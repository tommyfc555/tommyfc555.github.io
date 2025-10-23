const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Data storage
const users = new Map();
const servers = new Map();
const messages = new Map();
const onlineUsers = new Map();
const friendRequests = new Map();
const blocks = new Map();
const rateLimits = new Map();
const voiceChannels = new Map();
const calls = new Map();

// Rate limiting configuration
const RATE_LIMITS = {
    message: { window: 1000, max: 5 },
    login: { window: 60000, max: 5 },
    register: { window: 60000, max: 3 },
    friendRequest: { window: 60000, max: 10 },
    serverCreate: { window: 60000, max: 2 }
};

// Comprehensive profanity filter
const PROFANITY_LIST = [
    'nigger', 'nigga', 'chink', 'spic', 'kike', 'fag', 'faggot', 'tranny',
    'retard', 'mongoloid', 'cripple', 'midget', 'gimp', 'cunt', 'twat',
    'pussy', 'dick', 'cock', 'bastard', 'bitch', 'whore', 'slut', 'fuck',
    'shit', 'asshole', 'motherfucker', 'cocksucker', 'n1gger', 'n1gga',
    'f4g', 'f4ggot', 'r3tard', 'c0ck', 'd1ck', 'b1tch', 'rape', 'rapist',
    'pedo', 'pedophile', 'nazi', 'kkk', 'isist', 'terrorist'
];

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
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           'unknown';
}

app.use(express.json());

// Complete Discord-like HTML for /app
const appHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discord-Like Chat</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif; }
        body { background: #36393f; color: #dcddde; height: 100vh; overflow: hidden; }
        
        .app-container { display: flex; height: 100vh; }
        
        /* Sidebar */
        .sidebar { width: 240px; background: #2f3136; display: flex; flex-direction: column; }
        .server-header { padding: 16px; border-bottom: 2px solid #202225; }
        .server-name { font-weight: bold; color: white; font-size: 16px; }
        
        .channels { padding: 16px; flex: 1; }
        .channel-category { color: #8e9297; font-size: 12px; font-weight: 600; margin: 16px 0 8px 0; text-transform: uppercase; }
        .channel { padding: 6px 8px; border-radius: 4px; margin: 2px 0; cursor: pointer; color: #8e9297; display: flex; align-items: center; }
        .channel:hover { background: #3c3f45; color: #dcddde; }
        .channel.active { background: #42464d; color: white; }
        .channel.hash { margin-right: 6px; }
        
        .user-panel { background: #292b2f; padding: 12px; display: flex; align-items: center; }
        .user-avatar { width: 32px; height: 32px; background: #7289da; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 8px; }
        .user-info { flex: 1; }
        .username { font-weight: 600; font-size: 14px; }
        .user-tag { color: #b9bbbe; font-size: 12px; }
        
        /* Main Chat */
        .main-chat { flex: 1; display: flex; flex-direction: column; background: #36393f; }
        .chat-header { padding: 16px; border-bottom: 1px solid #2f3136; display: flex; align-items: center; }
        .chat-header-hash { color: #8e9297; font-size: 24px; margin-right: 8px; }
        .chat-header-name { font-weight: 600; color: white; }
        
        .messages { flex: 1; padding: 16px; overflow-y: auto; }
        .message { margin-bottom: 16px; display: flex; }
        .message-avatar { width: 40px; height: 40px; background: #7289da; border-radius: 50%; margin-right: 16px; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
        .message-content { flex: 1; }
        .message-header { display: flex; align-items: baseline; margin-bottom: 4px; }
        .message-username { font-weight: 600; color: white; margin-right: 8px; }
        .message-time { color: #72767d; font-size: 12px; }
        .message-text { color: #dcddde; line-height: 1.4; }
        .message.pinged { background: rgba(114, 137, 218, 0.1); border-radius: 4px; padding: 4px; }
        
        .message-input-container { padding: 16px; background: #40444b; border-radius: 8px; margin: 16px; }
        .message-input { width: 100%; background: transparent; border: none; color: #dcddde; font-size: 16px; outline: none; }
        .message-input::placeholder { color: #72767d; }
        
        /* Voice Chat */
        .voice-controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #2f3136; padding: 12px; border-radius: 8px; display: flex; gap: 8px; }
        .voice-btn { width: 40px; height: 40px; border-radius: 50%; border: none; background: #4f545c; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .voice-btn:hover { background: #5d6269; }
        .voice-btn.muted { background: #ed4245; }
        .voice-btn.deafened { background: #faa81a; }
        
        /* Loading */
        .loading { display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; }
        .spinner { border: 3px solid #36393f; border-top: 3px solid #7289da; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 16px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        /* Scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #2e3338; }
        ::-webkit-scrollbar-thumb { background: #202225; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #1a1c20; }
    </style>
</head>
<body>
    <div id="loadingScreen" class="loading">
        <div class="spinner"></div>
        <div>Loading Discord-like Chat...</div>
    </div>

    <div id="app" class="app-container" style="display: none;">
        <!-- Sidebar -->
        <div class="sidebar">
            <div class="server-header">
                <div class="server-name" id="currentServer">General Server</div>
            </div>
            
            <div class="channels">
                <div class="channel-category">TEXT CHANNELS</div>
                <div class="channel active" onclick="switchChannel('general')">
                    <span class="channel hash">#</span>
                    <span>general</span>
                </div>
                
                <div class="channel-category" style="margin-top: 20px;">VOICE CHANNELS</div>
                <div class="channel" onclick="joinVoiceChannel('general-voice')">
                    <span class="channel">🔊</span>
                    <span>General Voice</span>
                </div>
            </div>
            
            <div class="user-panel">
                <div class="user-avatar" id="userAvatar">U</div>
                <div class="user-info">
                    <div class="username" id="currentUsername">User</div>
                    <div class="user-tag" id="userTag">#0000</div>
                </div>
                <div class="voice-controls-mini">
                    <button class="voice-btn" onclick="toggleMute()" id="muteBtn">🎤</button>
                    <button class="voice-btn" onclick="toggleDeafen()" id="deafenBtn">🔇</button>
                </div>
            </div>
        </div>
        
        <!-- Main Chat -->
        <div class="main-chat">
            <div class="chat-header">
                <div class="chat-header-hash">#</div>
                <div class="chat-header-name">general</div>
            </div>
            
            <div class="messages" id="messagesContainer">
                <div class="message">
                    <div class="message-avatar">S</div>
                    <div class="message-content">
                        <div class="message-header">
                            <div class="message-username">System</div>
                            <div class="message-time">Just now</div>
                        </div>
                        <div class="message-text">Welcome to the server! Type @username to ping someone.</div>
                    </div>
                </div>
            </div>
            
            <div class="message-input-container">
                <input type="text" class="message-input" placeholder="Message #general" id="messageInput" maxlength="2000">
            </div>
        </div>
        
        <!-- Voice Controls -->
        <div class="voice-controls" id="voiceControls" style="display: none;">
            <button class="voice-btn" onclick="toggleMute()" id="muteBtnBig">🎤</button>
            <button class="voice-btn" onclick="toggleDeafen()" id="deafenBtnBig">🔇</button>
            <button class="voice-btn" onclick="startScreenShare()" id="screenShareBtn">🖥️</button>
            <button class="voice-btn" onclick="leaveVoiceChannel()" id="leaveVoiceBtn" style="background: #ed4245;">📞</button>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let currentUser = null;
        let currentChannel = 'general';
        let isInVoice = false;
        let isMuted = false;
        let isDeafened = false;
        
        // Initialize app
        async function init() {
            const userId = localStorage.getItem('userId');
            const username = localStorage.getItem('username');
            
            if (!userId || !username) {
                window.location.href = '/';
                return;
            }
            
            currentUser = { id: userId, username };
            
            // Update UI
            document.getElementById('currentUsername').textContent = username;
            document.getElementById('userAvatar').textContent = username.charAt(0).toUpperCase();
            document.getElementById('userTag').textContent = '#' + userId.slice(0,4);
            
            // Show app
            document.getElementById('loadingScreen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            
            // Socket events
            socket.emit('user-joined', { userId, username });
            
            socket.on('new-message', (data) => {
                if (data.channelId === currentChannel) {
                    addMessage(data.message);
                }
            });
            
            socket.on('user-pinged', (data) => {
                // Play ping sound
                playPingSound();
                
                // Show notification
                if (Notification.permission === 'granted') {
                    new Notification('You were mentioned!', {
                        body: \`\${data.message.username}: \${data.message.content}\`
                    });
                }
                
                // Highlight message if in same channel
                if (data.channelId === currentChannel) {
                    addMessage(data.message, true);
                }
            });
            
            socket.on('voice-user-joined', (data) => {
                console.log(\`\${data.username} joined voice\`);
            });
            
            socket.on('voice-user-left', (data) => {
                console.log(\`User \${data.userId} left voice\`);
            });
            
            // Request notification permission
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }
            
            // Message input handler
            document.getElementById('messageInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        }
        
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const content = input.value.trim();
            
            if (!content) return;
            
            socket.emit('send-server-message', {
                serverId: 'default',
                channelId: currentChannel,
                content: content
            });
            
            input.value = '';
        }
        
        function addMessage(message, isPinged = false) {
            const container = document.getElementById('messagesContainer');
            const messageEl = document.createElement('div');
            messageEl.className = 'message' + (isPinged ? ' pinged' : '');
            
            const time = new Date(message.timestamp).toLocaleTimeString();
            messageEl.innerHTML = \`
                <div class="message-avatar">\${message.username.charAt(0).toUpperCase()}</div>
                <div class="message-content">
                    <div class="message-header">
                        <div class="message-username">\${message.username}</div>
                        <div class="message-time">\${time}</div>
                    </div>
                    <div class="message-text">\${formatMessage(message.content)}</div>
                </div>
            \`;
            
            container.appendChild(messageEl);
            container.scrollTop = container.scrollHeight;
        }
        
        function formatMessage(content) {
            // Format @mentions
            return content.replace(/@(\w+)/g, '<span style="color: #7289da; background: rgba(114,137,218,0.1); padding: 2px 4px; border-radius: 3px;">@$1</span>');
        }
        
        function playPingSound() {
            // Create ping sound using Web Audio API
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
            } catch (e) {
                console.log('Could not play ping sound');
            }
        }
        
        function switchChannel(channelName) {
            currentChannel = channelName;
            document.querySelectorAll('.channel').forEach(ch => ch.classList.remove('active'));
            event.target.closest('.channel').classList.add('active');
            document.getElementById('messagesContainer').innerHTML = '<div class="message"><div class="message-avatar">S</div><div class="message-content"><div class="message-header"><div class="message-username">System</div><div class="message-time">Just now</div></div><div class="message-text">Welcome to #' + channelName + '</div></div></div>';
            document.getElementById('messageInput').placeholder = 'Message #' + channelName;
        }
        
        function joinVoiceChannel(channelId) {
            isInVoice = true;
            document.getElementById('voiceControls').style.display = 'flex';
            socket.emit('join-voice', { channelId: channelId });
        }
        
        function leaveVoiceChannel() {
            isInVoice = false;
            document.getElementById('voiceControls').style.display = 'none';
            socket.emit('leave-voice', { channelId: 'general-voice' });
        }
        
        function toggleMute() {
            isMuted = !isMuted;
            document.getElementById('muteBtn').classList.toggle('muted', isMuted);
            document.getElementById('muteBtnBig').classList.toggle('muted', isMuted);
            document.getElementById('muteBtnBig').textContent = isMuted ? '🎤❌' : '🎤';
            socket.emit('voice-toggle-mute', { channelId: 'general-voice' });
        }
        
        function toggleDeafen() {
            isDeafened = !isDeafened;
            document.getElementById('deafenBtn').classList.toggle('deafened', isDeafened);
            document.getElementById('deafenBtnBig').classList.toggle('deafened', isDeafened);
            document.getElementById('deafenBtnBig').textContent = isDeafened ? '🔇❌' : '🔇';
            socket.emit('voice-toggle-deafen', { channelId: 'general-voice' });
        }
        
        function startScreenShare() {
            if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true })
                    .then(stream => {
                        socket.emit('start-screenshare', { channelId: 'general-voice' });
                        alert('Screen sharing started!');
                    })
                    .catch(err => {
                        console.error('Error sharing screen:', err);
                        alert('Could not start screen sharing');
                    });
            } else {
                alert('Screen sharing not supported in this browser');
            }
        }
        
        // Initialize when page loads
        window.addEventListener('load', init);
    </script>
</body>
</html>
`;

// Routes
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Discord-Like Chat - Login</title>
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
            .switch-text { color: #72767d; text-align: center; margin-top: 0.5rem; }
            .switch-text a { color: #7289da; text-decoration: none; }
            .switch-text a:hover { text-decoration: underline; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <h1>Welcome to Discord-Like Chat</h1>
                <p style="color: #72767d; margin-top: 0.5rem;">Please login to continue</p>
            </div>
            <form id="loginForm">
                <div class="form-group">
                    <label for="username">USERNAME</label>
                    <input type="text" id="username" placeholder="Enter your username" required minlength="5">
                </div>
                <div class="form-group">
                    <label for="password">PASSWORD</label>
                    <input type="password" id="password" placeholder="Enter your password" required>
                </div>
                <button type="submit">Log In</button>
            </form>
            <div class="switch-text">
                Don't have an account? <a href="#" onclick="register()">Register</a>
            </div>
        </div>
        <script>
            document.getElementById('loginForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                
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
                        window.location.href = '/app';
                    } else {
                        alert('Login failed: ' + data.error);
                    }
                } catch (error) {
                    alert('Connection error');
                }
            });
            
            function register() {
                const username = prompt('Enter username (min 5 characters):');
                if (!username || username.length < 5) {
                    alert('Username must be at least 5 characters');
                    return;
                }
                
                const password = prompt('Enter password (min 6 characters):');
                if (!password || password.length < 6) {
                    alert('Password must be at least 6 characters');
                    return;
                }
                
                fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Registration successful! Please login.');
                    } else {
                        alert('Registration failed: ' + data.error);
                    }
                })
                .catch(() => alert('Connection error'));
            }
            
            // Auto-login if already logged in
            if (localStorage.getItem('userId')) {
                window.location.href = '/app';
            }
        </script>
    </body>
    </html>
    `);
});

app.get('/app', (req, res) => {
    res.send(appHTML);
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        users: users.size, 
        servers: servers.size,
        online: onlineUsers.size
    });
});

// API Routes
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const ip = getClientIP(req);
    
    if (!username || !password) {
        return res.json({ success: false, error: 'Username and password required' });
    }
    
    if (username.length < 5) {
        return res.json({ success: false, error: 'Username must be at least 5 characters' });
    }
    
    if (containsProfanity(username)) {
        return res.json({ success: false, error: 'Username contains inappropriate content' });
    }
    
    if (users.has(username.toLowerCase())) {
        return res.json({ success: false, error: 'Username already exists' });
    }
    
    const userId = generateId();
    users.set(username.toLowerCase(), {
        id: userId,
        username: username,
        password: password,
        createdAt: new Date(),
        friends: []
    });
    
    // Create default server if none exists
    if (servers.size === 0) {
        const serverId = 'default';
        servers.set(serverId, {
            id: serverId,
            name: 'General Server',
            owner: userId,
            members: [userId],
            channels: ['general']
        });
        
        messages.set(serverId, new Map());
        messages.get(serverId).set('general', []);
        
        // Create voice channel
        voiceChannels.set('general-voice', {
            id: 'general-voice',
            serverId: serverId,
            members: new Map(),
            name: 'General Voice'
        });
    }
    
    res.json({ success: true, userId, username });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    const user = users.get(username.toLowerCase());
    if (!user) {
        return res.json({ success: false, error: 'User not found' });
    }
    
    if (user.password !== password) {
        return res.json({ success: false, error: 'Invalid password' });
    }
    
    res.json({ success: true, userId: user.id, username: user.username });
});

// Socket.io
io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);
    
    socket.on('user-joined', (userData) => {
        onlineUsers.set(socket.id, {
            id: userData.userId,
            username: userData.username,
            socketId: socket.id
        });
        console.log(`👋 ${userData.username} joined`);
    });
    
    socket.on('send-server-message', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        const sanitizedContent = sanitizeText(data.content);
        
        // Detect pings
        const pingRegex = /@(\w+)/g;
        let match;
        const pingedUsers = new Set();
        
        while ((match = pingRegex.exec(data.content)) !== null) {
            pingedUsers.add(match[1].toLowerCase());
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
        
        // Save message
        const serverMessages = messages.get(data.serverId) || new Map();
        const channelMessages = serverMessages.get(data.channelId) || [];
        channelMessages.push(message);
        
        // Notify pinged users
        pingedUsers.forEach(username => {
            const pingedUser = Array.from(onlineUsers.values()).find(u => 
                u.username.toLowerCase() === username
            );
            if (pingedUser) {
                io.to(pingedUser.socketId).emit('user-pinged', {
                    message: message,
                    serverId: data.serverId,
                    channelId: data.channelId
                });
            }
        });
        
        // Broadcast to all in channel
        io.emit('new-message', { 
            serverId: data.serverId, 
            channelId: data.channelId,
            message 
        });
    });
    
    // Voice chat handlers
    socket.on('join-voice', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        const voiceChannel = voiceChannels.get(data.channelId);
        if (voiceChannel) {
            voiceChannel.members.set(user.id, {
                id: user.id,
                username: user.username,
                socketId: socket.id
            });
            
            io.emit('voice-user-joined', {
                userId: user.id,
                username: user.username
            });
        }
    });
    
    socket.on('leave-voice', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        const voiceChannel = voiceChannels.get(data.channelId);
        if (voiceChannel) {
            voiceChannel.members.delete(user.id);
            io.emit('voice-user-left', { userId: user.id });
        }
    });
    
    socket.on('voice-toggle-mute', (data) => {
        // Mute logic would go here
    });
    
    socket.on('voice-toggle-deafen', (data) => {
        // Deafen logic would go here
    });
    
    socket.on('start-screenshare', (data) => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            console.log(`🖥️ ${user.username} started screen sharing`);
        }
    });
    
    socket.on('disconnect', () => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            console.log(`👋 ${user.username} left`);
            onlineUsers.delete(socket.id);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Discord-Like Chat running on port ${PORT}`);
    console.log(`👉 Open: https://tommyfc555-github-io.onrender.com`);
});
