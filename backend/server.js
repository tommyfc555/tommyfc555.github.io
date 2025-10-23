const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|webm|pdf|txt|mp3|wav/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

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

// Serve static files
app.use('/uploads', express.static('uploads'));
app.use(express.json());

// HTML templates
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

        if (localStorage.getItem('userId')) {
            window.location.href = '/app';
        }
    </script>
</body>
</html>
`;

// Routes
app.get('/', (req, res) => {
    res.send(loginHTML);
});

app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'app.html'));
});

app.get('/invite/:serverId', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Join Server</title>
            <style>
                body { font-family: Arial; text-align: center; padding: 2rem; background: #36393f; color: white; }
                button { padding: 1rem 2rem; background: #7289da; color: white; border: none; border-radius: 5px; cursor: pointer; }
                .container { max-width: 400px; margin: 100px auto; padding: 2rem; background: #2f3136; border-radius: 8px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Server Invitation</h2>
                <p>You've been invited to join a server!</p>
                <button onclick="joinServer()">Join Server</button>
            </div>
            <script>
                async function joinServer() {
                    const userId = localStorage.getItem('userId');
                    if (!userId) {
                        alert('Please login first');
                        window.location.href = '/';
                        return;
                    }
                    
                    const serverId = window.location.pathname.split('/').pop();
                    const response = await fetch('/api/servers/join', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ serverId: serverId })
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        window.location.href = '/app';
                    } else {
                        alert(data.error);
                    }
                }
            </script>
        </body>
        </html>
    `);
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

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const ip = getClientIP(req);
    
    const user = users.get(username.toLowerCase());
    if (!user) {
        return res.json({ success: false, error: 'User not found' });
    }
    
    if (user.password !== password) {
        return res.json({ success: false, error: 'Invalid password' });
    }
    
    if (!checkRateLimit('login', ip)) {
        return res.json({ success: false, error: 'Too many login attempts. Please try again later.' });
    }
    
    // Update IP and last login
    user.ip = ip;
    user.lastLogin = new Date();
    const token = generateId();
    user.tokens.push(token);
    
    console.log(`✅ User logged in: ${username} from IP: ${ip}`);
    res.json({ success: true, userId: user.id, username: user.username, token });
});

// Server routes
app.get('/api/servers', (req, res) => {
    const serversArray = Array.from(servers.values()).map(server => ({
        id: server.id,
        name: server.name,
        memberCount: server.members.length,
        owner: server.owner
    }));
    res.json({ success: true, servers: serversArray });
});

app.post('/api/servers', (req, res) => {
    const { name } = req.body;
    const userId = req.headers['user-id']; // In real app, use proper auth
    
    if (!name || name.trim().length < 2) {
        return res.json({ success: false, error: 'Server name must be at least 2 characters' });
    }
    
    if (containsProfanity(name)) {
        return res.json({ success: false, error: 'Server name contains inappropriate content' });
    }
    
    if (!checkRateLimit('serverCreate', userId || 'anonymous')) {
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
    
    // Create default channels
    const textChannelId = generateId();
    const voiceChannelId = generateId();
    servers.get(serverId).channels.set(textChannelId, {
        id: textChannelId,
        name: 'general',
        type: 'text'
    });
    servers.get(serverId).channels.set(voiceChannelId, {
        id: voiceChannelId,
        name: 'General Voice',
        type: 'voice'
    });
    
    messages.set(serverId, new Map());
    messages.get(serverId).set(textChannelId, []);
    
    // Initialize voice channel
    voiceChannels.set(voiceChannelId, {
        id: voiceChannelId,
        serverId: serverId,
        members: new Map(),
        name: 'General Voice'
    });
    
    io.emit('server-created', { id: serverId, name: name.trim() });
    res.json({ success: true, serverId });
});

app.post('/api/servers/join', (req, res) => {
    const { serverId } = req.body;
    const userId = req.headers['user-id'];
    
    const server = servers.get(serverId);
    if (!server) {
        return res.json({ success: false, error: 'Server not found' });
    }
    
    if (!server.members.includes(userId)) {
        server.members.push(userId);
    }
    
    io.emit('server-joined', { serverId, userId });
    res.json({ success: true, message: 'Joined server successfully' });
});

app.get('/api/servers/:serverId/messages', (req, res) => {
    const { serverId } = req.params;
    const { channelId } = req.query;
    
    const serverMessages = messages.get(serverId) || new Map();
    const channelMessages = channelId ? serverMessages.get(channelId) || [] : [];
    
    res.json({ success: true, messages: channelMessages });
});

// File upload route
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.json({ success: false, error: 'No file uploaded' });
    }
    
    res.json({ 
        success: true, 
        file: {
            name: req.file.originalname,
            url: `/uploads/${req.file.filename}`,
            size: req.file.size,
            type: req.file.mimetype
        }
    });
});

// Friend routes
app.get('/api/friends', (req, res) => {
    const userId = req.headers['user-id'];
    const user = Array.from(users.values()).find(u => u.id === userId);
    
    if (!user) {
        return res.json({ success: false, error: 'User not found' });
    }
    
    const friends = user.friends.map(friendId => {
        const friend = Array.from(users.values()).find(u => u.id === friendId);
        return friend ? { id: friend.id, username: friend.username, online: onlineUsers.has(friend.id) } : null;
    }).filter(Boolean);
    
    res.json({ success: true, friends });
});

app.post('/api/friends/request', (req, res) => {
    const { username } = req.body;
    const fromUserId = req.headers['user-id'];
    
    if (!checkRateLimit('friendRequest', fromUserId)) {
        return res.json({ success: false, error: 'Rate limit exceeded' });
    }
    
    const targetUser = Array.from(users.values()).find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!targetUser) {
        return res.json({ success: false, error: 'User not found' });
    }
    
    if (targetUser.id === fromUserId) {
        return res.json({ success: false, error: 'Cannot add yourself' });
    }
    
    const requestId = generateId();
    if (!friendRequests.has(targetUser.id)) {
        friendRequests.set(targetUser.id, []);
    }
    
    friendRequests.get(targetUser.id).push({
        id: requestId,
        fromUserId: fromUserId,
        fromUsername: Array.from(users.values()).find(u => u.id === fromUserId)?.username,
        timestamp: new Date()
    });
    
    // Notify target user if online
    const targetSocket = Array.from(onlineUsers.entries()).find(([socketId, user]) => user.id === targetUser.id);
    if (targetSocket) {
        io.to(targetSocket[0]).emit('friend-request', {
            fromUserId: fromUserId,
            fromUsername: Array.from(users.values()).find(u => u.id === fromUserId)?.username
        });
    }
    
    res.json({ success: true, message: 'Friend request sent' });
});

app.get('/api/friends/requests', (req, res) => {
    const userId = req.headers['user-id'];
    const requests = friendRequests.get(userId) || [];
    res.json({ success: true, requests });
});

app.post('/api/friends/accept', (req, res) => {
    const { requestId } = req.body;
    const userId = req.headers['user-id'];
    
    const userRequests = friendRequests.get(userId) || [];
    const requestIndex = userRequests.findIndex(req => req.id === requestId);
    
    if (requestIndex === -1) {
        return res.json({ success: false, error: 'Request not found' });
    }
    
    const request = userRequests[requestIndex];
    const fromUser = Array.from(users.values()).find(u => u.id === request.fromUserId);
    const currentUser = Array.from(users.values()).find(u => u.id === userId);
    
    if (fromUser && currentUser) {
        if (!fromUser.friends.includes(userId)) {
            fromUser.friends.push(userId);
        }
        if (!currentUser.friends.includes(request.fromUserId)) {
            currentUser.friends.push(request.fromUserId);
        }
    }
    
    userRequests.splice(requestIndex, 1);
    
    res.json({ success: true, message: 'Friend request accepted' });
});

app.post('/api/friends/decline', (req, res) => {
    const { requestId } = req.body;
    const userId = req.headers['user-id'];
    
    const userRequests = friendRequests.get(userId) || [];
    const requestIndex = userRequests.findIndex(req => req.id === requestId);
    
    if (requestIndex === -1) {
        return res.json({ success: false, error: 'Request not found' });
    }
    
    userRequests.splice(requestIndex, 1);
    res.json({ success: true, message: 'Friend request declined' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);
    
    socket.on('user-joined', (userData) => {
        onlineUsers.set(socket.id, {
            id: userData.userId,
            username: userData.username,
            socketId: socket.id
        });
        
        console.log(`👋 ${userData.username} joined`);
        
        // Notify friends
        const user = Array.from(users.values()).find(u => u.id === userData.userId);
        if (user) {
            user.friends.forEach(friendId => {
                const friendSocket = Array.from(onlineUsers.entries()).find(([sId, u]) => u.id === friendId);
                if (friendSocket) {
                    io.to(friendSocket[0]).emit('friend-online', { userId: userData.userId });
                }
            });
        }
    });
    
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
            pings: Array.from(pingedUsers),
            type: 'text'
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
    
    socket.on('send-dm', (data) => {
        const fromUser = onlineUsers.get(socket.id);
        if (!fromUser) return;
        
        const dmKey = [fromUser.id, data.toUserId].sort().join('_');
        const message = {
            id: generateId(),
            username: fromUser.username,
            userId: fromUser.id,
            content: sanitizeText(data.content),
            timestamp: new Date(),
            type: 'dm'
        };
        
        const dmMessages = messages.get(dmKey) || [];
        dmMessages.push(message);
        messages.set(dmKey, dmMessages);
        
        // Notify recipient
        const recipientSocket = Array.from(onlineUsers.entries()).find(([sId, u]) => u.id === data.toUserId);
        if (recipientSocket) {
            io.to(recipientSocket[0]).emit('dm-message', {
                fromUserId: fromUser.id,
                toUserId: data.toUserId,
                message
            });
        }
        
        socket.emit('dm-message-sent', message);
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
                socketId: socket.id,
                muted: false,
                deafened: false
            });
            
            socket.join(`voice-${data.channelId}`);
            io.to(`voice-${data.channelId}`).emit('voice-user-joined', {
                userId: user.id,
                username: user.username
            });
        }
    });
    
    socket.on('leave-voice', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        const voiceChannel = voiceChannels.get(data.channelId);
        if (voiceChannel && voiceChannel.members.has(user.id)) {
            voiceChannel.members.delete(user.id);
            socket.leave(`voice-${data.channelId}`);
            io.to(`voice-${data.channelId}`).emit('voice-user-left', {
                userId: user.id
            });
        }
    });
    
    socket.on('voice-toggle-mute', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        const voiceChannel = voiceChannels.get(data.channelId);
        if (voiceChannel && voiceChannel.members.has(user.id)) {
            const member = voiceChannel.members.get(user.id);
            member.muted = !member.muted;
            io.to(`voice-${data.channelId}`).emit('voice-user-updated', {
                userId: user.id,
                muted: member.muted,
                deafened: member.deafened
            });
        }
    });
    
    socket.on('voice-toggle-deafen', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        const voiceChannel = voiceChannels.get(data.channelId);
        if (voiceChannel && voiceChannel.members.has(user.id)) {
            const member = voiceChannel.members.get(user.id);
            member.deafened = !member.deafened;
            io.to(`voice-${data.channelId}`).emit('voice-user-updated', {
                userId: user.id,
                muted: member.muted,
                deafened: member.deafened
            });
        }
    });
    
    // WebRTC signaling for voice
    socket.on('voice-offer', (data) => {
        socket.to(data.targetSocketId).emit('voice-offer', {
            offer: data.offer,
            socketId: socket.id
        });
    });
    
    socket.on('voice-answer', (data) => {
        socket.to(data.targetSocketId).emit('voice-answer', {
            answer: data.answer
        });
    });
    
    socket.on('voice-ice-candidate', (data) => {
        socket.to(data.targetSocketId).emit('voice-ice-candidate', {
            candidate: data.candidate
        });
    });
    
    // Screen sharing
    socket.on('start-screenshare', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        io.to(data.channelId).emit('screenshare-started', {
            userId: user.id,
            username: user.username,
            socketId: socket.id
        });
    });
    
    socket.on('stop-screenshare', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        io.to(data.channelId).emit('screenshare-stopped', {
            userId: user.id
        });
    });
    
    socket.on('disconnect', () => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            console.log(`👋 ${user.username} left`);
            
            // Leave all voice channels
            voiceChannels.forEach((channel, channelId) => {
                if (channel.members.has(user.id)) {
                    channel.members.delete(user.id);
                    io.to(`voice-${channelId}`).emit('voice-user-left', {
                        userId: user.id
                    });
                }
            });
            
            // Notify friends
            const userObj = Array.from(users.values()).find(u => u.id === user.id);
            if (userObj) {
                userObj.friends.forEach(friendId => {
                    const friendSocket = Array.from(onlineUsers.entries()).find(([sId, u]) => u.id === friendId);
                    if (friendSocket) {
                        io.to(friendSocket[0]).emit('friend-offline', { userId: user.id });
                    }
                });
            }
        }
        onlineUsers.delete(socket.id);
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        users: users.size, 
        servers: servers.size,
        online: onlineUsers.size,
        voiceChannels: voiceChannels.size
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Enhanced Discord-like Chat server running on port ${PORT}`);
    console.log(`🔒 Features: Voice chat, screen sharing, file uploads, ping system`);
    console.log(`📧 Open your Render URL in browser`);
    console.log(`🏠 Main page: /`);
    console.log(`💬 Chat app: /app`);
    console.log(`🔧 API health: /health`);
});
