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
const usedKeys = new Set();

// Generate random key
function generateKey() {
    return 'KEY-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Generate random HWID
function generateHWID() {
    return 'HWID-' + Math.random().toString(36).substr(2, 12).toUpperCase();
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
                    .setLabel('🔑 Claim Key & HWID')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('redeem_key')
                    .setLabel('🎫 Redeem Key')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('get_script')
                    .setLabel('📜 Get Script')
                    .setStyle(ButtonStyle.Secondary)
            );

        const embed = new EmbedBuilder()
            .setTitle('🔒 SCRIPT MANAGEMENT PANEL')
            .setDescription('**Get your HWID-locked script**')
            .setColor(0x000000)
            .addFields(
                { name: '🔑 CLAIM KEY & HWID', value: 'Generate your unique key and HWID (sent via DM)' },
                { name: '🎫 REDEEM KEY', value: 'Redeem your key to activate your account' },
                { name: '📜 GET SCRIPT', value: 'Get your script after redeeming your key' }
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
                content: `❌ You already have a key!\n**Your Key:** ||\`${userInfo.key}\`||\n**Your HWID:** ||\`${userInfo.hwid}\`||\n**Status:** ${userInfo.redeemed ? '✅ Redeemed' : '❌ Not Redeemed'}`,
                ephemeral: true
            });
        }

        const key = generateKey();
        const hwid = generateHWID();
        
        userData.set(user.id, {
            key: key,
            hwid: hwid,
            redeemed: false,
            claimedAt: new Date(),
            discordId: user.id,
            username: user.tag
        });

        // Send DM with key and HWID
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle('🔑 YOUR KEY & HWID')
                .setDescription('**Keep this information secure!**')
                .setColor(0x00ff00)
                .addFields(
                    { name: '🔑 Your Key', value: `\`${key}\``, inline: true },
                    { name: '🆔 Your HWID', value: `\`${hwid}\``, inline: true },
                    { name: '📋 Next Steps', value: '1. Use **Redeem Key** button to activate\n2. Then use **Get Script** to get your script', inline: false }
                )
                .setFooter({ text: 'Do not share this information with anyone!' });

            await user.send({ embeds: [dmEmbed] });
            
            await interaction.reply({
                content: '✅ **Key and HWID generated!** Check your DMs for your credentials.',
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: '❌ **Cannot send DMs!** Please enable DMs from server members and try again.',
                ephemeral: true
            });
        }
    }

    if (customId === 'redeem_key') {
        // Create modal for key input
        const modal = new ModalBuilder()
            .setCustomId('redeem_key_modal')
            .setTitle('🎫 REDEEM KEY');

        const keyInput = new TextInputBuilder()
            .setCustomId('redeem_key')
            .setLabel('ENTER YOUR KEY TO REDEEM')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('KEY-ABC123XYZ')
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(keyInput);
        modal.addComponents(firstActionRow);
        await interaction.showModal(modal);
    }

    if (customId === 'get_script') {
        const userInfo = userData.get(user.id);
        
        if (!userInfo) {
            return await interaction.reply({
                content: '❌ **No key found!** Use the **Claim Key & HWID** button first.',
                ephemeral: true
            });
        }

        if (!userInfo.redeemed) {
            return await interaction.reply({
                content: '❌ **Key not redeemed!** Use the **Redeem Key** button to activate your key first.',
                ephemeral: true
            });
        }

        // Create loadstring with website URL
        const loadstring = `loadstring(game:HttpGet("${WEBSITE_URL}/script/${userInfo.hwid}/${userInfo.key}"))()`;

        const embed = new EmbedBuilder()
            .setTitle('📜 YOUR SCRIPT')
            .setDescription('**Copy the loadstring below and execute it in Roblox:**')
            .setColor(0x0099ff)
            .addFields(
                { name: '🔑 Your Key', value: `\`${userInfo.key}\``, inline: true },
                { name: '🆔 Your HWID', value: `\`${userInfo.hwid}\``, inline: true },
                { name: '📜 Loadstring', value: `\`\`\`lua\n${loadstring}\n\`\`\``, inline: false }
            )
            .setFooter({ text: 'Script protected with HWID verification' });

        await interaction.reply({ 
            embeds: [embed],
            ephemeral: true 
        });
    }
});

// Modal Interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    const { customId, user, fields } = interaction;

    if (customId === 'redeem_key_modal') {
        const key = fields.getTextInputValue('redeem_key').trim();

        // Find user by key
        let userEntry = null;
        for (let [userId, data] of userData.entries()) {
            if (data.key === key) {
                userEntry = { userId, data };
                break;
            }
        }

        if (!userEntry) {
            return await interaction.reply({
                content: '❌ **INVALID KEY**\nThe key you entered does not exist.',
                ephemeral: true
            });
        }

        if (userEntry.userId !== user.id) {
            return await interaction.reply({
                content: '❌ **ACCESS DENIED**\nThis key belongs to another user.',
                ephemeral: true
            });
        }

        if (userEntry.data.redeemed) {
            return await interaction.reply({
                content: '❌ **KEY ALREADY REDEEMED**\nThis key has already been activated.',
                ephemeral: true
            });
        }

        // Redeem the key
        userData.set(userEntry.userId, {
            ...userEntry.data,
            redeemed: true,
            redeemedAt: new Date()
        });

        const embed = new EmbedBuilder()
            .setTitle('✅ KEY REDEEMED SUCCESSFULLY!')
            .setDescription('**Your key has been activated!**')
            .setColor(0x00ff00)
            .addFields(
                { name: '🔑 Key', value: `\`${userEntry.data.key}\``, inline: true },
                { name: '🆔 HWID', value: `\`${userEntry.data.hwid}\``, inline: true },
                { name: '📜 Next Step', value: 'Use the **Get Script** button to get your loadstring', inline: false }
            )
            .setFooter({ text: `Redeemed at: ${new Date().toLocaleString()}` });

        await interaction.reply({ 
            embeds: [embed],
            ephemeral: true 
        });
    }
});

// Script endpoint - serves the actual Lua script
app.get('/script/:hwid/:key', (req, res) => {
    const { hwid, key } = req.params;
    
    // Find user by key and HWID
    let userInfo = null;
    for (let data of userData.values()) {
        if (data.key === key && data.hwid === hwid && data.redeemed) {
            userInfo = data;
            break;
        }
    }

    if (!userInfo) {
        return res.status(404).send('-- ❌ INVALID KEY/HWID OR NOT REDEEMED');
    }

    // Create the actual protected script
    const luaScript = `-- 🔒 HWID Protected Script
-- User: ${userInfo.username}
-- Key: ${userInfo.key}
-- HWID: ${userInfo.hwid}
-- Generated: ${new Date().toISOString()}

local function verifyHWID()
    local userHWID = game:GetService("RbxAnalyticsService"):GetClientId()
    
    if userHWID ~= "${userInfo.hwid}" then
        warn("❌ HWID MISMATCH!")
        warn("Expected: ${userInfo.hwid}")
        warn("Found: " .. tostring(userHWID))
        warn("🔒 ACCESS DENIED - This script is locked to a specific device")
        return false
    end
    
    print("✅ HWID VERIFIED - ACCESS GRANTED")
    print("👤 User: ${userInfo.username}")
    print("🔑 Key: ${userInfo.key}")
    print("🆔 HWID: ${userInfo.hwid}")
    return true
end

-- Verify HWID before executing main script
if not verifyHWID() then
    return
end

-- ✅ HWID VERIFIED - EXECUTING MAIN SCRIPT
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
print("🎯 Script execution completed!")
print("🔒 Secure HWID Protection Active")`;

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
        redeemed: data.redeemed,
        claimedAt: data.claimedAt,
        redeemedAt: data.redeemedAt || 'Not redeemed'
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
