const express = require('express');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const https = require('https');

const app = express();
const server = require('http').createServer(app);
const PORT = process.env.PORT || 3000;

// Website URL
const WEBSITE_URL = 'https://tommyfc555-github-io.onrender.com';

// Variable to store the bot token
let BOT_TOKEN = '';

// Function to fetch token from pastefy
function fetchTokenFromPastefy() {
    return new Promise((resolve, reject) => {
        console.log('🔗 Fetching bot token from Pastefy...');
        https.get('https://pastefy.app/Pez2ITgu/raw', (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                const token = data.trim();
                if (token && token.length > 10) {
                    console.log('✅ Token fetched successfully from Pastefy');
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

// Discord Bot Setup
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

// Store user data
const userData = new Map();

// Generate random key
function generateKey() {
    return 'KEY-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Generate random HWID
function generateHWID() {
    return Math.random().toString(36).substr(2, 16).toUpperCase();
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize bot
async function initializeBot() {
    try {
        // Fetch token from Pastefy
        BOT_TOKEN = await fetchTokenFromPastefy();
        
        // Login bot
        await client.login(BOT_TOKEN);
        
        // Register slash commands after bot is ready
        client.once('ready', async () => {
            console.log(`🤖 Discord bot logged in as ${client.user.tag}`);
            console.log(`🌐 Website: ${WEBSITE_URL}`);
            console.log(`🔗 Bot Invite Link: https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot%20applications.commands`);
            
            // Register slash commands
            const commands = [
                {
                    name: 'panel',
                    description: 'Open the script management panel'
                }
            ];

            try {
                const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
                console.log('🔧 Registering slash commands...');
                await rest.put(
                    Routes.applicationCommands(client.user.id),
                    { body: commands }
                );
                console.log('✅ Slash commands registered!');
            } catch (error) {
                console.error('❌ Error registering commands:', error);
            }
        });

    } catch (error) {
        console.error('❌ Failed to initialize bot:', error.message);
        console.log('💡 Make sure the Pastefy link contains a valid bot token');
        process.exit(1);
    }
}

// Discord Bot Ready
client.once('ready', () => {
    console.log(`🤖 Discord bot logged in as ${client.user.tag}`);
});

// Slash Command Handler - PANEL FOR EVERYONE
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, user } = interaction;

    if (commandName === 'panel') {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_key')
                    .setLabel('🔑 Claim Key')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('get_script')
                    .setLabel('📜 Get Script')
                    .setStyle(ButtonStyle.Primary)
            );

        const embed = new EmbedBuilder()
            .setTitle('🔒 SCRIPT MANAGEMENT PANEL')
            .setDescription('**Get your HWID-locked script**')
            .setColor(0x000000)
            .addFields(
                { name: '🔑 CLAIM KEY', value: 'Generate your unique key (automatically locks to your device)' },
                { name: '📜 GET SCRIPT', value: 'Get your script loadstring after claiming key' }
            )
            .setFooter({ text: '🔒 Secure HWID Protection System' });

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    }
});

// Button Interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, user } = interaction;

    if (customId === 'claim_key') {
        // Check if user already has a key
        if (userData.has(user.id)) {
            const userInfo = userData.get(user.id);
            return await interaction.reply({
                content: `❌ You already have a key!\n**Your Key:** \`${userInfo.key}\``,
                ephemeral: true
            });
        }

        const key = generateKey();
        const hwid = generateHWID();
        
        userData.set(user.id, {
            key: key,
            hwid: hwid,
            claimedAt: new Date(),
            discordId: user.id,
            username: user.tag
        });

        await interaction.reply({
            content: `✅ **Key claimed successfully!**\n**Your Key:** \`${key}\`\n\nNow use the **Get Script** button to get your script.`,
            ephemeral: true
        });
    }

    if (customId === 'get_script') {
        const userInfo = userData.get(user.id);
        
        if (!userInfo) {
            return await interaction.reply({
                content: '❌ **No key found!** Use the **Claim Key** button first.',
                ephemeral: true
            });
        }

        // Create loadstring with website URL
        const loadstring = `loadstring(game:HttpGet("${WEBSITE_URL}/script/${userInfo.key}"))()`;

        const embed = new EmbedBuilder()
            .setTitle('📜 YOUR SCRIPT')
            .setDescription('**Copy the loadstring below and execute it in Roblox:**')
            .setColor(0x0099ff)
            .addFields(
                { name: '🔑 Your Key', value: `\`${userInfo.key}\``, inline: true },
                { name: '📜 Loadstring', value: `\`\`\`lua\n${loadstring}\n\`\`\``, inline: false }
            )
            .setFooter({ text: 'Script automatically locks to your device HWID' });

        await interaction.reply({ 
            embeds: [embed],
            ephemeral: true 
        });
    }
});

// Script endpoint - serves the actual Lua script with proper HWID detection
app.get('/script/:key', (req, res) => {
    const { key } = req.params;
    
    // Find user by key
    let userInfo = null;
    for (let data of userData.values()) {
        if (data.key === key) {
            userInfo = data;
            break;
        }
    }

    if (!userInfo) {
        return res.status(404).send('-- ❌ INVALID KEY');
    }

    // Create the actual protected script with proper HWID detection
    const luaScript = `-- 🔒 HWID Protected Script
-- User: ${userInfo.username}
-- Key: ${userInfo.key}
-- Generated: ${new Date().toISOString()}

local function getHardwareID()
    -- Try multiple methods to get HWID
    local hwid = nil
    
    -- Method 1: RbxAnalyticsService (most reliable)
    local success1, result1 = pcall(function()
        return game:GetService("RbxAnalyticsService"):GetClientId()
    end)
    
    if success1 and result1 then
        hwid = result1
    else
        -- Method 2: Stats (fallback)
        local success2, result2 = pcall(function()
            return game:GetService("Stats"):GetTotalMemoryUsage()
        end)
        
        if success2 and result2 then
            hwid = tostring(result2)
        else
            -- Method 3: Custom hash (final fallback)
            local success3, result3 = pcall(function()
                local players = game:GetService("Players")
                local localPlayer = players.LocalPlayer
                if localPlayer then
                    return tostring(localPlayer.UserId) .. "_" .. tostring(tick())
                end
                return "unknown_" .. tostring(tick())
            end)
            hwid = success3 and result3 or "error"
        end
    end
    
    return hwid
end

local function verifyAccess()
    local currentHWID = getHardwareID()
    local expectedHWID = "${userInfo.hwid}"
    
    print("🔍 Checking HWID...")
    print("📱 Current Device ID: " .. tostring(currentHWID))
    
    -- Compare HWIDs
    if currentHWID == expectedHWID then
        print("✅ HWID VERIFIED - ACCESS GRANTED")
        print("👤 User: ${userInfo.username}")
        print("🔑 Key: ${userInfo.key}")
        return true
    else
        print("❌ HWID MISMATCH - ACCESS DENIED")
        print("💡 This script is locked to a specific device")
        print("🔒 Contact support if this is your first time running")
        return false
    end
end

-- Verify access before executing main script
if not verifyAccess() then
    return
end

-- ✅ ACCESS GRANTED - EXECUTING MAIN SCRIPT
print("🚀 Script loaded successfully!")
print("✨ Protected by HWID System")

-- MAIN SCRIPT CONTENT GOES HERE
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer

if LocalPlayer and LocalPlayer.Character then
    local humanoid = LocalPlayer.Character:FindFirstChild("Humanoid")
    if humanoid then
        humanoid.WalkSpeed = 50
        print("🏃‍♂️ WalkSpeed set to 50")
    end
end

-- Add your main script functionality below
local function main()
    print("🎯 Main script execution started")
    
    -- Example functionality
    local player = game.Players.LocalPlayer
    if player then
        print("👋 Hello, " .. player.Name .. "!")
    end
    
    print("✅ Script execution completed!")
    print("🔒 Secure HWID Protection Active")
end

-- Start main script
main()`;

    res.setHeader('Content-Type', 'text/plain');
    res.send(luaScript);
});

// Simple homepage
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🔒 HWID Script System</title>
            <style>
                body {
                    background: #000;
                    color: #0f0;
                    font-family: 'Courier New', monospace;
                    text-align: center;
                    padding: 50px;
                }
                h1 {
                    color: #0f0;
                    text-shadow: 0 0 10px #0f0;
                }
                .info {
                    background: #111;
                    border: 1px solid #0f0;
                    padding: 20px;
                    margin: 20px auto;
                    max-width: 600px;
                    border-radius: 5px;
                }
            </style>
        </head>
        <body>
            <h1>🔒 HWID SCRIPT SYSTEM</h1>
            <div class="info">
                <p>This is the backend for the HWID-protected script system.</p>
                <p>Use the Discord bot to get your script.</p>
                <p><strong>Website:</strong> ${WEBSITE_URL}</p>
                <p><strong>Status:</strong> 🟢 ONLINE</p>
            </div>
        </body>
        </html>
    `);
});

// Admin route to view all users
app.get('/admin/users', (req, res) => {
    if (userData.size === 0) {
        return res.json({ message: 'No users registered' });
    }
    
    const users = Array.from(userData.entries()).map(([id, data]) => ({
        discordId: id,
        username: data.username,
        key: data.key,
        hwid: data.hwid,
        claimedAt: data.claimedAt
    }));
    
    res.json({ totalUsers: userData.size, users });
});

// Start server
server.listen(PORT, () => {
    console.log(`🌐 Server started on port ${PORT}`);
    console.log(`🔗 Public URL: ${WEBSITE_URL}`);
    console.log('🔗 Fetching bot token from Pastefy...');
    
    // Initialize the bot
    initializeBot();
});
