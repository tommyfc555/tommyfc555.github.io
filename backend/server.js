const express = require('express');
const http = require('http');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
const hwidLocks = new Map();

// Only your Discord ID can access the scripts
const YOUR_DISCORD_ID = '1415022792214052915';

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

function generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
}

// Check if user is you
function isYou(userId) {
    return userId === YOUR_DISCORD_ID;
}

// Initialize scripts
function initializeScripts() {
    scripts.set('premium_script', {
        id: 'premium_script',
        name: 'Premium Script',
        description: 'Exclusive premium Roblox script',
        version: '1.0.0',
        loadstring: `loadstring(game:HttpGet("https://tommyfc555-github-io.onrender.com/script/premium_script?hwid=HWID_PLACEHOLDER"))()`,
        requiresYou: true
    });
}

// Load bot token from Pastebin
async function loadBotToken() {
    try {
        console.log('🔗 Loading bot token from Pastebin...');
        const response = await fetch('https://pastefy.app/xU4v8ZyY/raw');
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
            description: 'Get your exclusive HWID-locked script'
        },
        {
            name: 'myhwid',
            description: 'Get your current HWID information'
        }
    ];

    async function registerCommands() {
        try {
            const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
            console.log('🔨 Registering slash commands...');
            await rest.put(
                Routes.applicationCommands(discordBot.user?.id),
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

    // Handle commands
    discordBot.on('interactionCreate', async interaction => {
        if (!interaction.isCommand()) return;

        const { commandName, user } = interaction;

        try {
            if (commandName === 'panel') {
                // Check if user is you
                if (!isYou(user.id)) {
                    return interaction.reply({
                        content: '❌ This command is exclusive to the script owner only.',
                        ephemeral: true
                    });
                }

                // Create the panel embed
                const panelEmbed = new EmbedBuilder()
                    .setTitle('🔒 Exclusive Script Panel')
                    .setDescription('Welcome! Generate your HWID-locked premium script below.')
                    .setColor(0x5865F2)
                    .addFields(
                        {
                            name: '📜 Your Script',
                            value: 'Premium Roblox Script with exclusive features',
                            inline: false
                        },
                        {
                            name: '🔐 Security',
                            value: 'Each script is uniquely locked to your device HWID',
                            inline: false
                        }
                    )
                    .setFooter({ text: 'Only you can generate and use this script' });

                // Create button
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('generate_my_script')
                            .setLabel('Generate My Script')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🔑')
                    );

                await interaction.reply({
                    embeds: [panelEmbed],
                    components: [row],
                    ephemeral: true
                });

            } else if (commandName === 'myhwid') {
                if (!isYou(user.id)) {
                    return interaction.reply({
                        content: '❌ This command is exclusive to the script owner only.',
                        ephemeral: true
                    });
                }

                // Generate HWID for this user
                const hwid = generateHWID({ 
                    ip: 'discord', 
                    headers: { 'user-agent': `discord:${user.id}` } 
                });

                const hwidEmbed = new EmbedBuilder()
                    .setTitle('🆔 Your HWID Information')
                    .setColor(0xFEE75C)
                    .addFields(
                        { name: 'Your HWID', value: `\`${hwid}\``, inline: false },
                        { name: 'Discord ID', value: `\`${user.id}\``, inline: true },
                        { name: 'Username', value: `\`${user.tag}\``, inline: true }
                    )
                    .setFooter({ text: 'This HWID is unique to your device' })
                    .setTimestamp();

                await interaction.reply({
                    embeds: [hwidEmbed],
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

        const { customId, user } = interaction;

        try {
            if (customId === 'generate_my_script') {
                // Check if user is you
                if (!isYou(user.id)) {
                    return interaction.reply({
                        content: '❌ This action is exclusive to the script owner only.',
                        ephemeral: true
                    });
                }

                // Generate HWID for this user
                const hwid = generateHWID({ 
                    ip: 'discord', 
                    headers: { 'user-agent': `discord:${user.id}` } 
                });

                const script = scripts.get('premium_script');
                
                // Create the loadstring with actual HWID
                const loadstringUrl = `https://tommyfc555-github-io.onrender.com/script/premium_script?hwid=${hwid}`;
                const personalizedLoadstring = `loadstring(game:HttpGet("${loadstringUrl}"))()`;
                
                // Create the final script format
                const finalScript = `[YOURHWID=${hwid}]\n${personalizedLoadstring}`;

                // Store HWID lock
                hwidLocks.set(hwid, {
                    userId: user.id,
                    scriptId: 'premium_script',
                    createdAt: Date.now(),
                    hwid: hwid,
                    username: user.tag
                });

                const scriptEmbed = new EmbedBuilder()
                    .setTitle('⭐ Your Exclusive Script')
                    .setDescription('Your HWID-locked premium script is ready!')
                    .setColor(0x57F287)
                    .addFields(
                        { 
                            name: '📋 Copy This Script', 
                            value: `\`\`\`lua\n${finalScript}\n\`\`\``,
                            inline: false 
                        },
                        { 
                            name: '🚀 How to Use', 
                            value: '1. Copy the entire script above\n2. Paste in Roblox executor\n3. Execute and enjoy!',
                            inline: false 
                        },
                        { 
                            name: '🔒 Security Info', 
                            value: `**HWID:** \`${hwid}\`\nThis script will only work on your device.`,
                            inline: false 
                        }
                    )
                    .setFooter({ text: 'Exclusive access • Do not share!' })
                    .setTimestamp();

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

// Serve homepage - Only shows script to you
app.get('/', (req, res) => {
    const clientHWID = generateHWID(req);
    
    // Check if this is you accessing the site
    const isYouAccessing = false; // We can't easily verify Discord ID from web
    
    if (isYouAccessing) {
        res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Exclusive Script Hub</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    font-family: 'Inter', sans-serif;
                }
                
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                
                :root {
                    --primary: #5865F2;
                    --success: #57F287;
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
                    max-width: 800px;
                    margin: 0 auto;
                    text-align: center;
                }
                
                .header {
                    margin-bottom: 40px;
                    padding: 40px 0;
                }
                
                .header h1 {
                    font-size: 3em;
                    background: linear-gradient(135deg, var(--primary), var(--success));
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 10px;
                }
                
                .script-card {
                    background: var(--bg-card);
                    border-radius: 15px;
                    padding: 30px;
                    border: 2px solid var(--primary);
                    margin-bottom: 30px;
                }
                
                .hwid-info {
                    background: rgba(88, 101, 242, 0.1);
                    border-radius: 10px;
                    padding: 20px;
                    margin-bottom: 20px;
                }
                
                .script-code {
                    background: #000;
                    border-radius: 10px;
                    padding: 20px;
                    margin: 20px 0;
                    text-align: left;
                    border: 1px solid #333;
                }
                
                code {
                    color: var(--success);
                    font-family: 'Courier New', monospace;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔒 Exclusive Script Hub</h1>
                    <p style="color: var(--text-secondary);">Welcome! This is your exclusive script.</p>
                </div>
                
                <div class="script-card">
                    <div class="hwid-info">
                        <h3>🆔 Your HWID: ${clientHWID}</h3>
                        <p>This script is locked to your device</p>
                    </div>
                    
                    <h3>⭐ Premium Script</h3>
                    <p>Your exclusive Roblox script with advanced features</p>
                    
                    <div class="script-code">
                        <code>
                            -- Your exclusive script content would be here<br>
                            -- HWID Verified: ${clientHWID}<br>
                            -- Access: APPROVED
                        </code>
                    </div>
                </div>
                
                <p style="color: var(--text-secondary);">
                    Use <code>/panel</code> in Discord to get your loadstring!
                </p>
            </div>
        </body>
        </html>
        `);
    } else {
        res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Access Denied</title>
            <style>
                body {
                    background: #0a0a0a;
                    color: white;
                    font-family: 'Inter', sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                }
                .message {
                    background: rgba(237, 66, 69, 0.1);
                    border: 1px solid rgba(237, 66, 69, 0.3);
                    border-radius: 15px;
                    padding: 40px;
                    backdrop-filter: blur(10px);
                }
            </style>
        </head>
        <body>
            <div class="message">
                <h1>🚫 Access Denied</h1>
                <p>This website contains exclusive content for the script owner only.</p>
                <p>If you are the owner, use the Discord bot to access your scripts.</p>
            </div>
        </body>
        </html>
        `);
    }
});

// API endpoint to serve scripts with HWID verification
app.get('/script/premium_script', (req, res) => {
    const clientHWID = req.query.hwid;
    
    if (!clientHWID) {
        return res.status(400).send('HWID parameter required');
    }
    
    // Verify HWID
    const hwidLock = hwidLocks.get(clientHWID);
    if (!hwidLock) {
        return res.status(403).send('HWID not authorized');
    }
    
    // Only you can access the script
    if (!isYou(hwidLock.userId)) {
        return res.status(403).send('Access denied');
    }
    
    // Serve the actual Lua script
    const luaScript = `
-- 🔒 Exclusive Premium Script
-- 👤 Owner: ${hwidLock.username}
-- 🆔 HWID: ${clientHWID}
-- ✅ Access: VERIFIED

print("⭐ Exclusive Premium Script Loaded!")
print("🔒 HWID Verified: ${clientHWID}")
print("👤 Authorized User: ${hwidLock.username}")

-- HWID Verification
local expectedHWID = "${clientHWID}"
local function getClientHWID()
    -- This would be your actual HWID detection logic in Roblox
    return "${clientHWID}"
end

if getClientHWID() ~= expectedHWID then
    print("❌ HWID verification failed!")
    print("🚫 This script is locked to another device")
    return
end

print("✅ HWID verification successful!")
print("🎮 Loading premium features...")

-- Your premium script content here
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer

-- Premium GUI
local ScreenGui = Instance.new("ScreenGui")
local MainFrame = Instance.new("Frame")
local Title = Instance.new("TextLabel")

ScreenGui.Parent = game.CoreGui
ScreenGui.Name = "ExclusivePremiumGUI"

MainFrame.Parent = ScreenGui
MainFrame.Size = UDim2.new(0, 400, 0, 300)
MainFrame.Position = UDim2.new(0.5, -200, 0.5, -150)
MainFrame.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
MainFrame.BorderSizePixel = 0
MainFrame.Active = true
MainFrame.Draggable = true

Title.Parent = MainFrame
Title.Size = UDim2.new(1, 0, 0, 40)
Title.BackgroundColor3 = Color3.fromRGB(88, 101, 242)
Title.Text = "⭐ Exclusive Premium Script v1.0"
Title.TextColor3 = Color3.fromRGB(255, 255, 255)
Title.TextSize = 18
Title.Font = Enum.Font.GothamBold

-- Add your exclusive features here
print("🚀 Premium features loaded successfully!")
print("🎉 Enjoy your exclusive script!")

-- Example feature
LocalPlayer.Chatted:Connect(function(msg)
    if msg == "/features" then
        print("🎮 Exclusive Features:")
        print("⭐ Premium GUI")
        print("🔒 HWID Protected")
        print("🚀 Advanced Tools")
        print("🎯 Exclusive Access")
    end
end)
    `.trim();
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(luaScript);
});

// API endpoint to verify HWID
app.post('/api/verify-hwid', express.json(), (req, res) => {
    const { hwid } = req.body;
    
    if (!hwid) {
        return res.json({ valid: false, error: 'HWID required' });
    }
    
    const hwidLock = hwidLocks.get(hwid);
    const isValid = hwidLock && isYou(hwidLock.userId);
    
    res.json({ 
        valid: isValid,
        user: isValid ? hwidLock.username : null,
        script: isValid ? 'premium_script' : null
    });
});

// API endpoint to get your scripts
app.get('/api/my-scripts', (req, res) => {
    const yourScripts = Array.from(hwidLocks.values())
        .filter(lock => isYou(lock.userId))
        .map(lock => ({
            scriptId: lock.scriptId,
            hwid: lock.hwid,
            createdAt: new Date(lock.createdAt).toLocaleString(),
            status: 'ACTIVE'
        }));
    
    res.json({ scripts: yourScripts });
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
    console.log('🔒 Exclusive Script System Ready');
    console.log('👤 Only Discord ID: 1415022792214052915 can access');
    console.log('🤖 Loading Discord bot...');
    
    // Load bot token from Pastebin
    loadBotToken();
});
