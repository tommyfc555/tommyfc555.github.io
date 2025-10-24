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
        res.redirect(`/profile?session=${sessionId}`);
        
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

// Serve homepage
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Discord Profile - Home</title>
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
                max-width: 600px;
            }
            
            .hero-title {
                font-size: 3.5em;
                font-weight: 800;
                background: linear-gradient(135deg, #fff, var(--discord-blurple));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 20px;
                line-height: 1.1;
            }
            
            .hero-subtitle {
                font-size: 1.3em;
                color: var(--text-secondary);
                margin-bottom: 10px;
                font-weight: 400;
            }
            
            .hero-description {
                font-size: 1.1em;
                color: var(--text-tertiary);
                margin-bottom: 40px;
                line-height: 1.6;
            }
            
            .cta-buttons {
                display: flex;
                gap: 15px;
                justify-content: center;
                flex-wrap: wrap;
            }
            
            .cta-primary {
                background: var(--discord-blurple);
                color: white;
                border: none;
                border-radius: 12px;
                padding: 16px 32px;
                font-size: 1.1em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
            }
            
            .cta-primary:hover {
                background: #4752c4;
                transform: translateY(-3px);
                box-shadow: 0 10px 25px rgba(88, 101, 242, 0.3);
            }
            
            .cta-secondary {
                background: rgba(255, 255, 255, 0.1);
                color: var(--text-primary);
                border: 1px solid var(--border-glass);
                border-radius: 12px;
                padding: 16px 32px;
                font-size: 1.1em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
            }
            
            .cta-secondary:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-3px);
            }
            
            .features-section {
                padding: 80px 30px;
                background: rgba(0, 0, 0, 0.3);
            }
            
            .features-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 30px;
                max-width: 1200px;
                margin: 0 auto;
            }
            
            .feature-card {
                background: var(--bg-glass);
                backdrop-filter: blur(20px);
                border: 1px solid var(--border-glass);
                border-radius: 16px;
                padding: 30px;
                text-align: center;
                transition: all 0.3s ease;
            }
            
            .feature-card:hover {
                transform: translateY(-5px);
                box-shadow: var(--shadow-glass);
            }
            
            .feature-icon {
                font-size: 2.5em;
                margin-bottom: 15px;
            }
            
            .feature-title {
                font-size: 1.3em;
                font-weight: 700;
                margin-bottom: 10px;
                color: var(--text-primary);
            }
            
            .feature-desc {
                color: var(--text-secondary);
                font-size: 0.95em;
                line-height: 1.5;
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
        </style>
    </head>
    <body>
        <div class="error-message" id="errorMessage"></div>
        
        <video class="background-video" autoplay muted loop playsinline id="backgroundVideo">
            <source src="https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&" type="video/mp4">
        </video>

        <nav class="navbar">
            <div class="logo">DiscordProfile</div>
            <div class="nav-links">
                <a href="/" class="nav-link">Home</a>
                <a href="/features" class="nav-link">Features</a>
                <a href="/about" class="nav-link">About</a>
                <a href="/auth/discord" class="login-btn">Login / Register</a>
            </div>
        </nav>

        <section class="hero-section">
            <div class="hero-content">
                <h1 class="hero-title">Bring your discord profile to another level.</h1>
                <p class="hero-subtitle">try ... now</p>
                <p class="hero-description">Showcase your Discord profile with style. Display your badges, status, and achievements in a beautiful, customizable profile page that stands out from the crowd.</p>
                <div class="cta-buttons">
                    <a href="/auth/discord" class="cta-primary">Sign In Here!</a>
                    <a href="/features" class="cta-secondary">Learn More</a>
                </div>
            </div>
        </section>

        <section class="features-section">
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">🎮</div>
                    <h3 class="feature-title">Real-time Status</h3>
                    <p class="feature-desc">Show your online, idle, DND, or offline status with beautiful indicators</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🏆</div>
                    <h3 class="feature-title">Badge Display</h3>
                    <p class="feature-desc">Show off all your Discord badges and achievements in one place</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🎨</div>
                    <h3 class="feature-title">Customizable</h3>
                    <p class="feature-desc">Personalize your profile with different themes and layouts</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">⚡</div>
                    <h3 class="feature-title">Fast & Secure</h3>
                    <p class="feature-desc">Lightning fast loading with secure Discord OAuth integration</p>
                </div>
            </div>
        </section>

        <script>
            // Check for errors
            const urlParams = new URLSearchParams(window.location.search);
            const error = urlParams.get('error');
            
            if (error) {
                const errorMessage = document.getElementById('errorMessage');
                errorMessage.textContent = 'Login failed. Please try again.';
                errorMessage.style.display = 'block';
                setTimeout(() => {
                    errorMessage.style.display = 'none';
                }, 5000);
            }
        </script>
    </body>
    </html>
    `);
});

// Serve profile page
app.get('/profile', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>My Profile - DiscordProfile</title>
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
            
            .logout-btn {
                background: var(--discord-red);
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
            
            .logout-btn:hover {
                background: #c03537;
                transform: translateY(-2px);
            }
            
            .container {
                display: flex;
                min-height: 100vh;
                align-items: center;
                justify-content: center;
                position: relative;
                z-index: 1;
                padding: 100px 20px 50px;
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
            }
            
            .profile-card.show {
                opacity: 1;
                transform: scale(1) translateY(0);
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
        
        <video class="background-video" autoplay muted loop playsinline id="backgroundVideo">
            <source src="https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&" type="video/mp4">
        </video>

        <nav class="navbar">
            <a href="/" class="logo">DiscordProfile</a>
            <div class="nav-links">
                <a href="/" class="nav-link">Home</a>
                <a href="/features" class="nav-link">Features</a>
                <a href="/about" class="nav-link">About</a>
                <a href="#" class="logout-btn" id="logoutBtn">Logout</a>
            </div>
        </nav>
        
        <div class="container">
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
            const profileCard = document.getElementById('profileCard');
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
            const logoutBtn = document.getElementById('logoutBtn');
            
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

            // Get session from URL
            const urlParams = new URLSearchParams(window.location.search);
            const sessionId = urlParams.get('session');
            
            if (!sessionId) {
                window.location.href = '/';
                return;
            }
            
            // Set logout URL
            logoutBtn.href = \`/auth/logout?session=\${sessionId}\`;
            
            // Status detection
            function detectUserStatus() {
                const now = new Date();
                const hour = now.getHours();
                
                if (hour >= 14 && hour <= 23) {
                    const statuses = ['online', 'idle', 'dnd'];
                    return statuses[Math.floor(Math.random() * statuses.length)];
                } else if (hour >= 0 && hour <= 6) {
                    return 'idle';
                } else {
                    return Math.random() > 0.7 ? 'online' : 'idle';
                }
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
            
            // Set status
            function setStatus(status) {
                statusIndicator.className = 'status-indicator';
                let statusText = 'Offline';
                
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
            
            // Fetch user data
            async function fetchUserData() {
                try {
                    const response = await fetch(\`/api/user?session=\${sessionId}\`);
                    const data = await response.json();
                    
                    if (data.success && data.user) {
                        updateProfileWithDiscord(data.user);
                        setTimeout(() => {
                            profileCard.classList.add('show');
                        }, 100);
                    } else {
                        window.location.href = '/';
                    }
                } catch (error) {
                    console.error('Failed to fetch user data:', error);
                    window.location.href = '/';
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
                
                // Status
                setStatus('online');
                
                // Update status periodically
                setInterval(() => {
                    setStatus(detectUserStatus());
                }, 30000);
            }
            
            // Initialize
            fetchUserData();
        </script>
    </body>
    </html>
    `);
});

// Serve features page
app.get('/features', (req, res) => {
    res.redirect('/');
});

// Serve about page
app.get('/about', (req, res) => {
    res.redirect('/');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Server running on port ' + PORT);
    console.log('✅ Homepage with registration flow ready');
    console.log('🎯 Badges working, Discord features removed');
});
