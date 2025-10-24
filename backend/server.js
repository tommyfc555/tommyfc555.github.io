require('dotenv').config();
const express = require('express');
const http = require('http');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// ✅ SECURE: Only use environment variables
const DISCORD_CONFIG = {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI || `https://tommyfc555-github-io.onrender.com/auth/discord/callback`,
    scope: 'identify'
};

// Validate that required environment variables exist
const requiredEnvVars = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    console.error('💡 Set them in Render.com dashboard under Environment tab');
    // Don't exit in production, just warn
    if (process.env.NODE_ENV === 'production') {
        console.error('🚨 Running in production without proper environment variables!');
    }
}

console.log('✅ Server starting...');

// Session storage
const sessions = new Map();

app.use(express.static('.'));
app.use(express.json());

// Generate random state for OAuth security
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
    
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CONFIG.clientId}&redirect_uri=${encodeURIComponent(DISCORD_CONFIG.redirectUri)}&response_type=code&scope=${DISCORD_CONFIG.scope}&state=${state}`;
    
    console.log('🔗 Redirecting to Discord OAuth...');
    res.redirect(discordAuthUrl);
});

app.get('/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;
    
    console.log('🔄 OAuth callback received:', { code: !!code, state: !!state });
    
    if (!code || !state) {
        console.error('❌ Missing code or state parameters');
        return res.redirect('/?error=missing_params');
    }
    
    if (!sessions.has(state)) {
        console.error('❌ Invalid state parameter');
        return res.redirect('/?error=invalid_state');
    }
    
    try {
        // Clean up the state session
        sessions.delete(state);
        
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
        
        console.log('🔑 Token response:', tokenData);
        
        if (!tokenData.access_token) {
            console.error('❌ Token exchange failed:', tokenData);
            return res.redirect('/?error=token_failed');
        }
        
        // Get user data from Discord
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });
        
        const userData = await userResponse.json();
        
        console.log('👤 User data received:', userData.username);
        
        if (userData.message) {
            console.error('❌ User data fetch failed:', userData);
            return res.redirect('/?error=user_fetch_failed');
        }
        
        // Create session
        const sessionId = crypto.randomBytes(16).toString('hex');
        sessions.set(sessionId, {
            user: userData,
            createdAt: Date.now()
        });
        
        console.log('✅ Login successful for user:', userData.username);
        res.redirect(`/?session=${sessionId}`);
        
    } catch (error) {
        console.error('❌ Discord OAuth error:', error);
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

// Serve the main page
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Black</title>
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
                --text-primary: #ffffff;
                --text-secondary: #a8b2d1;
                --text-tertiary: #8892b0;
                --bg-glass: rgba(0, 0, 0, 0.4);
                --border-glass: rgba(255, 255, 255, 0.15);
                --shadow-glass: 0 25px 50px rgba(0, 0, 0, 0.5);
            }
            
            body {
                background: #000;
                color: var(--text-primary);
                height: 100vh;
                height: 100dvh;
                overflow: hidden;
                position: fixed;
                width: 100%;
                touch-action: manipulation;
            }
            
            .background-video {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                z-index: -1;
                filter: brightness(0.7);
            }
            
            .container {
                display: flex;
                height: 100vh;
                height: 100dvh;
                align-items: center;
                justify-content: center;
                position: relative;
                z-index: 1;
                padding: 20px;
                box-sizing: border-box;
            }
            
            .login-container {
                background: var(--bg-glass);
                backdrop-filter: blur(25px);
                -webkit-backdrop-filter: blur(25px);
                border: 1px solid var(--border-glass);
                border-radius: 24px;
                padding: clamp(40px, 10vw, 60px) clamp(30px, 8vw, 50px);
                text-align: center;
                max-width: min(400px, 90vw);
                width: 100%;
                box-shadow: var(--shadow-glass);
            }
            
            .profile-card {
                background: var(--bg-glass);
                backdrop-filter: blur(25px);
                -webkit-backdrop-filter: blur(25px);
                border: 1px solid var(--border-glass);
                border-radius: 24px;
                padding: clamp(30px, 8vw, 50px) clamp(20px, 6vw, 40px);
                text-align: center;
                max-width: min(480px, 90vw);
                width: 100%;
                box-shadow: var(--shadow-glass);
                opacity: 0;
                transform: scale(0.8) translateY(30px);
                transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
                display: none;
            }
            
            .profile-card.show {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
            
            .login-title {
                font-size: clamp(2em, 8vw, 2.5em);
                font-weight: 700;
                background: linear-gradient(135deg, #fff 0%, #a8b2d1 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 20px;
            }
            
            .login-subtitle {
                color: var(--text-secondary);
                font-size: clamp(1em, 4vw, 1.2em);
                margin-bottom: 40px;
                font-weight: 300;
            }
            
            .discord-login-btn {
                background: #5865F2;
                color: white;
                border: none;
                border-radius: 50px;
                padding: 16px 32px;
                font-size: 1.1em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(88, 101, 242, 0.3);
                display: inline-flex;
                align-items: center;
                gap: 12px;
                text-decoration: none;
                margin: 10px 0;
            }
            
            .discord-login-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(88, 101, 242, 0.4);
            }
            
            .profile-pic {
                width: min(160px, 30vw);
                height: min(160px, 30vw);
                border-radius: 50%;
                border: 3px solid rgba(255, 255, 255, 0.3);
                margin: 0 auto 25px;
                background: var(--primary-gradient);
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                position: relative;
                transition: all 0.4s ease;
            }
            
            .profile-pic img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 50%;
            }
            
            .name-container {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                margin-bottom: 8px;
                flex-wrap: wrap;
            }
            
            .name {
                font-size: clamp(2em, 8vw, 3em);
                font-weight: 700;
                background: linear-gradient(135deg, #fff 0%, #a8b2d1 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                letter-spacing: -0.5px;
                line-height: 1.2;
            }
            
            .owner-badge {
                font-size: clamp(1em, 4vw, 1.2em);
                opacity: 0.9;
                position: relative;
                cursor: help;
                animation: crownGlow 2s ease-in-out infinite alternate;
                filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.3));
            }
            
            .username {
                color: var(--text-secondary);
                font-size: clamp(1em, 4vw, 1.3em);
                margin-bottom: 25px;
                font-weight: 400;
                letter-spacing: 0.5px;
            }
            
            .description {
                color: var(--text-tertiary);
                font-size: clamp(0.9em, 3.5vw, 1.2em);
                line-height: 1.6;
                margin-bottom: 35px;
                font-weight: 300;
            }
            
            .social-links {
                display: flex;
                justify-content: center;
                gap: min(20px, 4vw);
                margin-top: 30px;
                flex-wrap: wrap;
            }
            
            .social-link {
                width: min(50px, 12vw);
                height: min(50px, 12vw);
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.08);
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-secondary);
                text-decoration: none;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid rgba(255, 255, 255, 0.1);
                font-size: clamp(1em, 4vw, 1.2em);
            }
            
            .volume-control {
                position: fixed;
                top: 20px;
                left: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.3);
                padding: 15px 20px;
                border-radius: 16px;
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                transition: all 0.3s ease;
                display: none;
            }
            
            .volume-slider-container {
                display: flex;
                align-items: center;
                gap: 15px;
                width: 100%;
            }
            
            .volume-icon {
                font-size: clamp(1.1em, 4vw, 1.3em);
                color: var(--text-secondary);
                min-width: 30px;
                text-align: center;
            }
            
            .volume-slider {
                flex: 1;
                height: 6px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                outline: none;
                -webkit-appearance: none;
                min-height: 20px;
            }
            
            .volume-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #fff;
                cursor: pointer;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                transition: all 0.2s ease;
            }
            
            .volume-percentage {
                color: var(--text-secondary);
                font-size: clamp(0.8em, 3vw, 0.9em);
                font-weight: 500;
                min-width: 35px;
                text-align: center;
            }
            
            .discord-login-corner {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #5865F2;
                color: white;
                border: none;
                border-radius: 50px;
                padding: 12px 20px;
                font-size: 0.9em;
                font-weight: 600;
                cursor: pointer;
                backdrop-filter: blur(10px);
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(88, 101, 242, 0.3);
                display: flex;
                align-items: center;
                gap: 8px;
                z-index: 100;
                text-decoration: none;
                display: none;
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
                gap: 20px;
                padding: 20px;
                text-align: center;
            }
            
            .click-title {
                font-size: clamp(2em, 10vw, 3.5em);
                font-weight: 700;
                background: linear-gradient(135deg, #fff 0%, #a8b2d1 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                letter-spacing: 2px;
                animation: titlePulse 2s ease-in-out infinite;
                line-height: 1.2;
            }
            
            .click-subtitle {
                font-size: clamp(0.9em, 4vw, 1.2em);
                color: var(--text-tertiary);
                font-weight: 300;
                letter-spacing: 1px;
            }
            
            .click-to-play.hide {
                opacity: 0;
                pointer-events: none;
            }
            
            @keyframes crownGlow {
                0% {
                    transform: scale(1) rotate(0deg);
                    filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.3));
                }
                100% {
                    transform: scale(1.1) rotate(5deg);
                    filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.6));
                }
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
                animation: float 8s ease-in-out infinite;
            }
            
            @keyframes float {
                0%, 100% {
                    transform: translateY(0px) rotate(0deg);
                }
                33% {
                    transform: translateY(-10px) rotate(1deg);
                }
                66% {
                    transform: translateY(-5px) rotate(-1deg);
                }
            }
        </style>
    </head>
    <body>
        <div class="click-to-play" id="clickToPlay">
            <div class="click-title">CLICK ANYWHERE TO PLAY</div>
            <div class="click-subtitle">Experience the vibe</div>
        </div>
        
        <video class="background-video" autoplay muted loop playsinline id="backgroundVideo">
            <source src="https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&" type="video/mp4">
        </video>
        
        <div class="volume-control" id="volumeControl">
            <div class="volume-slider-container">
                <div class="volume-icon">🔊</div>
                <input type="range" class="volume-slider" id="volumeSlider" min="0" max="100" value="50">
                <div class="volume-percentage" id="volumePercentage">50%</div>
            </div>
        </div>
        
        <a href="/auth/discord" class="discord-login-corner" id="discordLoginCorner">
            <span>Login with Discord</span>
        </a>
        
        <div class="container">
            <!-- Login Screen (shown by default) -->
            <div class="login-container" id="loginContainer">
                <div class="login-title">Welcome</div>
                <div class="login-subtitle">Login with Discord to continue</div>
                <a href="/auth/discord" class="discord-login-btn">
                    <span>Login with Discord</span>
                </a>
            </div>
            
            <!-- Profile Card (hidden until login) -->
            <div class="profile-card" id="profileCard">
                <div class="profile-pic" id="profilePicture">
                    <img src="https://cdn.discordapp.com/attachments/1415024144105603186/1431012955830358186/03ec152ca2681844ffb0082d6180fe6e.webp?ex=68fbde2b&is=68fa8cab&hm=4d8b7a7409ee052540a24869da6a59c3750193b0ccda7c41df1954ddcc5d3133&" alt="Profile Picture" id="profileImage">
                </div>
                
                <div class="name-container">
                    <h1 class="name" id="displayName">Black</h1>
                    <div class="owner-badge">👑</div>
                </div>
                
                <div class="username" id="displayUsername">@zhuisud_9</div>
                
                <div class="description" id="userDescription">
                    Soon own website<br>
                    Building the future one line at a time
                </div>
                
                <div class="social-links">
                    <a href="#" class="social-link">📷</a>
                    <a href="#" class="social-link">🐦</a>
                    <a href="#" class="social-link">📺</a>
                    <a href="#" class="social-link">💻</a>
                </div>
            </div>
        </div>

        <script>
            // DOM Elements
            const clickToPlay = document.getElementById('clickToPlay');
            const loginContainer = document.getElementById('loginContainer');
            const profileCard = document.getElementById('profileCard');
            const volumeControl = document.getElementById('volumeControl');
            const volumeSlider = document.getElementById('volumeSlider');
            const volumePercentage = document.getElementById('volumePercentage');
            const discordLoginCorner = document.getElementById('discordLoginCorner');
            const profileImage = document.getElementById('profileImage');
            const displayName = document.getElementById('displayName');
            const displayUsername = document.getElementById('displayUsername');
            const userDescription = document.getElementById('userDescription');
            
            let audio = null;
            let hasInteracted = false;
            let currentSession = null;
            
            // Check for existing session
            function checkExistingSession() {
                const urlParams = new URLSearchParams(window.location.search);
                const sessionId = urlParams.get('session');
                const error = urlParams.get('error');
                
                if (error) {
                    showNotification('Login failed: ' + error);
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
                
                if (sessionId) {
                    currentSession = sessionId;
                    showProfileView();
                    fetchUserData(sessionId);
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }
            
            // Show profile view and hide login
            function showProfileView() {
                loginContainer.style.display = 'none';
                profileCard.style.display = 'block';
                setTimeout(() => {
                    profileCard.classList.add('show');
                }, 100);
            }
            
            // Fetch user data from session
            async function fetchUserData(sessionId) {
                try {
                    const response = await fetch('/api/user?session=' + sessionId);
                    const data = await response.json();
                    
                    if (data.success && data.user) {
                        updateProfileWithDiscord(data.user);
                        discordLoginCorner.innerHTML = '🔄 Logout';
                        discordLoginCorner.href = '/auth/logout?session=' + sessionId;
                        showNotification('Welcome, ' + data.user.username + '!');
                    }
                } catch (error) {
                    console.error('Failed to fetch user data:', error);
                }
            }
            
            function updateProfileWithDiscord(user) {
                const avatarUrl = user.avatar 
                    ? \`https://cdn.discordapp.com/avatars/\${user.id}/\${user.avatar}.webp?size=256\`
                    : \`https://cdn.discordapp.com/embed/avatars/\${user.discriminator % 5}.png\`;
                
                profileImage.src = avatarUrl;
                displayName.textContent = user.global_name || user.username;
                displayUsername.textContent = \`@\${user.username}\`;
                userDescription.innerHTML = \`Discord User<br>Connected via OAuth2\`;
            }
            
            function initializeAudio() {
                if (hasInteracted) return;
                
                audio = new Audio('https://cdn.discordapp.com/attachments/1415024144105603186/1431016663683305472/james_bandz_-_Swat_Me_Maybe_Lyrics.mp3?ex=68fbe19f&is=68fa901f&hm=7be358d8d9b012292cafb0c5d4e2bbb158a6c090f62a85c3b877e812da9d27cc&');
                audio.loop = true;
                updateVolume();
                
                audio.play().catch(error => {
                    console.log('Audio play failed:', error);
                });
                
                hasInteracted = true;
            }
            
            function updateVolume() {
                if (audio) {
                    audio.volume = volumeSlider.value / 100;
                }
                volumePercentage.textContent = volumeSlider.value + '%';
            }
            
            function showContent() {
                clickToPlay.classList.add('hide');
                volumeControl.style.display = 'block';
                discordLoginCorner.style.display = 'flex';
                
                setTimeout(() => {
                    initializeAudio();
                }, 800);
            }
            
            function showNotification(message) {
                const notification = document.createElement('div');
                notification.style.cssText = \`
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    z-index: 1000;
                    font-size: 0.9em;
                    animation: slideIn 0.3s ease;
                \`;
                notification.textContent = message;
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    notification.remove();
                }, 3000);
            }
            
            // Event Listeners
            clickToPlay.addEventListener('click', showContent);
            volumeSlider.addEventListener('input', updateVolume);
            
            // Initialize
            checkExistingSession();
        </script>
    </body>
    </html>
    `);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Server running on port ' + PORT);
    console.log('🔑 Using Client ID:', process.env.DISCORD_CLIENT_ID);
    console.log('🌐 Redirect URI:', process.env.REDIRECT_URI || 'https://tommyfc555-github-io.onrender.com/auth/discord/callback');
});
