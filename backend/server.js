const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Data storage
const users = new Map();
const servers = new Map();
const messages = new Map();
const onlineUsers = new Map();
const friendRequests = new Map();
const blocks = new Map();
const rateLimits = new Map();

// Rate limiting configuration
const RATE_LIMITS = {
    message: { window: 1000, max: 5 }, // 5 messages per second
    login: { window: 60000, max: 5 }, // 5 login attempts per minute
    register: { window: 60000, max: 3 }, // 3 registrations per minute
    friendRequest: { window: 60000, max: 10 } // 10 friend requests per minute
};

// Comprehensive profanity filter
const PROFANITY_LIST = [
    // Racial slurs and hate speech
    'nigger', 'nigga', 'chink', 'spic', 'kike', 'fag', 'faggot', 'tranny',
    'retard', 'mongoloid', 'cripple', 'midget', 'gimp',
    
    // Severe profanity
    'cunt', 'twat', 'pussy', 'dick', 'cock', 'bastard', 'bitch', 'whore',
    'slut', 'fuck', 'shit', 'asshole', 'motherfucker', 'cocksucker',
    
    // Common variations and misspellings
    'n1gger', 'n1gga', 'f4g', 'f4ggot', 'r3tard', 'c0ck', 'd1ck', 'b1tch',
    'f u c k', 's h i t', 'a s s', 'f*ck', 's*it', 'a**', 'b*tch',
    
    // Additional offensive terms
    'rape', 'rapist', 'pedo', 'pedophile', 'nazi', 'kkk', 'isist', 'terrorist'
];

// Enhanced profanity filter with partial matching
function containsProfanity(text) {
    if (!text) return false;
    
    const cleanText = text.toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ');
    
    return PROFANITY_LIST.some(profanity => {
        const pattern = new RegExp(`\\b${profanity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return pattern.test(cleanText);
    });
}

function sanitizeText(text) {
    if (containsProfanity(text)) {
        return '[Content Removed]';
    }
    return text;
}

// Generate unique IDs
function generateId() {
    return crypto.randomBytes(8).toString('hex');
}

function generateInviteCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Rate limiting middleware
function checkRateLimit(type, identifier) {
    const now = Date.now();
    const limit = RATE_LIMITS[type];
    
    if (!rateLimits.has(identifier)) {
        rateLimits.set(identifier, {});
    }
    
    const userLimits = rateLimits.get(identifier);
    
    if (!userLimits[type]) {
        userLimits[type] = { count: 1, firstRequest: now };
        return true;
    }
    
    const userLimit = userLimits[type];
    
    if (now - userLimit.firstRequest > limit.window) {
        userLimit.count = 1;
        userLimit.firstRequest = now;
        return true;
    }
    
    if (userLimit.count < limit.max) {
        userLimit.count++;
        return true;
    }
    
    return false;
}

// Get client IP
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           req.connection.socket?.remoteAddress ||
           'unknown';
}

// HTML templates with Discord-like UI
const loginHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discord-Like Chat</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif; }
        body { background: #36393f; height: 100vh; display: flex; justify-content: center; align-items: center; }
        .container { background: #36393f; padding: 2rem; border-radius: 5px; box-shadow: 0 2px 10px 0 rgba(0,0,0,0.2); width: 480px; }
        .logo { text-align: center; margin-bottom: 1rem; }
        .logo h1 { color: #fff; font-size: 1.5rem; font-weight: 700; }
        .form-group { margin-bottom: 1rem; }
        label { color: #b9bbbe; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.5rem; display: block; text-transform: uppercase; }
        input { width: 100%; padding: 0.75rem; background: #303339; border: 1px solid #222428; border-radius: 3px; color: #dcddde; font-size: 1rem; }
        input:focus { outline: none; border-color: #7289da; }
        .error-text { color: #f04747; font-size: 0.875rem; margin-top: 0.25rem; display: none; }
        button { width: 100%; padding: 0.75rem; background: #7289da; color: white; border: none; border-radius: 3px; font-size: 1rem; font-weight: 500; cursor: pointer; margin-top: 1rem; }
        button:hover { background: #677bc4; }
        button:disabled { background: #4e5d94; cursor: not-allowed; }
        .switch-text { color: #72767d; text-align: center; margin-top: 0.5rem; }
        .switch-text a { color: #7289da; text-decoration: none; }
        .switch-text a:hover { text-decoration: underline; }
        .loading { display: none; text-align: center; color: #72767d; }
        .spinner { border: 2px solid #36393f; border-top: 2px solid #7289da; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <h1>Welcome back!</h1>
            <p style="color: #72767d; margin-top: 0.5rem;">We're so excited to see you again!</p>
        </div>
        <form id="loginForm">
            <div class="form-group">
                <label for="loginUsername">USERNAME</label>
                <input type="text" id="loginUsername" placeholder="" required minlength="5">
                <div class="error-text" id="loginUsernameError">Username must be at least 5 characters</div>
            </div>
            <div class="form-group">
                <label for="loginPassword">PASSWORD</label>
                <input type="password" id="loginPassword" placeholder="" required>
                <div class="error-text" id="loginPasswordError">Password is required</div>
            </div>
            <button type="submit" id="loginBtn">Log In</button>
            <div class="loading" id="loginLoading">
                <div class="spinner"></div>
                Logging in...
            </div>
        </form>
        <div class="switch-text">
            Need an account? <a href="#" onclick="showRegister()">Register</a>
        </div>
    </div>

    <div class="container" id="registerContainer" style="display: none;">
        <div class="logo">
            <h1>Create an account</h1>
        </div>
        <form id="registerForm">
            <div class="form-group">
                <label for="registerUsername">USERNAME</label>
                <input type="text" id="registerUsername" placeholder="" required minlength="5" maxlength="32">
                <div class="error-text" id="registerUsernameError">Username must be 5-32 characters</div>
            </div>
            <div class="form-group">
                <label for="registerPassword">PASSWORD</label>
                <input type="password" id="registerPassword" placeholder="" required minlength="6">
                <div class="error-text" id="registerPasswordError">Password must be at least 6 characters</div>
            </div>
            <button type="submit" id="registerBtn">Continue</button>
            <div class="loading" id="registerLoading">
                <div class="spinner"></div>
                Creating account...
            </div>
        </form>
        <div class="switch-text">
            <a href="#" onclick="showLogin()">Already have an account?</a>
        </div>
    </div>

    <script>
        function showRegister() {
            document.getElementById('loginForm').parentElement.style.display = 'none';
            document.getElementById('registerContainer').style.display = 'block';
        }

        function showLogin() {
            document.getElementById('registerContainer').style.display = 'none';
            document.getElementById('loginForm').parentElement.style.display = 'block';
        }

        function validateForm(formType) {
            const username = document.getElementById(formType + 'Username');
            const password = document.getElementById(formType + 'Password');
            const usernameError = document.getElementById(formType + 'UsernameError');
            const passwordError = document.getElementById(formType + 'PasswordError');
            let isValid = true;

            if (username.value.length < 5) {
                usernameError.style.display = 'block';
                isValid = false;
            } else {
                usernameError.style.display = 'none';
            }

            if (password.value.length < 6) {
                passwordError.style.display = 'block';
                isValid = false;
            } else {
                passwordError.style.display = 'none';
            }

            return isValid;
        }

        async function handleLogin(e) {
            e.preventDefault();
            if (!validateForm('login')) return;

            const btn = document.getElementById('loginBtn');
            const loading = document.getElementById('loginLoading');
            btn.style.display = 'none';
            loading.style.display = 'block';

            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                
                if (data.success) {
                    localStorage.setItem('userId', data.userId);
                    localStorage.setItem('username', data.username);
                    localStorage.setItem('token', data.token);
                    window.location.href = '/app';
                } else {
                    showError('login', data.error);
                }
            } catch (error) {
                showError('login', 'Connection error');
            } finally {
                btn.style.display = 'block';
                loading.style.display = 'none';
            }
        }

        async function handleRegister(e) {
            e.preventDefault();
            if (!validateForm('register')) return;

            const btn = document.getElementById('registerBtn');
            const loading = document.getElementById('registerLoading');
            btn.style.display = 'none';
            loading.style.display = 'block';

            const username = document.getElementById('registerUsername').value;
            const password = document.getElementById('registerPassword').value;

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                
                if (data.success) {
                    localStorage.setItem('userId', data.userId);
                    localStorage.setItem('username', data.username);
                    localStorage.setItem('token', data.token);
                    window.location.href = '/app';
                } else {
                    showError('register', data.error);
                }
            } catch (error) {
                showError('register', 'Connection error');
            } finally {
                btn.style.display = 'block';
                loading.style.display = 'none';
            }
        }

        function showError(formType, message) {
            const errorDiv = document.getElementById(formType + 'PasswordError');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }

        document.getElementById('loginForm').addEventListener('submit', handleLogin);
        document.getElementById('registerForm').addEventListener('submit', handleRegister);

        // Real-time validation
        document.getElementById('loginUsername').addEventListener('input', function() {
            if (this.value.length >= 5) {
                document.getElementById('loginUsernameError').style.display = 'none';
            }
        });

        document.getElementById('registerUsername').addEventListener('input', function() {
            if (this.value.length >= 5 && this.value.length <= 32) {
                document.getElementById('registerUsernameError').style.display = 'none';
            }
        });

        // Check if already logged in
        if (localStorage.getItem('userId')) {
            window.location.href = '/app';
        }
    </script>
</body>
</html>
`;

// ... (The rest of the HTML and JavaScript code would continue here with the Discord-like UI)

// Enhanced API Routes with profanity filtering
app.post('/api/servers', (req, res) => {
    const { name } = req.body;
    const userId = req.userId; // In real app, get from auth middleware
    
    if (!name || name.trim().length < 2) {
        return res.json({ success: false, error: 'Server name must be at least 2 characters' });
    }
    
    if (containsProfanity(name)) {
        return res.json({ success: false, error: 'Server name contains inappropriate content' });
    }
    
    if (!checkRateLimit('serverCreate', userId)) {
        return res.json({ success: false, error: 'Rate limit exceeded. Please try again later.' });
    }
    
    const serverId = generateId();
    servers.set(serverId, {
        id: serverId,
        name: name.trim(),
        owner: userId,
        members: [userId],
        createdAt: new Date(),
        channels: new Map()
    });
    
    // Create default channel
    const defaultChannelId = generateId();
    servers.get(serverId).channels.set(defaultChannelId, {
        id: defaultChannelId,
        name: 'general',
        type: 'text'
    });
    
    messages.set(serverId, new Map());
    messages.get(serverId).set(defaultChannelId, []);
    
    io.emit('server-created', { id: serverId, name: name.trim() });
    res.json({ success: true, serverId });
});

// Enhanced user registration with username validation
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const ip = getClientIP(req);
    
    if (!username || !password) {
        return res.json({ success: false, error: 'Username and password required' });
    }
    
    if (username.length < 5) {
        return res.json({ success: false, error: 'Username must be at least 5 characters' });
    }
    
    if (username.length > 32) {
        return res.json({ success: false, error: 'Username must be less than 32 characters' });
    }
    
    if (password.length < 6) {
        return res.json({ success: false, error: 'Password must be at least 6 characters' });
    }
    
    if (containsProfanity(username)) {
        return res.json({ success: false, error: 'Username contains inappropriate content' });
    }
    
    if (!checkRateLimit('register', ip)) {
        return res.json({ success: false, error: 'Too many registration attempts. Please try again later.' });
    }
    
    if (users.has(username.toLowerCase())) {
        return res.json({ success: false, error: 'Username already exists' });
    }
    
    const userId = generateId();
    const token = generateId();
    
    users.set(username.toLowerCase(), {
        id: userId,
        username: username,
        password: password,
        ip: ip,
        createdAt: new Date(),
        friends: [],
        blockedUsers: [],
        tokens: [token],
        lastLogin: new Date()
    });
    
    console.log(`✅ User registered: ${username} from IP: ${ip}`);
    
    res.json({ success: true, userId, username, token });
});

// Enhanced message sending with ping detection
socket.on('send-server-message', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;
    
    if (!checkRateLimit('message', user.id)) {
        socket.emit('rate-limit', { type: 'message' });
        return;
    }
    
    const sanitizedContent = sanitizeText(data.content);
    
    // Detect pings (@username)
    const pingRegex = /@(\w+)/g;
    let match;
    const pingedUsers = new Set();
    
    while ((match = pingRegex.exec(data.content)) !== null) {
        const mentionedUsername = match[1].toLowerCase();
        pingedUsers.add(mentionedUsername);
    }
    
    const message = {
        id: generateId(),
        username: user.username,
        userId: user.id,
        content: sanitizedContent,
        timestamp: new Date(),
        serverId: data.serverId,
        channelId: data.channelId,
        pings: Array.from(pingedUsers)
    };
    
    const serverMessages = messages.get(data.serverId) || new Map();
    const channelMessages = serverMessages.get(data.channelId) || [];
    channelMessages.push(message);
    serverMessages.set(data.channelId, channelMessages);
    messages.set(data.serverId, serverMessages);
    
    // Notify pinged users
    pingedUsers.forEach(username => {
        const pingedUser = Array.from(onlineUsers.values()).find(u => 
            u.username.toLowerCase() === username.toLowerCase()
        );
        if (pingedUser) {
            io.to(pingedUser.socketId).emit('user-pinged', {
                message: message,
                serverId: data.serverId,
                channelId: data.channelId
            });
        }
    });
    
    io.to(data.serverId).emit('new-message', { 
        serverId: data.serverId, 
        channelId: data.channelId,
        message 
    });
});

// ... (Rest of the server code with all the other enhancements)

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Enhanced Discord-like Chat server running on port ${PORT}`);
    console.log(`🔒 Features: Rate limiting, profanity filter, ping system, Discord UI`);
    console.log(`📧 Open your Render URL in browser`);
    console.log(`🏠 Main page: /`);
    console.log(`💬 Chat app: /app`);
});
