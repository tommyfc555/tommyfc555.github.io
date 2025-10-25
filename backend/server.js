const express = require('express');
const http = require('http');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Fix for rate limiting behind proxy
app.set('trust proxy', 1);

// Enhanced Rate limiting
const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Increased from 1 to 3 per hour
  message: { error: 'Too many accounts created from this IP, please try again after an hour' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for certain conditions
    return req.method !== 'POST' && !req.path.includes('/auth/discord');
  }
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased from 100 to 200
  message: { error: 'Too many requests from this IP' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 auth attempts per 5 minutes
  message: { error: 'Too many authentication attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use(generalLimiter);
app.use('/auth/discord', authLimiter);

// Global variables for bot and ban system
let discordBot = null;
let BOT_TOKEN = '';
const bannedUsers = new Map();
const bannedIPs = new Map();
const bannedHWIDs = new Map();
const userViews = new Map();
const registrationAttempts = new Map();

// Discord OAuth Configuration
const DISCORD_CONFIG = {
    clientId: '1431237319112790158',
    clientSecret: 'HwGyRVit7PwUbxbzJdt5vBLOFwxbBw8n',
    redirectUri: 'https://tommyfc555-github-io.onrender.com/auth/discord/callback',
    scope: 'identify'
};

console.log('🎯 Discord OAuth Configuration:');
console.log('📋 Client ID:', DISCORD_CONFIG.clientId);
console.log('🔑 Client Secret: [SET]');
console.log('🌐 Redirect URI:', DISCORD_CONFIG.redirectUri);

// User storage
const users = new Map();
const sessions = new Map();
const userCreationLimits = new Map();

// Enhanced security headers
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'browsing-topics=(), run-ad-auction=(), join-ad-interest-group=(), private-state-token-redemption=(), private-state-token-issuance=(), private-aggregation=(), attribution-reporting=()');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

app.use(express.static('.'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Helper functions
function generateState() {
    return crypto.randomBytes(16).toString('hex');
}

function generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
}

function getClientIP(req) {
    return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
}

function generateHWID(req) {
    const ip = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    return crypto.createHash('md5').update(ip + userAgent).digest('hex');
}

// Enhanced registration attempt tracking
function trackRegistrationAttempt(identifier) {
    const now = Date.now();
    const attempts = registrationAttempts.get(identifier) || [];
    const recentAttempts = attempts.filter(time => now - time < 3600000);
    recentAttempts.push(now);
    registrationAttempts.set(identifier, recentAttempts);
    return recentAttempts.length;
}

function getRegistrationAttempts(identifier) {
    const now = Date.now();
    const attempts = registrationAttempts.get(identifier) || [];
    return attempts.filter(time => now - time < 3600000).length;
}

// Clean up old sessions and data
setInterval(() => {
    const now = Date.now();
    
    for (const [key, session] of sessions.entries()) {
        if (now - session.createdAt > 3600000) {
            sessions.delete(key);
        }
    }
    
    for (const [identifier, attempts] of registrationAttempts.entries()) {
        const recentAttempts = attempts.filter(time => now - time < 3600000);
        if (recentAttempts.length === 0) {
            registrationAttempts.delete(identifier);
        } else {
            registrationAttempts.set(identifier, recentAttempts);
        }
    }
    
    for (const [discordId, timestamp] of userCreationLimits.entries()) {
        if (now - timestamp > 24 * 60 * 60 * 1000) {
            userCreationLimits.delete(discordId);
        }
    }
}, 300000);

// Enhanced ban checking
function isUserBanned(discordId, req = null) {
    if (bannedUsers.has(discordId)) {
        const banInfo = bannedUsers.get(discordId);
        if (banInfo.expiresAt && Date.now() > banInfo.expiresAt) {
            bannedUsers.delete(discordId);
            return false;
        }
        return bannedUsers.get(discordId);
    }
    
    if (req) {
        const ip = getClientIP(req);
        if (bannedIPs.has(ip)) {
            const banInfo = bannedIPs.get(ip);
            if (banInfo.expiresAt && Date.now() > banInfo.expiresAt) {
                bannedIPs.delete(ip);
                return false;
            }
            return bannedIPs.get(ip);
        }
        
        const hwid = generateHWID(req);
        if (bannedHWIDs.has(hwid)) {
            const banInfo = bannedHWIDs.get(hwid);
            if (banInfo.expiresAt && Date.now() > banInfo.expiresAt) {
                bannedHWIDs.delete(hwid);
                return false;
            }
            return bannedHWIDs.get(hwid);
        }
    }
    
    return false;
}

// Get ban info for a user
function getBanInfo(discordId) {
    return bannedUsers.get(discordId) || null;
}

// Add views to a user
function addUserViews(username, count = 1) {
    const currentViews = userViews.get(username) || 0;
    userViews.set(username, currentViews + count);
}

// Get user views
function getUserViews(username) {
    return userViews.get(username) || 0;
}

// Load bot token from Pastebin
async function loadBotToken() {
    try {
        console.log('🔗 Loading bot token from Pastebin...');
        const response = await fetch('https://pastebin.com/raw/DARdvf5t');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const token = await response.text();
        BOT_TOKEN = token.trim();
        console.log('✅ Bot token loaded successfully');
        initializeBot();
    } catch (error) {
        console.error('❌ Failed to load bot token:', error);
    }
}

// Check if user has admin permissions
function isAdmin(userId) {
    const adminUsers = [
        '1415022792214052915',
        '1431237319112790158'
    ];
    return adminUsers.includes(userId);
}

// Find user by username or ID
function findUser(query) {
    if (users.has(query.toLowerCase())) {
        return users.get(query.toLowerCase());
    }
    
    for (const [username, userData] of users.entries()) {
        if (userData.discordData.id === query) {
            return userData;
        }
    }
    
    for (const [username, userData] of users.entries()) {
        if (userData.displayName.toLowerCase().includes(query.toLowerCase())) {
            return userData;
        }
    }
    
    return null;
}

// Initialize Discord bot
function initializeBot() {
    discordBot = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers
        ]
    });

    // Register slash commands
    const commands = [
        {
            name: 'ban',
            description: 'Ban a user from creating profiles',
            options: [
                {
                    name: 'user',
                    type: 3,
                    description: 'The username, user ID, or profile link to ban',
                    required: true
                },
                {
                    name: 'reason',
                    type: 3,
                    description: 'Reason for the ban',
                    required: false
                },
                {
                    name: 'duration',
                    type: 3,
                    description: 'Ban duration (e.g., 7d, 30d, permanent)',
                    required: false
                }
            ]
        },
        {
            name: 'unban',
            description: 'Unban a user',
            options: [
                {
                    name: 'user_id',
                    type: 3,
                    description: 'The Discord user ID to unban',
                    required: true
                }
            ]
        },
        {
            name: 'baninfo',
            description: 'Get ban information for a user',
            options: [
                {
                    name: 'user_id',
                    type: 3,
                    description: 'The Discord user ID to check',
                    required: true
                }
            ]
        },
        {
            name: 'userinfo',
            description: 'Get information about a user',
            options: [
                {
                    name: 'user',
                    type: 3,
                    description: 'The username, user ID, or profile link',
                    required: true
                }
            ]
        },
        {
            name: 'serverinfo',
            description: 'Get server information'
        },
        {
            name: 'cleanup',
            description: 'Clean up old sessions and data (Admin only)'
        },
        {
            name: 'stats',
            description: 'Show bot statistics'
        },
        {
            name: 'addviews',
            description: 'Add views to a user profile',
            options: [
                {
                    name: 'user',
                    type: 3,
                    description: 'The username to add views to',
                    required: true
                },
                {
                    name: 'count',
                    type: 4,
                    description: 'Number of views to add',
                    required: false
                }
            ]
        },
        {
            name: 'viewstats',
            description: 'View profile view statistics',
            options: [
                {
                    name: 'user',
                    type: 3,
                    description: 'The username to check views for',
                    required: false
                }
            ]
        },
        {
            name: 'settings',
            description: 'Manage bot settings (Admin only)',
            options: [
                {
                    name: 'setting',
                    type: 3,
                    description: 'Setting to change',
                    required: true,
                    choices: [
                        { name: 'Maintenance Mode', value: 'maintenance' },
                        { name: 'Registration', value: 'registration' },
                        { name: 'View Counter', value: 'viewcounter' }
                    ]
                },
                {
                    name: 'value',
                    type: 3,
                    description: 'Value for the setting (on/off)',
                    required: true,
                    choices: [
                        { name: 'On', value: 'on' },
                        { name: 'Off', value: 'off' }
                    ]
                }
            ]
        },
        {
            name: 'help',
            description: 'Show all available commands'
        }
    ];

    async function registerCommands() {
        try {
            const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
            console.log('🔨 Registering slash commands...');
            await rest.put(
                Routes.applicationCommands('1431237319112790158'),
                { body: commands }
            );
            console.log('✅ Slash commands registered successfully');
        } catch (error) {
            console.error('❌ Error registering commands:', error);
        }
    }

    // Bot settings
    const botSettings = {
        maintenance: false,
        registration: true,
        viewcounter: true
    };

    discordBot.once('ready', () => {
        console.log(`🤖 Logged in as ${discordBot.user.tag}`);
        registerCommands();
    });

    discordBot.on('interactionCreate', async interaction => {
        if (!interaction.isCommand()) return;

        const { commandName, options, user, guild } = interaction;
        const userIsAdmin = isAdmin(user.id);

        try {
            if (commandName === 'help') {
                const helpEmbed = new EmbedBuilder()
                    .setTitle('🤖 Discord Profile Bot Commands')
                    .setColor(0x5865F2)
                    .setDescription('Here are all the available commands:')
                    .addFields(
                        {
                            name: '🛠️ Admin Commands',
                            value: `
                            **/ban <user> [reason] [duration]** - Ban a user from creating profiles
                            **/unban <user_id>** - Unban a previously banned user
                            **/cleanup** - Clean up old sessions and data
                            **/settings <setting> <value>** - Manage bot settings
                            **/addviews <user> [count]** - Add views to a user profile
                            `,
                            inline: false
                        },
                        {
                            name: 'ℹ️ Info Commands',
                            value: `
                            **/baninfo <user_id>** - Get ban information for a user
                            **/userinfo <user>** - Get information about a user
                            **/serverinfo** - Get server information
                            **/stats** - Show bot statistics
                            **/viewstats [user]** - View profile view statistics
                            **/help** - Show this help message
                            `,
                            inline: false
                        }
                    )
                    .setFooter({ text: 'Admin commands are only available to authorized users' })
                    .setTimestamp();

                await interaction.reply({ 
                    embeds: [helpEmbed], 
                    ephemeral: true 
                });

            } else if (commandName === 'ban') {
                if (!userIsAdmin) {
                    return interaction.reply({ 
                        content: '❌ This command is only available to administrators.', 
                        ephemeral: true 
                    });
                }

                const userInput = options.getString('user');
                const reason = options.getString('reason') || 'No reason provided';
                const duration = options.getString('duration') || 'permanent';
                
                let username = userInput;
                if (userInput.includes('/')) {
                    const parts = userInput.split('/');
                    username = parts[parts.length - 1].toLowerCase();
                }
                
                const targetUserData = findUser(username);
                if (!targetUserData) {
                    return interaction.reply({ 
                        content: `❌ User "${userInput}" not found.`, 
                        ephemeral: true 
                    });
                }

                const targetUserId = targetUserData.discordData.id;
                const targetUsername = targetUserData.username;
                
                if (bannedUsers.has(targetUserId)) {
                    return interaction.reply({ 
                        content: `❌ User ${targetUserData.displayName} is already banned.`, 
                        ephemeral: true 
                    });
                }

                // Calculate expiration date
                let expiresAt = null;
                if (duration !== 'permanent') {
                    const match = duration.match(/^(\d+)([dhm])$/);
                    if (match) {
                        const [, amount, unit] = match;
                        let ms = parseInt(amount);
                        switch (unit) {
                            case 'd': ms *= 24 * 60 * 60 * 1000; break;
                            case 'h': ms *= 60 * 60 * 1000; break;
                            case 'm': ms *= 60 * 1000; break;
                        }
                        expiresAt = Date.now() + ms;
                    }
                }

                bannedUsers.set(targetUserId, {
                    reason: reason,
                    bannedBy: user.tag,
                    bannedAt: new Date().toISOString(),
                    userId: targetUserId,
                    username: targetUsername,
                    displayName: targetUserData.displayName,
                    expiresAt: expiresAt,
                    duration: duration
                });

                const embed = new EmbedBuilder()
                    .setTitle('✅ User Banned')
                    .setColor(0xED4245)
                    .setDescription(`Successfully banned ${targetUserData.displayName}`)
                    .addFields(
                        { name: 'User ID', value: targetUserId, inline: true },
                        { name: 'Username', value: targetUsername, inline: true },
                        { name: 'Reason', value: reason, inline: true },
                        { name: 'Duration', value: duration, inline: true },
                        { name: 'Banned By', value: user.tag, inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ 
                    embeds: [embed]
                });

            } else if (commandName === 'unban') {
                if (!userIsAdmin) {
                    return interaction.reply({ 
                        content: '❌ This command is only available to administrators.', 
                        ephemeral: true 
                    });
                }

                const userId = options.getString('user_id');
                
                if (!bannedUsers.has(userId)) {
                    return interaction.reply({ 
                        content: `❌ User with ID \`${userId}\` is not banned.`, 
                        ephemeral: true 
                    });
                }

                const banInfo = bannedUsers.get(userId);
                bannedUsers.delete(userId);

                const embed = new EmbedBuilder()
                    .setTitle('✅ User Unbanned')
                    .setColor(0x57F287)
                    .setDescription(`Successfully unbanned user`)
                    .addFields(
                        { name: 'User ID', value: userId, inline: true },
                        { name: 'Previously Banned By', value: banInfo.bannedBy, inline: true },
                        { name: 'Ban Reason', value: banInfo.reason, inline: true },
                        { name: 'Unbanned By', value: user.tag, inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ 
                    embeds: [embed]
                });

            } else if (commandName === 'baninfo') {
                if (!userIsAdmin) {
                    return interaction.reply({ 
                        content: '❌ This command is only available to administrators.', 
                        ephemeral: true 
                    });
                }

                const userId = options.getString('user_id');
                const banInfo = bannedUsers.get(userId);
                
                if (!banInfo) {
                    return interaction.reply({ 
                        content: `✅ User with ID \`${userId}\` is not banned.`, 
                        ephemeral: true 
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🔍 Ban Information')
                    .setColor(0xFEE75C)
                    .addFields(
                        { name: 'User ID', value: userId, inline: true },
                        { name: 'Username', value: banInfo.username || 'Unknown', inline: true },
                        { name: 'Display Name', value: banInfo.displayName || 'Unknown', inline: true },
                        { name: 'Banned By', value: banInfo.bannedBy, inline: true },
                        { name: 'Reason', value: banInfo.reason, inline: false },
                        { name: 'Duration', value: banInfo.duration || 'Permanent', inline: true },
                        { name: 'Banned At', value: new Date(banInfo.bannedAt).toLocaleString(), inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ 
                    embeds: [embed],
                    ephemeral: true 
                });

            } else if (commandName === 'userinfo') {
                const userInput = options.getString('user');
                
                let username = userInput;
                if (userInput.includes('/')) {
                    const parts = userInput.split('/');
                    username = parts[parts.length - 1].toLowerCase();
                }
                
                const targetUserData = findUser(username);
                if (!targetUserData) {
                    return interaction.reply({ 
                        content: `❌ User "${userInput}" not found.`, 
                        ephemeral: true 
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('👤 User Information')
                    .setColor(0x5865F2)
                    .setThumbnail(targetUserData.discordData.avatar ? 
                        `https://cdn.discordapp.com/avatars/${targetUserData.discordData.id}/${targetUserData.discordData.avatar}.webp?size=256` : 
                        `https://cdn.discordapp.com/embed/avatars/${targetUserData.discordData.discriminator % 5}.png`)
                    .addFields(
                        { name: 'Display Name', value: targetUserData.displayName, inline: true },
                        { name: 'Username', value: targetUserData.username, inline: true },
                        { name: 'Discord ID', value: targetUserData.discordData.id, inline: true },
                        { name: 'Profile URL', value: `https://tommyfc555-github-io.onrender.com/${targetUserData.username}`, inline: false },
                        { name: 'Account Created', value: `<t:${Math.floor(new Date(targetUserData.discordData.id / 4194304 + 1420070400000).getTime() / 1000)}:R>`, inline: true },
                        { name: 'Profile Views', value: getUserViews(targetUserData.username).toString(), inline: true },
                        { name: 'Verified', value: targetUserData.discordData.verified ? 'Yes' : 'No', inline: true }
                    )
                    .setFooter({ text: `Requested by ${user.tag}` })
                    .setTimestamp();

                await interaction.reply({ 
                    embeds: [embed] 
                });

            } else if (commandName === 'serverinfo') {
                if (!guild) {
                    return interaction.reply({ 
                        content: '❌ This command can only be used in a server.', 
                        ephemeral: true 
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🏠 Server Information')
                    .setColor(0x5865F2)
                    .setThumbnail(guild.iconURL())
                    .addFields(
                        { name: 'Server Name', value: guild.name, inline: true },
                        { name: 'Server ID', value: guild.id, inline: true },
                        { name: 'Member Count', value: guild.memberCount.toString(), inline: true },
                        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                        { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
                        { name: 'Boost Level', value: `Level ${guild.premiumTier}`, inline: true }
                    )
                    .setFooter({ text: `Requested by ${user.tag}` })
                    .setTimestamp();

                await interaction.reply({ 
                    embeds: [embed] 
                });

            } else if (commandName === 'stats') {
                const totalUsers = users.size;
                const totalBans = bannedUsers.size;
                const totalSessions = sessions.size;
                const totalViews = Array.from(userViews.values()).reduce((a, b) => a + b, 0);

                const embed = new EmbedBuilder()
                    .setTitle('📊 Bot Statistics')
                    .setColor(0x5865F2)
                    .addFields(
                        { name: 'Total Profiles', value: totalUsers.toString(), inline: true },
                        { name: 'Active Bans', value: totalBans.toString(), inline: true },
                        { name: 'Active Sessions', value: totalSessions.toString(), inline: true },
                        { name: 'Total Views', value: totalViews.toString(), inline: true },
                        { name: 'Uptime', value: formatUptime(process.uptime()), inline: true },
                        { name: 'Memory Usage', value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true }
                    )
                    .setFooter({ text: 'Discord Profile Bot' })
                    .setTimestamp();

                await interaction.reply({ 
                    embeds: [embed] 
                });

            } else if (commandName === 'cleanup') {
                if (!userIsAdmin) {
                    return interaction.reply({ 
                        content: '❌ This command is only available to administrators.', 
                        ephemeral: true 
                    });
                }

                const now = Date.now();
                let cleanedSessions = 0;
                let cleanedLimits = 0;

                for (const [key, session] of sessions.entries()) {
                    if (now - session.createdAt > 3600000) {
                        sessions.delete(key);
                        cleanedSessions++;
                    }
                }

                for (const [discordId, timestamp] of userCreationLimits.entries()) {
                    if (now - timestamp > 24 * 60 * 60 * 1000) {
                        userCreationLimits.delete(discordId);
                        cleanedLimits++;
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle('🧹 Cleanup Completed')
                    .setColor(0x57F287)
                    .addFields(
                        { name: 'Sessions Cleaned', value: cleanedSessions.toString(), inline: true },
                        { name: 'Rate Limits Cleaned', value: cleanedLimits.toString(), inline: true },
                        { name: 'Remaining Sessions', value: sessions.size.toString(), inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ 
                    embeds: [embed] 
                });

            } else if (commandName === 'addviews') {
                if (!userIsAdmin) {
                    return interaction.reply({ 
                        content: '❌ This command is only available to administrators.', 
                        ephemeral: true 
                    });
                }

                const username = options.getString('user').toLowerCase();
                const count = options.getInteger('count') || 1;

                if (!users.has(username)) {
                    return interaction.reply({ 
                        content: `❌ User "${username}" not found.`, 
                        ephemeral: true 
                    });
                }

                addUserViews(username, count);
                const newViews = getUserViews(username);

                const embed = new EmbedBuilder()
                    .setTitle('👀 Views Added')
                    .setColor(0x5865F2)
                    .addFields(
                        { name: 'Username', value: username, inline: true },
                        { name: 'Views Added', value: count.toString(), inline: true },
                        { name: 'Total Views', value: newViews.toString(), inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ 
                    embeds: [embed] 
                });

            } else if (commandName === 'viewstats') {
                const username = options.getString('user');
                
                if (username) {
                    const userData = findUser(username.toLowerCase());
                    if (!userData) {
                        return interaction.reply({ 
                            content: `❌ User "${username}" not found.`, 
                            ephemeral: true 
                        });
                    }

                    const views = getUserViews(userData.username);

                    const embed = new EmbedBuilder()
                        .setTitle('📊 View Statistics')
                        .setColor(0x5865F2)
                        .addFields(
                            { name: 'Username', value: userData.username, inline: true },
                            { name: 'Display Name', value: userData.displayName, inline: true },
                            { name: 'Total Views', value: views.toString(), inline: true }
                        )
                        .setTimestamp();

                    await interaction.reply({ 
                        embeds: [embed] 
                    });
                } else {
                    const topUsers = Array.from(users.entries())
                        .map(([username, userData]) => ({
                            username,
                            displayName: userData.displayName,
                            views: getUserViews(username)
                        }))
                        .sort((a, b) => b.views - a.views)
                        .slice(0, 10);

                    const totalViews = Array.from(userViews.values()).reduce((a, b) => a + b, 0);

                    const embed = new EmbedBuilder()
                        .setTitle('📊 Top Profile Views')
                        .setColor(0x5865F2)
                        .setDescription(`Total views across all profiles: **${totalViews}**`)
                        .addFields(
                            topUsers.map((user, index) => ({
                                name: `${index + 1}. ${user.displayName}`,
                                value: `@${user.username} - ${user.views} views`,
                                inline: false
                            }))
                        )
                        .setTimestamp();

                    await interaction.reply({ 
                        embeds: [embed] 
                    });
                }

            } else if (commandName === 'settings') {
                if (!userIsAdmin) {
                    return interaction.reply({ 
                        content: '❌ This command is only available to administrators.', 
                        ephemeral: true 
                    });
                }

                const setting = options.getString('setting');
                const value = options.getString('value');
                const newValue = value === 'on';

                if (!botSettings.hasOwnProperty(setting)) {
                    return interaction.reply({ 
                        content: `❌ Invalid setting: ${setting}`, 
                        ephemeral: true 
                    });
                }

                botSettings[setting] = newValue;

                const embed = new EmbedBuilder()
                    .setTitle('⚙️ Bot Settings Updated')
                    .setColor(0x5865F2)
                    .addFields(
                        { name: 'Setting', value: setting, inline: true },
                        { name: 'New Value', value: newValue ? 'Enabled' : 'Disabled', inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ 
                    embeds: [embed] 
                });
            }
        } catch (error) {
            console.error('Error handling command:', error);
            await interaction.reply({ 
                content: '❌ An error occurred while executing this command.', 
                ephemeral: true 
            });
        }
    });

    discordBot.login(BOT_TOKEN).catch(error => {
        console.error('❌ Bot login failed:', error);
    });
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.join(' ') || '0m';
}

// Serve homepage
app.get('/', (req, res) => {
    const { username } = req.query;
    
    if (username && users.has(username.toLowerCase())) {
        return res.redirect('/' + username.toLowerCase());
    }
    
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Discord Profile - Home</title>
        <meta name="robots" content="noindex, nofollow">
        <meta name="referrer" content="no-referrer">
        <meta http-equiv="Permissions-Policy" content="browsing-topics=(), run-ad-auction=(), join-ad-interest-group=(), private-state-token-redemption=(), private-state-token-issuance=(), private-aggregation=(), attribution-reporting=()">
        
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                -webkit-tap-highlight-color: transparent;
            }
            
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
            
            :root {
                --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                --discord-blurple: #5865F2;
                --discord-green: #57F287;
                --discord-yellow: #FEE75C;
                --discord-red: #ED4245;
                --discord-gray: #747f8d;
                --text-primary: #ffffff;
                --text-secondary: #b9bbbe;
                --text-tertiary: #72767d;
                --bg-glass: rgba(0, 0, 0, 0.5);
                --border-glass: rgba(255, 255, 255, 0.1);
                --shadow-glass: 0 8px 32px rgba(0, 0, 0, 0.3);
            }
            
            body {
                background: #000;
                color: var(--text-primary);
                min-height: 100vh;
                overflow: auto;
                position: relative;
            }
            
            .background-video {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                z-index: -1;
                filter: brightness(0.6);
            }
            
            .navbar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: var(--bg-glass);
                backdrop-filter: blur(20px);
                border-bottom: 1px solid var(--border-glass);
                padding: 15px 30px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                z-index: 1000;
            }
            
            .logo {
                font-size: 1.4em;
                font-weight: 800;
                background: linear-gradient(135deg, #fff, var(--discord-blurple));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            
            .nav-links {
                display: flex;
                gap: 20px;
                align-items: center;
            }
            
            .nav-link {
                color: var(--text-secondary);
                text-decoration: none;
                font-weight: 500;
                font-size: 0.9em;
                transition: color 0.3s ease;
                padding: 8px 16px;
                border-radius: 8px;
            }
            
            .nav-link:hover {
                color: var(--text-primary);
                background: rgba(255, 255, 255, 0.1);
            }
            
            .login-btn {
                background: var(--discord-blurple);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 10px 20px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
                font-size: 0.9em;
            }
            
            .login-btn:hover {
                background: #4752c4;
                transform: translateY(-2px);
            }
            
            .hero-section {
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 100px 30px 50px;
            }
            
            .hero-content {
                max-width: 800px;
            }
            
            .hero-title {
                font-size: 4em;
                font-weight: 800;
                background: linear-gradient(135deg, #fff, var(--discord-blurple), #ff6b6b);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 20px;
                line-height: 1.1;
                animation: glow 2s ease-in-out infinite alternate;
            }
            
            @keyframes glow {
                from {
                    text-shadow: 0 0 20px rgba(88, 101, 242, 0.5);
                }
                to {
                    text-shadow: 0 0 30px rgba(88, 101, 242, 0.8), 0 0 40px rgba(88, 101, 242, 0.6);
                }
            }
            
            .hero-subtitle {
                font-size: 1.5em;
                color: var(--text-secondary);
                margin-bottom: 10px;
                font-weight: 400;
            }
            
            .hero-description {
                font-size: 1.2em;
                color: var(--text-tertiary);
                margin-bottom: 40px;
                line-height: 1.6;
            }
            
            .username-form {
                background: var(--bg-glass);
                backdrop-filter: blur(20px);
                border: 1px solid var(--border-glass);
                border-radius: 20px;
                padding: 40px;
                max-width: 500px;
                margin: 0 auto 40px;
                box-shadow: var(--shadow-glass);
            }
            
            .form-title {
                font-size: 1.5em;
                font-weight: 700;
                margin-bottom: 25px;
                color: var(--text-primary);
            }
            
            .input-group {
                margin-bottom: 25px;
            }
            
            .username-input {
                width: 100%;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid var(--border-glass);
                border-radius: 12px;
                padding: 16px 20px;
                color: var(--text-primary);
                font-size: 1.1em;
                transition: all 0.3s ease;
            }
            
            .username-input:focus {
                outline: none;
                border-color: var(--discord-blurple);
                background: rgba(255, 255, 255, 0.15);
                transform: translateY(-2px);
                box-shadow: 0 10px 25px rgba(88, 101, 242, 0.2);
            }
            
            .username-input::placeholder {
                color: var(--text-tertiary);
            }
            
            .cta-buttons {
                display: flex;
                gap: 20px;
                justify-content: center;
                flex-wrap: wrap;
            }
            
            .cta-primary {
                background: var(--discord-blurple);
                color: white;
                border: none;
                border-radius: 15px;
                padding: 18px 40px;
                font-size: 1.2em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
                display: inline-block;
            }
            
            .cta-primary:hover {
                background: #4752c4;
                transform: translateY(-5px);
                box-shadow: 0 15px 35px rgba(88, 101, 242, 0.4);
            }
            
            .cta-secondary {
                background: rgba(255, 255, 255, 0.1);
                color: var(--text-primary);
                border: 1px solid var(--border-glass);
                border-radius: 15px;
                padding: 18px 40px;
                font-size: 1.2em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
                display: inline-block;
            }
            
            .cta-secondary:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-5px);
                box-shadow: 0 15px 35px rgba(255, 255, 255, 0.1);
            }
            
            .features-section {
                padding: 100px 30px;
                background: rgba(0, 0, 0, 0.3);
            }
            
            .section-title {
                text-align: center;
                font-size: 3em;
                font-weight: 800;
                margin-bottom: 60px;
                background: linear-gradient(135deg, #fff, var(--discord-blurple));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            
            .features-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 40px;
                max-width: 1200px;
                margin: 0 auto;
            }
            
            .feature-card {
                background: var(--bg-glass);
                backdrop-filter: blur(20px);
                border: 1px solid var(--border-glass);
                border-radius: 20px;
                padding: 40px 30px;
                text-align: center;
                transition: all 0.3s ease;
            }
            
            .feature-card:hover {
                transform: translateY(-10px);
                box-shadow: var(--shadow-glass);
                border-color: var(--discord-blurple);
            }
            
            .feature-icon {
                font-size: 3em;
                margin-bottom: 20px;
            }
            
            .feature-title {
                font-size: 1.4em;
                font-weight: 700;
                margin-bottom: 15px;
                color: var(--text-primary);
            }
            
            .feature-desc {
                color: var(--text-secondary);
                font-size: 1em;
                line-height: 1.6;
            }
            
            .stats-section {
                padding: 80px 30px;
                text-align: center;
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 30px;
                max-width: 1000px;
                margin: 0 auto;
            }
            
            .stat-card {
                background: var(--bg-glass);
                backdrop-filter: blur(20px);
                border: 1px solid var(--border-glass);
                border-radius: 15px;
                padding: 30px;
            }
            
            .stat-number {
                font-size: 2.5em;
                font-weight: 800;
                color: var(--discord-blurple);
                margin-bottom: 10px;
            }
            
            .stat-label {
                color: var(--text-secondary);
                font-size: 1.1em;
            }
            
            .error-message {
                position: fixed;
                top: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(237, 66, 69, 0.9);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.3);
                z-index: 1000;
                font-size: 0.9em;
                font-weight: 500;
                display: none;
            }
            
            .success-message {
                position: fixed;
                top: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(87, 242, 135, 0.9);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.3);
                z-index: 1000;
                font-size: 0.9em;
                font-weight: 500;
                display: none;
            }

            .floating-shapes {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: -1;
            }
            
            .shape {
                position: absolute;
                opacity: 0.1;
                animation: float 6s ease-in-out infinite;
            }
            
            .shape:nth-child(1) {
                top: 20%;
                left: 10%;
                animation-delay: 0s;
            }
            
            .shape:nth-child(2) {
                top: 60%;
                right: 10%;
                animation-delay: 2s;
            }
            
            .shape:nth-child(3) {
                bottom: 20%;
                left: 20%;
                animation-delay: 4s;
            }
            
            @keyframes float {
                0%, 100% {
                    transform: translateY(0px) rotate(0deg);
                }
                50% {
                    transform: translateY(-20px) rotate(180deg);
                }
            }

            .footer {
                background: var(--bg-glass);
                backdrop-filter: blur(20px);
                border-top: 1px solid var(--border-glass);
                padding: 40px 30px;
                text-align: center;
                color: var(--text-secondary);
            }

            .banned-message {
                background: rgba(237, 66, 69, 0.9);
                color: white;
                padding: 20px;
                border-radius: 10px;
                margin: 20px auto;
                max-width: 500px;
                text-align: center;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.3);
            }
        </style>
    </head>
    <body>
        <div class="error-message" id="errorMessage"></div>
        <div class="success-message" id="successMessage"></div>
        
        <video class="background-video" autoplay muted loop playsinline id="backgroundVideo">
            <source src="https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&" type="video/mp4">
        </video>

        <div class="floating-shapes">
            <div class="shape" style="font-size: 100px;">🎮</div>
            <div class="shape" style="font-size: 80px;">🌟</div>
            <div class="shape" style="font-size: 120px;">⚡</div>
        </div>

        <nav class="navbar">
            <div class="logo">DiscordProfile</div>
            <div class="nav-links">
                <a href="/" class="nav-link">Home</a>
                <a href="#features" class="nav-link">Features</a>
                <a href="#stats" class="nav-link">Stats</a>
                <a href="#" class="login-btn" id="registerBtn">Get Started</a>
            </div>
        </nav>

        <section class="hero-section">
            <div class="hero-content">
                <h1 class="hero-title">Elevate Your Discord Presence</h1>
                <p class="hero-subtitle">Create stunning profile pages that stand out</p>
                <p class="hero-description">Transform your Discord identity into a beautiful, customizable profile page. Showcase your badges, stats, and personality with stunning visuals and animations.</p>
                
                <div class="username-form">
                    <h3 class="form-title">Claim Your Unique Profile</h3>
                    <div class="input-group">
                        <input type="text" class="username-input" id="usernameInput" placeholder="Enter your desired username (e.g., hwid)" maxlength="20">
                    </div>
                    <button class="cta-primary" onclick="registerUser()">Create My Profile →</button>
                </div>
                
                <div class="cta-buttons">
                    <a href="#features" class="cta-secondary">Explore Features</a>
                    <a href="#stats" class="cta-secondary">View Examples</a>
                </div>
            </div>
        </section>

        <section id="features" class="features-section">
            <h2 class="section-title">Amazing Features</h2>
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">🎨</div>
                    <h3 class="feature-title">Custom Profiles</h3>
                    <p class="feature-desc">Get your own personalized profile URL with custom backgrounds, colors, and layouts that reflect your style.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🏆</div>
                    <h3 class="feature-title">Badge Showcase</h3>
                    <p class="feature-desc">Display all your Discord badges and achievements in an elegant, organized way that impresses visitors.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">⚡</div>
                    <h3 class="feature-title">Lightning Fast</h3>
                    <p class="feature-desc">Optimized for speed with instant loading times and smooth animations for the best user experience.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🔒</div>
                    <h3 class="feature-title">Secure & Private</h3>
                    <p class="feature-desc">Built with security in mind. Your data is protected with secure Discord OAuth integration.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🎵</div>
                    <h3 class="feature-title">Background Music</h3>
                    <p class="feature-desc">Add custom background music to your profile to create an immersive experience for your visitors.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">📱</div>
                    <h3 class="feature-title">Mobile Friendly</h3>
                    <p class="feature-desc">Perfectly responsive design that looks amazing on all devices, from desktop to mobile.</p>
                </div>
            </div>
        </section>

        <section id="stats" class="stats-section">
            <h2 class="section-title">Why Choose Us</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">∞</div>
                    <div class="stat-label">Customization Options</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">100%</div>
                    <div class="stat-label">Free Forever</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">⚡</div>
                    <div class="stat-label">Instant Setup</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">24/7</div>
                    <div class="stat-label">Active Support</div>
                </div>
            </div>
        </section>

        <footer class="footer">
            <p>&copy; 2024 DiscordProfile. All rights reserved. | Made with ❤️ for the Discord community</p>
        </footer>

        <script>
            function showError(message) {
                const errorMessage = document.getElementById('errorMessage');
                errorMessage.textContent = message;
                errorMessage.style.display = 'block';
                setTimeout(() => {
                    errorMessage.style.display = 'none';
                }, 5000);
            }
            
            function showSuccess(message) {
                const successMessage = document.getElementById('successMessage');
                successMessage.textContent = message;
                successMessage.style.display = 'block';
                setTimeout(() => {
                    successMessage.style.display = 'none';
                }, 5000);
            }
            
            function registerUser() {
                const usernameInput = document.getElementById('usernameInput');
                const username = usernameInput.value.trim().toLowerCase();
                
                if (!username) {
                    showError('Please enter a username');
                    return;
                }
                
                if (username.length < 3) {
                    showError('Username must be at least 3 characters long');
                    return;
                }
                
                if (!/^[a-z0-9_-]+$/.test(username)) {
                    showError('Username can only contain letters, numbers, hyphens, and underscores');
                    return;
                }
                
                sessionStorage.setItem('registeringUsername', username);
                window.location.href = '/auth/discord?username=' + encodeURIComponent(username);
            }
            
            const urlParams = new URLSearchParams(window.location.search);
            const error = urlParams.get('error');
            
            if (error === 'banned') {
                showError('Your account has been banned from creating profiles.');
            } else if (error === 'rate_limit') {
                showError('You can only create one profile per day. Please try again tomorrow.');
            } else if (error === 'username_taken') {
                showError('This username is already taken. Please choose another one.');
            } else if (error) {
                showError('Registration failed. Please try again.');
            }
            
            document.getElementById('registerBtn').addEventListener('click', function(e) {
                e.preventDefault();
                document.getElementById('usernameInput').focus();
            });
            
            document.getElementById('usernameInput').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    registerUser();
                }
            });

            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function (e) {
                    e.preventDefault();
                    const target = document.querySelector(this.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                });
            });
        </script>
    </body>
    </html>
    `);
});

// Discord OAuth Routes
app.get('/auth/discord', createAccountLimiter, (req, res) => {
    const state = generateState();
    const registeringUsername = req.query.username || 'user';
    
    const clientIP = getClientIP(req);
    const hwid = generateHWID(req);
    
    // Enhanced ban checking
    if (bannedIPs.has(clientIP)) {
        const banInfo = bannedIPs.get(clientIP);
        if (banInfo.expiresAt && Date.now() > banInfo.expiresAt) {
            bannedIPs.delete(clientIP);
        } else {
            return res.redirect('/?error=banned');
        }
    }
    
    if (bannedHWIDs.has(hwid)) {
        const banInfo = bannedHWIDs.get(hwid);
        if (banInfo.expiresAt && Date.now() > banInfo.expiresAt) {
            bannedHWIDs.delete(hwid);
        } else {
            return res.redirect('/?error=banned');
        }
    }
    
    // Check registration attempts
    const ipAttempts = getRegistrationAttempts(clientIP);
    const hwidAttempts = getRegistrationAttempts(hwid);
    
    if (ipAttempts > 5 || hwidAttempts > 5) {
        return res.redirect('/?error=rate_limit');
    }
    
    sessions.set(state, { 
        createdAt: Date.now(),
        registering: true,
        desiredUsername: registeringUsername,
        clientIP: clientIP,
        hwid: hwid
    });
    
    trackRegistrationAttempt(clientIP);
    trackRegistrationAttempt(hwid);
    
    const discordAuthUrl = 'https://discord.com/api/oauth2/authorize?client_id=' + DISCORD_CONFIG.clientId + '&redirect_uri=' + encodeURIComponent(DISCORD_CONFIG.redirectUri) + '&response_type=code&scope=identify&state=' + state;
    
    console.log('🔗 Redirecting to Discord OAuth...');
    res.redirect(discordAuthUrl);
});

app.get('/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;
    
    console.log('🔄 OAuth callback received');
    
    if (!code) {
        return res.redirect('/?error=missing_code');
    }
    
    try {
        const sessionState = sessions.get(state);
        if (!sessionState) {
            return res.redirect('/?error=invalid_state');
        }
        
        console.log('🔑 Exchanging code for token...');
        
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: DISCORD_CONFIG.clientId,
                client_secret: DISCORD_CONFIG.clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: DISCORD_CONFIG.redirectUri,
            }),
        });
        
        const tokenData = await tokenResponse.json();
        
        console.log('🔑 Token response status:', tokenResponse.status);
        
        if (!tokenData.access_token) {
            console.log('❌ Token exchange failed:', tokenData);
            return res.redirect('/?error=token_failed');
        }
        
        // Get user data
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: 'Bearer ' + tokenData.access_token,
            },
        });
        
        const userData = await userResponse.json();
        
        if (userData.message) {
            return res.redirect('/?error=user_fetch_failed');
        }
        
        // Enhanced ban checking
        const banInfo = isUserBanned(userData.id, req);
        if (banInfo) {
            bannedIPs.set(sessionState.clientIP, {
                reason: 'Associated with banned user',
                bannedBy: 'System',
                bannedAt: new Date().toISOString(),
                originalUser: userData.id,
                expiresAt: null
            });
            
            bannedHWIDs.set(sessionState.hwid, {
                reason: 'Associated with banned user',
                bannedBy: 'System',
                bannedAt: new Date().toISOString(),
                originalUser: userData.id,
                expiresAt: null
            });
            
            return res.redirect('/?error=banned');
        }
        
        // Enhanced rate limiting
        const lastCreation = userCreationLimits.get(userData.id);
        if (lastCreation && (Date.now() - lastCreation) < 24 * 60 * 60 * 1000) {
            return res.redirect('/?error=rate_limit');
        }
        
        // Get the desired username from session state
        let username = sessionState.desiredUsername.toLowerCase();
        
        // Enhanced username availability check
        if (users.has(username)) {
            // Try adding discriminator
            const discriminator = userData.discriminator;
            let newUsername = username + '-' + discriminator;
            
            if (users.has(newUsername)) {
                // If still taken, generate random suffix
                const randomSuffix = Math.random().toString(36).substring(2, 6);
                newUsername = username + '-' + randomSuffix;
            }
            
            username = newUsername;
        }
        
        // Create user record with enhanced settings
        const userRecord = {
            discordData: userData,
            access_token: tokenData.access_token,
            username: username,
            displayName: userData.global_name || userData.username,
            createdAt: Date.now(),
            profileViews: 0,
            settings: {
                bio: '',
                background: 'https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&',
                music: '',
                showBadges: true,
                showStats: true,
                showSocialLinks: true,
                customCSS: '',
                customHTML: '',
                theme: 'default',
                layout: 'classic',
                socialLinks: {
                    instagram: '',
                    twitter: '',
                    youtube: '',
                    github: '',
                    twitch: '',
                    tiktok: ''
                }
            }
        };
        
        users.set(username, userRecord);
        userCreationLimits.set(userData.id, Date.now());
        
        console.log('✅ User registered:', username);
        
        // Create session for the user
        const sessionId = generateSessionId();
        sessions.set(sessionId, {
            userId: userData.id,
            username: username,
            createdAt: Date.now()
        });
        
        // Set session cookie
        res.cookie('session', sessionId, { 
            httpOnly: true, 
            maxAge: 3600000,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        
        // Redirect to settings page for new users
        res.redirect('/' + username + '/settings?new=true');
        
    } catch (error) {
        console.error('❌ OAuth error:', error);
        res.redirect('/?error=auth_failed');
    }
});

// Middleware to check if user owns the profile
function checkProfileOwnership(req, res, next) {
    const { username } = req.params;
    const sessionId = req.cookies?.session;
    
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(403).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Access Denied</title>
                <style>
                    body { 
                        background: #000; 
                        color: white; 
                        font-family: Arial; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        height: 100vh; 
                        margin: 0; 
                    }
                    .message { 
                        text-align: center; 
                        background: rgba(255,255,255,0.1); 
                        padding: 40px; 
                        border-radius: 10px; 
                        backdrop-filter: blur(10px);
                    }
                    a { 
                        color: #5865F2; 
                        text-decoration: none; 
                    }
                </style>
            </head>
            <body>
                <div class="message">
                    <h2>Access Denied</h2>
                    <p>Please log in to access settings.</p>
                    <a href="/">← Back to Home</a>
                </div>
            </body>
            </html>
        `);
    }
    
    const session = sessions.get(sessionId);
    const user = users.get(session.username);
    
    if (!user || user.username !== username.toLowerCase()) {
        return res.status(403).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Access Denied</title>
                <style>
                    body { 
                        background: #000; 
                        color: white; 
                        font-family: Arial; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        height: 100vh; 
                        margin: 0; 
                    }
                    .message { 
                        text-align: center; 
                        background: rgba(255,255,255,0.1); 
                        padding: 40px; 
                        border-radius: 10px; 
                        backdrop-filter: blur(10px);
                    }
                    a { 
                        color: #5865F2; 
                        text-decoration: none; 
                    }
                </style>
            </head>
            <body>
                <div class="message">
                    <h2>Access Denied</h2>
                    <p>You can only edit your own profile settings.</p>
                    <a href="/${username}">← Back to Profile</a>
                </div>
            </body>
            </html>
        `);
    }
    
    req.user = user;
    req.sessionId = sessionId;
    next();
}

// Enhanced Settings page
app.get('/:username/settings', checkProfileOwnership, (req, res) => {
    const user = req.user;
    const isNew = req.query.new === 'true';
    
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Settings - ${user.displayName}'s Profile</title>
        <meta name="robots" content="noindex, nofollow">
        <meta name="referrer" content="no-referrer">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            
            :root {
                --discord-blurple: #5865F2;
                --discord-green: #57F287;
                --discord-red: #ED4245;
                --bg-primary: #0a0a0a;
                --bg-secondary: #1a1a1a;
                --bg-tertiary: #2a2a2a;
                --text-primary: #ffffff;
                --text-secondary: #b9bbbe;
                --text-tertiary: #72767d;
                --border: rgba(255,255,255,0.1);
            }
            
            body {
                background: var(--bg-primary);
                color: var(--text-primary);
                min-height: 100vh;
                padding: 20px;
            }
            
            .settings-container {
                max-width: 1000px;
                margin: 0 auto;
                background: var(--bg-secondary);
                border-radius: 16px;
                overflow: hidden;
                border: 1px solid var(--border);
            }
            
            .settings-header {
                background: var(--bg-tertiary);
                padding: 30px;
                border-bottom: 1px solid var(--border);
            }
            
            .back-button {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                color: var(--text-secondary);
                text-decoration: none;
                margin-bottom: 20px;
                transition: color 0.3s ease;
            }
            
            .back-button:hover {
                color: var(--text-primary);
            }
            
            .header-content {
                display: flex;
                align-items: center;
                gap: 20px;
            }
            
            .profile-pic {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                object-fit: cover;
                border: 3px solid var(--discord-blurple);
            }
            
            .header-text h1 {
                font-size: 2em;
                margin-bottom: 5px;
            }
            
            .header-text p {
                color: var(--text-secondary);
            }
            
            .settings-content {
                padding: 30px;
                display: grid;
                gap: 30px;
            }
            
            .settings-section {
                background: var(--bg-tertiary);
                border-radius: 12px;
                padding: 25px;
                border: 1px solid var(--border);
            }
            
            .section-title {
                font-size: 1.3em;
                font-weight: 600;
                margin-bottom: 20px;
                color: var(--text-primary);
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            .form-label {
                display: block;
                margin-bottom: 8px;
                color: var(--text-secondary);
                font-weight: 500;
            }
            
            .form-input, .form-textarea, .form-select {
                width: 100%;
                padding: 12px 16px;
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: 8px;
                color: var(--text-primary);
                font-size: 14px;
                transition: all 0.3s ease;
            }
            
            .form-input:focus, .form-textarea:focus, .form-select:focus {
                outline: none;
                border-color: var(--discord-blurple);
                box-shadow: 0 0 0 2px rgba(88, 101, 242, 0.2);
            }
            
            .form-textarea {
                min-height: 100px;
                resize: vertical;
            }
            
            .checkbox-group {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 15px;
            }
            
            .checkbox {
                width: 18px;
                height: 18px;
                accent-color: var(--discord-blurple);
            }
            
            .social-links-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-top: 15px;
            }
            
            .save-button {
                background: var(--discord-blurple);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 14px 28px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }
            
            .save-button:hover {
                background: #4752c4;
                transform: translateY(-2px);
            }
            
            .save-button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            .message {
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 20px;
                display: none;
            }
            
            .message.success {
                background: rgba(87, 242, 135, 0.1);
                border: 1px solid rgba(87, 242, 135, 0.3);
                color: var(--discord-green);
            }
            
            .message.error {
                background: rgba(237, 66, 69, 0.1);
                border: 1px solid rgba(237, 66, 69, 0.3);
                color: var(--discord-red);
            }
            
            .preview-section {
                background: var(--bg-tertiary);
                border-radius: 12px;
                padding: 25px;
                border: 1px solid var(--border);
                margin-top: 20px;
            }
            
            .preview-title {
                font-size: 1.2em;
                margin-bottom: 15px;
                color: var(--text-primary);
            }
            
            .preview-link {
                color: var(--discord-blurple);
                text-decoration: none;
                word-break: break-all;
            }
            
            .preview-link:hover {
                text-decoration: underline;
            }
            
            @media (max-width: 768px) {
                .settings-content {
                    padding: 20px;
                }
                
                .header-content {
                    flex-direction: column;
                    text-align: center;
                }
                
                .social-links-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="settings-container">
            <div class="settings-header">
                <a href="/${user.username}" class="back-button">
                    ← Back to Profile
                </a>
                <div class="header-content">
                    <img src="${user.discordData.avatar ? 'https://cdn.discordapp.com/avatars/' + user.discordData.id + '/' + user.discordData.avatar + '.webp?size=256' : 'https://cdn.discordapp.com/embed/avatars/' + (user.discordData.discriminator % 5) + '.png'}" 
                         alt="Profile Picture" class="profile-pic">
                    <div class="header-text">
                        <h1>${user.displayName}</h1>
                        <p>@${user.username}</p>
                    </div>
                </div>
            </div>
            
            <div class="settings-content">
                ${isNew ? `
                <div class="message success" id="welcomeMessage" style="display: block;">
                    🎉 Welcome! Your profile has been created. Customize it below!
                </div>
                ` : ''}
                
                <div class="message success" id="successMessage" style="display: none;"></div>
                <div class="message error" id="errorMessage" style="display: none;"></div>
                
                <form id="settingsForm">
                    <div class="settings-section">
                        <h2 class="section-title">👤 Profile Information</h2>
                        
                        <div class="form-group">
                            <label class="form-label">Display Name</label>
                            <input type="text" class="form-input" name="displayName" value="${user.displayName || ''}" maxlength="32">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Bio</label>
                            <textarea class="form-textarea" name="bio" placeholder="Tell everyone about yourself..." maxlength="500">${user.settings.bio || ''}</textarea>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h2 class="section-title">🎨 Appearance</h2>
                        
                        <div class="form-group">
                            <label class="form-label">Background Video URL</label>
                            <input type="url" class="form-input" name="background" value="${user.settings.background || ''}" placeholder="https://example.com/background.mp4">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Background Music URL</label>
                            <input type="url" class="form-input" name="music" value="${user.settings.music || ''}" placeholder="https://example.com/music.mp3">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Theme</label>
                            <select class="form-select" name="theme">
                                <option value="default" ${user.settings.theme === 'default' ? 'selected' : ''}>Default</option>
                                <option value="dark" ${user.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                                <option value="light" ${user.settings.theme === 'light' ? 'selected' : ''}>Light</option>
                                <option value="neon" ${user.settings.theme === 'neon' ? 'selected' : ''}>Neon</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h2 class="section-title">🔗 Social Links</h2>
                        
                        <div class="checkbox-group">
                            <input type="checkbox" class="checkbox" id="showSocialLinks" name="showSocialLinks" ${user.settings.showSocialLinks ? 'checked' : ''}>
                            <label for="showSocialLinks">Show social links on profile</label>
                        </div>
                        
                        <div class="social-links-grid">
                            <div class="form-group">
                                <label class="form-label">Instagram</label>
                                <input type="url" class="form-input" name="socialLinks[instagram]" value="${user.settings.socialLinks?.instagram || ''}" placeholder="https://instagram.com/username">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Twitter</label>
                                <input type="url" class="form-input" name="socialLinks[twitter]" value="${user.settings.socialLinks?.twitter || ''}" placeholder="https://twitter.com/username">
                            </div>
                            <div class="form-group">
                                <label class="form-label">YouTube</label>
                                <input type="url" class="form-input" name="socialLinks[youtube]" value="${user.settings.socialLinks?.youtube || ''}" placeholder="https://youtube.com/username">
                            </div>
                            <div class="form-group">
                                <label class="form-label">GitHub</label>
                                <input type="url" class="form-input" name="socialLinks[github]" value="${user.settings.socialLinks?.github || ''}" placeholder="https://github.com/username">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Twitch</label>
                                <input type="url" class="form-input" name="socialLinks[twitch]" value="${user.settings.socialLinks?.twitch || ''}" placeholder="https://twitch.tv/username">
                            </div>
                            <div class="form-group">
                                <label class="form-label">TikTok</label>
                                <input type="url" class="form-input" name="socialLinks[tiktok]" value="${user.settings.socialLinks?.tiktok || ''}" placeholder="https://tiktok.com/@username">
                            </div>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h2 class="section-title">⚙️ Display Options</h2>
                        
                        <div class="checkbox-group">
                            <input type="checkbox" class="checkbox" id="showBadges" name="showBadges" ${user.settings.showBadges ? 'checked' : ''}>
                            <label for="showBadges">Show Discord badges</label>
                        </div>
                        
                        <div class="checkbox-group">
                            <input type="checkbox" class="checkbox" id="showStats" name="showStats" ${user.settings.showStats ? 'checked' : ''}>
                            <label for="showStats">Show profile statistics</label>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h2 class="section-title">💻 Customization</h2>
                        
                        <div class="form-group">
                            <label class="form-label">Custom CSS</label>
                            <textarea class="form-textarea" name="customCSS" placeholder="Add your custom CSS here..." rows="6">${user.settings.customCSS || ''}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Custom HTML</label>
                            <textarea class="form-textarea" name="customHTML" placeholder="Add your custom HTML here..." rows="6">${user.settings.customHTML || ''}</textarea>
                        </div>
                    </div>
                    
                    <button type="submit" class="save-button">
                        💾 Save Changes
                    </button>
                </form>
                
                <div class="preview-section">
                    <h3 class="preview-title">Profile Preview</h3>
                    <p>Your profile is live at: <a href="/${user.username}" class="preview-link" target="_blank">https://${req.headers.host}/${user.username}</a></p>
                </div>
            </div>
        </div>
        
        <script>
            const form = document.getElementById('settingsForm');
            const successMessage = document.getElementById('successMessage');
            const errorMessage = document.getElementById('errorMessage');
            const welcomeMessage = document.getElementById('welcomeMessage');
            
            // Hide welcome message after 5 seconds
            if (welcomeMessage) {
                setTimeout(() => {
                    welcomeMessage.style.display = 'none';
                }, 5000);
            }
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const saveButton = form.querySelector('button[type="submit"]');
                const originalText = saveButton.innerHTML;
                saveButton.innerHTML = '⏳ Saving...';
                saveButton.disabled = true;
                
                try {
                    const formData = new FormData(form);
                    const data = Object.fromEntries(formData.entries());
                    
                    // Parse social links
                    const socialLinks = {};
                    for (const [key, value] of Object.entries(data)) {
                        if (key.startsWith('socialLinks[')) {
                            const platform = key.match(/socialLinks\[(.*?)\]/)[1];
                            socialLinks[platform] = value;
                        }
                    }
                    
                    // Prepare payload
                    const payload = {
                        ...data,
                        socialLinks: socialLinks
                    };
                    
                    // Convert checkbox values to boolean
                    payload.showBadges = payload.showBadges === 'on';
                    payload.showStats = payload.showStats === 'on';
                    payload.showSocialLinks = payload.showSocialLinks === 'on';
                    
                    const response = await fetch('/${user.username}/settings/update', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        successMessage.textContent = '✅ Settings saved successfully!';
                        successMessage.style.display = 'block';
                        errorMessage.style.display = 'none';
                        
                        // Update display name in header if changed
                        if (payload.displayName) {
                            document.querySelector('.header-text h1').textContent = payload.displayName;
                        }
                    } else {
                        throw new Error(result.message || 'Failed to save settings');
                    }
                } catch (error) {
                    errorMessage.textContent = '❌ ' + error.message;
                    errorMessage.style.display = 'block';
                    successMessage.style.display = 'none';
                } finally {
                    saveButton.innerHTML = originalText;
                    saveButton.disabled = false;
                    
                    // Scroll to top to show message
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        </script>
    </body>
    </html>
    `);
});

// Update settings endpoint
app.post('/:username/settings/update', checkProfileOwnership, express.json(), (req, res) => {
    const user = req.user;
    const newSettings = req.body;
    
    try {
        // Update user settings
        user.settings = {
            ...user.settings,
            ...newSettings
        };
        
        // Handle nested social links
        if (newSettings.socialLinks) {
            user.settings.socialLinks = {
                ...user.settings.socialLinks,
                ...newSettings.socialLinks
            };
        }
        
        // Update display name if provided
        if (newSettings.displayName) {
            user.displayName = newSettings.displayName;
        }
        
        users.set(user.username, user);
        
        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ success: false, message: 'Failed to update settings' });
    }
});

// Helper functions for profile generation - FIXED VERSION
function getBadgesHTML(flags) {
    if (!flags) return '';
    
    const badges = [];
    const badgeMap = {
        1: '🎨', // Discord Employee (1 << 0 = 1)
        2: '🤝', // Partnered Server Owner (1 << 1 = 2)
        4: '⚡', // HypeSquad Events (1 << 2 = 4)
        8: '🐛', // Bug Hunter Level 1 (1 << 3 = 8)
        64: '🏠', // House Bravery (1 << 6 = 64)
        128: '💚', // House Brilliance (1 << 7 = 128)
        256: '❤️', // House Balance (1 << 8 = 256)
        512: '⭐', // Early Supporter (1 << 9 = 512)
        1024: '🛡️', // Bug Hunter Level 2 (1 << 10 = 1024)
        16384: '🌟', // Early Verified Bot Developer (1 << 14 = 16384)
        65536: '🤖', // Active Developer (1 << 16 = 65536)
        131072: '🎓', // Moderator Programs Alumni (1 << 17 = 131072)
        262144: '🌐' // Discord Certified Moderator (1 << 18 = 262144)
    };
    
    for (const [flag, emoji] of Object.entries(badgeMap)) {
        if (flags & parseInt(flag)) {
            badges.push(emoji);
        }
    }
    
    return badges.length > 0 ? 
        `<div class="badges">${badges.join('')}</div>` : 
        '<div class="badges">👤 No badges</div>';
}

function getAccountAge(userId) {
    const timestamp = (parseInt(userId) / 4194304) + 1420070400000;
    const accountDate = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - accountDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
    return `${Math.floor(diffDays / 365)} years`;
}

function getProfileCSS() {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        :root {
            --discord-blurple: #5865F2;
            --discord-green: #57F287;
            --discord-yellow: #FEE75C;
            --discord-red: #ED4245;
            --text-primary: #ffffff;
            --text-secondary: #b9bbbe;
            --text-tertiary: #72767d;
            --bg-glass: rgba(0, 0, 0, 0.7);
            --border-glass: rgba(255, 255, 255, 0.1);
        }
        
        body {
            background: #000;
            color: var(--text-primary);
            min-height: 100vh;
            overflow-x: hidden;
        }
        
        .background-video {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: -2;
            filter: brightness(0.6);
        }
        
        .navbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: var(--bg-glass);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border-glass);
            padding: 15px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 1000;
        }
        
        .logo {
            font-size: 1.4em;
            font-weight: 800;
            background: linear-gradient(135deg, #fff, var(--discord-blurple));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-decoration: none;
        }
        
        .settings-btn {
            background: var(--discord-blurple);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 10px 20px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            font-size: 0.9em;
        }
        
        .settings-btn:hover {
            background: #4752c4;
            transform: translateY(-2px);
        }
        
        .container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 100px 20px 50px;
        }
        
        .profile-card {
            background: var(--bg-glass);
            backdrop-filter: blur(20px);
            border: 1px solid var(--border-glass);
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }
        
        .profile-header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .profile-pic-container {
            position: relative;
            display: inline-block;
            margin-bottom: 20px;
        }
        
        .profile-pic {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            object-fit: cover;
            border: 4px solid var(--discord-blurple);
        }
        
        .status-indicator {
            position: absolute;
            bottom: 10px;
            right: 10px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid var(--bg-glass);
        }
        
        .status-online {
            background: var(--discord-green);
        }
        
        .name-container {
            margin-bottom: 10px;
        }
        
        .name {
            font-size: 2em;
            font-weight: 700;
            margin-bottom: 5px;
        }
        
        .username {
            color: var(--text-secondary);
            font-size: 1.2em;
            margin-bottom: 5px;
        }
        
        .profile-url {
            color: var(--text-tertiary);
            font-size: 0.9em;
            word-break: break-all;
        }
        
        .bio-section {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 25px;
        }
        
        .bio-label {
            color: var(--text-secondary);
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 0.9em;
        }
        
        .bio-content {
            line-height: 1.5;
            color: var(--text-primary);
        }
        
        .badges-container {
            margin-bottom: 25px;
        }
        
        .badges {
            display: flex;
            justify-content: center;
            gap: 10px;
            flex-wrap: wrap;
            font-size: 1.5em;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 25px;
        }
        
        .stat-item {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            padding: 15px;
            text-align: center;
        }
        
        .stat-label {
            color: var(--text-secondary);
            font-size: 0.8em;
            margin-bottom: 5px;
        }
        
        .stat-value {
            color: var(--text-primary);
            font-weight: 600;
            font-size: 1.1em;
        }
        
        .social-links {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-top: 20px;
        }
        
        .social-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            text-decoration: none;
            font-size: 1.2em;
            transition: all 0.3s ease;
        }
        
        .social-link:hover {
            background: var(--discord-blurple);
            transform: translateY(-2px);
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 80px 15px 30px;
            }
            
            .profile-card {
                padding: 30px 20px;
            }
            
            .name {
                font-size: 1.6em;
            }
            
            .stats-grid {
                grid-template-columns: 1fr;
            }
        }
    `;
}

// Serve user profile pages - FIXED
app.get('/:username', (req, res) => {
    const { username } = req.params;
    const user = users.get(username.toLowerCase());
    
    if (!user) {
        return res.redirect('/?username=' + username);
    }
    
    // Check if user is banned
    const banInfo = getBanInfo(user.discordData.id);
    if (banInfo) {
        return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>User Banned - DiscordProfile</title>
            <meta name="robots" content="noindex, nofollow">
            <meta name="referrer" content="no-referrer">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                
                body {
                    background: #000;
                    color: #fff;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                
                .banned-container {
                    text-align: center;
                    background: rgba(237, 66, 69, 0.1);
                    border: 1px solid rgba(237, 66, 69, 0.3);
                    border-radius: 16px;
                    padding: 40px;
                    max-width: 500px;
                    backdrop-filter: blur(20px);
                }
                
                .banned-icon {
                    font-size: 4em;
                    margin-bottom: 20px;
                }
                
                .banned-title {
                    font-size: 2em;
                    font-weight: 700;
                    margin-bottom: 16px;
                    color: #ED4245;
                }
                
                .banned-message {
                    color: #b9bbbe;
                    margin-bottom: 24px;
                    line-height: 1.5;
                }
                
                .ban-details {
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 24px;
                    text-align: left;
                }
                
                .ban-detail {
                    margin-bottom: 8px;
                    display: flex;
                    justify-content: space-between;
                }
                
                .ban-label {
                    color: #72767d;
                    font-weight: 600;
                }
                
                .ban-value {
                    color: #fff;
                }
                
                .home-link {
                    display: inline-block;
                    background: #5865F2;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 600;
                    transition: all 0.3s ease;
                }
                
                .home-link:hover {
                    background: #4752c4;
                    transform: translateY(-2px);
                }
            </style>
        </head>
        <body>
            <div class="banned-container">
                <div class="banned-icon">🚫</div>
                <h1 class="banned-title">User Banned</h1>
                <p class="banned-message">
                    This user's profile has been suspended and is no longer accessible.
                </p>
                
                <div class="ban-details">
                    <div class="ban-detail">
                        <span class="ban-label">Username:</span>
                        <span class="ban-value">${user.displayName}</span>
                    </div>
                    <div class="ban-detail">
                        <span class="ban-label">Reason:</span>
                        <span class="ban-value">${banInfo.reason}</span>
                    </div>
                    <div class="ban-detail">
                        <span class="ban-label">Banned By:</span>
                        <span class="ban-value">${banInfo.bannedBy}</span>
                    </div>
                    <div class="ban-detail">
                        <span class="ban-label">Banned On:</span>
                        <span class="ban-value">${new Date(banInfo.bannedAt).toLocaleDateString()}</span>
                    </div>
                </div>
                
                <a href="/" class="home-link">Return to Homepage</a>
            </div>
        </body>
        </html>
        `);
    }
    
    // Increment profile views
    user.profileViews = (user.profileViews || 0) + 1;
    addUserViews(username.toLowerCase(), 1);
    
    // Generate profile components
    const avatarUrl = user.discordData.avatar 
        ? 'https://cdn.discordapp.com/avatars/' + user.discordData.id + '/' + user.discordData.avatar + '.webp?size=256'
        : 'https://cdn.discordapp.com/embed/avatars/' + (user.discordData.discriminator % 5) + '.png';
    
    const badgesHTML = user.settings.showBadges ? getBadgesHTML(user.discordData.public_flags) : '';
    const accountAge = getAccountAge(user.discordData.id);
    
    let socialLinksHTML = '';
    if (user.settings.showSocialLinks && user.settings.socialLinks) {
        const socials = user.settings.socialLinks;
        socialLinksHTML = `
            <div class="social-links">
                ${socials.instagram ? `<a href="${socials.instagram}" class="social-link" title="Instagram" target="_blank">📷</a>` : ''}
                ${socials.twitter ? `<a href="${socials.twitter}" class="social-link" title="Twitter" target="_blank">🐦</a>` : ''}
                ${socials.youtube ? `<a href="${socials.youtube}" class="social-link" title="YouTube" target="_blank">📺</a>` : ''}
                ${socials.github ? `<a href="${socials.github}" class="social-link" title="GitHub" target="_blank">💻</a>` : ''}
                ${socials.twitch ? `<a href="${socials.twitch}" class="social-link" title="Twitch" target="_blank">🎮</a>` : ''}
                ${socials.tiktok ? `<a href="${socials.tiktok}" class="social-link" title="TikTok" target="_blank">🎵</a>` : ''}
            </div>
        `;
    }
    
    const statsHTML = user.settings.showStats ? `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-label">Account Age</div>
                <div class="stat-value">${accountAge}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Status</div>
                <div class="stat-value">Online</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Verified</div>
                <div class="stat-value">${user.discordData.verified ? 'Yes' : 'No'}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Profile Views</div>
                <div class="stat-value">${getUserViews(username.toLowerCase())}</div>
            </div>
        </div>
    ` : '';
    
    const bioHTML = user.settings.bio ? `
        <div class="bio-section">
            <div class="bio-label">About Me</div>
            <div class="bio-content">${user.settings.bio}</div>
        </div>
    ` : '';
    
    // Check if user is owner for settings button
    const sessionId = req.cookies?.session;
    const isOwner = sessionId && sessions.has(sessionId) && sessions.get(sessionId).username === username.toLowerCase();
    const settingsButton = isOwner ? `<a href="/${username}/settings" class="settings-btn">⚙️ Settings</a>` : '';
    
    const navbarHTML = settingsButton ? `
        <nav class="navbar">
            <a href="/" class="logo">DiscordProfile</a>
            <div class="nav-links">
                ${settingsButton}
            </div>
        </nav>
    ` : '';
    
    // Generate the complete profile page
    const profileHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${user.displayName}'s Profile - DiscordProfile</title>
        <meta name="description" content="${user.displayName}'s Discord profile">
        <meta name="robots" content="noindex, nofollow">
        <meta name="referrer" content="no-referrer">
        <meta http-equiv="Permissions-Policy" content="browsing-topics=(), run-ad-auction=(), join-ad-interest-group=(), private-state-token-redemption=(), private-state-token-issuance=(), private-aggregation=(), attribution-reporting=()">
        <style>
            ${getProfileCSS()}
            ${user.settings.customCSS || ''}
        </style>
    </head>
    <body>
        <video class="background-video" autoplay muted loop playsinline>
            <source src="${user.settings.background}" type="video/mp4">
        </video>
        
        ${user.settings.music ? `
        <audio id="backgroundMusic" loop>
            <source src="${user.settings.music}" type="audio/mp3">
        </audio>
        ` : ''}
        
        ${navbarHTML}
        
        <div class="container">
            <div class="profile-card">
                <div class="profile-header">
                    <div class="profile-pic-container">
                        <div class="profile-pic">
                            <img src="${avatarUrl}" alt="${user.displayName}'s Profile Picture">
                        </div>
                        <div class="status-indicator status-online"></div>
                    </div>
                    <div class="profile-info">
                        <div class="name-container">
                            <h1 class="name">${user.displayName}</h1>
                        </div>
                        <div class="username">@${user.username}</div>
                        <div class="profile-url">${req.headers.host}/${username}</div>
                    </div>
                </div>
                
                ${bioHTML}
                ${badgesHTML}
                ${statsHTML}
                ${socialLinksHTML}
                ${user.settings.customHTML || ''}
            </div>
        </div>
        
        ${user.settings.music ? `
        <script>
            document.addEventListener('DOMContentLoaded', function() {
                const music = document.getElementById('backgroundMusic');
                music.volume = 0.3;
                music.play().catch(e => console.log('Autoplay blocked:', e));
            });
        </script>
        ` : ''}
    </body>
    </html>
    `;
    
    res.send(profileHTML);
});

// Serve features page
app.get('/features', (req, res) => {
    res.redirect('/#features');
});

// Serve about page
app.get('/about', (req, res) => {
    res.redirect('/');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Page Not Found</title>
            <style>
                body { 
                    background: #000; 
                    color: white; 
                    font-family: Arial; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    height: 100vh; 
                    margin: 0; 
                }
                .message { 
                    text-align: center; 
                    background: rgba(255,255,255,0.1); 
                    padding: 40px; 
                    border-radius: 10px; 
                    backdrop-filter: blur(10px);
                }
                a { 
                    color: #5865F2; 
                    text-decoration: none; 
                }
            </style>
        </head>
        <body>
            <div class="message">
                <h2>404 - Page Not Found</h2>
                <p>The page you're looking for doesn't exist.</p>
                <a href="/">← Back to Home</a>
            </div>
        </body>
        </html>
    `);
});

// Start server and load bot token
server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Server running on port ' + PORT);
    console.log('✅ Enhanced registration system ready');
    console.log('🎯 Fixed profile and settings pages');
    console.log('⚙️ Improved rate limiting and security');
    console.log('🔧 Enhanced bot commands with temporary bans');
    console.log('👀 Better view tracking system');
    
    // Load bot token from Pastebin
    loadBotToken();
});
