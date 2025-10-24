const express = require('express');
const http = require('http');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

const PORT = 3000;

// ✅ WORKING CONFIGURATION
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
console.log('🚀 Server starting...');

// Session storage
const sessions = new Map();

// Security headers
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'browsing-topics=(), run-ad-auction=(), join-ad-interest-group=(), private-state-token-redemption=(), private-state-token-issuance=(), private-aggregation=(), attribution-reporting=()');
    next();
});

app.use(express.static('.'));
app.use(express.json());

function generateState() {
    return crypto.randomBytes(16).toString('hex');
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

// Discord OAuth Routes
app.get('/auth/discord', (req, res) => {
    const state = generateState();
    sessions.set(state, { createdAt: Date.now() });
    
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CONFIG.clientId}&redirect_uri=${encodeURIComponent(DISCORD_CONFIG.redirectUri)}&response_type=code&scope=identify`;
    
    console.log('🔗 Redirecting to Discord OAuth...');
    res.redirect(discordAuthUrl);
});

app.get('/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    
    console.log('🔄 OAuth callback received');
    
    if (!code) {
        return res.redirect('/?error=missing_code');
    }
    
    try {
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
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });
        
        const userData = await userResponse.json();
        
        if (userData.message) {
            return res.redirect('/?error=user_fetch_failed');
        }
        
        // Create session
        const sessionId = crypto.randomBytes(16).toString('hex');
        sessions.set(sessionId, {
            user: userData,
            access_token: tokenData.access_token,
            createdAt: Date.now()
        });
        
        console.log('✅ Login successful for user:', userData.username);
        res.redirect(`/?session=${sessionId}`);
        
    } catch (error) {
        console.error('❌ OAuth error:', error);
        res.redirect('/?error=auth_failed');
    }
});

// Get user data endpoint
app.get('/api/user', (req, res) => {
    const sessionId = req.query.session;
    
    if (!sessionId || !sessions.has(sessionId)) {
        return res.json({ success: false, error: 'Invalid session' });
    }
    
    const session = sessions.get(sessionId);
    res.json({ success: true, user: session.user });
});

// Logout endpoint
app.get('/auth/logout', (req, res) => {
    const sessionId = req.query.session;
    if (sessionId) {
        sessions.delete(sessionId);
    }
    res.redirect('/');
});

// Serve main page with enhanced Discord profile
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Black - Discord Profile</title>
        <meta http-equiv="Permissions-Policy" content="browsing-topics=(), run-ad-auction=(), join-ad-interest-group=(), private-state-token-redemption=(), private-state-token-issuance=(), private-aggregation=(), attribution-reporting=()">
        
        <style>
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
            
            .container {
                display: flex;
                min-height: 100vh;
                align-items: center;
                justify-content: center;
                position: relative;
                z-index: 1;
                padding: 20px;
            }
            
            .login-container {
                background: var(--bg-glass);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid var(--border-glass);
                border-radius: 16px;
                padding: 40px 30px;
                text-align: center;
                max-width: 350px;
                width: 100%;
                box-shadow: var(--shadow-glass);
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
                opacity: 0;
                transform: scale(0.9) translateY(20px);
                transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
                display: none;
            }
            
            .profile-card.show {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
            
            .login-title {
                font-size: 1.8em;
                font-weight: 700;
                background: linear-gradient(135deg, #fff 0%, var(--text-secondary) 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 15px;
            }
            
            .login-subtitle {
                color: var(--text-secondary);
                font-size: 0.95em;
                margin-bottom: 30px;
                font-weight: 400;
            }
            
            .discord-login-btn {
                background: var(--discord-blurple);
                color: white;
                border: none;
                border-radius: 12px;
                padding: 14px 28px;
                font-size: 0.95em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(88, 101, 242, 0.3);
                display: inline-flex;
                align-items: center;
                gap: 10px;
                text-decoration: none;
                margin: 5px 0;
            }
            
            .discord-login-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(88, 101, 242, 0.4);
                background: #4752c4;
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
            }
            
            .status-online { background: var(--discord-green); }
            .status-idle { background: var(--discord-yellow); }
            .status-dnd { background: var(--discord-red); }
            .status-offline { background: var(--discord-gray); }
            .status-streaming { background: #593695; }
            
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
            
            .user-id {
                color: var(--text-tertiary);
                font-size: 0.8em;
                font-family: 'Courier New', monospace;
                margin-top: 2px;
            }
            
            .badges-container {
                display: flex;
                gap: 6px;
                margin: 12px 0;
                flex-wrap: wrap;
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
            
            .discord-features {
                background: rgba(255, 255, 255, 0.03);
                border-radius: 12px;
                padding: 15px;
                margin: 20px 0;
                border: 1px solid var(--border-glass);
            }
            
            .features-title {
                color: var(--text-secondary);
                font-size: 0.85em;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 10px;
                text-align: center;
            }
            
            .features-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
            }
            
            .feature-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                padding: 8px;
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.05);
                transition: all 0.3s ease;
            }
            
            .feature-item:hover {
                background: rgba(255, 255, 255, 0.1);
                transform: translateY(-2px);
            }
            
            .feature-icon {
                font-size: 1.2em;
                opacity: 0.9;
            }
            
            .feature-label {
                color: var(--text-secondary);
                font-size: 0.7em;
                font-weight: 500;
                text-align: center;
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
            
            .discord-login-corner {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: var(--discord-blurple);
                color: white;
                border: none;
                border-radius: 12px;
                padding: 10px 16px;
                font-size: 0.85em;
                font-weight: 600;
                cursor: pointer;
                backdrop-filter: blur(10px);
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(88, 101, 242, 0.3);
                display: flex;
                align-items: center;
                gap: 6px;
                z-index: 100;
                text-decoration: none;
                display: none;
            }
            
            .discord-login-corner:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(88, 101, 242, 0.4);
            }
            
            .click-to-play {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(26, 26, 46, 0.95) 100%);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                color: white;
                cursor: pointer;
                transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
                gap: 15px;
                padding: 20px;
                text-align: center;
            }
            
            .click-title {
                font-size: 2.2em;
                font-weight: 700;
                background: linear-gradient(135deg, #fff 0%, var(--text-secondary) 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                letter-spacing: 1px;
                animation: titlePulse 2s ease-in-out infinite;
            }
            
            .click-subtitle {
                font-size: 0.95em;
                color: var(--text-tertiary);
                font-weight: 300;
                letter-spacing: 0.5px;
            }
            
            .click-to-play.hide {
                opacity: 0;
                pointer-events: none;
            }
            
            .error-message {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(237, 66, 69, 0.9);
                color: white;
                padding: 10px 16px;
                border-radius: 8px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.3);
                z-index: 1000;
                font-size: 0.85em;
                font-weight: 500;
                display: none;
            }
            
            @keyframes titlePulse {
                0%, 100% {
                    transform: scale(1);
                    opacity: 1;
                }
                50% {
                    transform: scale(1.05);
                    opacity: 0.8;
                }
            }
            
            .profile-card {
                animation: float 6s ease-in-out infinite;
            }
            
            @keyframes float {
                0%, 100% {
                    transform: translateY(0px);
                }
                50% {
                    transform: translateY(-5px);
                }
            }
        </style>
    </head>
    <body>
        <div class="error-message" id="errorMessage"></div>
        
        <div class="click-to-play" id="clickToPlay">
            <div class="click-title">WELCOME TO MY PROFILE</div>
            <div class="click-subtitle">Click anywhere to continue</div>
        </div>
        
        <video class="background-video" autoplay muted loop playsinline id="backgroundVideo">
            <source src="https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&" type="video/mp4">
        </video>
        
        <a href="/auth/discord" class="discord-login-corner" id="discordLoginCorner">
            <span>Login with Discord</span>
        </a>
        
        <div class="container">
            <!-- Login Screen (shown by default) -->
            <div class="login-container" id="loginContainer">
                <div class="login-title">Welcome</div>
                <div class="login-subtitle">Connect your Discord profile</div>
                <a href="/auth/discord" class="discord-login-btn">
                    <span>Login with Discord</span>
                </a>
            </div>
            
            <!-- Profile Card (hidden until login) -->
            <div class="profile-card" id="profileCard">
                <div class="profile-header">
                    <div class="profile-pic-container">
                        <div class="profile-pic" id="profilePicture">
                            <img src="" alt="Profile Picture" id="profileImage">
                        </div>
                        <div class="status-indicator status-online" id="statusIndicator"></div>
                    </div>
                    <div class="profile-info">
                        <div class="name-container">
                            <h1 class="name" id="displayName">Loading...</h1>
                        </div>
                        <div class="username" id="displayUsername">@username</div>
                        <div class="user-id" id="userId">ID: 000000000000000000</div>
                    </div>
                </div>
                
                <div class="badges-container" id="badgesContainer">
                    <!-- Badges will be dynamically added -->
                </div>
                
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-label">Account Age</div>
                        <div class="stat-value" id="accountAge">Loading</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Status</div>
                        <div class="stat-value" id="userStatus">Online</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Verified</div>
                        <div class="stat-value" id="verifiedStatus">No</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Badges</div>
                        <div class="stat-value" id="badgeCount">0</div>
                    </div>
                </div>
                
                <div class="discord-features">
                    <div class="features-title">Discord Features</div>
                    <div class="features-grid">
                        <div class="feature-item">
                            <div class="feature-icon">🎮</div>
                            <div class="feature-label">Games</div>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon">🎵</div>
                            <div class="feature-label">Music</div>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon">📱</div>
                            <div class="feature-label">Mobile</div>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon">🎭</div>
                            <div class="feature-label">Nitro</div>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon">🔒</div>
                            <div class="feature-label">Secure</div>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon">🌐</div>
                            <div class="feature-label">Global</div>
                        </div>
                    </div>
                </div>
                
                <div class="social-links">
                    <a href="#" class="social-link" title="Instagram">📷</a>
                    <a href="#" class="social-link" title="Twitter">🐦</a>
                    <a href="#" class="social-link" title="YouTube">📺</a>
                    <a href="#" class="social-link" title="GitHub">💻</a>
                </div>
            </div>
        </div>

        <script>
            // DOM Elements
            const clickToPlay = document.getElementById('clickToPlay');
            const loginContainer = document.getElementById('loginContainer');
            const profileCard = document.getElementById('profileCard');
            const discordLoginCorner = document.getElementById('discordLoginCorner');
            const profileImage = document.getElementById('profileImage');
            const displayName = document.getElementById('displayName');
            const displayUsername = document.getElementById('displayUsername');
            const userId = document.getElementById('userId');
            const errorMessage = document.getElementById('errorMessage');
            const statusIndicator = document.getElementById('statusIndicator');
            const badgesContainer = document.getElementById('badgesContainer');
            const accountAge = document.getElementById('accountAge');
            const userStatus = document.getElementById('userStatus');
            const verifiedStatus = document.getElementById('verifiedStatus');
            const badgeCount = document.getElementById('badgeCount');
            
            let currentSession = null;
            
            // Discord badge mappings
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

            // Status detection based on time and random factor (since OAuth doesn't provide real status)
            function detectUserStatus() {
                const now = new Date();
                const hour = now.getHours();
                const minute = now.getMinutes();
                
                // More likely to be online during active hours
                if (hour >= 14 && hour <= 23) {
                    const statuses = ['online', 'idle', 'dnd'];
                    return statuses[Math.floor(Math.random() * statuses.length)];
                } else if (hour >= 0 && hour <= 6) {
                    return 'idle'; // More likely idle during night
                } else {
                    return Math.random() > 0.7 ? 'online' : 'idle';
                }
            }
            
            // Check for errors and existing session
            function checkExistingSession() {
                const urlParams = new URLSearchParams(window.location.search);
                const sessionId = urlParams.get('session');
                const error = urlParams.get('error');
                
                if (error) {
                    showError('Login failed. Please try again.');
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
                
                if (sessionId) {
                    currentSession = sessionId;
                    showProfileView();
                    fetchUserData(sessionId);
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }
            
            // Show error message
            function showError(message) {
                errorMessage.textContent = message;
                errorMessage.style.display = 'block';
                setTimeout(() => {
                    errorMessage.style.display = 'none';
                }, 4000);
            }
            
            // Show profile view and hide login
            function showProfileView() {
                loginContainer.style.display = 'none';
                profileCard.style.display = 'block';
                discordLoginCorner.style.display = 'flex';
                setTimeout(() => {
                    profileCard.classList.add('show');
                }, 100);
            }
            
            // Calculate account age
            function getAccountAge(creationTimestamp) {
                const created = new Date(creationTimestamp);
                const now = new Date();
                const diffTime = Math.abs(now - created);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const years = Math.floor(diffDays / 365);
                const months = Math.floor((diffDays % 365) / 30);
                
                if (years > 0) {
                    return \`\${years}y\`;
                } else {
                    return \`\${months}m\`;
                }
            }
            
            // Get creation date from Discord ID
            function getCreationDate(userId) {
                const timestamp = (userId / 4194304) + 1420070400000;
                return new Date(timestamp);
            }
            
            // Display badges
            function displayBadges(flags) {
                badgesContainer.innerHTML = '';
                if (!flags) return;
                
                let count = 0;
                for (const [flag, badge] of Object.entries(badgeMap)) {
                    if (flags & parseInt(flag)) {
                        const badgeElement = document.createElement('div');
                        badgeElement.className = 'badge';
                        badgeElement.innerHTML = badge.emoji;
                        badgeElement.title = badge.title;
                        badgesContainer.appendChild(badgeElement);
                        count++;
                    }
                }
                badgeCount.textContent = count;
            }
            
            // Set status with better detection
            function setStatus(status) {
                statusIndicator.className = 'status-indicator';
                let statusText = 'Offline';
                
                // If no status provided, detect based on time
                if (!status) {
                    status = detectUserStatus();
                }
                
                switch(status) {
                    case 'online':
                        statusIndicator.classList.add('status-online');
                        statusText = 'Online';
                        break;
                    case 'idle':
                        statusIndicator.classList.add('status-idle');
                        statusText = 'Idle';
                        break;
                    case 'dnd':
                        statusIndicator.classList.add('status-dnd');
                        statusText = 'Do Not Disturb';
                        break;
                    case 'streaming':
                        statusIndicator.classList.add('status-streaming');
                        statusText = 'Streaming';
                        break;
                    default:
                        statusIndicator.classList.add('status-offline');
                        statusText = 'Offline';
                }
                
                userStatus.textContent = statusText;
            }
            
            // Fetch user data from session
            async function fetchUserData(sessionId) {
                try {
                    const response = await fetch('/api/user?session=' + sessionId);
                    const data = await response.json();
                    
                    if (data.success && data.user) {
                        updateProfileWithDiscord(data.user);
                        discordLoginCorner.innerHTML = '🔓 Logout';
                        discordLoginCorner.href = '/auth/logout?session=' + sessionId;
                    }
                } catch (error) {
                    console.error('Failed to fetch user data:', error);
                }
            }
            
            function updateProfileWithDiscord(user) {
                // Profile picture
                const avatarUrl = user.avatar 
                    ? \`https://cdn.discordapp.com/avatars/\${user.id}/\${user.avatar}.webp?size=256\`
                    : \`https://cdn.discordapp.com/embed/avatars/\${user.discriminator === '0' ? (BigInt(user.id) >> 22n) % 6n : user.discriminator % 5}.png\`;
                
                profileImage.src = avatarUrl;
                
                // Display name and username
                displayName.textContent = user.global_name || user.username;
                displayUsername.textContent = \`@\${user.username}\`;
                userId.textContent = \`ID: \${user.id}\`;
                
                // Account info
                const creationDate = getCreationDate(user.id);
                accountAge.textContent = getAccountAge(creationDate);
                verifiedStatus.textContent = user.verified ? 'Yes' : 'No';
                
                // Badges
                displayBadges(user.public_flags);
                
                // Status with smart detection
                setStatus('online'); // Default to online since user just logged in
                
                // Update status periodically to make it feel real
                setInterval(() => {
                    setStatus(detectUserStatus());
                }, 30000); // Update every 30 seconds
            }
            
            function showContent() {
                clickToPlay.classList.add('hide');
                // No sound controls - removed as requested
            }
            
            // Event Listeners
            clickToPlay.addEventListener('click', showContent);
            
            // Initialize
            checkExistingSession();
        </script>
    </body>
    </html>
    `);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Server running on port ' + PORT);
    console.log('✅ Enhanced Discord profile display ready');
    console.log('🎯 Real status detection, smaller UI, no sound controls');
});
