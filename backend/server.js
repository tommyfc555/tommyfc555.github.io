const express = require('express');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes } = require('discord.js');
const https = require('https');

const app = express();
const server = require('http').createServer(app);
const PORT = process.env.PORT || 3000;

const WEBSITE_URL = 'https://tommyfc555-github-io.onrender.com';
const ADMIN_ROLE_ID = '1432821388187664605';

// Cache for quick responses
const userData = new Map();

// Get token from environment variable first, then fallback to Pastefy
let BOT_TOKEN = process.env.BOT_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

function generateKey() {
    return 'KEY-' + Math.random().toString(36).substr(2, 12).toUpperCase();
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Function to fetch token from pastefy
function fetchTokenFromPastefy() {
    return new Promise((resolve, reject) => {
        console.log('Getting bot token from Pastefy...');
        https.get('https://pastefy.app/Pez2ITgu/raw', (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                const token = data.trim();
                if (token && token.length > 10) {
                    console.log('Token fetched successfully from Pastefy');
                    resolve(token);
                } else {
                    reject(new Error('Invalid token received from Pastefy'));
                }
            });
            
        }).on('error', (error) => {
            reject(new Error('Failed to fetch token: ' + error.message));
        });
    });
}

// Quick response for Discord interactions
async function handlePanelCommand(interaction) {
    try {
        // Create panel immediately without any delays
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_key')
                    .setLabel('Get Key')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('get_script')
                    .setLabel('Get Script')
                    .setStyle(ButtonStyle.Primary)
            );

        // Add reset key button only for admins
        if (interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('reset_key')
                    .setLabel('Reset Key')
                    .setStyle(ButtonStyle.Danger)
            );
        }

        const embed = new EmbedBuilder()
            .setTitle('Script Management')
            .setDescription('Manage your script access below')
            .setColor(0x0099FF)
            .addFields(
                { name: 'Get Key', value: 'Generate your unique access key' },
                { name: 'Get Script', value: 'Get your script after obtaining key' }
            )
            .setFooter({ text: 'Device locked protection system' });

        if (interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            embed.addFields({ name: 'Reset Key', value: 'Generate new key (Admin only)' });
        }

        // Reply immediately without deferring
        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Error in handlePanelCommand:', error);
        // If reply fails, try to follow up
        try {
            await interaction.followUp({
                content: 'An error occurred. Please try again.',
                ephemeral: true
            });
        } catch (e) {
            console.error('Failed to send error message:', e);
        }
    }
}

// Initialize bot
async function initializeBot() {
    try {
        // If no token in environment, fetch from Pastefy
        if (!BOT_TOKEN) {
            BOT_TOKEN = await fetchTokenFromPastefy();
        }
        
        await client.login(BOT_TOKEN);
        console.log('Bot logged in successfully');
        
    } catch (error) {
        console.error('Failed to initialize bot:', error.message);
        process.exit(1);
    }
}

client.once('ready', async () => {
    console.log(`Bot ready: ${client.user.tag}`);
    
    // Register commands after bot is ready
    const commands = [
        {
            name: 'panel',
            description: 'Open script panel'
        }
    ];

    try {
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        console.log('Registering commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Commands registered successfully');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// Handle command interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'panel') {
        await handlePanelCommand(interaction);
    }
});

// Handle button interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, user, member } = interaction;

    try {
        // Defer reply immediately for button interactions
        await interaction.deferReply({ ephemeral: true });

        if (customId === 'claim_key') {
            if (userData.has(user.id)) {
                const userInfo = userData.get(user.id);
                return await interaction.editReply({
                    content: `You already have a key: \`${userInfo.key}\``
                });
            }

            const key = generateKey();
            
            userData.set(user.id, {
                key: key,
                hwid: null,
                locked: false,
                claimedAt: new Date(),
                discordId: user.id,
                username: user.tag
            });

            await interaction.editReply({
                content: `Key generated: \`${key}\`\n\nUse Get Script to get your script. It will lock to your device on first run.`
            });
        }

        if (customId === 'get_script') {
            const userInfo = userData.get(user.id);
            
            if (!userInfo) {
                return await interaction.editReply({
                    content: 'Get a key first using the Get Key button'
                });
            }

            const loadstring = `loadstring(game:HttpGet("${WEBSITE_URL}/secure-script/${userInfo.key}"))()`;

            const embed = new EmbedBuilder()
                .setTitle('Your Script')
                .setDescription('Copy and execute in Roblox:')
                .setColor(0x0099FF)
                .addFields(
                    { name: 'Your Key', value: `\`${userInfo.key}\`` },
                    { name: 'Loadstring', value: `\`\`\`lua\n${loadstring}\n\`\`\`` }
                )
                .setFooter({ text: 'Script will lock to first device that runs it' });

            await interaction.editReply({ 
                embeds: [embed]
            });
        }

        if (customId === 'reset_key') {
            if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
                return await interaction.editReply({
                    content: 'You do not have permission to reset keys'
                });
            }

            const userInfo = userData.get(user.id);
            
            if (!userInfo) {
                return await interaction.editReply({
                    content: 'You dont have a key to reset'
                });
            }

            const newKey = generateKey();
            
            userData.set(user.id, {
                key: newKey,
                hwid: null,
                locked: false,
                claimedAt: new Date(),
                discordId: user.id,
                username: user.tag
            });

            await interaction.editReply({
                content: `Key reset successfully!\nNew Key: \`${newKey}\``
            });
        }
    } catch (error) {
        console.error('Error handling button interaction:', error);
        try {
            await interaction.editReply({
                content: 'An error occurred. Please try again.'
            });
        } catch (e) {
            await interaction.followUp({
                content: 'An error occurred. Please try again.',
                ephemeral: true
            });
        }
    }
});

// Block direct access to script URLs
app.get('/script/:key', (req, res) => {
    res.status(403).send(`
        <html>
        <head>
            <title>Access Denied</title>
            <style>
                body {
                    background: #1a1a1a;
                    color: #ff4444;
                    font-family: Arial;
                    text-align: center;
                    padding: 50px;
                }
                h1 {
                    color: #ff4444;
                }
            </style>
        </head>
        <body>
            <h1>ACCESS DENIED</h1>
            <p>You cannot view the script directly.</p>
            <p>Use the Discord bot to get your loadstring.</p>
            <p>This URL only works when called from Roblox.</p>
        </body>
        </html>
    `);
});

// Secure script endpoint - only serves to Roblox
app.get('/secure-script/:key', (req, res) => {
    const { key } = req.params;
    
    // Check if request is coming from Roblox
    const userAgent = req.headers['user-agent'] || '';
    const isRoblox = userAgent.includes('Roblox') || 
                     req.headers['roblox-id'] || 
                     req.headers['origin'] === 'roblox-player';
    
    if (!isRoblox) {
        return res.status(403).send('-- Access denied. This script can only be loaded from Roblox.');
    }
    
    let userInfo = null;
    for (let data of userData.values()) {
        if (data.key === key) {
            userInfo = data;
            break;
        }
    }

    if (!userInfo) {
        return res.status(404).send('-- Invalid key');
    }

    const luaScript = `-- Device Locked Script
-- Key: ${userInfo.key}

local key = "${userInfo.key}"
local expectedHWID = "${userInfo.hwid}"

local function getDeviceID()
    local deviceID = ""
    
    local success, result = pcall(function()
        return game:GetService("RbxAnalyticsService"):GetClientId()
    end)
    
    if success and result then
        deviceID = tostring(result)
    else
        local success2, result2 = pcall(function()
            local stats = game:GetService("Stats")
            local performanceStats = stats:FindFirstChild("PerformanceStats")
            if performanceStats then
                local mem = performanceStats:FindFirstChild("Memory")
                if mem then
                    return tostring(mem.Value)
                end
            end
            return tostring(tick()) .. tostring(math.random(10000, 99999))
        end)
        deviceID = success2 and result2 or "unknown_" .. tostring(tick())
    end
    
    return deviceID
end

local function checkAccess()
    local currentDeviceID = getDeviceID()
    
    if expectedHWID == "" or expectedHWID == "null" then
        local response = game:HttpGet("${WEBSITE_URL}/lock/${userInfo.key}/" .. currentDeviceID)
        if response == "locked" then
            print("Device locked successfully")
            return true
        else
            print("Failed to lock device")
            return false
        end
    else
        if currentDeviceID == expectedHWID then
            print("Device verified")
            return true
        else
            print("Device mismatch")
            return false
        end
    end
end

if not checkAccess() then
    print("Access denied - Wrong device")
    return
end

print("Access granted")
print("Running main script...")

local Players = game:GetService("Players")
local player = Players.LocalPlayer

if player and player.Character then
    local humanoid = player.Character:FindFirstChild("Humanoid")
    if humanoid then
        humanoid.WalkSpeed = 50
        print("WalkSpeed set to 50")
    end
end

print("Script loaded successfully")`;

    res.setHeader('Content-Type', 'text/plain');
    res.send(luaScript);
});

app.get('/lock/:key/:hwid', (req, res) => {
    const { key, hwid } = req.params;
    
    let userInfo = null;
    let userId = null;
    
    for (let [id, data] of userData.entries()) {
        if (data.key === key) {
            userInfo = data;
            userId = id;
            break;
        }
    }

    if (!userInfo) {
        return res.send('error');
    }

    if (userInfo.hwid && userInfo.hwid !== hwid) {
        return res.send('already_locked');
    }

    if (!userInfo.hwid) {
        userData.set(userId, {
            ...userInfo,
            hwid: hwid,
            locked: true,
            lockedAt: new Date()
        });
        return res.send('locked');
    }

    res.send('verified');
});

app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Script System</title>
            <style>
                body {
                    background: #1a1a1a;
                    color: #fff;
                    font-family: Arial;
                    text-align: center;
                    padding: 50px;
                }
            </style>
        </head>
        <body>
            <h1>Script System Backend</h1>
            <p>Use Discord bot for access</p>
            <p>Status: 🟢 Online</p>
        </body>
        </html>
    `);
});

app.get('/admin/users', (req, res) => {
    if (userData.size === 0) {
        return res.json({ message: 'No users' });
    }
    
    const users = Array.from(userData.entries()).map(([id, data]) => ({
        discordId: id,
        username: data.username,
        key: data.key,
        hwid: data.hwid,
        locked: data.locked,
        claimedAt: data.claimedAt
    }));
    
    res.json({ totalUsers: userData.size, users });
});

// Start server and bot
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Website: ${WEBSITE_URL}`);
    initializeBot();
});
