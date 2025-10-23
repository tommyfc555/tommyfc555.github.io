const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Store users and messages
let users = [];
let messages = [];

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// API routes
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, error: 'Username and password required' });
    }
    
    if (users.find(u => u.username === username)) {
        return res.json({ success: false, error: 'Username already exists' });
    }
    
    users.push({ username, password });
    console.log(`✅ User registered: ${username}`);
    
    res.json({ success: true, message: 'Registration successful' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.json({ success: false, error: 'Invalid credentials' });
    }
    
    console.log(`✅ User logged in: ${username}`);
    res.json({ success: true, message: 'Login successful', username });
});

// Socket.io
io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);
    
    // Send previous messages to new user
    socket.emit('previous-messages', messages);
    
    socket.on('user-joined', (username) => {
        console.log(`👋 ${username} joined the chat`);
        
        // Add user to online list
        socket.username = username;
        
        // Broadcast to all users
        const joinMessage = {
            type: 'system',
            content: `${username} joined the chat`,
            timestamp: new Date()
        };
        
        messages.push(joinMessage);
        io.emit('user-joined', joinMessage);
        io.emit('update-users', users.map(u => u.username));
    });
    
    socket.on('send-message', (data) => {
        const message = {
            type: 'user',
            username: data.username,
            content: data.message,
            timestamp: new Date()
        };
        
        messages.push(message);
        
        // Broadcast to all users
        io.emit('new-message', message);
        console.log(`💬 ${data.username}: ${data.message}`);
    });
    
    socket.on('disconnect', () => {
        if (socket.username) {
            console.log(`👋 ${socket.username} left the chat`);
            
            const leaveMessage = {
                type: 'system',
                content: `${socket.username} left the chat`,
                timestamp: new Date()
            };
            
            messages.push(leaveMessage);
            io.emit('user-left', leaveMessage);
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Chat server running on port ${PORT}`);
    console.log(`📧 Open http://localhost:3000 in your browser`);
});
