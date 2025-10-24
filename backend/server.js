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

// User storage (in production, use a database)
const users = new Map(); // Map<username, userData>
const sessions = new Map(); // Map<sessionId, userData>

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

function generateSessionId() {
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

// Serve homepage with username input
app.get('/', (req, res) => {
    const { username } = req.query;
    
    if (username && users.has(username.toLowerCase())) {
        // Redirect to user's profile if username exists
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
            
            .username-form {
                background: var(--bg-glass);
                backdrop-filter: blur(20px);
                border: 1px solid var(--border-glass);
                border-radius: 16px;
                padding: 30px;
                max-width: 400px;
                margin: 0 auto 30px;
            }
            
            .form-title {
                font-size: 1.3em;
                font-weight: 700;
                margin-bottom: 20px;
                color: var(--text-primary);
            }
            
            .input-group {
                margin-bottom: 20px;
            }
            
            .username-input {
                width: 100%;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid var(--border-glass);
                border-radius: 8px;
                padding: 12px 16px;
                color: var(--text-primary);
                font-size: 1em;
                transition: all 0.3s ease;
            }
            
            .username-input:focus {
                outline: none;
                border-color: var(--discord-blurple);
                background: rgba(255, 255, 255, 0.15);
            }
            
            .username-input::placeholder {
                color: var(--text-tertiary);
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
                display: inline-block;
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
                display: inline-block;
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
        </style>
    </head>
    <body>
        <div class="error-message" id="errorMessage"></div>
        <div class="success-message" id="successMessage"></div>
        
        <video class="background-video" autoplay muted loop playsinline id="backgroundVideo">
            <source src="https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&" type="video/mp4">
        </video>

        <nav class="navbar">
            <div class="logo">DiscordProfile</div>
            <div class="nav-links">
                <a href="/" class="nav-link">Home</a>
                <a href="/features" class="nav-link">Features</a>
                <a href="/about" class="nav-link">About</a>
                <a href="#" class="login-btn" id="registerBtn">Login / Register</a>
            </div>
        </nav>

        <section class="hero-section">
            <div class="hero-content">
                <h1 class="hero-title">Bring your discord profile to another level.</h1>
                <p class="hero-subtitle">try ... now</p>
                <p class="hero-description">Showcase your Discord profile with style. Display your badges, status, and achievements in a beautiful, customizable profile page that stands out from the crowd.</p>
                
                <div class="username-form">
                    <h3 class="form-title">Choose a name here!</h3>
                    <div class="input-group">
                        <input type="text" class="username-input" id="usernameInput" placeholder="Enter your username (e.g., hwid)" maxlength="20">
                    </div>
                    <button class="cta-primary" onclick="registerUser()">Login with this name</button>
                </div>
                
                <div class="cta-buttons">
                    <a href="/features" class="cta-secondary">Learn More</a>
                </div>
            </div>
        </section>

        <section class="features-section">
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">🎮</div>
                    <h3 class="feature-title">Custom Profiles</h3>
                    <p class="feature-desc">Get your own personalized profile URL like: yourname.discordprofile.com</p>
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
                window.location.href = '/auth/discord';
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
        </script>
    </body>
    </html>
    `);
});

// Discord OAuth Routes
app.get('/auth/discord', (req, res) => {
    const state = generateState();
    sessions.set(state, { 
        createdAt: Date.now(),
        registering: true
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
        
        // Generate a username if not provided (fallback)
        let username = userData.username.toLowerCase();
        
        // Check if username already exists, if so add discriminator
        if (users.has(username)) {
            username = username + '-' + userData.discriminator;
        }
        
        // Store user data
        const userRecord = {
            discordData: userData,
            access_token: tokenData.access_token,
            username: username,
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
                customHTML: ''
            }
        };
        
        users.set(username, userRecord);
        
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
        
        // Redirect to user's profile
        res.redirect('/' + username);
        
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
        return res.status(403).send('Access denied. Please log in.');
    }
    
    const session = sessions.get(sessionId);
    const user = users.get(session.username);
    
    if (!user || user.username !== username.toLowerCase()) {
        return res.status(403).send('Access denied. You can only edit your own profile.');
    }
    
    req.user = user;
    next();
}

// Settings page - only accessible to profile owner
app.get('/:username/settings', checkProfileOwnership, (req, res) => {
    const user = req.user;
    
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Settings - ${user.discordData.global_name || user.discordData.username}</title>
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
                <span class="nav-user">Welcome, ${user.discordData.global_name || user.discordData.username}</span>
            </div>
        </nav>

        <div class="settings-container">
            <div class="settings-sidebar">
                <h3>Settings</h3>
                <div class="sidebar-links">
                    <a href="#profile" class="sidebar-link active">Profile</a>
                    <a href="#appearance" class="sidebar-link">Appearance</a>
                    <a href="#music" class="sidebar-link">Music</a>
                    <a href="#privacy" class="sidebar-link">Privacy</a>
                    <a href="#advanced" class="sidebar-link">Advanced</a>
                </div>
            </div>

            <div class="settings-content">
                <h1>Profile Settings</h1>
                <p class="settings-subtitle">Customize your profile appearance and behavior</p>

                <form id="settingsForm" class="settings-form">
                    <!-- Profile Section -->
                    <div id="profile" class="settings-section active">
                        <h2>Profile Information</h2>
                        
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
                                    <div class="bg-preview-image"></div>
                                    <span>Default Anime</span>
                                </div>
                                <div class="bg-preview" data-url="https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&">
                                    <div class="bg-preview-image"></div>
                                    <span>Space Theme</span>
                                </div>
                                <div class="bg-preview" data-url="https://cdn.discordapp.com/attachments/1415024144105603186/1431012690108874833/Anime_girl_dancing_infront_of_car.mp4?ex=68fbddec&is=68fa8c6c&hm=444b29541a18a7f1308500f68b513285c730c359294314a9d3e8f18fc6272cd6&">
                                    <div class="bg-preview-image"></div>
                                    <span>Cyberpunk</span>
                                </div>
                            </div>
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
            
            bioTextarea.addEventListener('input', () => {
                bioCount.textContent = bioTextarea.value.length;
            });

            // Form submission
            document.getElementById('settingsForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                const settings = Object.fromEntries(formData);
                
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
        </script>
    </body>
    </html>
    `);
});

// Update settings endpoint
app.post('/:username/settings/update', checkProfileOwnership, (req, res) => {
    const user = req.user;
    const newSettings = req.body;
    
    // Update user settings
    user.settings = {
        ...user.settings,
        ...newSettings
    };
    
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
    
    // Generate social links HTML
    const socialLinksHTML = user.settings.showSocialLinks ? `
        <div class="social-links">
            <a href="#" class="social-link" title="Instagram">📷</a>
            <a href="#" class="social-link" title="Twitter">🐦</a>
            <a href="#" class="social-link" title="YouTube">📺</a>
            <a href="#" class="social-link" title="GitHub">💻</a>
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
    
    res.send('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + (user.discordData.global_name || user.discordData.username) + '\'s Profile - DiscordProfile</title><meta name="description" content="' + (user.discordData.global_name || user.discordData.username) + '\'s Discord profile"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><meta http-equiv="Permissions-Policy" content="browsing-topics=(), run-ad-auction=(), join-ad-interest-group=(), private-state-token-redemption=(), private-state-token-issuance=(), private-aggregation=(), attribution-reporting=()"><style>' + getProfileCSS() + (user.settings.customCSS || '') + '</style></head><body><video class="background-video" autoplay muted loop playsinline id="backgroundVideo"><source src="' + user.settings.background + '" type="video/mp4"></video>' + (user.settings.music ? '<audio id="backgroundMusic" loop><source src="' + user.settings.music + '" type="audio/mp3"></audio>' : '') + '<nav class="navbar"><a href="/" class="logo">DiscordProfile</a><div class="nav-links"><a href="/" class="nav-link">Home</a><a href="/features" class="nav-link">Features</a><a href="/about" class="nav-link">About</a>' + settingsButton + '<a href="/auth/discord" class="get-profile-btn">Get Your Profile</a></div></nav><div class="container"><div class="profile-card"><div class="profile-header"><div class="profile-pic-container"><div class="profile-pic"><img src="' + avatarUrl + '" alt="' + (user.discordData.global_name || user.discordData.username) + '\'s Profile Picture"></div><div class="status-indicator status-online"></div></div><div class="profile-info"><div class="name-container"><h1 class="name">' + (user.discordData.global_name || user.discordData.username) + '</h1></div><div class="username">@' + user.discordData.username + '</div><div class="profile-url">' + req.headers.host + '/' + username + '</div></div></div>' + bioHTML + '<div class="badges-container">' + badgesHTML + '</div>' + statsHTML + socialLinksHTML + (user.settings.customHTML || '') + '</div></div>' + (user.settings.music ? '<script>document.getElementById(\'backgroundMusic\').play().catch(e => console.log(\'Autoplay blocked\'));</script>' : '') + '</body></html>');
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
        return years + 'y';
    } else {
        return months + 'm';
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
            background: linear-gradient(45deg, #667eea, #764ba2);
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
        .btn-secondary {
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
    res.redirect('/');
});

// Serve about page
app.get('/about', (req, res) => {
    res.redirect('/');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Server running on port ' + PORT);
    console.log('✅ Custom username system ready');
    console.log('🎯 Each user gets their own profile URL');
    console.log('⚙️ Settings page available at /username/settings');
    console.log('🔗 Example: https://tommyfc555-github-io.onrender.com/hwid/settings');
});
