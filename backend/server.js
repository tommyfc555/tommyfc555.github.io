const express = require('express');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes } = require('discord.js');
const path = require('path');

const app = express();
const server = require('http').createServer(app);
const PORT = process.env.PORT || 3000;

// Discord Bot Setup
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Store user data
const userData = new Map();

// Generate random key
function generateKey() {
    return 'KEY-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// HWID validation
function validateHWID(hwid) {
    return hwid && hwid.length >= 8 && hwid.length <= 64;
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register slash commands
const commands = [
    {
        name: 'panel',
        description: 'Open the script management panel'
    }
];

const rest = new REST({ version: '10' }).setToken('https://pastefy.app/Pez2ITgu/raw');

(async () => {
    try {
        console.log('🔧 Registering slash commands...');
        await rest.put(
            Routes.applicationCommands('1432816884415463514'),
            { body: commands }
        );
        console.log('✅ Slash commands registered!');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
})();

// Discord Bot Ready
client.once('ready', () => {
    console.log(`🤖 Discord bot logged in as ${client.user.tag}`);
    console.log(`🌐 Website running on http://localhost:${PORT}`);
});

// Slash Command Handler
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
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('reset_hwid')
                    .setLabel('🔄 Reset HWID')
                    .setStyle(ButtonStyle.Danger)
            );

        const embed = new EmbedBuilder()
            .setTitle('🔒 Script Management Panel')
            .setDescription('Manage your HWID-locked script access')
            .setColor(0x00ff88)
            .addFields(
                { name: '🔑 Claim Key', value: 'Get your unique HWID key (One-time use)' },
                { name: '📜 Get Script', value: 'Download the script (requires key & HWID)' },
                { name: '🔄 Reset HWID', value: 'Generate new HWID for your key' }
            )
            .setFooter({ text: 'Each key is locked to your Discord account' });

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
        if (userData.has(user.id)) {
            return await interaction.reply({
                content: '❌ You already have a key! Use "Get Script" or "Reset HWID"',
                ephemeral: true
            });
        }

        const key = generateKey();
        userData.set(user.id, {
            key: key,
            hwid: null,
            claimedAt: new Date(),
            discordId: user.id,
            username: user.tag
        });

        const embed = new EmbedBuilder()
            .setTitle('🔑 Key Claimed Successfully!')
            .setDescription(`Your unique key: \`${key}\``)
            .addFields(
                { name: 'Next Steps', value: '1. Visit our website to set HWID\n2. Use "Get Script" to download' },
                { name: 'Important', value: '• This key is locked to your account\n• Only one HWID per key\n• Keep your key secure!' }
            )
            .setColor(0x00ff88)
            .setFooter({ text: `Claimed at: ${new Date().toLocaleString()}` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (customId === 'get_script') {
        const userInfo = userData.get(user.id);
        
        if (!userInfo) {
            return await interaction.reply({
                content: '❌ You need to claim a key first! Use the "Claim Key" button.',
                ephemeral: true
            });
        }

        if (!userInfo.hwid) {
            return await interaction.reply({
                content: `❌ HWID not set! Visit our website and enter your key to set HWID.\nWebsite: http://localhost:${PORT}`,
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📜 Script Ready for Download')
            .setDescription('Your HWID-locked script is ready!')
            .addFields(
                { name: 'Your Key', value: `\`${userInfo.key}\``, inline: true },
                { name: 'Your HWID', value: `\`${userInfo.hwid}\``, inline: true },
                { name: 'Download Link', value: `[Click Here](http://localhost:${PORT}/download/${userInfo.key})` }
            )
            .setColor(0x0099ff)
            .setFooter({ text: 'Script will only work with your HWID' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (customId === 'reset_hwid') {
        const userInfo = userData.get(user.id);
        
        if (!userInfo) {
            return await interaction.reply({
                content: '❌ You need to claim a key first!',
                ephemeral: true
            });
        }

        // Reset HWID
        userData.set(user.id, {
            ...userInfo,
            hwid: null
        });

        await interaction.reply({
            content: `✅ HWID reset successfully! Visit our website to set a new HWID:\nhttp://localhost:${PORT}`,
            ephemeral: true
        });
    }
});

// Website Routes
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LuaShield - HWID Management</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        body {
            background: #0f0f0f;
            color: #fff;
            min-height: 100vh;
            padding: 2rem;
            background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%);
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(26, 26, 26, 0.9);
            padding: 2rem;
            border-radius: 12px;
            border: 1px solid #333;
            backdrop-filter: blur(10px);
        }
        
        h1 {
            color: #00ff88;
            margin-bottom: 1rem;
            text-align: center;
            font-size: 2.5rem;
        }
        
        .subtitle {
            color: #ccc;
            text-align: center;
            margin-bottom: 2rem;
            font-size: 1.1rem;
        }
        
        .form-group {
            margin-bottom: 1.5rem;
        }
        
        label {
            display: block;
            margin-bottom: 0.5rem;
            color: #00ff88;
            font-weight: 600;
        }
        
        input {
            width: 100%;
            padding: 12px;
            background: #0a0a0a;
            border: 1px solid #333;
            border-radius: 6px;
            color: #fff;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        
        input:focus {
            outline: none;
            border-color: #00ff88;
        }
        
        button {
            width: 100%;
            padding: 12px;
            background: #00ff88;
            color: #000;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            margin-bottom: 1rem;
        }
        
        button:hover {
            background: #00cc66;
            transform: translateY(-2px);
        }
        
        .btn-reset {
            background: #ff4444;
            color: white;
        }
        
        .btn-reset:hover {
            background: #cc3333;
        }
        
        .result {
            margin-top: 1rem;
            padding: 1rem;
            border-radius: 6px;
            text-align: center;
            font-weight: bold;
        }
        
        .success {
            background: #00ff8820;
            border: 1px solid #00ff88;
            color: #00ff88;
        }
        
        .error {
            background: #ff444420;
            border: 1px solid #ff4444;
            color: #ff4444;
        }
        
        .info-box {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1.5rem;
        }
        
        .info-box h3 {
            color: #00ff88;
            margin-bottom: 0.5rem;
        }
        
        .steps {
            margin-left: 1.5rem;
            color: #ccc;
        }
        
        .steps li {
            margin-bottom: 0.5rem;
        }
        
        .discord-info {
            background: #5865f2;
            border: 1px solid #4752c4;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1.5rem;
            text-align: center;
        }
        
        .discord-info a {
            color: white;
            text-decoration: none;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 LuaShield</h1>
        <div class="subtitle">HWID-Locked Script Management</div>
        
        <div class="discord-info">
            <strong>📢 Discord Bot Required:</strong><br>
            Use <code>/panel</code> in Discord to get started!
        </div>
        
        <div class="info-box">
            <h3>📋 How It Works:</h3>
            <ol class="steps">
                <li>Use Discord bot <code>/panel</code> to claim your key</li>
                <li>Set your HWID here using the key</li>
                <li>Download your personalized script from Discord</li>
                <li>Script only works with your HWID</li>
            </ol>
        </div>

        <div class="form-group">
            <label for="keyInput">🔑 Your Key:</label>
            <input type="text" id="keyInput" placeholder="Enter your key (e.g., KEY-ABC123)" />
        </div>
        
        <div class="form-group">
            <label for="hwidInput">🆔 Your HWID:</label>
            <input type="text" id="hwidInput" placeholder="Enter your HWID (min 8 characters)" />
        </div>
        
        <button onclick="setHWID()">✅ Set HWID</button>
        <button onclick="resetHWID()" class="btn-reset">🔄 Reset HWID</button>
        
        <div id="result"></div>
    </div>

    <script>
        async function setHWID() {
            const key = document.getElementById('keyInput').value.trim();
            const hwid = document.getElementById('hwidInput').value.trim();
            const resultDiv = document.getElementById('result');
            
            if (!key || !hwid) {
                showResult('Please enter both key and HWID', 'error');
                return;
            }
            
            if (hwid.length < 8) {
                showResult('HWID must be at least 8 characters', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/set-hwid', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ key, hwid })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showResult('✅ HWID set successfully! You can now download your script from Discord using /panel → Get Script', 'success');
                } else {
                    showResult('❌ ' + data.error, 'error');
                }
            } catch (error) {
                showResult('❌ Network error: ' + error.message, 'error');
            }
        }
        
        async function resetHWID() {
            const key = document.getElementById('keyInput').value.trim();
            const resultDiv = document.getElementById('result');
            
            if (!key) {
                showResult('Please enter your key', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/reset-hwid', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ key })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showResult('✅ HWID reset! You can now set a new HWID.', 'success');
                    document.getElementById('hwidInput').value = '';
                } else {
                    showResult('❌ ' + data.error, 'error');
                }
            } catch (error) {
                showResult('❌ Network error: ' + error.message, 'error');
            }
        }
        
        function showResult(message, type) {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = message;
            resultDiv.className = 'result ' + type;
        }
    </script>
</body>
</html>
    `);
});

// API to set HWID
app.post('/api/set-hwid', (req, res) => {
    const { key, hwid } = req.body;

    if (!key || !hwid) {
        return res.json({ success: false, error: 'Key and HWID required' });
    }

    // Find user by key
    let userEntry = null;
    for (let [userId, data] of userData.entries()) {
        if (data.key === key) {
            userEntry = { userId, data };
            break;
        }
    }

    if (!userEntry) {
        return res.json({ success: false, error: 'Invalid key' });
    }

    if (userEntry.data.hwid) {
        return res.json({ success: false, error: 'HWID already set for this key. Use reset if needed.' });
    }

    if (!validateHWID(hwid)) {
        return res.json({ success: false, error: 'Invalid HWID format (8-64 characters required)' });
    }

    // Set HWID
    userData.set(userEntry.userId, {
        ...userEntry.data,
        hwid: hwid
    });

    res.json({ 
        success: true, 
        message: 'HWID set successfully!',
        discordId: userEntry.userId
    });
});

// API to reset HWID
app.post('/api/reset-hwid', (req, res) => {
    const { key } = req.body;

    if (!key) {
        return res.json({ success: false, error: 'Key required' });
    }

    // Find user by key
    let userEntry = null;
    for (let [userId, data] of userData.entries()) {
        if (data.key === key) {
            userEntry = { userId, data };
            break;
        }
    }

    if (!userEntry) {
        return res.json({ success: false, error: 'Invalid key' });
    }

    // Reset HWID
    userData.set(userEntry.userId, {
        ...userEntry.data,
        hwid: null
    });

    res.json({ 
        success: true, 
        message: 'HWID reset successfully!' 
    });
});

// Download script endpoint
app.get('/download/:key', (req, res) => {
    const key = req.params.key;
    
    // Find user by key
    let userInfo = null;
    for (let data of userData.values()) {
        if (data.key === key) {
            userInfo = data;
            break;
        }
    }

    if (!userInfo || !userInfo.hwid) {
        return res.status(404).send(`
            <html>
            <body style="background: #0f0f0f; color: #ff4444; font-family: Arial; text-align: center; padding: 50px;">
                <h1>❌ Access Denied</h1>
                <p>Key not found or HWID not set</p>
                <a href="/" style="color: #00ff88;">Return to Home</a>
            </body>
            </html>
        `);
    }

    // Generate the actual Lua script with HWID check
    const luaScript = `-- 🔒 LuaShield Protected Script
-- Key: ${userInfo.key}
-- HWID: ${userInfo.hwid}
-- User: ${userInfo.username}
-- Generated: ${new Date().toISOString()}

local function verifyHWID()
    local userHWID = game:GetService("RbxAnalyticsService"):GetClientId()
    
    if userHWID ~= "${userInfo.hwid}" then
        warn("[[LuaShield]] ❌ HWID Mismatch!")
        warn("[[LuaShield]] Expected: ${userInfo.hwid}")
        warn("[[LuaShield]] Found: " .. tostring(userHWID))
        warn("[[LuaShield]] 🔒 Access Denied - Script locked to different device")
        return false
    end
    
    print("[[LuaShield]] ✅ HWID Verified - Access Granted")
    print("[[LuaShield]] 👤 User: ${userInfo.username}")
    print("[[LuaShield]] 🔑 Key: ${userInfo.key}")
    return true
end

if not verifyHWID() then
    return
end

-- ✅ HWID Verified - Loading Main Script...
print("[[LuaShield]] 🚀 Script initialized successfully!")

-- Your main script content here
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer

if LocalPlayer and LocalPlayer.Character then
    LocalPlayer.Character:WaitForChild("Humanoid").WalkSpeed = 50
    print("[[LuaShield]] ✨ WalkSpeed set to 50")
end

print("[[LuaShield]] 🎯 Script execution completed!")
print("[[LuaShield]] 🔒 Protected by LuaShield HWID System")`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="luashield_${userInfo.key}.lua"`);
    res.send(luaScript);
});

// Admin route to view all users (optional)
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

// Start servers
server.listen(PORT, () => {
    console.log(`🌐 Website running on http://localhost:${PORT}`);
});

// Login bot (REPLACE WITH YOUR ACTUAL BOT TOKEN)
client.login('YOUR_BOT_TOKEN_HERE').catch(console.error);
