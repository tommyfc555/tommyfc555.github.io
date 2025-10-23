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

// Create directories
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Data storage
const DATA_FILE = 'data.json';

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (error) {
    console.log('Starting with fresh data');
  }
  return {
    users: {},
    servers: {},
    messages: {},
    friends: {},
    friendRequests: {}
  };
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    users,
    servers,
    messages,
    friends,
    friendRequests
  }, null, 2));
}

let { users, servers, messages, friends, friendRequests } = loadData();

// Runtime storage
const onlineUsers = new Map();
const voiceChannels = new Map();
const screenShares = new Map();

// Default roles
const DEFAULT_ROLES = {
  admin: { id: 'admin', name: 'Admin', color: '#ed4245', permissions: ['*'] },
  moderator: { id: 'moderator', name: 'Moderator', color: '#faa61a', permissions: ['manage_messages'] },
  member: { id: 'member', name: 'Member', color: '#95a5a6', permissions: ['send_messages'] }
};

// Helper functions
function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

function getClientIP(req) {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
}

app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// Routes
app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>Discord Clone - Login</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial; }
      body { background: #36393f; height: 100vh; display: flex; justify-content: center; align-items: center; }
      .container { background: #36393f; padding: 2rem; border-radius: 5px; width: 480px; color: white; text-align: center; }
      input { width: 100%; padding: 12px; margin: 8px 0; background: #303339; border: 1px solid #222428; color: white; border-radius: 3px; }
      button { width: 100%; padding: 12px; background: #5865f2; color: white; border: none; border-radius: 3px; cursor: pointer; margin: 8px 0; }
      .error { color: #ed4245; margin: 8px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Discord Clone</h1>
      <p style="color: #b9bbbe; margin: 16px 0;">Login to continue</p>
      <input type="text" id="username" placeholder="Username" minlength="3">
      <input type="password" id="password" placeholder="Password" minlength="6">
      <button onclick="login()">Login</button>
      <button onclick="register()" style="background: #4f545c;">Register</button>
      <div id="error" class="error"></div>
    </div>
    <script>
      async function login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
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
          document.getElementById('error').textContent = data.error;
        }
      }

      async function register() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        if (username.length < 3) {
          document.getElementById('error').textContent = 'Username must be at least 3 characters';
          return;
        }
        if (password.length < 6) {
          document.getElementById('error').textContent = 'Password must be at least 6 characters';
          return;
        }
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (data.success) {
          alert('Registration successful! Please login.');
        } else {
          document.getElementById('error').textContent = data.error;
        }
      }

      // Auto-focus username
      document.getElementById('username').focus();
      
      // Enter key support
      document.getElementById('password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
      });

      // Check if already logged in
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
  
  if (!username || !password) {
    return res.json({ success: false, error: 'Username and password required' });
  }
  
  if (users[username.toLowerCase()]) {
    return res.json({ success: false, error: 'Username already exists' });
  }
  
  const userId = generateId();
  users[username.toLowerCase()] = {
    id: userId,
    username: username,
    password: password,
    avatar: null,
    status: 'online',
    bio: '',
    createdAt: new Date()
  };
  
  // Create default server if none exists
  if (Object.keys(servers).length === 0) {
    const serverId = 'main';
    servers[serverId] = {
      id: serverId,
      name: 'Main Server',
      owner: userId,
      channels: {
        'general': { id: 'general', name: 'general', type: 'text', position: 0 },
        'chat': { id: 'chat', name: 'chat', type: 'text', position: 1 },
        'voice': { id: 'voice', name: 'Voice Chat', type: 'voice', position: 2 }
      },
      roles: DEFAULT_ROLES,
      members: {
        [userId]: { roles: ['admin', 'member'], joinedAt: new Date() }
      },
      createdAt: new Date()
    };
    
    messages[serverId] = {
      'general': [],
      'chat': []
    };
    
    voiceChannels.set('voice', {
      id: 'voice',
      name: 'Voice Chat',
      members: new Map()
    });
  }
  
  friends[userId] = [];
  friendRequests[userId] = [];
  
  saveData();
  res.json({ success: true, userId, username });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username.toLowerCase()];
  
  if (!user || user.password !== password) {
    return res.json({ success: false, error: 'Invalid credentials' });
  }
  
  res.json({ success: true, userId: user.id, username: user.username });
});

app.get('/api/servers', (req, res) => {
  res.json({ success: true, servers });
});

app.get('/api/servers/:serverId/messages', (req, res) => {
  const { serverId } = req.params;
  const { channelId } = req.query;
  
  const serverMessages = messages[serverId] || {};
  const channelMessages = channelId ? (serverMessages[channelId] || []) : [];
  
  res.json({ success: true, messages: channelMessages });
});

app.post('/api/servers/:serverId/channels', (req, res) => {
  const { serverId } = req.params;
  const { name, type } = req.body;
  const userId = req.headers['user-id'];
  
  if (!userId) return res.json({ success: false, error: 'Not authenticated' });
  
  const server = servers[serverId];
  if (!server) return res.json({ success: false, error: 'Server not found' });
  
  // Check admin permissions
  const member = server.members[userId];
  if (!member || !member.roles.includes('admin')) {
    return res.json({ success: false, error: 'Insufficient permissions' });
  }
  
  const channelId = generateId();
  server.channels[channelId] = {
    id: channelId,
    name: name.toLowerCase(),
    displayName: name,
    type: type || 'text',
    position: Object.keys(server.channels).length
  };
  
  if (!messages[serverId]) messages[serverId] = {};
  messages[serverId][channelId] = [];
  
  if (type === 'voice') {
    voiceChannels.set(channelId, {
      id: channelId,
      name: name,
      members: new Map()
    });
  }
  
  saveData();
  
  io.emit('channel-created', { serverId, channel: server.channels[channelId] });
  res.json({ success: true, channel: server.channels[channelId] });
});

app.post('/api/upload', (req, res) => {
  const { file, filename } = req.body;
  
  if (!file) return res.json({ success: false, error: 'No file data' });
  
  try {
    const fileId = generateId();
    const fileExt = filename.split('.').pop() || 'png';
    const savedFilename = `${fileId}.${fileExt}`;
    const filePath = path.join(uploadsDir, savedFilename);
    
    const base64Data = file.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    fs.writeFileSync(filePath, buffer);
    
    res.json({
      success: true,
      file: {
        id: fileId,
        name: filename,
        url: `/uploads/${savedFilename}`,
        type: 'image'
      }
    });
  } catch (error) {
    res.json({ success: false, error: 'Upload failed' });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    users: Object.keys(users).length,
    servers: Object.keys(servers).length,
    online: onlineUsers.size
  });
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Serve main app
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.html'));
});

// Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user-joined', (userData) => {
    onlineUsers.set(socket.id, {
      id: userData.userId,
      username: userData.username,
      socketId: socket.id
    });

    // Update user status
    const user = users[userData.username.toLowerCase()];
    if (user) user.status = 'online';

    // Notify others
    socket.broadcast.emit('user-online', {
      userId: userData.userId,
      username: userData.username
    });

    console.log(`${userData.username} joined`);
  });

  socket.on('send-message', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    const message = {
      id: generateId(),
      userId: user.id,
      username: user.username,
      content: data.content,
      timestamp: new Date(),
      serverId: data.serverId,
      channelId: data.channelId,
      attachments: data.attachments || []
    };

    // Save message
    if (!messages[data.serverId]) messages[data.serverId] = {};
    if (!messages[data.serverId][data.channelId]) messages[data.serverId][data.channelId] = [];
    messages[data.serverId][data.channelId].push(message);

    saveData();

    // Broadcast to everyone in the server
    io.emit('new-message', {
      serverId: data.serverId,
      channelId: data.channelId,
      message
    });
  });

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
        channelId: data.channelId,
        user: { id: user.id, username: user.username }
      });
    }
  });

  socket.on('leave-voice', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    const voiceChannel = voiceChannels.get(data.channelId);
    if (voiceChannel && voiceChannel.members.has(user.id)) {
      voiceChannel.members.delete(user.id);

      io.emit('voice-user-left', {
        channelId: data.channelId,
        userId: user.id
      });
    }
  });

  socket.on('start-screenshare', (data) => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      screenShares.set(user.id, {
        userId: user.id,
        username: user.username,
        channelId: data.channelId
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
      io.emit('screenshare-stopped', { userId: user.id });
    }
  });

  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      console.log(`${user.username} left`);

      // Leave voice channels
      voiceChannels.forEach(channel => {
        if (channel.members.has(user.id)) {
          channel.members.delete(user.id);
          io.emit('voice-user-left', {
            channelId: channel.id,
            userId: user.id
          });
        }
      });

      // Update status
      const userObj = users[user.username.toLowerCase()];
      if (userObj) userObj.status = 'offline';

      // Notify others
      socket.broadcast.emit('user-offline', { userId: user.id });

      onlineUsers.delete(socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Discord Clone running on port ${PORT}`);
  console.log(`👉 Open: http://localhost:${PORT}`);
});
