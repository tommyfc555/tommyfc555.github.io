const express = require('express');
const http = require('http');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Fix for rate limiting behind proxy
app.set('trust proxy', 1);

// Rate limiting
const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1, // Limit each IP to 1 create account request per hour
  message: 'Too many accounts created from this IP, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use(generalLimiter);

// Global variables for bot and ban system
let discordBot = null;
let BOT_TOKEN = '';
const bannedUsers = new Map();
const bannedIPs = new Map();
const bannedHWIDs = new Map();

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
const userCreationLimits = new Map(); // Map<discordId, timestamp>

// Security headers
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'browsing-topics=(), run-ad-auction=(), join-ad-interest-group=(), private-state-token-redemption=(), private-state-token-issuance=(), private-aggregation=(), attribution-reporting=()');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

app.use(express.static('.'));
app.use(express.json());
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

// Clean up old sessions
setInterval(() => {
    const now = Date.now();
    for (const [key, session] of sessions.entries()) {
        if (now - session.createdAt > 3600000) {
            sessions.delete(key);
        }
    }
}, 3600000);

// Check if user is banned
function isUserBanned(discordId, req = null) {
    // Check user ID ban
    if (bannedUsers.has(discordId)) {
        return true;
    }
    
    // Check IP ban if request provided
    if (req) {
        const ip = getClientIP(req);
        if (bannedIPs.has(ip)) {
            return true;
        }
        
        // Check HWID ban
        const hwid = generateHWID(req);
        if (bannedHWIDs.has(hwid)) {
            return true;
        }
    }
    
    return false;
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
    // Admin user IDs
    const adminUsers = [
        '1415022792214052915', // Your user ID
        '1431237319112790158' // Bot's user ID
    ];
    return adminUsers.includes(userId);
}

// Initialize Discord bot
function initializeBot() {
    discordBot = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    // Register slash commands
    const commands = [
        {
            name: 'ban',
            description: 'Ban a user from creating profiles',
            options: [
                {
                    name: 'username',
                    type: 3, // STRING
                    description: 'The username to ban',
                    required: true
                }
            ]
        },
        {
            name: 'unban',
            description: 'Unban a user',
            options: [
                {
                    name: 'username',
                    type: 3, // STRING
                    description: 'The username to unban',
                    required: true
                }
            ]
        },
        {
            name: 'help',
            description: 'Show all available commands (Admin only)'
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

    // Bot ready event
    discordBot.once('ready', () => {
        console.log(`🤖 Logged in as ${discordBot.user.tag}`);
        registerCommands();
    });

    // Handle slash commands
    discordBot.on('interactionCreate', async interaction => {
        if (!interaction.isCommand()) return;

        const { commandName, options, user } = interaction;

        // Check if user is admin for certain commands
        const userIsAdmin = isAdmin(user.id);

        if (commandName === 'help') {
            if (!userIsAdmin) {
                return interaction.reply({ 
                    content: '❌ This command is only available to administrators.', 
                    ephemeral: true 
                });
            }

            const helpMessage = `
**🤖 Discord Profile Bot Commands**

**/ban <username>** - Ban a user from creating profiles
**/unban <username>** - Unban a previously banned user
**/help** - Show this help message

**Admin Only Commands:**
- All commands are admin-only for security
- Bans prevent users from creating new accounts
- Bans apply to user ID, IP, and hardware ID

**Usage Examples:**
\`/ban eviluser\` - Bans the user "eviluser"
\`/unban reformeduser\` - Unbans the user "reformeduser"
            `;

            await interaction.reply({ 
                content: helpMessage, 
                ephemeral: true 
            });

        } else if (commandName === 'ban') {
            if (!userIsAdmin) {
                return interaction.reply({ 
                    content: '❌ This command is only available to administrators.', 
                    ephemeral: true 
                });
            }

            const username = options.getString('username').toLowerCase();
            
            // Find user in database
            const userToBan = Array.from(users.values()).find(u => 
                u.username.toLowerCase() === username || 
                u.discordData.username.toLowerCase() === username
            );

            if (!userToBan) {
                return interaction.reply({ 
                    content: `❌ User "${username}" not found.`, 
                    ephemeral: true 
                });
            }

            // Ban the user by ID
            bannedUsers.set(userToBan.discordData.id, {
                reason: 'Banned by moderator',
                bannedBy: user.tag,
                bannedAt: new Date().toISOString()
            });

            // Also remove their profile
            users.delete(userToBan.username);

            await interaction.reply({ 
                content: `✅ Successfully banned ${username} and removed their profile.`, 
                ephemeral: false 
            });

        } else if (commandName === 'unban') {
            if (!userIsAdmin) {
                return interaction.reply({ 
                    content: '❌ This command is only available to administrators.', 
                    ephemeral: true 
                });
            }

            const username = options.getString('username').toLowerCase();
            
            // Find banned user by username
            let unbannedUserId = null;
            for (const [userId, banData] of bannedUsers.entries()) {
                const user = Array.from(users.values()).find(u => u.discordData.id === userId);
                if (user && (user.username.toLowerCase() === username || user.discordData.username.toLowerCase() === username)) {
                    unbannedUserId = userId;
                    break;
                }
            }

            if (!unbannedUserId) {
                return interaction.reply({ 
                    content: `❌ User "${username}" is not banned or not found.`, 
                    ephemeral: true 
                });
            }

            // Unban the user
            bannedUsers.delete(unbannedUserId);

            await interaction.reply({ 
                content: `✅ Successfully unbanned ${username}.`, 
                ephemeral: false 
            });
        }
    });

    // Login to Discord
    discordBot.login(BOT_TOKEN).catch(error => {
        console.error('❌ Bot login failed:', error);
    });
}

// Serve homepage with username input
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
                
                // Store username in session storage and redirect to Discord auth
                sessionStorage.setItem('registeringUsername', username);
                window.location.href = '/auth/discord?username=' + encodeURIComponent(username);
            }
            
            // Check for errors
            const urlParams = new URLSearchParams(window.location.search);
            const error = urlParams.get('error');
            
            if (error) {
                showError('Registration failed. Please try again.');
            }
            
            // Make register button work
            document.getElementById('registerBtn').addEventListener('click', function(e) {
                e.preventDefault();
                document.getElementById('usernameInput').focus();
            });
            
            // Enter key support
            document.getElementById('usernameInput').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    registerUser();
                }
            });

            // Smooth scrolling for anchor links
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
    
    // Check rate limiting for Discord account
    const clientIP = getClientIP(req);
    const hwid = generateHWID(req);
    
    sessions.set(state, { 
        createdAt: Date.now(),
        registering: true,
        desiredUsername: registeringUsername,
        clientIP: clientIP,
        hwid: hwid
    });
    
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
        
        // Check if user is banned
        if (isUserBanned(userData.id, req)) {
            return res.redirect('/?error=banned');
        }
        
        // Rate limiting: 1 account per Discord account
        const lastCreation = userCreationLimits.get(userData.id);
        if (lastCreation && (Date.now() - lastCreation) < 24 * 60 * 60 * 1000) {
            return res.redirect('/?error=rate_limit');
        }
        
        // Get the desired username from session state
        let username = sessionState.desiredUsername.toLowerCase();
        
        // Check if username already exists, if so add discriminator
        if (users.has(username)) {
            username = username + '-' + userData.discriminator;
        }
        
        // Store user data
        const userRecord = {
            discordData: userData,
            access_token: tokenData.access_token,
            username: username,
            displayName: userData.global_name || userData.username, // Use Discord display name
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
                socialLinks: {
                    instagram: '',
                    twitter: '',
                    youtube: '',
                    github: ''
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
        res.cookie('session', sessionId, { httpOnly: true, maxAge: 3600000 });
        
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
        <title>Settings - ${user.displayName}</title>
        <meta name="robots" content="noindex, nofollow">
        <meta name="referrer" content="no-referrer">
        <style>
            ${getSettingsCSS()}
        </style>
    </head>
    <body>
        <video class="background-video" autoplay muted loop playsinline>
            <source src="${user.settings.background}" type="video/mp4">
        </video>

        <nav class="navbar">
            <a href="/${user.username}" class="logo">← Back to Profile</a>
            <div class="nav-links">
                <span class="nav-user">Welcome, ${user.displayName}</span>
            </div>
        </nav>

        <div class="settings-container">
            <div class="settings-sidebar">
                <h3>Settings</h3>
                <div class="sidebar-links">
                    <a href="#profile" class="sidebar-link active">Profile</a>
                    <a href="#appearance" class="sidebar-link">Appearance</a>
                    <a href="#social" class="sidebar-link">Social Links</a>
                    <a href="#music" class="sidebar-link">Music</a>
                    <a href="#privacy" class="sidebar-link">Privacy</a>
                    <a href="#advanced" class="sidebar-link">Advanced</a>
                </div>
            </div>

        <div class="settings-content">
            ${isNew ? `
            <div class="welcome-banner">
                <h2>🎉 Welcome to DiscordProfile!</h2>
                <p>Customize your profile to make it truly yours. Start by setting up your bio and appearance.</p>
            </div>
            ` : ''}
            
            <h1>Profile Settings</h1>
            <p class="settings-subtitle">Customize your profile appearance and behavior</p>

            <form id="settingsForm" class="settings-form">
                <!-- Profile Section -->
                <div id="profile" class="settings-section active">
                    <h2>Profile Information</h2>
                    
                    <div class="form-group">
                        <label for="displayName">Display Name</label>
                        <input type="text" id="displayName" name="displayName" value="${user.displayName}" placeholder="Your display name" maxlength="30">
                        <small>This is the name visitors will see on your profile</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="bio">Bio</label>
                        <textarea id="bio" name="bio" placeholder="Tell everyone about yourself..." maxlength="500">${user.settings.bio || ''}</textarea>
                        <div class="char-count"><span id="bioCount">${(user.settings.bio || '').length}</span>/500</div>
                    </div>

                    <div class="form-group">
                        <label>Display Options</label>
                        <div class="checkbox-group">
                            <label class="checkbox">
                                <input type="checkbox" name="showBadges" ${user.settings.showBadges ? 'checked' : ''}>
                                <span class="checkmark"></span>
                                Show Discord Badges
                            </label>
                            <label class="checkbox">
                                <input type="checkbox" name="showStats" ${user.settings.showStats ? 'checked' : ''}>
                                <span class="checkmark"></span>
                                Show Profile Statistics
                            </label>
                            <label class="checkbox">
                                <input type="checkbox" name="showSocialLinks" ${user.settings.showSocialLinks ? 'checked' : ''}>
                                <span class="checkmark"></span>
                                Show Social Links
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Appearance Section -->
                <div id="appearance" class="settings-section">
                    <h2>Appearance</h2>
                    
                    <div class="form-group">
                        <label for="background">Background Video URL</label>
                        <input type="url" id="background" name="background" value="${user.settings.background}" placeholder="https://example.com/background.mp4">
                        <small>Enter a direct URL to a video file (MP4 recommended)</small>
                    </div>

                    <div class="form-group">
                        <label>Preview Backgrounds</label>
                        <div class="background-previews">
                            <div class="bg-preview" data-url="https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&">
                                <div class="bg-preview-image" style="background: linear-gradient(45deg, #667eea, #764ba2);"></div>
                                <span>Default Anime</span>
                            </div>
                            <div class="bg-preview" data-url="https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&">
                                <div class="bg-preview-image" style="background: linear-gradient(45deg, #ff6b6b, #ee5a24);"></div>
                                <span>Sunset Theme</span>
                            </div>
                            <div class="bg-preview" data-url="https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&">
                                <div class="bg-preview-image" style="background: linear-gradient(45deg, #00d2d3, #54a0ff);"></div>
                                <span>Ocean Theme</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Social Links Section -->
                <div id="social" class="settings-section">
                    <h2>Social Media Links</h2>
                    
                    <div class="form-group">
                        <label for="instagram">Instagram</label>
                        <input type="url" id="instagram" name="socialLinks.instagram" value="${user.settings.socialLinks.instagram}" placeholder="https://instagram.com/yourusername">
                    </div>
                    
                    <div class="form-group">
                        <label for="twitter">Twitter</label>
                        <input type="url" id="twitter" name="socialLinks.twitter" value="${user.settings.socialLinks.twitter}" placeholder="https://twitter.com/yourusername">
                    </div>
                    
                    <div class="form-group">
                        <label for="youtube">YouTube</label>
                        <input type="url" id="youtube" name="socialLinks.youtube" value="${user.settings.socialLinks.youtube}" placeholder="https://youtube.com/yourchannel">
                    </div>
                    
                    <div class="form-group">
                        <label for="github">GitHub</label>
                        <input type="url" id="github" name="socialLinks.github" value="${user.settings.socialLinks.github}" placeholder="https://github.com/yourusername">
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-danger" onclick="clearSocialLinks()">Clear All Social Links</button>
                    </div>
                </div>

                <!-- Music Section -->
                <div id="music" class="settings-section">
                    <h2>Background Music</h2>
                    
                    <div class="form-group">
                        <label for="music">Music URL</label>
                        <input type="url" id="music" name="music" value="${user.settings.music}" placeholder="https://example.com/music.mp3">
                        <small>Enter a direct URL to an audio file (MP3 recommended)</small>
                    </div>

                    <div class="form-group">
                        <label>Music Controls</label>
                        <div class="checkbox-group">
                            <label class="checkbox">
                                <input type="checkbox" name="autoPlayMusic">
                                <span class="checkmark"></span>
                                Auto-play music when profile loads
                            </label>
                            <label class="checkbox">
                                <input type="checkbox" name="loopMusic" checked>
                                <span class="checkmark"></span>
                                Loop music
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Advanced Section -->
                <div id="advanced" class="settings-section">
                    <h2>Advanced Customization</h2>
                    
                    <div class="form-group">
                        <label for="customCSS">Custom CSS</label>
                        <textarea id="customCSS" name="customCSS" placeholder="Add your custom CSS here..." rows="8">${user.settings.customCSS || ''}</textarea>
                        <small>Add custom styles to personalize your profile appearance</small>
                    </div>

                    <div class="form-group">
                        <label for="customHTML">Custom HTML</label>
                        <textarea id="customHTML" name="customHTML" placeholder="Add your custom HTML here..." rows="8">${user.settings.customHTML || ''}</textarea>
                        <small>Add custom HTML elements to your profile (use with caution)</small>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="window.location.href='/${user.username}'">Cancel</button>
                    <button type="submit" class="btn-primary">Save Changes</button>
                </div>
            </form>
        </div>
    </div>

    <div class="toast" id="toast"></div>

    <script>
        // Tab navigation
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('href').substring(1);
                
                // Update active tab
                document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
                document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
                
                link.classList.add('active');
                document.getElementById(target).classList.add('active');
            });
        });

        // Background preview
        document.querySelectorAll('.bg-preview').forEach(preview => {
            preview.addEventListener('click', () => {
                const url = preview.getAttribute('data-url');
                document.getElementById('background').value = url;
                
                // Update background preview
                document.querySelector('.background-video source').src = url;
                document.querySelector('.background-video').load();
            });
        });

        // Bio character count
        const bioTextarea = document.getElementById('bio');
        const bioCount = document.getElementById('bioCount');
        
        if (bioTextarea) {
            bioTextarea.addEventListener('input', () => {
                bioCount.textContent = bioTextarea.value.length;
            });
        }

        // Clear social links
        function clearSocialLinks() {
            if (confirm('Are you sure you want to clear all social links?')) {
                document.getElementById('instagram').value = '';
                document.getElementById('twitter').value = '';
                document.getElementById('youtube').value = '';
                document.getElementById('github').value = '';
                showToast('Social links cleared!', 'success');
            }
        }

        // Form submission
        document.getElementById('settingsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const settings = {};
            
            for (let [key, value] of formData.entries()) {
                if (key.includes('.')) {
                    const keys = key.split('.');
                    let current = settings;
                    for (let i = 0; i < keys.length - 1; i++) {
                        if (!current[keys[i]]) current[keys[i]] = {};
                        current = current[keys[i]];
                    }
                    current[keys[keys.length - 1]] = value;
                } else {
                    settings[key] = value;
                }
            }
            
            try {
                const response = await fetch('/${user.username}/settings/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(settings)
                });
                
                if (response.ok) {
                    showToast('Settings saved successfully!');
                    // Update display name if changed
                    if (settings.displayName) {
                        document.querySelector('.nav-user').textContent = 'Welcome, ' + settings.displayName;
                    }
                } else {
                    showToast('Error saving settings', 'error');
                }
            } catch (error) {
                showToast('Error saving settings', 'error');
            }
        });

        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast ' + type;
            toast.style.display = 'block';
            
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }

        // Remove welcome banner after 5 seconds if new user
        ${isNew ? `
        setTimeout(() => {
            const banner = document.querySelector('.welcome-banner');
            if (banner) {
                banner.style.opacity = '0';
                setTimeout(() => banner.remove(), 300);
            }
        }, 5000);
        ` : ''}
    </script>
</body>
</html>
    `);
});

// Update settings endpoint
app.post('/:username/settings/update', checkProfileOwnership, (req, res) => {
    const user = req.user;
    const newSettings = req.body;
    
    // Update user settings and display name
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
    
    if (newSettings.displayName) {
        user.displayName = newSettings.displayName;
    }
    
    users.set(user.username, user);
    
    res.json({ success: true, message: 'Settings updated successfully' });
});

// Serve user profile pages
app.get('/:username', (req, res) => {
    const { username } = req.params;
    const user = users.get(username.toLowerCase());
    
    if (!user) {
        return res.redirect('/?username=' + username);
    }
    
    // Increment profile views
    user.profileViews = (user.profileViews || 0) + 1;
    
    // Generate avatar URL
    const avatarUrl = user.discordData.avatar 
        ? 'https://cdn.discordapp.com/avatars/' + user.discordData.id + '/' + user.discordData.avatar + '.webp?size=256'
        : 'https://cdn.discordapp.com/embed/avatars/' + (user.discordData.discriminator % 5) + '.png';
    
    // Generate badges HTML
    const badgesHTML = user.settings.showBadges ? getBadgesHTML(user.discordData.public_flags) : '';
    
    // Generate account age
    const accountAge = getAccountAge(user.discordData.id);
    
    // Generate social links HTML
    let socialLinksHTML = '';
    if (user.settings.showSocialLinks && user.settings.socialLinks) {
        const socials = user.settings.socialLinks;
        socialLinksHTML = `
            <div class="social-links">
                ${socials.instagram ? `<a href="${socials.instagram}" class="social-link" title="Instagram" target="_blank">📷</a>` : ''}
                ${socials.twitter ? `<a href="${socials.twitter}" class="social-link" title="Twitter" target="_blank">🐦</a>` : ''}
                ${socials.youtube ? `<a href="${socials.youtube}" class="social-link" title="YouTube" target="_blank">📺</a>` : ''}
                ${socials.github ? `<a href="${socials.github}" class="social-link" title="GitHub" target="_blank">💻</a>` : ''}
            </div>
        `;
    }
    
    // Generate stats HTML
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
                <div class="stat-value">${user.profileViews}</div>
            </div>
        </div>
    ` : '';
    
    // Generate bio HTML
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
        <nav class="navbar profile-navbar">
            <a href="/" class="logo">DiscordProfile</a>
            <div class="nav-links">
                ${settingsButton}
            </div>
        </nav>
    ` : '';
    
    res.send('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + user.displayName + '\'s Profile - DiscordProfile</title><meta name="description" content="' + user.displayName + '\'s Discord profile"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><meta http-equiv="Permissions-Policy" content="browsing-topics=(), run-ad-auction=(), join-ad-interest-group=(), private-state-token-redemption=(), private-state-token-issuance=(), private-aggregation=(), attribution-reporting=()"><style>' + getProfileCSS() + (user.settings.customCSS || '') + '</style></head><body><video class="background-video" autoplay muted loop playsinline id="backgroundVideo"><source src="' + user.settings.background + '" type="video/mp4"></video>' + (user.settings.music ? '<audio id="backgroundMusic" loop><source src="' + user.settings.music + '" type="audio/mp3"></audio>' : '') + navbarHTML + '<div class="container"><div class="profile-card"><div class="profile-header"><div class="profile-pic-container"><div class="profile-pic"><img src="' + avatarUrl + '" alt="' + user.displayName + '\'s Profile Picture"></div><div class="status-indicator status-online"></div></div><div class="profile-info"><div class="name-container"><h1 class="name">' + user.displayName + '</h1></div><div class="username">@' + user.username + '</div><div class="profile-url">' + req.headers.host + '/' + username + '</div></div></div>' + bioHTML + '<div class="badges-container">' + badgesHTML + '</div>' + statsHTML + socialLinksHTML + (user.settings.customHTML || '') + '</div></div>' + (user.settings.music ? '<script>document.getElementById(\'backgroundMusic\').play().catch(e => console.log(\'Autoplay blocked\'));</script>' : '') + '</body></html>');
});

// Helper functions
function getBadgesHTML(flags) {
    if (!flags) return '<div style="color: var(--text-tertiary); font-size: 0.9em;">No badges yet</div>';
    
    const badgeMap = {
        1: { emoji: '🌟', title: 'Discord Staff' },
        2: { emoji: '🤝', title: 'Partnered Server Owner' },
        4: { emoji: '🚨', title: 'Hypesquad Events' },
        8: { emoji: '🐛', title: 'Bug Hunter Level 1' },
        64: { emoji: '🛡️', title: 'Hypesquad Bravery' },
        128: { emoji: '💎', title: 'Hypesquad Brilliance' },
        256: { emoji: '⚖️', title: 'Hypesquad Balance' },
        512: { emoji: '🎖️', title: 'Early Supporter' },
        1024: { emoji: '🛠️', title: 'Bug Hunter Level 2' },
        16384: { emoji: '🤖', title: 'Early Verified Bot Developer' },
        131072: { emoji: '☕', title: 'Active Developer' },
        4194304: { emoji: '📱', title: 'Uses Android App' }
    };
    
    let badgesHTML = '';
    let badgeCount = 0;
    
    for (const [flag, badge] of Object.entries(badgeMap)) {
        if (flags & parseInt(flag)) {
            badgesHTML += '<div class="badge" title="' + badge.title + '">' + badge.emoji + '</div>';
            badgeCount++;
        }
    }
    
    if (badgeCount === 0) {
        badgesHTML = '<div style="color: var(--text-tertiary); font-size: 0.9em;">No badges yet</div>';
    }
    
    return badgesHTML;
}

function getAccountAge(userId) {
    const timestamp = (userId / 4194304) + 1420070400000;
    const created = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    
    if (years > 0) {
        return years + ' year' + (years > 1 ? 's' : '');
    } else if (months > 0) {
        return months + ' month' + (months > 1 ? 's' : '');
    } else {
        return 'New';
    }
}

function getProfileCSS() {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            -webkit-tap-highlight-color: transparent;
        }
        
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
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
        
        .profile-navbar {
            background: transparent;
            border: none;
        }
        
        .logo {
            font-size: 1.4em;
            font-weight: 800;
            background: linear-gradient(135deg, #fff, var(--discord-blurple));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-decoration: none;
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
        
        .settings-btn {
            color: var(--text-secondary);
            text-decoration: none;
            font-weight: 500;
            font-size: 0.9em;
            transition: all 0.3s ease;
            padding: 8px 16px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
        }
        
        .settings-btn:hover {
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
        }
        
        .get-profile-btn {
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
        
        .get-profile-btn:hover {
            background: #4752c4;
            transform: translateY(-2px);
        }
        
        .container {
            display: flex;
            min-height: 100vh;
            align-items: center;
            justify-content: center;
            position: relative;
            z-index: 1;
            padding: 20px;
        }
        
        .profile-card {
            background: var(--bg-glass);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--border-glass);
            border-radius: 16px;
            padding: 30px 25px;
            text-align: center;
            max-width: 380px;
            width: 100%;
            box-shadow: var(--shadow-glass);
            animation: float 6s ease-in-out infinite;
        }
        
        .profile-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
            text-align: left;
        }
        
        .profile-pic-container {
            position: relative;
            flex-shrink: 0;
        }
        
        .profile-pic {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            border: 3px solid rgba(255, 255, 255, 0.2);
            background: var(--primary-gradient);
            overflow: hidden;
        }
        
        .profile-pic img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 50%;
        }
        
        .status-indicator {
            position: absolute;
            bottom: 2px;
            right: 2px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 3px solid var(--bg-glass);
            background: var(--discord-green);
        }
        
        .status-online { background: var(--discord-green); }
        .status-idle { background: var(--discord-yellow); }
        .status-dnd { background: var(--discord-red); }
        .status-offline { background: var(--discord-gray); }
        
        .profile-info {
            flex: 1;
        }
        
        .name-container {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
            flex-wrap: wrap;
        }
        
        .name {
            font-size: 1.4em;
            font-weight: 700;
            color: var(--text-primary);
        }
        
        .username {
            color: var(--text-secondary);
            font-size: 0.9em;
            font-weight: 400;
        }
        
        .profile-url {
            color: var(--discord-blurple);
            font-size: 0.8em;
            margin-top: 2px;
            font-family: 'Courier New', monospace;
        }
        
        .bio-section {
            margin: 15px 0;
            text-align: left;
        }
        
        .bio-label {
            color: var(--text-tertiary);
            font-size: 0.8em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        
        .bio-content {
            color: var(--text-secondary);
            font-size: 0.9em;
            line-height: 1.4;
        }
        
        .badges-container {
            display: flex;
            gap: 6px;
            margin: 12px 0;
            flex-wrap: wrap;
            justify-content: center;
            min-height: 30px;
        }
        
        .badge {
            font-size: 1em;
            opacity: 0.9;
            transition: all 0.3s ease;
            cursor: help;
            padding: 4px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.1);
        }
        
        .badge:hover {
            transform: scale(1.1);
            opacity: 1;
            background: rgba(255, 255, 255, 0.2);
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin: 20px 0;
        }
        
        .stat-item {
            background: rgba(255, 255, 255, 0.05);
            padding: 12px;
            border-radius: 10px;
            text-align: center;
            border: 1px solid var(--border-glass);
        }
        
        .stat-label {
            color: var(--text-tertiary);
            font-size: 0.75em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        
        .stat-value {
            color: var(--text-primary);
            font-size: 0.9em;
            font-weight: 600;
        }
        
        .social-links {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-top: 20px;
        }
        
        .social-link {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            text-decoration: none;
            transition: all 0.3s ease;
            border: 1px solid var(--border-glass);
            font-size: 1em;
        }
        
        .social-link:hover {
            transform: translateY(-2px);
            background: rgba(255, 255, 255, 0.15);
            color: var(--text-primary);
        }
        
        @keyframes float {
            0%, 100% {
                transform: translateY(0px);
            }
            50% {
                transform: translateY(-5px);
            }
        }
    `;
}

function getSettingsCSS() {
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
            --discord-red: #ED4245;
            --text-primary: #ffffff;
            --text-secondary: #b9bbbe;
            --text-tertiary: #72767d;
            --bg-glass: rgba(0, 0, 0, 0.5);
            --border-glass: rgba(255, 255, 255, 0.1);
        }
        
        body {
            background: #000;
            color: var(--text-primary);
            min-height: 100vh;
        }
        
        .background-video {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: -1;
            filter: brightness(0.4);
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
            font-size: 1.2em;
            font-weight: 600;
            color: var(--text-primary);
            text-decoration: none;
        }
        
        .nav-user {
            color: var(--text-secondary);
            font-size: 0.9em;
        }
        
        .settings-container {
            display: flex;
            min-height: 100vh;
            padding-top: 70px;
        }
        
        .settings-sidebar {
            width: 250px;
            background: var(--bg-glass);
            backdrop-filter: blur(20px);
            border-right: 1px solid var(--border-glass);
            padding: 30px 20px;
        }
        
        .settings-sidebar h3 {
            margin-bottom: 20px;
            color: var(--text-primary);
        }
        
        .sidebar-links {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .sidebar-link {
            color: var(--text-secondary);
            text-decoration: none;
            padding: 12px 16px;
            border-radius: 8px;
            transition: all 0.3s ease;
        }
        
        .sidebar-link:hover,
        .sidebar-link.active {
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-primary);
        }
        
        .settings-content {
            flex: 1;
            padding: 40px;
            max-width: 800px;
        }
        
        .settings-content h1 {
            margin-bottom: 8px;
            font-size: 2em;
        }
        
        .settings-subtitle {
            color: var(--text-secondary);
            margin-bottom: 30px;
        }
        
        .settings-section {
            display: none;
        }
        
        .settings-section.active {
            display: block;
        }
        
        .settings-section h2 {
            margin-bottom: 20px;
            font-size: 1.4em;
            border-bottom: 1px solid var(--border-glass);
            padding-bottom: 10px;
        }
        
        .welcome-banner {
            background: linear-gradient(135deg, var(--discord-blurple), #764ba2);
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            animation: slideIn 0.5s ease-out;
        }
        
        .welcome-banner h2 {
            margin-bottom: 10px;
            border: none;
        }
        
        @keyframes slideIn {
            from {
                transform: translateY(-20px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        .form-group {
            margin-bottom: 25px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: var(--text-primary);
        }
        
        .form-group input,
        .form-group textarea,
        .form-group select {
            width: 100%;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid var(--border-glass);
            border-radius: 8px;
            padding: 12px 16px;
            color: var(--text-primary);
            font-size: 1em;
            transition: all 0.3s ease;
        }
        
        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
            outline: none;
            border-color: var(--discord-blurple);
            background: rgba(255, 255, 255, 0.15);
        }
        
        .form-group textarea {
            resize: vertical;
            min-height: 100px;
        }
        
        .form-group small {
            display: block;
            margin-top: 6px;
            color: var(--text-tertiary);
            font-size: 0.85em;
        }
        
        .char-count {
            text-align: right;
            font-size: 0.8em;
            color: var(--text-tertiary);
            margin-top: 4px;
        }
        
        .checkbox-group {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .checkbox {
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
        }
        
        .checkbox input {
            display: none;
        }
        
        .checkmark {
            width: 20px;
            height: 20px;
            border: 2px solid var(--border-glass);
            border-radius: 4px;
            position: relative;
            transition: all 0.3s ease;
        }
        
        .checkbox input:checked + .checkmark {
            background: var(--discord-blurple);
            border-color: var(--discord-blurple);
        }
        
        .checkbox input:checked + .checkmark::after {
            content: '✓';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 12px;
            font-weight: bold;
        }
        
        .background-previews {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 15px;
            margin-top: 10px;
        }
        
        .bg-preview {
            cursor: pointer;
            text-align: center;
        }
        
        .bg-preview-image {
            width: 100%;
            height: 80px;
            border-radius: 8px;
            margin-bottom: 8px;
            border: 2px solid transparent;
            transition: all 0.3s ease;
        }
        
        .bg-preview:hover .bg-preview-image {
            border-color: var(--discord-blurple);
            transform: scale(1.05);
        }
        
        .bg-preview span {
            font-size: 0.8em;
            color: var(--text-secondary);
        }
        
        .form-actions {
            display: flex;
            gap: 15px;
            justify-content: flex-end;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid var(--border-glass);
        }
        
        .btn-primary,
        .btn-secondary,
        .btn-danger {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
            text-align: center;
        }
        
        .btn-primary {
            background: var(--discord-blurple);
            color: white;
        }
        
        .btn-primary:hover {
            background: #4752c4;
            transform: translateY(-2px);
        }
        
        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-primary);
            border: 1px solid var(--border-glass);
        }
        
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        
        .btn-danger {
            background: var(--discord-red);
            color: white;
        }
        
        .btn-danger:hover {
            background: #c03537;
            transform: translateY(-2px);
        }
        
        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--discord-green);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            z-index: 1000;
            font-weight: 500;
            display: none;
        }
        
        .toast.error {
            background: var(--discord-red);
        }
    `;
}

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
    console.log('✅ Custom username system ready');
    console.log('🎯 Each user gets their own profile URL');
    console.log('⚙️ Settings page available at /username/settings');
    console.log('🔗 Example: https://tommyfc555-github-io.onrender.com/hwid/settings');
    
    // Load bot token from Pastebin
    loadBotToken();
});
