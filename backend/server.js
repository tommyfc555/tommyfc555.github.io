const express = require('express');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const https = require('https');

const app = express();
const server = require('http').createServer(app);
const PORT = process.env.PORT || 3000;

// Website URL
const WEBSITE_URL = 'https://tommyfc555-github-io.onrender.com';

// Whitelist role ID
const WHITELIST_ROLE_ID = '1432821388187664605';

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
        GatewayIntentBits.GuildMembers
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

// Check if user is whitelisted
function isWhitelisted(member) {
    return member.roles.cache.has(WHITELIST_ROLE_ID);
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
            console.log(`🌐 Website running on ${WEBSITE_URL}`);
            console.log(`🔗 Bot Invite Link: https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot%20applications.commands`);
            console.log(`⚪ Whitelist Role ID: ${WHITELIST_ROLE_ID}`);
            
            // Register slash commands
            const commands = [
                {
                    name: 'panel',
                    description: 'Open the script management panel'
                },
                {
                    name: 'whitelist',
                    description: 'Whitelist a user',
                    options: [
                        {
                            name: 'user',
                            type: 6, // USER type
                            description: 'The user to whitelist',
                            required: true
                        }
                    ]
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

// Slash Command Handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, user, member, options } = interaction;

    // Check permissions for whitelist command
    if (commandName === 'whitelist') {
        // Check if user has administrator permissions
        if (!member.permissions.has('ADMINISTRATOR')) {
            return await interaction.reply({
                content: '❌ **ACCESS DENIED**\nYou need administrator permissions to use this command.',
                ephemeral: true
            });
        }

        const targetUser = options.getUser('user');
        const targetMember = await interaction.guild.members.fetch(targetUser.id);

        try {
            // Add whitelist role to target user
            await targetMember.roles.add(WHITELIST_ROLE_ID);
            
            const embed = new EmbedBuilder()
                .setTitle('✅ USER WHITELISTED')
                .setDescription(`**${targetUser.tag}** has been whitelisted successfully!`)
                .setColor(0x00ff00)
                .addFields(
                    { name: 'Whitelisted User', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'Whitelisted By', value: `<@${user.id}>`, inline: true },
                    { name: 'Role Added', value: `<@&${WHITELIST_ROLE_ID}>`, inline: true }
                )
                .setFooter({ text: `Whitelisted at: ${new Date().toLocaleString()}` });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            await interaction.reply({
                content: '❌ **ERROR**\nFailed to whitelist user. Make sure the bot has the correct permissions.',
                ephemeral: true
            });
        }
        return;
    }

    if (commandName === 'panel') {
        // Check if user is whitelisted
        if (!isWhitelisted(member)) {
            const embed = new EmbedBuilder()
                .setTitle('❌ ACCESS DENIED')
                .setDescription('You are not whitelisted to use this system.')
                .setColor(0xff0000)
                .addFields(
                    { name: 'Required Role', value: `<@&${WHITELIST_ROLE_ID}>`, inline: true },
                    { name: 'How to Get Access', value: 'Contact an administrator to get whitelisted.', inline: true }
                )
                .setFooter({ text: 'Whitelist system active' });

            return await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }

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
            .setTitle('🔒 SCRIPT MANAGEMENT PANEL')
            .setDescription('**Manage your HWID-locked script access**')
            .setColor(0x000000)
            .addFields(
                { name: '🔑 CLAIM KEY', value: 'Get your unique HWID key (One-time use per user)' },
                { name: '📜 GET SCRIPT', value: 'Download script (Input your KEY & HWID)' },
                { name: '🔄 RESET HWID', value: 'Reset your HWID (Input your KEY & HWID)' }
            )
            .setFooter({ text: `🔒 Whitelisted User | Website: ${WEBSITE_URL}` });

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

    const { customId, user, member } = interaction;

    // Check if user is whitelisted for all button interactions
    if (!isWhitelisted(member)) {
        return await interaction.reply({
            content: '❌ **ACCESS DENIED**\nYou are not whitelisted to use this system.',
            ephemeral: true
        });
    }

    if (customId === 'claim_key') {
        if (userData.has(user.id)) {
            const userInfo = userData.get(user.id);
            return await interaction.reply({
                content: `❌ You already have a key!\n**Your Key:** \`${userInfo.key}\`\n**Your HWID:** \`${userInfo.hwid || 'Not Set'}\``,
                ephemeral: true
            });
        }

        const key = generateKey();
        userData.set(user.id, {
            key: key,
            hwid: null,
            claimedAt: new Date(),
            discordId: user.id,
            username: user.tag,
            whitelisted: true
        });

        const embed = new EmbedBuilder()
            .setTitle('🔑 KEY CLAIMED SUCCESSFULLY!')
            .setDescription(`**Your unique key:** \`${key}\``)
            .setColor(0x00ff00)
            .addFields(
                { name: '📋 NEXT STEPS', value: `1. **Set your HWID** using the website: ${WEBSITE_URL}\n2. **Get your script** using the Get Script button` },
                { name: '⚠️ IMPORTANT', value: '• This key is **permanently locked** to your account\n• Only **ONE HWID** per key\n• **Keep your key secure!**' }
            )
            .setFooter({ text: `Claimed at: ${new Date().toLocaleString()} | Whitelisted User` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (customId === 'get_script') {
        // Create modal for key and HWID input
        const modal = new ModalBuilder()
            .setCustomId('get_script_modal')
            .setTitle('📜 GET SCRIPT');

        const keyInput = new TextInputBuilder()
            .setCustomId('script_key')
            .setLabel('ENTER YOUR KEY')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('KEY-ABC123XYZ')
            .setRequired(true);

        const hwidInput = new TextInputBuilder()
            .setCustomId('script_hwid')
            .setLabel('ENTER YOUR HWID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Your unique HWID (min 8 chars)')
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(keyInput);
        const secondActionRow = new ActionRowBuilder().addComponents(hwidInput);

        modal.addComponents(firstActionRow, secondActionRow);
        await interaction.showModal(modal);
    }

    if (customId === 'reset_hwid') {
        // Create modal for reset HWID
        const modal = new ModalBuilder()
            .setCustomId('reset_hwid_modal')
            .setTitle('🔄 RESET HWID');

        const keyInput = new TextInputBuilder()
            .setCustomId('reset_key')
            .setLabel('ENTER YOUR KEY')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('KEY-ABC123XYZ')
            .setRequired(true);

        const hwidInput = new TextInputBuilder()
            .setCustomId('reset_hwid')
            .setLabel('ENTER CURRENT HWID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Your current HWID to reset')
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(keyInput);
        const secondActionRow = new ActionRowBuilder().addComponents(hwidInput);

        modal.addComponents(firstActionRow, secondActionRow);
        await interaction.showModal(modal);
    }
});

// Modal Interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    const { customId, user, fields, member } = interaction;

    // Check if user is whitelisted for modal interactions
    if (!isWhitelisted(member)) {
        return await interaction.reply({
            content: '❌ **ACCESS DENIED**\nYou are not whitelisted to use this system.',
            ephemeral: true
        });
    }

    if (customId === 'get_script_modal') {
        const key = fields.getTextInputValue('script_key').trim();
        const hwid = fields.getTextInputValue('script_hwid').trim();

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

        if (!userEntry.data.hwid) {
            return await interaction.reply({
                content: `❌ **HWID NOT SET**\nYou need to set your HWID first on the website: ${WEBSITE_URL}`,
                ephemeral: true
            });
        }

        if (userEntry.data.hwid !== hwid) {
            return await interaction.reply({
                content: `❌ **HWID MISMATCH**\nExpected: \`${userEntry.data.hwid}\`\nYou entered: \`${hwid}\``,
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📜 SCRIPT READY FOR DOWNLOAD')
            .setDescription('**Your HWID-locked script is ready!**')
            .setColor(0x000000)
            .addFields(
                { name: '🔑 YOUR KEY', value: `\`${userEntry.data.key}\``, inline: true },
                { name: '🆔 YOUR HWID', value: `\`${userEntry.data.hwid}\``, inline: true },
                { name: '📥 DOWNLOAD', value: `[**CLICK TO DOWNLOAD**](${WEBSITE_URL}/download/${userEntry.data.key})` }
            )
            .setFooter({ text: '🔒 Script will only work with your exact HWID | Whitelisted User' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (customId === 'reset_hwid_modal') {
        const key = fields.getTextInputValue('reset_key').trim();
        const currentHWID = fields.getTextInputValue('reset_hwid').trim();

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

        if (!userEntry.data.hwid) {
            return await interaction.reply({
                content: '❌ **NO HWID SET**\nThere is no HWID to reset.',
                ephemeral: true
            });
        }

        if (userEntry.data.hwid !== currentHWID) {
            return await interaction.reply({
                content: `❌ **INCORRECT HWID**\nCurrent HWID: \`${userEntry.data.hwid}\`\nYou entered: \`${currentHWID}\``,
                ephemeral: true
            });
        }

        // Reset HWID
        userData.set(userEntry.userId, {
            ...userEntry.data,
            hwid: null
        });

        await interaction.reply({
            content: `✅ **HWID RESET SUCCESSFUL!**\nYour HWID has been reset. You can now set a new HWID on the website.\n**Website:** ${WEBSITE_URL}`,
            ephemeral: true
        });
    }
});

// Website Routes - BLACK THEME
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔒 BLACK | HWID SYSTEM</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Courier New', monospace;
        }
        
        body {
            background: #000000;
            color: #00ff00;
            min-height: 100vh;
            padding: 0;
            overflow-x: hidden;
        }
        
        .terminal {
            background: #000000;
            border: 2px solid #00ff00;
            border-radius: 0px;
            margin: 20px;
            padding: 0;
            box-shadow: 0 0 20px #00ff00;
        }
        
        .terminal-header {
            background: #001100;
            padding: 10px 20px;
            border-bottom: 1px solid #00ff00;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .terminal-title {
            color: #00ff00;
            font-weight: bold;
            font-size: 1.2em;
        }
        
        .terminal-body {
            padding: 30px;
        }
        
        h1 {
            color: #00ff00;
            text-align: center;
            margin-bottom: 10px;
            font-size: 2.5em;
            text-shadow: 0 0 10px #00ff00;
        }
        
        .subtitle {
            color: #00cc00;
            text-align: center;
            margin-bottom: 30px;
            font-size: 1.1em;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .panel {
            background: #001100;
            border: 1px solid #00ff00;
            padding: 25px;
            margin-bottom: 20px;
            border-radius: 5px;
        }
        
        .panel-title {
            color: #00ff00;
            margin-bottom: 15px;
            font-size: 1.3em;
            border-bottom: 1px solid #00ff00;
            padding-bottom: 10px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            color: #00ff00;
            font-weight: bold;
        }
        
        input {
            width: 100%;
            padding: 12px;
            background: #000000;
            border: 1px solid #00ff00;
            border-radius: 3px;
            color: #00ff00;
            font-size: 16px;
            font-family: 'Courier New', monospace;
        }
        
        input:focus {
            outline: none;
            box-shadow: 0 0 10px #00ff00;
            border-color: #00ff00;
        }
        
        button {
            width: 100%;
            padding: 15px;
            background: #00ff00;
            color: #000000;
            border: none;
            border-radius: 3px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            font-family: 'Courier New', monospace;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        
        button:hover {
            background: #00cc00;
            box-shadow: 0 0 15px #00ff00;
        }
        
        .btn-reset {
            background: #ff0000;
            color: #ffffff;
        }
        
        .btn-reset:hover {
            background: #cc0000;
            box-shadow: 0 0 15px #ff0000;
        }
        
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 3px;
            text-align: center;
            font-weight: bold;
            border: 1px solid;
        }
        
        .success {
            background: #001100;
            border-color: #00ff00;
            color: #00ff00;
        }
        
        .error {
            background: #110000;
            border-color: #ff0000;
            color: #ff0000;
        }
        
        .info-box {
            background: #001100;
            border: 1px solid #00ff00;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 3px;
        }
        
        .info-box h3 {
            color: #00ff00;
            margin-bottom: 10px;
        }
        
        .steps {
            margin-left: 20px;
            color: #00cc00;
        }
        
        .steps li {
            margin-bottom: 8px;
        }
        
        .discord-info {
            background: #001133;
            border: 1px solid #0066ff;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 3px;
            text-align: center;
        }
        
        .blink {
            animation: blink 1s infinite;
        }
        
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .watermark {
            text-align: center;
            margin-top: 30px;
            color: #00ff00;
            opacity: 0.7;
            font-size: 0.9em;
        }
        
        .status {
            text-align: center;
            margin: 10px 0;
            padding: 10px;
            background: #001100;
            border: 1px solid #00ff00;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="terminal">
        <div class="terminal-header">
            <div class="terminal-title">🔒 BLACK HWID SYSTEM</div>
            <div class="blink">🟢 ONLINE</div>
        </div>
        <div class="terminal-body">
            <div class="container">
                <h1>BLACK HWID SYSTEM</h1>
                <div class="subtitle">SECURE SCRIPT MANAGEMENT</div>
                
                <div class="status">
                    <strong>🌐 LIVE SYSTEM</strong><br>
                    <span>Connected to: ${WEBSITE_URL}</span>
                </div>
                
                <div class="discord-info">
                    <strong>💬 DISCORD BOT REQUIRED</strong><br>
                    Use <code style="background: #000; padding: 2px 5px; border: 1px solid #0066ff;">/panel</code> in Discord to access the management panel<br>
                    <small>Whitelist role required: <code>${WHITELIST_ROLE_ID}</code></small>
                </div>
                
                <div class="info-box">
                    <h3>📋 SYSTEM OVERVIEW</h3>
                    <ol class="steps">
                        <li>Use Discord <code>/panel</code> to claim your unique key</li>
                        <li>Set your HWID using the form below</li>
                        <li>Get your script from Discord using your key and HWID</li>
                        <li>Script only works with your exact HWID</li>
                    </ol>
                </div>

                <div class="panel">
                    <div class="panel-title">🔑 SET YOUR HWID</div>
                    <div class="form-group">
                        <label for="keyInput">YOUR KEY:</label>
                        <input type="text" id="keyInput" placeholder="ENTER YOUR KEY (FROM DISCORD)" />
                    </div>
                    
                    <div class="form-group">
                        <label for="hwidInput">YOUR HWID:</label>
                        <input type="text" id="hwidInput" placeholder="ENTER YOUR HWID (MIN 8 CHARACTERS)" />
                    </div>
                    
                    <button onclick="setHWID()">✅ SET HWID</button>
                </div>
                
                <div class="panel">
                    <div class="panel-title">🔄 RESET HWID</div>
                    <div class="form-group">
                        <label for="resetKeyInput">YOUR KEY:</label>
                        <input type="text" id="resetKeyInput" placeholder="ENTER YOUR KEY" />
                    </div>
                    
                    <button onclick="resetHWID()" class="btn-reset">🔄 RESET HWID</button>
                </div>
                
                <div id="result"></div>
                
                <div class="watermark">
                    🔒 BLACK HWID SYSTEM | SECURE SCRIPT PROTECTION
                </div>
            </div>
        </div>
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
                    showResult('✅ HWID set successfully! You can now get your script from Discord using /panel → Get Script', 'success');
                    document.getElementById('keyInput').value = '';
                    document.getElementById('hwidInput').value = '';
                } else {
                    showResult('❌ ' + data.error, 'error');
                }
            } catch (error) {
                showResult('❌ Network error: ' + error.message, 'error');
            }
        }
        
        async function resetHWID() {
            const key = document.getElementById('resetKeyInput').value.trim();
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
                    document.getElementById('resetKeyInput').value = '';
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
            <body style="background: #000000; color: #ff0000; font-family: 'Courier New', monospace; text-align: center; padding: 50px;">
                <h1 style="color: #ff0000; text-shadow: 0 0 10px #ff0000;">❌ ACCESS DENIED</h1>
                <p>Key not found or HWID not set</p>
                <a href="${WEBSITE_URL}" style="color: #00ff00;">Return to Home</a>
            </body>
            </html>
        `);
    }

    // Generate the actual Lua script with HWID check
    const luaScript = `-- 🔒 BLACK HWID PROTECTED SCRIPT
-- Key: ${userInfo.key}
-- HWID: ${userInfo.hwid}
-- User: ${userInfo.username}
-- Generated: ${new Date().toISOString()}
-- Website: ${WEBSITE_URL}

local function verifyHWID()
    local userHWID = game:GetService("RbxAnalyticsService"):GetClientId()
    
    if userHWID ~= "${userInfo.hwid}" then
        warn("[[BLACK]] ❌ HWID MISMATCH!")
        warn("[[BLACK]] Expected: ${userInfo.hwid}")
        warn("[[BLACK]] Found: " .. tostring(userHWID))
        warn("[[BLACK]] 🔒 ACCESS DENIED - Script locked to different device")
        return false
    end
    
    print("[[BLACK]] ✅ HWID VERIFIED - ACCESS GRANTED")
    print("[[BLACK]] 👤 User: ${userInfo.username}")
    print("[[BLACK]] 🔑 Key: ${userInfo.key}")
    print("[[BLACK]] 🌐 Website: ${WEBSITE_URL}")
    return true
end

if not verifyHWID() then
    return
end

-- ✅ HWID VERIFIED - LOADING MAIN SCRIPT...
print("[[BLACK]] 🚀 Script initialized successfully!")

-- Your main script content here
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer

if LocalPlayer and LocalPlayer.Character then
    LocalPlayer.Character:WaitForChild("Humanoid").WalkSpeed = 50
    print("[[BLACK]] ✨ WalkSpeed set to 50")
end

print("[[BLACK]] 🎯 Script execution completed!")
print("[[BLACK]] 🔒 Protected by BLACK HWID System")`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="black_${userInfo.key}.lua"`);
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
        claimedAt: data.claimedAt,
        whitelisted: data.whitelisted
    }));
    
    res.json({ totalUsers: userData.size, users });
});

// Start server
server.listen(PORT, () => {
    console.log(`🌐 Website server started on port ${PORT}`);
    console.log(`🔗 Public URL: ${WEBSITE_URL}`);
    console.log('🔗 Fetching bot token from Pastefy...');
    
    // Initialize the bot
    initializeBot();
});
