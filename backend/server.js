const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// In-memory storage
const users = new Map();
const messages = [];
const onlineUsers = new Map();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Serve chat page
app.get('/chat', (req, res) => {
    res.sendFile(__dirname + '/public/chat.html');
});

// Serve login page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

// Auth routes
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (password.length < 3) {
        return res.status(400).json({ error: 'Password must be at least 3 characters' });
    }
    
    if (users.has(username)) {
        return res.status(400).json({ error: 'Username already taken' });
    }
    
    // Store user
    users.set(username, {
        password: password,
        createdAt: new Date(),
        lastSeen: new Date()
    });
    
    console.log(`👤 User registered: ${username}`);
    
    res.json({
        success: true,
        message: 'Registration successful!',
        username: username
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    const user = users.get(username);
    if (!user) {
        return res.status(400).json({ error: 'User not found' });
    }
    
    if (user.password !== password) {
        return res.status(400).json({ error: 'Invalid password' });
    }
    
    user.lastSeen = new Date();
    
    console.log(`🔐 User logged in: ${username}`);
    
    res.json({
        success: true,
        message: 'Login successful!',
        username: username
    });
});

// Get chat messages
app.get('/api/messages', (req, res) => {
    res.json({
        success: true,
        messages: messages.slice(-100) // Last 100 messages
    });
});

// Get online users
app.get('/api/online-users', (req, res) => {
    const online = Array.from(onlineUsers.values());
    res.json({
        success: true,
        users: online
    });
});

// Socket.io for real-time chat
io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);
    
    socket.on('join-chat', (userData) => {
        const { username } = userData;
        
        // Store online user
        onlineUsers.set(socket.id, {
            id: socket.id,
            username: username,
            joinedAt: new Date()
        });
        
        // Notify everyone about new user
        socket.broadcast.emit('user-joined', {
            username: username,
            message: `${username} joined the chat`,
            timestamp: new Date()
        });
        
        // Send current online users to everyone
        io.emit('online-users-update', Array.from(onlineUsers.values()));
        
        console.log(`💬 ${username} joined the chat`);
    });
    
    socket.on('send-message', (messageData) => {
        const { username, message } = messageData;
        
        if (!username || !message) return;
        
        // Create message object
        const messageObj = {
            id: Date.now().toString(),
            username: username,
            message: message.trim(),
            timestamp: new Date(),
            socketId: socket.id
        };
        
        // Add to messages array (keep last 200 messages)
        messages.push(messageObj);
        if (messages.length > 200) {
            messages.shift();
        }
        
        // Broadcast to all clients
        io.emit('new-message', messageObj);
        
        console.log(`💭 ${username}: ${message}`);
    });
    
    socket.on('typing-start', (data) => {
        socket.broadcast.emit('user-typing', {
            username: data.username,
            isTyping: true
        });
    });
    
    socket.on('typing-stop', (data) => {
        socket.broadcast.emit('user-typing', {
            username: data.username,
            isTyping: false
        });
    });
    
    socket.on('disconnect', () => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            // Notify everyone about user leaving
            socket.broadcast.emit('user-left', {
                username: user.username,
                message: `${user.username} left the chat`,
                timestamp: new Date()
            });
            
            // Remove from online users
            onlineUsers.delete(socket.id);
            
            // Update online users for everyone
            io.emit('online-users-update', Array.from(onlineUsers.values()));
            
            console.log(`👋 ${user.username} left the chat`);
        }
        
        console.log('🔌 User disconnected:', socket.id);
    });
});

// API routes
app.get('/api/status', (req, res) => {
    res.json({
        status: '🟢 Online',
        totalUsers: users.size,
        onlineUsers: onlineUsers.size,
        totalMessages: messages.length,
        uptime: process.uptime()
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Chat Server Started!');
    console.log('📍 Port:', PORT);
    console.log('💬 Real-time Chat: Ready');
    console.log('👤 User System: Ready');
    console.log('⚡ Server ready!');
});
