// Discord OAuth Configuration - UPDATE THESE!
const CLIENT_ID = '1429907130277691483'; // Get from Discord Developer Portal
const REDIRECT_URI = window.location.origin + window.location.pathname;
const BACKEND_URL = 'https://your-backend.herokuapp.com'; // You'll need to set this up

// DOM Elements
const loginPrompt = document.getElementById('login-prompt');
const loading = document.getElementById('loading');
const profileContainer = document.getElementById('profile-container');
const loginBtn = document.getElementById('login-btn');
const mainLoginBtn = document.getElementById('main-login-btn');
const authButtons = document.getElementById('auth-buttons');

// Discord badge information
const badgeMap = {
    "staff": { name: "Discord Staff", emoji: "👨‍💼", color: "#ed4245" },
    "partner": { name: "Partnered Server Owner", emoji: "🤝", color: "#5865f2" },
    "hypesquad": { name: "HypeSquad Events", emoji: "🏠", color: "#eb459e" },
    "bug_hunter": { name: "Bug Hunter", emoji: "🐛", color: "#57f287" },
    "hypesquad_bravery": { name: "HypeSquad Bravery", emoji: "⚔️", color: "#5865f2" },
    "hypesquad_brilliance": { name: "HypeSquad Brilliance", emoji: "🎓", color: "#fee75c" },
    "hypesquad_balance": { name: "HypeSquad Balance", emoji: "⚖️", color: "#57f287" },
    "early_supporter": { name: "Early Supporter", emoji: "🌟", color: "#fee75c" },
    "verified_bot_developer": { name: "Early Verified Bot Developer", emoji: "🤖", color: "#57f287" },
    "active_developer": { name: "Active Developer", emoji: "💻", color: "#57f287" },
    "nitro": { name: "Nitro Subscriber", emoji: "💎", color: "#eb459e" }
};

// Initialize
function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
        alert('Login failed: ' + error);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (code) {
        handleOAuthCallback(code);
    } else {
        const userData = localStorage.getItem('discord_user');
        if (userData) {
            displayUserProfile(JSON.parse(userData));
        } else {
            showLoginPrompt();
        }
    }

    setupEventListeners();
    createSnowflakes();
    setupAudio();
}

function setupEventListeners() {
    loginBtn.addEventListener('click', redirectToDiscordOAuth);
    mainLoginBtn.addEventListener('click', redirectToDiscordOAuth);
}

function setupAudio() {
    const music = document.getElementById('background-music');
    // Auto-play with user interaction
    document.addEventListener('click', function() {
        if (music.paused) {
            music.play().catch(e => console.log('Audio play prevented'));
        }
    }, { once: true });
}

function redirectToDiscordOAuth(e) {
    e.preventDefault();
    const state = generateRandomState();
    localStorage.setItem('oauth_state', state);
    
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20email%20guilds&state=${state}&prompt=none`;
    window.location.href = authUrl;
}

function handleOAuthCallback(code) {
    showLoading();
    
    // For demo purposes - in real implementation, you'd call your backend
    console.log('OAuth code received:', code);
    
    // Simulate API call delay
    setTimeout(() => {
        // Mock user data for demo
        const mockUserData = {
            id: '123456789012345678',
            username: 'Black',
            discriminator: '1337',
            avatar: 'a_abc123def456',
            banner: null,
            banner_color: '#1337',
            accent_color: 5025616,
            flags: 64, // Early Supporter flag
            public_flags: 64,
            purchased_flags: 0,
            premium_type: 2, // Nitro
            verified: true,
            email: 'black@example.com',
            locale: 'en-US',
            mfa_enabled: true,
            created_at: '2018-06-01T00:00:00.000000+00:00'
        };

        // Save to localStorage
        localStorage.setItem('discord_user', JSON.stringify(mockUserData));
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        displayUserProfile(mockUserData);
    }, 2000);
}

function displayUserProfile(user) {
    hideAllSections();
    profileContainer.style.display = 'block';

    // Set user info
    document.getElementById('username').textContent = user.username;
    document.getElementById('discriminator').textContent = '#' + user.discriminator;
    document.getElementById('user-id').textContent = `ID: ${user.id}`;

    // Set avatar
    const avatarUrl = user.avatar 
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
        : `https://cdn.discordapp.com/embed/avatars/${user.discriminator % 5}.png`;
    document.getElementById('user-avatar').src = avatarUrl;

    // Calculate account age
    const createdDate = new Date(user.created_at);
    const ageInDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    const ageInYears = (ageInDays / 365).toFixed(1);

    document.getElementById('account-created').textContent = createdDate.toLocaleDateString();
    document.getElementById('account-age').textContent = `${ageInDays} days (${ageInYears} years)`;

    // Set other details
    document.getElementById('user-locale').textContent = user.locale.toUpperCase();
    document.getElementById('email-verified').textContent = user.verified ? 'Yes' : 'No';
    document.getElementById('mfa-enabled').textContent = user.mfa_enabled ? 'Yes' : 'No';
    
    // Premium type
    const premiumTypes = { 0: 'None', 1: 'Nitro Classic', 2: 'Nitro', 3: 'Nitro Basic' };
    document.getElementById('user-premium').textContent = premiumTypes[user.premium_type] || 'None';

    // Display badges
    displayUserBadges(user.public_flags, user.premium_type);

    // Update auth buttons
    authButtons.innerHTML = '<button class="logout-btn" id="logout-btn">Logout</button>';
    document.getElementById('logout-btn').addEventListener('click', logout);
}

function displayUserBadges(flags, premiumType) {
    const badgesContainer = document.getElementById('badges-container');
    badgesContainer.innerHTML = '';

    const badges = [];

    // Check each badge flag
    if (flags & 1) badges.push('staff');
    if (flags & 2) badges.push('partner');
    if (flags & 4) badges.push('hypesquad');
    if (flags & 8) badges.push('bug_hunter');
    if (flags & 64) badges.push('hypesquad_bravery');
    if (flags & 128) badges.push('hypesquad_brilliance');
    if (flags & 256) badges.push('hypesquad_balance');
    if (flags & 512) badges.push('early_supporter');
    if (flags & 131072) badges.push('verified_bot_developer');
    if (flags & 4194304) badges.push('active_developer');
    
    // Nitro badge
    if (premiumType > 0) badges.push('nitro');

    // Create badge elements
    badges.forEach(badgeKey => {
        const badgeInfo = badgeMap[badgeKey];
        if (badgeInfo) {
            const badgeElement = document.createElement('div');
            badgeElement.className = 'badge';
            badgeElement.innerHTML = `
                ${badgeInfo.emoji}
                <div class="badge-tooltip">${badgeInfo.name}</div>
            `;
            badgeElement.style.background = badgeInfo.color;
            badgesContainer.appendChild(badgeElement);
        }
    });

    if (badges.length === 0) {
        badgesContainer.innerHTML = '<div style="color: #72767d; font-style: italic;">No badges yet</div>';
    }
}

function showLoginPrompt() {
    hideAllSections();
    loginPrompt.style.display = 'block';
}

function showLoading() {
    hideAllSections();
    loading.style.display = 'block';
}

function hideAllSections() {
    loginPrompt.style.display = 'none';
    loading.style.display = 'none';
    profileContainer.style.display = 'none';
}

function logout() {
    localStorage.removeItem('discord_user');
    localStorage.removeItem('discord_token');
    showLoginPrompt();
    authButtons.innerHTML = '<a href="#" class="login-btn" id="login-btn">Login with Discord</a>';
    document.getElementById('login-btn').addEventListener('click', redirectToDiscordOAuth);
}

function generateRandomState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Snowflake functions
function createSnowflakes() {
    const snowflakesContainer = document.getElementById('snowflakes');
    const snowflakeCount = 100;
    
    for (let i = 0; i < snowflakeCount; i++) {
        setTimeout(() => {
            const snowflake = document.createElement('div');
            snowflake.className = 'snowflake';
            snowflake.innerHTML = '❄';
            
            const size = Math.random() * 20 + 10;
            const left = Math.random() * 100;
            const duration = Math.random() * 10 + 5;
            const delay = Math.random() * 5;
            
            snowflake.style.left = left + 'vw';
            snowflake.style.fontSize = size + 'px';
            snowflake.style.animation = `fall ${duration}s linear ${delay}s infinite`;
            snowflake.style.opacity = Math.random() * 0.7 + 0.3;
            
            snowflakesContainer.appendChild(snowflake);
        }, i * 50);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);
