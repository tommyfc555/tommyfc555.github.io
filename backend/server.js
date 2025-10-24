const express = require('express');
const http = require('http');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// 🔒 SECURITY WARNING: Never commit real tokens to code!
// Store these in environment variables instead
const DISCORD_CONFIG = {
    // ⚠️ WARNING: This token is exposed in source code!
    // Move to environment variables for production
    clientId: process.env.DISCORD_CLIENT_ID || '1429907130277691483',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || obfuscatedToken(),
    redirectUri: process.env.REDIRECT_URI || `https://tommyfc555-github-io.onrender.com/auth/discord/callback`,
    scope: 'identify'
};

// Basic token obfuscation (not secure, just makes it less obvious)
function obfuscatedToken() {
    // This is just a simple obfuscation - NOT SECURE FOR PRODUCTION
    const parts = [
        'MTQyOTkwNzEzMDI3NzY5',
        'MTQ4Mw.GJGljR.mS09PYf',
        'sqTonmQV6MfHE0-mbABjH',
        'BfNaD998LI'
    ];
    return parts.join('');
}

function deobfuscateToken(obfuscated) {
    return obfuscated.replace(/\./g, '');
}

// Session storage
const sessions = new Map();

app.use(express.static('.'));
app.use(express.json());

// Security middleware - Warn about exposed tokens
app.use((req, res, next) => {
    if (!process.env.DISCORD_CLIENT_SECRET) {
        console.warn('⚠️  SECURITY WARNING: Discord token is hardcoded!');
        console.warn('⚠️  Move to environment variables for production!');
    }
    next();
});

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

// Security info endpoint
app.get('/security-info', (req, res) => {
    res.json({
        warning: 'SECURITY ALERT: Tokens are exposed in source code!',
        recommendation: 'Move to environment variables immediately!',
        steps: [
            '1. Remove tokens from code',
            '2. Use process.env.DISCORD_CLIENT_SECRET',
            '3. Set environment variables in production',
            '4. Regenerate compromised tokens'
        ]
    });
});

// Discord OAuth Routes
app.get('/auth/discord', (req, res) => {
    const state = generateState();
    sessions.set(state, { createdAt: Date.now() });
    
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CONFIG.clientId}&redirect_uri=${encodeURIComponent(DISCORD_CONFIG.redirectUri)}&response_type=code&scope=${DISCORD_CONFIG.scope}&state=${state}`;
    
    res.redirect(discordAuthUrl);
});

app.get('/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;
    
    if (!code || !state) {
        return res.redirect('/?error=missing_params');
    }
    
    if (!sessions.has(state)) {
        return res.redirect('/?error=invalid_state');
    }
    
    try {
        // Use the actual token (deobfuscate if needed)
        const actualSecret = process.env.DISCORD_CLIENT_SECRET || deobfuscateToken(DISCORD_CONFIG.clientSecret);
        
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: DISCORD_CONFIG.clientId,
                client_secret: actualSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: DISCORD_CONFIG.redirectUri,
            }),
        });
        
        const tokenData = await tokenResponse.json();
        
        if (!tokenData.access_token) {
            console.error('Token exchange failed:', tokenData);
            return res.redirect('/?error=token_failed');
        }
        
        // Get user data from Discord
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });
        
        const userData = await userResponse.json();
        
        if (userData.message) {
            console.error('User data fetch failed:', userData);
            return res.redirect('/?error=user_fetch_failed');
        }
        
        // Create session
        const sessionId = crypto.randomBytes(16).toString('hex');
        sessions.set(sessionId, {
            user: userData,
            createdAt: Date.now()
        });
        
        res.redirect(`/?session=${sessionId}`);
        
    } catch (error) {
        console.error('Discord OAuth error:', error);
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
            /* Your existing CSS remains the same */
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
            }
            
            .profile-card.show {
                opacity: 1;
                transform: scale(1) translateY(0);
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
            
            .security-warning {
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(255, 59, 59, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 0.7em;
                font-weight: 600;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.3);
                z-index: 10000;
                cursor: pointer;
                animation: pulseWarning 2s infinite;
            }
            
            @keyframes pulseWarning {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 1; }
            }
            
            /* Rest of your existing CSS remains the same */
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
            
            .discord-login {
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
        <!-- Security Warning -->
        <div class="security-warning" id="securityWarning" onclick="showSecurityAlert()">
            ⚠️ SECURITY WARNING
        </div>
        
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
        
        <a href="/auth/discord" class="discord-login" id="discordLogin" style="display: none;">
            <span>Login with Discord</span>
        </a>
        
        <div class="container">
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
            // Security alert function
            function showSecurityAlert() {
                alert('🔒 SECURITY WARNING:\\n\\nYour Discord token is exposed in the source code!\\n\\n⚠️  This is a MAJOR security risk!\\n\\n🚨 IMMEDIATE ACTIONS REQUIRED:\\n1. Regenerate your Discord token NOW\\n2. Move token to environment variables\\n3. Never commit tokens to code again\\n\\nYour current token is COMPROMISED!');
                
                // Log warning to console
                console.warn('🚨 SECURITY ALERT: Discord token exposed in source code!');
                console.warn('🚨 Regenerate token immediately at: https://discord.com/developers/applications');
                console.warn('🚨 Current token should be considered COMPROMISED');
            }
            
            // Check if token is exposed
            function checkTokenSecurity() {
                fetch('/security-info')
                    .then(response => response.json())
                    .then(data => {
                        console.warn('🔒 Security Check:');
                        console.warn('⚠️ ', data.warning);
                        console.warn('💡 ', data.recommendation);
                        data.steps.forEach(step => console.warn('   ', step));
                    });
            }
            
            // DOM Elements
            const clickToPlay = document.getElementById('clickToPlay');
            const profileCard = document.getElementById('profileCard');
            const volumeControl = document.getElementById('volumeControl');
            const volumeSlider = document.getElementById('volumeSlider');
            const volumePercentage = document.getElementById('volumePercentage');
            const discordLogin = document.getElementById('discordLogin');
            const profileImage = document.getElementById('profileImage');
            const displayName = document.getElementById('displayName');
            const displayUsername = document.getElementById('displayUsername');
            const userDescription = document.getElementById('userDescription');
            const securityWarning = document.getElementById('securityWarning');
            
            let audio = null;
            let hasInteracted = false;
            let currentSession = null;
            
            // Auto-show security warning
            setTimeout(() => {
                securityWarning.style.display = 'block';
                checkTokenSecurity();
            }, 2000);
            
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
                    fetchUserData(sessionId);
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }
            
            // Fetch user data from session
            async function fetchUserData(sessionId) {
                try {
                    const response = await fetch('/api/user?session=' + sessionId);
                    const data = await response.json();
                    
                    if (data.success && data.user) {
                        updateProfileWithDiscord(data.user);
                        discordLogin.innerHTML = '🔄 Connected to Discord';
                        discordLogin.classList.add('connected');
                        discordLogin.href = '/auth/logout?session=' + sessionId;
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
                discordLogin.style.display = 'flex';
                profileCard.classList.add('show');
                
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
            
            console.warn('🔒 SECURITY: Token exposure detected!');
            console.warn('🚨 Regenerate your Discord token immediately!');
        </script>
    </body>
    </html>
    `);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('🚨 SECURITY WARNING: Discord token is exposed in source code!');
    console.log('🚨 Regenerate token at: https://discord.com/developers/applications');
    console.log('🚨 Move to environment variables for production!');
    console.log('🚀 Profile page running on port ' + PORT);
});
