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

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Serve login page
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Chat App - Login</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            body { background: linear-gradient(135deg, #667eea, #764ba2); height: 100vh; display: flex; justify-content: center; align-items: center; }
            .container { background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); width: 400px; }
            h1 { text-align: center; margin-bottom: 2rem; color: #333; }
            .tabs { display: flex; margin-bottom: 1.5rem; border-bottom: 2px solid #eee; }
            .tab { flex: 1; padding: 1rem; text-align: center; cursor: pointer; border-bottom: 3px solid transparent; }
            .tab.active { border-bottom-color: #667eea; font-weight: bold; color: #667eea; }
            .form { display: none; }
            .form.active { display: block; }
            .input-group { margin-bottom: 1rem; }
            input { width: 100%; padding: 0.8rem; border: 2px solid #ddd; border-radius: 5px; font-size: 1rem; }
            input:focus { outline: none; border-color: #667eea; }
            button { width: 100%; padding: 0.8rem; background: #667eea; color: white; border: none; border-radius: 5px; font-size: 1rem; cursor: pointer; margin-top: 1rem; }
            button:hover { background: #5a6fd8; }
            .message { margin-top: 1rem; padding: 0.8rem; border-radius: 5px; text-align: center; display: none; }
            .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>💬 Chat App</h1>
            <div class="tabs">
                <div class="tab active" onclick="showTab('login')">Login</div>
                <div class="tab" onclick="showTab('register')">Register</div>
            </div>
            <form id="loginForm" class="form active" onsubmit="login(event)">
                <div class="input-group"><input type="text" id="loginUsername" placeholder="Username" required></div>
                <div class="input-group"><input type="password" id="loginPassword" placeholder="Password" required></div>
                <button type="submit">Login</button>
            </form>
            <form id="registerForm" class="form" onsubmit="register(event)">
                <div class="input-group"><input type="text" id="registerUsername" placeholder="Username" required></div>
                <div class="input-group"><input type="password" id="registerPassword" placeholder="Password" required></div>
                <button type="submit">Register</button>
            </form>
            <div id="message" class="message"></div>
        </div>
        <script>
            function showTab(tabName) {
                document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.form').forEach(form => form.classList.remove('active'));
                event.target.classList.add('active');
                document.getElementById(tabName + 'Form').classList.add('active');
            }
            async function login(e) {
                e.preventDefault();
                const username = document.getElementById('loginUsername').value;
                const password = document.getElementById('loginPassword').value;
                try {
                    const response = await fetch('/api/login', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();
                    if (data.success) {
                        localStorage.setItem('username', username);
                        window.location.href = '/chat';
                    } else {
                        showMessage(data.error, 'error');
                    }
                } catch (error) {
                    showMessage('Connection error', 'error');
                }
            }
            async function register(e) {
                e.preventDefault();
                const username = document.getElementById('registerUsername').value;
                const password = document.getElementById('registerPassword').value;
                try {
                    const response = await fetch('/api/register', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();
                    if (data.success) {
                        showMessage('Registration successful! Please login.', 'success');
                        document.getElementById('registerForm').reset();
                        setTimeout(() => showTab('login'), 2000);
                    } else {
                        showMessage(data.error, 'error');
                    }
                } catch (error) {
                    showMessage('Connection error', 'error');
                }
            }
            function showMessage(text, type) {
                const messageEl = document.getElementById('message');
                messageEl.textContent = text;
                messageEl.className = 'message ' + type;
                messageEl.style.display = 'block';
            }
            if (localStorage.getItem('username')) {
                window.location.href = '/chat';
            }
        </script>
    </body>
    </html>
    `);
});

// Serve chat page
app.get('/chat', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Chat Room</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            body { background: #1a1a2e; color: white; height: 100vh; overflow: hidden; }
            .chat-container { display: flex; height: 100vh; max-width: 1200px; margin: 0 auto; }
            .sidebar { width: 250px; background: #16213e; padding: 1rem; border-right: 1px solid #2a2a4a; }
            .user-info { padding: 1rem; background: #0f3460; border-radius: 5px; margin-bottom: 1rem; }
            .username { font-weight: bold; color: #64ffda; }
            .online-users { margin-top: 1rem; }
            .online-users h3 { margin-bottom: 0.5rem; color: #8892b0; }
            .user-list { list-style: none; }
            .user-item { padding: 0.5rem; margin-bottom: 0.3rem; background: rgba(255,255,255,0.1); border-radius: 3px; }
            .logout-btn { width: 100%; padding: 0.8rem; background: #ff6b6b; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 1rem; }
            .logout-btn:hover { background: #ff5252; }
            .chat-area { flex: 1; display: flex; flex-direction: column; }
            .messages-container { flex: 1; padding: 1rem; overflow-y: auto; background: #1a1a2e; }
            .message { margin-bottom: 1rem; padding: 0.8rem; background: rgba(255,255,255,0.1); border-radius: 5px; }
            .message.system { background: rgba(255,193,7,0.2); text-align: center; font-style: italic; }
            .message-header { display: flex; justify-content: space-between; margin-bottom: 0.3rem; }
            .message-username { font-weight: bold; color: #64ffda; }
            .message-time { font-size: 0.8rem; color: #8892b0; }
            .message-content { line-height: 1.4; }
            .input-area { padding: 1rem; background: #16213e; border-top: 1px solid #2a2a4a; }
            .input-container { display: flex; gap: 10px; }
            .message-input { flex: 1; padding: 0.8rem; border: 2px solid #2a2a4a; background: rgba(255,255,255,0.1); color: white; border-radius: 5px; font-size: 1rem; }
            .message-input:focus { outline: none; border-color: #64ffda; }
            .send-btn { padding: 0 1.5rem; background: #64ffda; color: #1a1a2e; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; }
            .send-btn:hover { background: #52e3c2; }
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: rgba(255,255,255,0.1); }
            ::-webkit-scrollbar-thumb { background: #64ffda; border-radius: 3px; }
        </style>
    </head>
    <body>
        <div class="chat-container">
            <div class="sidebar">
                <div class="user-info">
                    <div>Logged in as:</div>
                    <div class="username" id="currentUsername">User</div>
                </div>
                <div class="online-users">
                    <h3>Online Users</h3>
                    <ul class="user-list" id="userList">
                        <li class="user-item">Loading...</li>
                    </ul>
                </div>
                <button class="logout-btn" onclick="logout()">Logout</button>
            </div>
            <div class="chat-area">
                <div class="messages-container" id="messagesContainer">
                    <div class="message system">
                        <div class="message-content">Welcome to the chat!</div>
                    </div>
                </div>
                <div class="input-area">
                    <div class="input-container">
                        <input type="text" id="messageInput" class="message-input" placeholder="Type your message..." maxlength="500">
                        <button class="send-btn" onclick="sendMessage()">Send</button>
                    </div>
                </div>
            </div>
        </div>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            const username = localStorage.getItem('username');
            if (!username) {
                window.location.href = '/';
                throw new Error('Not logged in');
            }
            document.getElementById('currentUsername').textContent = username;
            socket.emit('user-joined', username);
            socket.on('previous-messages', (previousMessages) => {
                const container = document.getElementById('messagesContainer');
                container.innerHTML = '';
                previousMessages.forEach(message => addMessage(message));
                scrollToBottom();
            });
            socket.on('new-message', (message) => {
                addMessage(message);
                scrollToBottom();
            });
            socket.on('user-joined', (message) => {
                addMessage(message);
                scrollToBottom();
            });
            socket.on('user-left', (message) => {
                addMessage(message);
                scrollToBottom();
            });
            function sendMessage() {
                const input = document.getElementById('messageInput');
                const message = input.value.trim();
                if (message) {
                    socket.emit('send-message', { username: username, message: message });
                    input.value = '';
                }
            }
            function addMessage(message) {
                const container = document.getElementById('messagesContainer');
                const messageEl = document.createElement('div');
                if (message.type === 'system') {
                    messageEl.className = 'message system';
                    messageEl.innerHTML = '<div class="message-content">' + message.content + '</div>';
                } else {
                    messageEl.className = 'message';
                    const time = new Date(message.timestamp).toLocaleTimeString();
                    messageEl.innerHTML = '<div class="message-header"><div class="message-username">' + message.username + '</div><div class="message-time">' + time + '</div></div><div class="message-content">' + message.content + '</div>';
                }
                container.appendChild(messageEl);
            }
            function scrollToBottom() {
                const container = document.getElementById('messagesContainer');
                container.scrollTop = container.scrollHeight;
            }
            function logout() {
                localStorage.removeItem('username');
                window.location.href = '/';
            }
            document.getElementById('messageInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });
            document.getElementById('messageInput').focus();
        </script>
    </body>
    </html>
    `);
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

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', users: users.length, messages: messages.length });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Chat server running on port ${PORT}`);
    console.log(`📧 Open your Render URL in browser`);
});
