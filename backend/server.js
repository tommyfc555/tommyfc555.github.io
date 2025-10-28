const express = require('express');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes } = require('discord.js');
const https = require('https');

const app = express();
const server = require('http').createServer(app);
const PORT = process.env.PORT || 3000;

const WEBSITE_URL = 'https://tommyfc555-github-io.onrender.com';
let BOT_TOKEN = '';

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
                    console.log('Token fetched successfully');
                    resolve(token);
                } else {
                    reject(new Error('Invalid token received'));
                }
            });
            
        }).on('error', (error) => {
            reject(new Error('Failed to fetch token: ' + error.message));
        });
    });
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

const userData = new Map();

function generateKey() {
    return 'KEY-' + Math.random().toString(36).substr(2, 12).toUpperCase();
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function initializeBot() {
    try {
        BOT_TOKEN = await fetchTokenFromPastefy();
        await client.login(BOT_TOKEN);
        
        client.once('ready', async () => {
            console.log(`Bot logged in as ${client.user.tag}`);
            
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
                console.log('Commands registered');
            } catch (error) {
                console.error('Error registering commands:', error);
            }
        });

    } catch (error) {
        console.error('Failed to start bot:', error.message);
        process.exit(1);
    }
}

client.once('ready', () => {
    console.log(`Bot ready: ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, user } = interaction;

    if (commandName === 'panel') {
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

        const embed = new EmbedBuilder()
            .setTitle('Script Panel')
            .setDescription('Manage your script access')
            .setColor(0x2b2d31)
            .addFields(
                { name: 'Get Key', value: 'Generate your unique key' },
                { name: 'Get Script', value: 'Get script after getting key' }
            )
            .setFooter({ text: 'Device locked protection' });

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, user } = interaction;

    if (customId === 'claim_key') {
        if (userData.has(user.id)) {
            const userInfo = userData.get(user.id);
            return await interaction.reply({
                content: `You already have a key: \`${userInfo.key}\``,
                ephemeral: true
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

        await interaction.reply({
            content: `Key generated: \`${key}\`\n\nNow get your script. It will lock to your device on first run.`,
            ephemeral: true
        });
    }

    if (customId === 'get_script') {
        const userInfo = userData.get(user.id);
        
        if (!userInfo) {
            return await interaction.reply({
                content: 'Get a key first',
                ephemeral: true
            });
        }

        const loadstring = `loadstring(game:HttpGet("${WEBSITE_URL}/script/${userInfo.key}"))()`;

        const embed = new EmbedBuilder()
            .setTitle('Your Script')
            .setDescription('Copy and execute in Roblox:')
            .setColor(0x2b2d31)
            .addFields(
                { name: 'Key', value: `\`${userInfo.key}\`` },
                { name: 'Loadstring', value: `\`\`\`lua\n${loadstring}\n\`\`\`` }
            )
            .setFooter({ text: 'Script will lock to first device that runs it' });

        await interaction.reply({ 
            embeds: [embed],
            ephemeral: true 
        });
    }
});

app.get('/script/:key', (req, res) => {
    const { key } = req.params;
    
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
    
    -- Try different methods to get unique device identifier
    local success, result = pcall(function()
        return game:GetService("RbxAnalyticsService"):GetClientId()
    end)
    
    if success and result then
        deviceID = tostring(result)
    else
        -- Fallback method
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
        -- First time running, lock to this device
        local response = game:HttpGet("${WEBSITE_URL}/lock/${key}/" .. currentDeviceID)
        if response == "locked" then
            print("Device locked successfully")
            return true
        else
            print("Failed to lock device")
            return false
        end
    else
        -- Check if device matches
        if currentDeviceID == expectedHWID then
            print("Device verified")
            return true
        else
            print("Device mismatch")
            print("Expected: " .. expectedHWID)
            print("Current: " .. currentDeviceID)
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

-- Your main script here
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

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Website: ${WEBSITE_URL}`);
    initializeBot();
});
