const express = require('express');
const http = require('http');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Fix for rate limiting behind proxy
app.set('trust proxy', 1);

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// Global variables
let discordBot = null;
let BOT_TOKEN = '';
const scripts = new Map();
const userKeys = new Map();
const hwidLocks = new Map();
const specialRoleId = 'YOUR_SPECIAL_ROLE_ID_HERE'; // Replace with your special role ID

// User storage
const users = new Map();
const sessions = new Map();

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

app.use(express.static('.'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Helper functions
function generateHWID(req) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    return crypto.createHash('sha256').update(ip + userAgent).digest('hex').substring(0, 16);
}

function generateLicenseKey() {
    return crypto.randomBytes(8).toString('hex').toUpperCase();
}

function generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
}

// Initialize sample scripts
function initializeScripts() {
    scripts.set('premium_script', {
        id: 'premium_script',
        name: 'Premium Script',
        description: 'Our most powerful Roblox exploit script',
        version: '1.0.0',
        loadstring: `loadstring(game:HttpGet("https://yourwebsite.com/script/premium_script.lua"))()`,
        requiresKey: true,
        specialRoleRequired: true
    });

    scripts.set('free_script', {
        id: 'free_script',
        name: 'Free Script',
        description: 'Basic Roblox script for testing',
        version: '1.0.0',
        loadstring: `loadstring(game:HttpGet("https://yourwebsite.com/script/free_script.lua"))()`,
        requiresKey: false,
        specialRoleRequired: false
    });
}

// Load bot token from environment or config
async function loadBotToken() {
    try {
        // You can load from environment variable or config file
        BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
        console.log('✅ Bot token loaded');
        initializeBot();
    } catch (error) {
        console.error('❌ Failed to load bot token:', error);
    }
}

// Check if user has special role
function hasSpecialRole(member) {
    if (!member) return false;
    return member.roles.cache.has(specialRoleId);
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
            name: 'panel',
            description: 'Open the script panel to get your scripts'
        },
        {
            name: 'generate_key',
            description: 'Generate a license key for premium scripts (Special Role Only)',
            options: [
                {
                    name: 'script_id',
                    type: 3,
                    description: 'The script ID to generate key for',
                    required: true,
                    choices: [
                        { name: 'Premium Script', value: 'premium_script' },
                        { name: 'Free Script', value: 'free_script' }
                    ]
                }
            ]
        },
        {
            name: 'admin_stats',
            description: 'View bot statistics (Admin Only)'
        }
    ];

    async function registerCommands() {
        try {
            const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
            console.log('🔨 Registering slash commands...');
            await rest.put(
                Routes.applicationCommands(discordBot.user?.id || 'YOUR_BOT_ID'),
                { body: commands }
            );
            console.log('✅ Slash commands registered successfully');
        } catch (error) {
            console.error('❌ Error registering commands:', error);
        }
    }

    discordBot.once('ready', () => {
        console.log(`🤖 Logged in as ${discordBot.user.tag}`);
        registerCommands();
        initializeScripts();
    });

    // Handle panel command
    discordBot.on('interactionCreate', async interaction => {
        if (!interaction.isCommand()) return;

        const { commandName, options, user, guild, member } = interaction;

        try {
            if (commandName === 'panel') {
                // Create the main panel embed
                const panelEmbed = new EmbedBuilder()
                    .setTitle('🎮 Roblox Script Panel')
                    .setDescription('Get your HWID-locked scripts below. Click the buttons to generate your personalized scripts.')
                    .setColor(0x5865F2)
                    .addFields(
                        {
                            name: '📜 Available Scripts',
                            value: `
                            **Premium Script** - Advanced features (Special Role Required)
                            **Free Script** - Basic features for everyone
                            `,
                            inline: false
                        },
                        {
                            name: '🔐 How it works',
                            value: '1. Click a script button\n2. Get your HWID-locked script\n3. Copy and execute in Roblox',
                            inline: false
                        }
                    )
                    .setFooter({ text: 'Your scripts are HWID-locked to your device' });

                // Create buttons for each script
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('get_premium_script')
                            .setLabel('Get Premium Script')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('⭐'),
                        new ButtonBuilder()
                            .setCustomId('get_free_script')
                            .setLabel('Get Free Script')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🔓')
                    );

                await interaction.reply({
                    embeds: [panelEmbed],
                    components: [row],
                    ephemeral: true
                });

            } else if (commandName === 'generate_key') {
                // Check if user has special role
                if (!hasSpecialRole(member)) {
                    return interaction.reply({
                        content: '❌ This command is only available to users with the special role.',
                        ephemeral: true
                    });
                }

                const scriptId = options.getString('script_id');
                const script = scripts.get(scriptId);

                if (!script) {
                    return interaction.reply({
                        content: '❌ Script not found.',
                        ephemeral: true
                    });
                }

                const licenseKey = generateLicenseKey();
                
                // Store the key
                userKeys.set(licenseKey, {
                    userId: user.id,
                    scriptId: scriptId,
                    createdAt: Date.now(),
                    used: false
                });

                const keyEmbed = new EmbedBuilder()
                    .setTitle('🔑 License Key Generated')
                    .setColor(0x57F287)
                    .addFields(
                        { name: 'Script', value: script.name, inline: true },
                        { name: 'License Key', value: `\`${licenseKey}\``, inline: true },
                        { name: 'User', value: `<@${user.id}>`, inline: true }
                    )
                    .setFooter({ text: 'This key can be used to activate the script' })
                    .setTimestamp();

                await interaction.reply({
                    embeds: [keyEmbed],
                    ephemeral: true
                });

            } else if (commandName === 'admin_stats') {
                // Admin stats command
                const totalKeys = userKeys.size;
                const usedKeys = Array.from(userKeys.values()).filter(key => key.used).length;
                const totalHWIDs = hwidLocks.size;

                const statsEmbed = new EmbedBuilder()
                    .setTitle('📊 Admin Statistics')
                    .setColor(0xFEE75C)
                    .addFields(
                        { name: 'Total License Keys', value: totalKeys.toString(), inline: true },
                        { name: 'Used Keys', value: usedKeys.toString(), inline: true },
                        { name: 'Active HWID Locks', value: totalHWIDs.toString(), inline: true },
                        { name: 'Available Scripts', value: scripts.size.toString(), inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({
                    embeds: [statsEmbed],
                    ephemeral: true
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

    // Handle button interactions
    discordBot.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        const { customId, user, member } = interaction;

        try {
            if (customId === 'get_premium_script') {
                // Check if user has special role for premium script
                if (!hasSpecialRole(member)) {
                    return interaction.reply({
                        content: '❌ You need a special role to access premium scripts.',
                        ephemeral: true
                    });
                }

                // Generate HWID for this user
                const hwid = generateHWID({ 
                    ip: 'discord', 
                    headers: { 'user-agent': `discord:${user.id}` } 
                });

                const script = scripts.get('premium_script');
                const personalizedScript = `[YOURHWID=${hwid}]\n${script.loadstring}`;

                // Store HWID lock
                hwidLocks.set(hwid, {
                    userId: user.id,
                    scriptId: 'premium_script',
                    createdAt: Date.now(),
                    hwid: hwid
                });

                const scriptEmbed = new EmbedBuilder()
                    .setTitle('⭐ Premium Script')
                    .setDescription('Your HWID-locked premium script is ready!')
                    .setColor(0x5865F2)
                    .addFields(
                        { 
                            name: '📋 Your Script', 
                            value: `\`\`\`lua\n${personalizedScript}\n\`\`\``,
                            inline: false 
                        },
                        { 
                            name: '⚠️ Important', 
                            value: 'This script is locked to your HWID. Do not share it!',
                            inline: false 
                        }
                    )
                    .setFooter({ text: `HWID: ${hwid}` });

                await interaction.reply({
                    embeds: [scriptEmbed],
                    ephemeral: true
                });

            } else if (customId === 'get_free_script') {
                // Generate HWID for free script
                const hwid = generateHWID({ 
                    ip: 'discord', 
                    headers: { 'user-agent': `discord:${user.id}` } 
                });

                const script = scripts.get('free_script');
                const personalizedScript = `[YOURHWID=${hwid}]\n${script.loadstring}`;

                // Store HWID lock
                hwidLocks.set(hwid, {
                    userId: user.id,
                    scriptId: 'free_script',
                    createdAt: Date.now(),
                    hwid: hwid
                });

                const scriptEmbed = new EmbedBuilder()
                    .setTitle('🔓 Free Script')
                    .setDescription('Your HWID-locked free script is ready!')
                    .setColor(0x57F287)
                    .addFields(
                        { 
                            name: '📋 Your Script', 
                            value: `\`\`\`lua\n${personalizedScript}\n\`\`\``,
                            inline: false 
                        },
                        { 
                            name: 'ℹ️ Note', 
                            value: 'This script is locked to your HWID.',
                            inline: false 
                        }
                    )
                    .setFooter({ text: `HWID: ${hwid}` });

                await interaction.reply({
                    embeds: [scriptEmbed],
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error handling button interaction:', error);
            await interaction.reply({
                content: '❌ An error occurred while generating your script.',
                ephemeral: true
            });
        }
    });

    discordBot.login(BOT_TOKEN).catch(error => {
        console.error('❌ Bot login failed:', error);
    });
}

// Website Routes

// Serve homepage
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Roblox Script Hub</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            
            :root {
                --primary: #5865F2;
                --success: #57F287;
                --warning: #FEE75C;
                --danger: #ED4245;
                --bg-dark: #0a0a0a;
                --bg-card: #1a1a1a;
                --text-primary: #ffffff;
                --text-secondary: #b9bbbe;
            }
            
            body {
                background: var(--bg-dark);
                color: var(--text-primary);
                min-height: 100vh;
                padding: 20px;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
            }
            
            .header {
                text-align: center;
                margin-bottom: 50px;
                padding: 40px 0;
            }
            
            .header h1 {
                font-size: 3em;
                background: linear-gradient(135deg, var(--primary), var(--success));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 10px;
            }
            
            .header p {
                color: var(--text-secondary);
                font-size: 1.2em;
            }
            
            .scripts-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                gap: 30px;
                margin-bottom: 50px;
            }
            
            .script-card {
                background: var(--bg-card);
                border-radius: 15px;
                padding: 30px;
                border: 1px solid rgba(255,255,255,0.1);
                transition: all 0.3s ease;
            }
            
            .script-card:hover {
                transform: translateY(-5px);
                border-color: var(--primary);
            }
            
            .script-card.premium {
                border-color: var(--warning);
            }
            
            .script-badge {
                display: inline-block;
                padding: 5px 12px;
                border-radius: 20px;
                font-size: 0.8em;
                font-weight: 600;
                margin-bottom: 15px;
            }
            
            .badge-free {
                background: var(--success);
                color: #000;
            }
            
            .badge-premium {
                background: var(--warning);
                color: #000;
            }
            
            .script-card h3 {
                font-size: 1.5em;
                margin-bottom: 10px;
            }
            
            .script-card p {
                color: var(--text-secondary);
                margin-bottom: 20px;
                line-height: 1.5;
            }
            
            .script-features {
                list-style: none;
                margin-bottom: 25px;
            }
            
            .script-features li {
                padding: 8px 0;
                color: var(--text-secondary);
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .script-features li:before {
                content: '✓';
                color: var(--success);
                font-weight: bold;
            }
            
            .btn {
                display: inline-block;
                padding: 12px 24px;
                background: var(--primary);
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                transition: all 0.3s ease;
                border: none;
                cursor: pointer;
                width: 100%;
                text-align: center;
            }
            
            .btn:hover {
                background: #4752c4;
                transform: translateY(-2px);
            }
            
            .btn-premium {
                background: var(--warning);
                color: #000;
            }
            
            .btn-premium:hover {
                background: #e6d852;
            }
            
            .info-section {
                background: var(--bg-card);
                border-radius: 15px;
                padding: 40px;
                margin-top: 50px;
                border: 1px solid rgba(255,255,255,0.1);
            }
            
            .info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 30px;
            }
            
            .info-item {
                text-align: center;
            }
            
            .info-icon {
                font-size: 3em;
                margin-bottom: 15px;
            }
            
            .info-item h4 {
                font-size: 1.2em;
                margin-bottom: 10px;
            }
            
            .info-item p {
                color: var(--text-secondary);
            }
            
            .discord-link {
                text-align: center;
                margin-top: 30px;
            }
            
            .discord-btn {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                background: var(--primary);
                color: white;
                padding: 15px 30px;
                border-radius: 10px;
                text-decoration: none;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            
            .discord-btn:hover {
                background: #4752c4;
                transform: translateY(-2px);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎮 Roblox Script Hub</h1>
                <p>Advanced HWID-locked scripts for enhanced gameplay</p>
            </div>
            
            <div class="scripts-grid">
                <div class="script-card">
                    <span class="script-badge badge-free">FREE</span>
                    <h3>Free Script</h3>
                    <p>Basic features to get you started with our script system.</p>
                    <ul class="script-features">
                        <li>Essential game features</li>
                        <li>Easy to use</li>
                        <li>HWID protected</li>
                        <li>Regular updates</li>
                    </ul>
                    <button class="btn" onclick="alert('Join our Discord and use /panel to get your free script!')">
                        Get Free Script
                    </button>
                </div>
                
                <div class="script-card premium">
                    <span class="script-badge badge-premium">PREMIUM</span>
                    <h3>Premium Script</h3>
                    <p>Advanced features and exclusive capabilities for power users.</p>
                    <ul class="script-features">
                        <li>All free features plus:</li>
                        <li>Advanced game tools</li>
                        <li>Priority support</li>
                        <li>Early access to updates</li>
                        <li>Exclusive features</li>
                    </ul>
                    <button class="btn btn-premium" onclick="alert('Join our Discord and get special role to access premium scripts!')">
                        Get Premium Script
                    </button>
                </div>
            </div>
            
            <div class="info-section">
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-icon">🔒</div>
                        <h4>HWID Protected</h4>
                        <p>Each script is locked to your device for maximum security</p>
                    </div>
                    <div class="info-item">
                        <div class="info-icon">⚡</div>
                        <h4>Fast Execution</h4>
                        <p>Optimized scripts for smooth performance in-game</p>
                    </div>
                    <div class="info-item">
                        <div class="info-icon">🛡️</div>
                        <h4>Safe & Secure</h4>
                        <p>Regular updates to ensure compatibility and safety</p>
                    </div>
                    <div class="info-item">
                        <div class="info-icon">🎯</div>
                        <h4>Easy to Use</h4>
                        <p>Simple copy-paste system with automatic HWID detection</p>
                    </div>
                </div>
                
                <div class="discord-link">
                    <a href="https://discord.gg/your-server" class="discord-btn" target="_blank">
                        <span>Join Our Discord</span>
                        <span>🎮</span>
                    </a>
                    <p style="margin-top: 15px; color: var(--text-secondary);">
                        Use <code>/panel</code> in our Discord to get your scripts!
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `);
});

// API endpoint to serve scripts with HWID verification
app.get('/script/:scriptId', (req, res) => {
    const { scriptId } = req.params;
    const clientHWID = req.query.hwid;
    const licenseKey = req.query.key;
    
    const script = scripts.get(scriptId);
    
    if (!script) {
        return res.status(404).send('Script not found');
    }
    
    // Check if script requires license key
    if (script.requiresKey) {
        if (!licenseKey) {
            return res.status(403).send('License key required');
        }
        
        const keyData = userKeys.get(licenseKey);
        if (!keyData || keyData.used || keyData.scriptId !== scriptId) {
            return res.status(403).send('Invalid license key');
        }
        
        // Mark key as used
        keyData.used = true;
        userKeys.set(licenseKey, keyData);
    }
    
    // HWID verification
    if (clientHWID) {
        const hwidLock = hwidLocks.get(clientHWID);
        if (!hwidLock || hwidLock.scriptId !== scriptId) {
            return res.status(403).send('HWID not authorized for this script');
        }
    }
    
    // Serve the actual Lua script
    // This would be your actual script content
    const luaScript = `
-- Roblox Script - ${script.name}
-- Version: ${script.version}
-- HWID: ${clientHWID || 'NOT_VERIFIED'}

print("🔒 HWID Locked Script Loaded")
print("📝 Script: ${script.name}")
print("⚡ Version: ${script.version}")

if not (${clientHWID ? `"${clientHWID}"` : 'false'}) then
    print("❌ HWID verification failed!")
    return
end

print("✅ HWID Verified: ${clientHWID}")

-- Your actual script code here
game:GetService("Players").LocalPlayer.Chatted:Connect(function(msg)
    if msg == "/features" then
        print("🎮 Script Features:")
        print("⭐ Premium Features Active")
        print("🔒 HWID Protected")
    end
end)

print("🚀 Script successfully loaded!")
    `.trim();
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(luaScript);
});

// API endpoint to verify HWID
app.post('/api/verify-hwid', express.json(), (req, res) => {
    const { hwid, scriptId } = req.body;
    
    if (!hwid || !scriptId) {
        return res.json({ valid: false, error: 'Missing parameters' });
    }
    
    const hwidLock = hwidLocks.get(hwid);
    const isValid = hwidLock && hwidLock.scriptId === scriptId;
    
    res.json({ 
        valid: isValid,
        script: isValid ? scripts.get(scriptId) : null
    });
});

// API endpoint to get user's scripts
app.get('/api/user-scripts/:userId', (req, res) => {
    const { userId } = req.params;
    
    const userScripts = Array.from(hwidLocks.values())
        .filter(lock => lock.userId === userId)
        .map(lock => ({
            scriptId: lock.scriptId,
            script: scripts.get(lock.scriptId),
            hwid: lock.hwid,
            createdAt: lock.createdAt
        }));
    
    res.json({ scripts: userScripts });
});

// Error handling
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
                    background: #0a0a0a; 
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

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Server running on port ' + PORT);
    console.log('🎮 Roblox Script System Ready');
    console.log('🔒 HWID Locking System Active');
    console.log('🤖 Discord Bot Integration Enabled');
    
    // Load bot token
    loadBotToken();
});
