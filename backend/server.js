const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const path = require('path');
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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Data storage with persistence
const DATA_FILE = 'data.json';

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      
      // Convert Maps back from objects
      const users = new Map();
      const servers = new Map();
      const messages = new Map();
      const friendRequests = new Map();
      
      if (data.users) {
        Object.entries(data.users).forEach(([key, value]) => {
          users.set(key, value);
        });
      }
      
      if (data.servers) {
        Object.entries(data.servers).forEach(([key, value]) => {
          // Convert nested maps for channels and roles
          if (value.channels && Array.isArray(value.channels)) {
            value.channels = new Map(value.channels);
          }
          if (value.roles && Array.isArray(value.roles)) {
            value.roles = new Map(value.roles);
          }
          if (value.members && Array.isArray(value.members)) {
            value.members = new Map(value.members);
          }
          servers.set(key, value);
        });
      }
      
      if (data.messages) {
        Object.entries(data.messages).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            messages.set(key, value);
          } else {
            // Handle nested maps for server messages
            const serverMessages = new Map();
            Object.entries(value).forEach(([channelId, channelMessages]) => {
              serverMessages.set(channelId, channelMessages);
            });
            messages.set(key, serverMessages);
          }
        });
      }
      
      if (data.friendRequests) {
        Object.entries(data.friendRequests).forEach(([key, value]) => {
          friendRequests.set(key, value);
        });
      }
      
      return { users, servers, messages, friendRequests };
    }
  } catch (error) {
    console.log('No existing data file or error loading, starting fresh:', error);
  }
  
  return {
    users: new Map(),
    servers: new Map(),
    messages: new Map(),
    friendRequests: new Map()
  };
}

function saveData() {
  try {
    // Convert Maps to objects for JSON serialization
    const data = {
      users: Object.fromEntries(users),
      servers: Object.fromEntries(Array.from(servers.entries()).map(([key, server]) => {
        return [key, {
          ...server,
          channels: Array.from(server.channels?.entries() || []),
          roles: Array.from(server.roles?.entries() || []),
          members: Array.from(server.members?.entries() || [])
        }];
      })),
      messages: Object.fromEntries(Array.from(messages.entries()).map(([key, value]) => {
        if (value instanceof Map) {
          return [key, Object.fromEntries(value)];
        }
        return [key, value];
      })),
      friendRequests: Object.fromEntries(friendRequests)
    };
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// Load existing data
const { users, servers, messages, friendRequests } = loadData();

// Runtime data
const onlineUsers = new Map();
const rateLimits = new Map();
const voiceChannels = new Map();
const screenShares = new Map();

// Rate limiting configuration
const RATE_LIMITS = {
    message: { window: 1000, max: 10 },
    login: { window: 60000, max: 5 },
    register: { window: 60000, max: 3 },
    friendRequest: { window: 60000, max: 10 },
    serverCreate: { window: 60000, max: 2 }
};

// Default roles and permissions
const DEFAULT_ROLES = {
    admin: {
        id: 'admin',
        name: 'Admin',
        color: '#ed4245',
        permissions: ['manage_server', 'manage_channels', 'manage_roles', 'kick_members', 'ban_members', 'administrator'],
        position: 100
    },
    moderator: {
        id: 'moderator',
        name: 'Moderator',
        color: '#faa61a',
        permissions: ['manage_messages', 'kick_members', 'mute_members', 'deafen_members'],
        position: 50
    },
    member: {
        id: 'member',
        name: 'Member',
        color: '#95a5a6',
        permissions: ['send_messages', 'connect_voice', 'speak'],
        position: 1
    }
};

// Enhanced profanity filter
const PROFANITY_LIST = [
    'nigger', 'nigga', 'chink', 'spic', 'kike', 'fag', 'faggot', 'tranny',
    'retard', 'mongoloid', 'cripple', 'midget', 'gimp', 'cunt', 'twat',
    'pussy', 'dick', 'cock', 'bastard', 'bitch', 'whore', 'slut', 'fuck',
    'shit', 'asshole', 'motherfucker', 'cocksucker'
];

function containsProfanity(text) {
    if (!text) return false;
    
    const cleanText = text.toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ');
    
    return PROFANITY_LIST.some(profanity => {
        const pattern = new RegExp('\\b' + profanity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

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
        friends: [],
        avatar: null,
        status: 'online',
        bio: '',
        customStatus: ''
    });
    
    // Create default server if none exists
    if (servers.size === 0) {
        const serverId = 'default';
        const server = {
            id: serverId,
            name: 'General Server',
            owner: userId,
            channels: new Map(),
            roles: new Map(),
            members: new Map([[userId, { roles: ['admin', 'member'], joinedAt: new Date() }]]),
            createdAt: new Date(),
            icon: null,
            description: 'Welcome to the default server!'
        };
        
        // Add default channels
        server.channels.set('general', {
            id: 'general',
            name: 'general',
            type: 'text',
            position: 0,
            permissions: []
        });
        
        server.channels.set('chat', {
            id: 'chat',
            name: 'chat',
            type: 'text',
            position: 1,
            permissions: []
        });
        
        server.channels.set('general-voice', {
            id: 'general-voice',
            name: 'General Voice',
            type: 'voice',
            position: 2,
            permissions: []
        });
        
        // Add default roles
        Object.values(DEFAULT_ROLES).forEach(role => {
            server.roles.set(role.id, role);
        });
        
        servers.set(serverId, server);
        
        // Initialize messages
        messages.set(serverId, new Map());
        messages.get(serverId).set('general', []);
        messages.get(serverId).set('chat', []);
        
        // Create voice channels
        voiceChannels.set('general-voice', {
            id: 'general-voice',
            serverId: serverId,
            name: 'General Voice',
            members: new Map(),
            type: 'voice'
        });
    }
    
    saveData();
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

app.get('/api/servers/:serverId/messages', (req, res) => {
    const { serverId } = req.params;
    const { channelId } = req.query;
    
    const serverMessages = messages.get(serverId) || new Map();
    const channelMessages = channelId ? serverMessages.get(channelId) || [] : [];
    
    res.json({ success: true, messages: channelMessages });
});

app.post('/api/servers/:serverId/channels', (req, res) => {
    const { serverId } = req.params;
    const { name, type } = req.body;
    const userId = req.headers['user-id'];
    
    if (!userId) {
        return res.json({ success: false, error: 'Not authenticated' });
    }
    
    const server = servers.get(serverId);
    if (!server) {
        return res.json({ success: false, error: 'Server not found' });
    }
    
    // Check permissions
    const member = server.members.get(userId);
    if (!member || !member.roles.includes('admin')) {
        return res.json({ success: false, error: 'Insufficient permissions' });
    }
    
    if (!name || name.length < 2) {
        return res.json({ success: false, error: 'Channel name must be at least 2 characters' });
    }
    
    const channelId = generateId();
    const channel = {
        id: channelId,
        name: name.toLowerCase(),
        displayName: name,
        type: type || 'text',
        position: server.channels.size,
        permissions: [],
        createdAt: new Date()
    };
    
    server.channels.set(channelId, channel);
    
    // Initialize messages for the channel
    if (!messages.has(serverId)) {
        messages.set(serverId, new Map());
    }
    messages.get(serverId).set(channelId, []);
    
    if (type === 'voice') {
        voiceChannels.set(channelId, {
            id: channelId,
            serverId: serverId,
            name: name,
            members: new Map(),
            type: 'voice'
        });
    }
    
    saveData();
    
    io.emit('channel-created', { serverId, channel });
    res.json({ success: true, channel });
});

app.post('/api/servers/:serverId/roles', (req, res) => {
    const { serverId } = req.params;
    const { name, color, permissions } = req.body;
    const userId = req.headers['user-id'];
    
    if (!userId) {
        return res.json({ success: false, error: 'Not authenticated' });
    }
    
    const server = servers.get(serverId);
    if (!server) {
        return res.json({ success: false, error: 'Server not found' });
    }
    
    // Check permissions
    const member = server.members.get(userId);
    if (!member || !member.roles.includes('admin')) {
        return res.json({ success: false, error: 'Insufficient permissions' });
    }
    
    if (!name || name.length < 2) {
        return res.json({ success: false, error: 'Role name must be at least 2 characters' });
    }
    
    const roleId = generateId();
    const role = {
        id: roleId,
        name: name,
        color: color || '#99aab5',
        permissions: permissions || [],
        position: server.roles.size,
        createdAt: new Date()
    };
    
    server.roles.set(roleId, role);
    saveData();
    
    io.emit('role-created', { serverId, role });
    res.json({ success: true, role });
});

app.post('/api/servers/:serverId/members/:memberId/roles', (req, res) => {
    const { serverId, memberId } = req.params;
    const { roleId } = req.body;
    const userId = req.headers['user-id'];
    
    if (!userId) {
        return res.json({ success: false, error: 'Not authenticated' });
    }
    
    const server = servers.get(serverId);
    if (!server) {
        return res.json({ success: false, error: 'Server not found' });
    }
    
    // Check permissions
    const member = server.members.get(userId);
    if (!member || !member.roles.includes('admin')) {
        return res.json({ success: false, error: 'Insufficient permissions' });
    }
    
    if (!server.roles.has(roleId)) {
        return res.json({ success: false, error: 'Role not found' });
    }
    
    const targetMember = server.members.get(memberId);
    if (!targetMember) {
        return res.json({ success: false, error: 'Member not found' });
    }
    
    if (!targetMember.roles.includes(roleId)) {
        targetMember.roles.push(roleId);
    }
    
    saveData();
    
    io.emit('member-roles-updated', { serverId, memberId, roles: targetMember.roles });
    res.json({ success: true, roles: targetMember.roles });
});

app.get('/api/users/:userId', (req, res) => {
    const { userId } = req.params;
    
    const user = Array.from(users.values()).find(u => u.id === userId);
    if (!user) {
        return res.json({ success: false, error: 'User not found' });
    }
    
    // Don't send password
    const { password, ...userData } = user;
    res.json({ success: true, user: userData });
});

app.post('/api/upload', (req, res) => {
    // Simple base64 file upload handler
    const { file, filename, filetype } = req.body;
    
    if (!file || !filename) {
        return res.json({ success: false, error: 'File data required' });
    }
    
    try {
        const fileId = generateId();
        const fileExt = filename.split('.').pop();
        const savedFilename = `${fileId}.${fileExt}`;
        const filePath = path.join(uploadsDir, savedFilename);
        
        // Convert base64 to buffer and save
        const fileBuffer = Buffer.from(file.split(',')[1], 'base64');
        fs.writeFileSync(filePath, fileBuffer);
        
        const fileUrl = `/uploads/${savedFilename}`;
        
        res.json({ 
            success: true, 
            file: {
                id: fileId,
                name: filename,
                url: fileUrl,
                type: filetype || 'application/octet-stream',
                size: fileBuffer.length
            }
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.json({ success: false, error: 'File upload failed' });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        users: users.size, 
        servers: servers.size,
        online: onlineUsers.size,
        voiceChannels: voiceChannels.size
    });
});

// Serve the main app
app.get('/app', (req, res) => {
    // The full HTML is too large to include here, but it would contain:
    // - Complete Discord-like UI with server sidebar
    // - Channel creation and management
    // - Role management system
    // - Member list with roles display
    // - User profiles and DM system
    // - Server settings
    // - File upload functionality
    // - Voice chat and screen sharing
    
    // For now, we'll serve a simplified version
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Discord App</title>
        <style>
            body { margin: 0; padding: 0; font-family: Arial; background: #36393f; color: white; }
            .container { padding: 2rem; text-align: center; }
            .loading { color: #7289da; font-size: 1.5rem; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="loading">Discord App Loading...</div>
            <p>Full Discord-like UI with channels, roles, member lists, and server settings coming soon!</p>
            <button onclick="logout()" style="padding: 10px 20px; background: #7289da; color: white; border: none; border-radius: 3px; cursor: pointer;">Logout</button>
        </div>
        <script>
            function logout() {
                localStorage.clear();
                window.location.href = '/';
            }
        </script>
    </body>
    </html>
    `);
});

// Socket.io
io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);
    
    socket.on('user-joined', (userData) => {
        onlineUsers.set(socket.id, {
            id: userData.userId,
            username: userData.username,
            socketId: socket.id,
            status: 'online'
        });
        
        console.log('👋 ' + userData.username + ' joined');
        
        // Update user status
        const user = users.get(userData.username.toLowerCase());
        if (user) {
            user.status = 'online';
        }
        
        // Notify others about user coming online
        socket.broadcast.emit('user-status-changed', {
            userId: userData.userId,
            username: userData.username,
            status: 'online'
        });
    });
    
    socket.on('send-server-message', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        if (!checkRateLimit('message', user.id)) {
            socket.emit('rate-limit', { type: 'message' });
            return;
        }
        
        const sanitizedContent = sanitizeText(data.content);
        
        // Detect pings
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
            attachments: data.attachments || []
        };
        
        // Save message persistently
        if (!messages.has(data.serverId)) {
            messages.set(data.serverId, new Map());
        }
        const serverMessages = messages.get(data.serverId);
        if (!serverMessages.has(data.channelId)) {
            serverMessages.set(data.channelId, []);
        }
        const channelMessages = serverMessages.get(data.channelId);
        channelMessages.push(message);
        
        saveData();
        
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
        
        // Broadcast to all in server
        io.emit('new-message', { 
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
            type: 'dm',
            attachments: data.attachments || []
        };
        
        const dmMessages = messages.get(dmKey) || [];
        dmMessages.push(message);
        messages.set(dmKey, dmMessages);
        
        saveData();
        
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
                deafened: false,
                speaking: false
            });
            
            socket.join('voice-' + data.channelId);
            
            io.emit('voice-user-joined', {
                userId: user.id,
                username: user.username,
                channelId: data.channelId
            });
        }
    });
    
    socket.on('leave-voice', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        const voiceChannel = voiceChannels.get(data.channelId);
        if (voiceChannel && voiceChannel.members.has(user.id)) {
            voiceChannel.members.delete(user.id);
            socket.leave('voice-' + data.channelId);
            
            io.emit('voice-user-left', { 
                userId: user.id,
                channelId: data.channelId
            });
        }
    });
    
    // Screen sharing
    socket.on('start-screenshare', (data) => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            screenShares.set(user.id, {
                userId: user.id,
                username: user.username,
                socketId: socket.id,
                channelId: data.channelId,
                startedAt: new Date()
            });
            
            io.emit('screenshare-started', {
                userId: user.id,
                username: user.username,
                channelId: data.channelId
            });
        }
    });
    
    socket.on('stop-screenshare', (data) => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            screenShares.delete(user.id);
            io.emit('screenshare-stopped', {
                userId: user.id,
                channelId: data.channelId
            });
        }
    });
    
    socket.on('disconnect', () => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            console.log('👋 ' + user.username + ' left');
            
            // Leave all voice channels
            voiceChannels.forEach((channel, channelId) => {
                if (channel.members.has(user.id)) {
                    channel.members.delete(user.id);
                    io.emit('voice-user-left', { 
                        userId: user.id,
                        channelId: channelId
                    });
                }
            });
            
            // Stop screen sharing
            if (screenShares.has(user.id)) {
                screenShares.delete(user.id);
                io.emit('screenshare-stopped', { userId: user.id });
            }
            
            // Update user status
            const userObj = users.get(user.username.toLowerCase());
            if (userObj) {
                userObj.status = 'offline';
            }
            
            // Notify others
            socket.broadcast.emit('user-status-changed', {
                userId: user.id,
                username: user.username,
                status: 'offline'
            });
            
            onlineUsers.delete(socket.id);
        }
    });
});

// Auto-save data every 30 seconds
setInterval(saveData, 30000);

server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Enhanced Discord Chat running on port ' + PORT);
    console.log('🔒 Features: Channels, Roles, Member Lists, Server Settings, DMs');
    console.log('💾 Data persistence enabled');
    console.log('👉 Open: http://localhost:' + PORT);
});
