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

// Generate unique IDs
function generateId() {
    return crypto.randomBytes(8).toString('hex');
}

function generateInviteCode() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Get client IP
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
}

// HTML templates
const loginHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enhanced Chat</title>
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
        <h1>💬 Enhanced Chat</h1>
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
                    localStorage.setItem('userId', data.userId);
                    localStorage.setItem('username', data.username);
                    window.location.href = '/app';
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
        if (localStorage.getItem('userId')) {
            window.location.href = '/app';
        }
    </script>
</body>
</html>
`;

const appHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enhanced Chat</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
        body { background: #1a1a2e; color: white; height: 100vh; overflow: hidden; }
        .app-container { display: flex; height: 100vh; }
        
        .sidebar { width: 300px; background: #16213e; border-right: 1px solid #2a2a4a; display: flex; flex-direction: column; }
        .header { padding: 1rem; background: #0f3460; border-bottom: 1px solid #2a2a4a; }
        .user-info { display: flex; align-items: center; gap: 10px; margin-bottom: 1rem; }
        .username { font-weight: bold; color: #64ffda; }
        
        .nav { padding: 1rem; }
        .nav-item { padding: 0.8rem; margin-bottom: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 5px; cursor: pointer; }
        .nav-item.active { background: rgba(100,255,218,0.2); border-left: 3px solid #64ffda; }
        .nav-item:hover { background: rgba(255,255,255,0.1); }
        
        .content { flex: 1; display: flex; flex-direction: column; }
        .content-header { padding: 1rem; background: #0f3460; border-bottom: 1px solid #2a2a4a; }
        
        .servers-list { padding: 1rem; }
        .server-item { padding: 1rem; margin-bottom: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 5px; cursor: pointer; }
        .server-item:hover { background: rgba(255,255,255,0.1); }
        
        .chat-area { flex: 1; display: flex; flex-direction: column; }
        .messages-container { flex: 1; padding: 1rem; overflow-y: auto; background: #1a1a2e; }
        .message { margin-bottom: 1rem; padding: 0.8rem; background: rgba(255,255,255,0.05); border-radius: 5px; }
        .message.system { background: rgba(255,193,7,0.2); text-align: center; font-style: italic; }
        .message.dm { border-left: 3px solid #ff6b6b; }
        .message-header { display: flex; justify-content: space-between; margin-bottom: 0.3rem; }
        .message-username { font-weight: bold; color: #64ffda; }
        .message-time { font-size: 0.8rem; color: #8892b0; }
        
        .input-area { padding: 1rem; background: #16213e; border-top: 1px solid #2a2a4a; }
        .input-container { display: flex; gap: 10px; }
        .message-input { flex: 1; padding: 0.8rem; border: 2px solid #2a2a4a; background: rgba(255,255,255,0.1); color: white; border-radius: 5px; }
        .send-btn { padding: 0 1.5rem; background: #64ffda; color: #1a1a2e; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; }
        
        .friends-list { padding: 1rem; }
        .friend-item { padding: 1rem; margin-bottom: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 5px; display: flex; justify-content: space-between; }
        .friend-actions button { margin-left: 0.5rem; padding: 0.3rem 0.6rem; border: none; border-radius: 3px; cursor: pointer; }
        
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); justify-content: center; align-items: center; }
        .modal-content { background: #16213e; padding: 2rem; border-radius: 10px; width: 400px; }
        .modal input { width: 100%; padding: 0.8rem; margin-bottom: 1rem; background: rgba(255,255,255,0.1); border: 1px solid #2a2a4a; color: white; border-radius: 5px; }
        .modal-buttons { display: flex; gap: 10px; }
        .modal-buttons button { flex: 1; padding: 0.8rem; border: none; border-radius: 5px; cursor: pointer; }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.1); }
        ::-webkit-scrollbar-thumb { background: #64ffda; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="app-container">
        <div class="sidebar">
            <div class="header">
                <h2>💬 Enhanced Chat</h2>
                <div class="user-info">
                    <div class="username" id="currentUsername">User</div>
                </div>
            </div>
            
            <div class="nav">
                <div class="nav-item active" onclick="showSection('servers')">🏠 Servers</div>
                <div class="nav-item" onclick="showSection('friends')">👥 Friends</div>
                <div class="nav-item" onclick="showSection('dms')">💬 Direct Messages</div>
                <button onclick="logout()" style="width: 100%; padding: 0.8rem; background: #ff6b6b; color: white; border: none; border-radius: 5px; margin-top: 1rem;">Logout</button>
            </div>
        </div>
        
        <div class="content">
            <div class="content-header">
                <h2 id="contentTitle">Servers</h2>
            </div>
            
            <div id="serversSection" class="content-section">
                <div style="padding: 1rem;">
                    <button onclick="showCreateServerModal()" style="padding: 0.8rem 1.5rem; background: #64ffda; color: #1a1a2e; border: none; border-radius: 5px; margin-bottom: 1rem;">Create Server</button>
                    <div id="serversList" class="servers-list"></div>
                </div>
            </div>
            
            <div id="friendsSection" class="content-section" style="display: none;">
                <div style="padding: 1rem;">
                    <div style="display: flex; gap: 10px; margin-bottom: 1rem;">
                        <input type="text" id="friendUsername" placeholder="Username to add" style="flex: 1; padding: 0.8rem; background: rgba(255,255,255,0.1); border: 1px solid #2a2a4a; color: white; border-radius: 5px;">
                        <button onclick="sendFriendRequest()" style="padding: 0.8rem 1.5rem; background: #64ffda; color: #1a1a2e; border: none; border-radius: 5px;">Add Friend</button>
                    </div>
                    <div id="friendsList" class="friends-list"></div>
                    <h3 style="margin: 1rem 0;">Friend Requests</h3>
                    <div id="friendRequestsList"></div>
                </div>
            </div>
            
            <div id="dmsSection" class="content-section" style="display: none;">
                <div style="padding: 1rem;">
                    <div id="dmsList" class="friends-list"></div>
                </div>
            </div>
            
            <div id="chatSection" class="chat-area" style="display: none;">
                <div class="messages-container" id="messagesContainer"></div>
                <div class="input-area">
                    <div class="input-container">
                        <input type="text" id="messageInput" class="message-input" placeholder="Type your message..." maxlength="500">
                        <button class="send-btn" onclick="sendMessage()">Send</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <div id="createServerModal" class="modal">
        <div class="modal-content">
            <h3>Create Server</h3>
            <input type="text" id="serverName" placeholder="Server Name">
            <div class="modal-buttons">
                <button onclick="createServer()" style="background: #64ffda; color: #1a1a2e;">Create</button>
                <button onclick="hideModal('createServerModal')" style="background: #ff6b6b; color: white;">Cancel</button>
            </div>
        </div>
    </div>
    
    <div id="inviteModal" class="modal">
        <div class="modal-content">
            <h3>Invite Friends</h3>
            <p>Share this link:</p>
            <input type="text" id="inviteLink" readonly>
            <div class="modal-buttons">
                <button onclick="copyInviteLink()" style="background: #64ffda; color: #1a1a2e;">Copy</button>
                <button onclick="hideModal('inviteModal')" style="background: #ff6b6b; color: white;">Close</button>
            </div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let currentUser = null;
        let currentServer = null;
        let currentDM = null;
        
        async function init() {
            const userId = localStorage.getItem('userId');
            const username = localStorage.getItem('username');
            
            if (!userId || !username) {
                window.location.href = '/';
                return;
            }
            
            currentUser = { id: userId, username };
            document.getElementById('currentUsername').textContent = username;
            
            socket.emit('user-joined', currentUser);
            
            loadServers();
            loadFriends();
            loadDMs();
            
            socket.on('server-created', (server) => {
                loadServers();
            });
            
            socket.on('server-joined', (data) => {
                loadServers();
                joinServer(data.serverId);
            });
            
            socket.on('new-message', (data) => {
                if (data.serverId === currentServer) {
                    addMessage(data.message);
                }
            });
            
            socket.on('friend-request', (data) => {
                loadFriendRequests();
            });
            
            socket.on('dm-message', (data) => {
                if (currentDM === data.fromUserId || currentDM === data.toUserId) {
                    addDMMessage(data.message);
                }
            });
        }
        
        function showSection(section) {
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.content-section').forEach(section => section.style.display = 'none');
            document.getElementById('chatSection').style.display = 'none';
            
            event.target.classList.add('active');
            document.getElementById(section + 'Section').style.display = 'block';
            document.getElementById('contentTitle').textContent = section.charAt(0).toUpperCase() + section.slice(1);
        }
        
        async function loadServers() {
            try {
                const response = await fetch('/api/servers');
                const data = await response.json();
                
                const serversList = document.getElementById('serversList');
                serversList.innerHTML = '';
                
                if (data.servers && data.servers.length > 0) {
                    data.servers.forEach(server => {
                        const serverEl = document.createElement('div');
                        serverEl.className = 'server-item';
                        serverEl.innerHTML = '<div><strong>' + server.name + '</strong></div><div style="font-size: 0.8rem; color: #8892b0;">Members: ' + server.memberCount + '</div><button onclick="joinServer(\\'' + server.id + '\\')" style="margin-top: 0.5rem; padding: 0.3rem 0.6rem; background: #64ffda; color: #1a1a2e; border: none; border-radius: 3px;">Join</button><button onclick="showInviteModal(\\'' + server.id + '\\')" style="margin-top: 0.5rem; padding: 0.3rem 0.6rem; background: #667eea; color: white; border: none; border-radius: 3px;">Invite</button>';
                        serversList.appendChild(serverEl);
                    });
                } else {
                    serversList.innerHTML = '<p>No servers found. Create one!</p>';
                }
            } catch (error) {
                console.error('Error loading servers:', error);
            }
        }
        
        function showCreateServerModal() {
            document.getElementById('createServerModal').style.display = 'flex';
        }
        
        async function createServer() {
            const name = document.getElementById('serverName').value;
            if (!name) return;
            
            try {
                const response = await fetch('/api/servers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                
                const data = await response.json();
                if (data.success) {
                    hideModal('createServerModal');
                    loadServers();
                }
            } catch (error) {
                console.error('Error creating server:', error);
            }
        }
        
        function showInviteModal(serverId) {
            const inviteLink = window.location.origin + '/invite/' + serverId;
            document.getElementById('inviteLink').value = inviteLink;
            document.getElementById('inviteModal').style.display = 'flex';
        }
        
        function copyInviteLink() {
            const link = document.getElementById('inviteLink');
            link.select();
            document.execCommand('copy');
            alert('Invite link copied!');
        }
        
        function hideModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
        }
        
        function joinServer(serverId) {
            currentServer = serverId;
            currentDM = null;
            
            document.getElementById('serversSection').style.display = 'none';
            document.getElementById('chatSection').style.display = 'flex';
            document.getElementById('contentTitle').textContent = 'Server Chat';
            
            loadServerMessages(serverId);
        }
        
        async function loadServerMessages(serverId) {
            try {
                const response = await fetch('/api/servers/' + serverId + '/messages');
                const data = await response.json();
                
                const container = document.getElementById('messagesContainer');
                container.innerHTML = '';
                
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(message => {
                        addMessage(message);
                    });
                } else {
                    container.innerHTML = '<div class="message system"><div class="message-content">No messages yet. Start the conversation!</div></div>';
                }
            } catch (error) {
                console.error('Error loading messages:', error);
            }
        }
        
        async function loadFriends() {
            try {
                const response = await fetch('/api/friends');
                const data = await response.json();
                
                const friendsList = document.getElementById('friendsList');
                friendsList.innerHTML = '';
                
                if (data.friends && data.friends.length > 0) {
                    data.friends.forEach(friend => {
                        const friendEl = document.createElement('div');
                        friendEl.className = 'friend-item';
                        friendEl.innerHTML = '<div>' + friend.username + '</div><div class="friend-actions"><button onclick="startDM(\\'' + friend.id + '\\')" style="background: #64ffda; color: #1a1a2e;">Message</button><button onclick="blockUser(\\'' + friend.id + '\\')" style="background: #ff6b6b; color: white;">Block</button></div>';
                        friendsList.appendChild(friendEl);
                    });
                } else {
                    friendsList.innerHTML = '<p>No friends yet. Add some friends!</p>';
                }
                
                loadFriendRequests();
            } catch (error) {
                console.error('Error loading friends:', error);
            }
        }
        
        async function loadFriendRequests() {
            try {
                const response = await fetch('/api/friends/requests');
                const data = await response.json();
                
                const requestsList = document.getElementById('friendRequestsList');
                requestsList.innerHTML = '';
                
                if (data.requests && data.requests.length > 0) {
                    data.requests.forEach(request => {
                        const requestEl = document.createElement('div');
                        requestEl.className = 'friend-item';
                        requestEl.innerHTML = '<div>' + request.fromUsername + '</div><div class="friend-actions"><button onclick="acceptFriendRequest(\\'' + request.id + '\\')" style="background: #64ffda; color: #1a1a2e;">Accept</button><button onclick="declineFriendRequest(\\'' + request.id + '\\')" style="background: #ff6b6b; color: white;">Decline</button></div>';
                        requestsList.appendChild(requestEl);
                    });
                } else {
                    requestsList.innerHTML = '<p>No friend requests</p>';
                }
            } catch (error) {
                console.error('Error loading friend requests:', error);
            }
        }
        
        async function sendFriendRequest() {
            const username = document.getElementById('friendUsername').value;
            if (!username) return;
            
            try {
                const response = await fetch('/api/friends/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                });
                
                document.getElementById('friendUsername').value = '';
            } catch (error) {
                console.error('Error sending friend request:', error);
            }
        }
        
        async function acceptFriendRequest(requestId) {
            try {
                await fetch('/api/friends/accept', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestId })
                });
                
                loadFriends();
            } catch (error) {
                console.error('Error accepting friend request:', error);
            }
        }
        
        async function declineFriendRequest(requestId) {
            try {
                await fetch('/api/friends/decline', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestId })
                });
                
                loadFriendRequests();
            } catch (error) {
                console.error('Error declining friend request:', error);
            }
        }
        
        async function loadDMs() {
            try {
                const response = await fetch('/api/dms');
                const data = await response.json();
                
                const dmsList = document.getElementById('dmsList');
                dmsList.innerHTML = '';
                
                if (data.dms && data.dms.length > 0) {
                    data.dms.forEach(dm => {
                        const dmEl = document.createElement('div');
                        dmEl.className = 'friend-item';
                        dmEl.innerHTML = '<div>' + dm.username + '</div><div class="friend-actions"><button onclick="startDM(\\'' + dm.userId + '\\')" style="background: #64ffda; color: #1a1a2e;">Open Chat</button></div>';
                        dmsList.appendChild(dmEl);
                    });
                } else {
                    dmsList.innerHTML = '<p>No direct messages yet</p>';
                }
            } catch (error) {
                console.error('Error loading DMs:', error);
            }
        }
        
        function startDM(userId) {
            currentDM = userId;
            currentServer = null;
            
            document.getElementById('dmsSection').style.display = 'none';
            document.getElementById('chatSection').style.display = 'flex';
            document.getElementById('contentTitle').textContent = 'Direct Message';
            
            loadDMMessages(userId);
        }
        
        async function loadDMMessages(userId) {
            try {
                const response = await fetch('/api/dms/' + userId);
                const data = await response.json();
                
                const container = document.getElementById('messagesContainer');
                container.innerHTML = '';
                
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(message => {
                        addDMMessage(message);
                    });
                } else {
                    container.innerHTML = '<div class="message system"><div class="message-content">No messages yet. Start the conversation!</div></div>';
                }
            } catch (error) {
                console.error('Error loading DM messages:', error);
            }
        }
        
        function addMessage(message) {
            const container = document.getElementById('messagesContainer');
            const messageEl = document.createElement('div');
            messageEl.className = 'message';
            
            const time = new Date(message.timestamp).toLocaleTimeString();
            messageEl.innerHTML = '<div class="message-header"><div class="message-username">' + message.username + '</div><div class="message-time">' + time + '</div></div><div class="message-content">' + message.content + '</div>';
            
            container.appendChild(messageEl);
            container.scrollTop = container.scrollHeight;
        }
        
        function addDMMessage(message) {
            const container = document.getElementById('messagesContainer');
            const messageEl = document.createElement('div');
            messageEl.className = 'message dm';
            
            const time = new Date(message.timestamp).toLocaleTimeString();
            messageEl.innerHTML = '<div class="message-header"><div class="message-username">' + message.username + '</div><div class="message-time">' + time + '</div></div><div class="message-content">' + message.content + '</div>';
            
            container.appendChild(messageEl);
            container.scrollTop = container.scrollHeight;
        }
        
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const content = input.value.trim();
            
            if (!content) return;
            
            if (currentServer) {
                socket.emit('send-server-message', {
                    serverId: currentServer,
                    content: content
                });
            } else if (currentDM) {
                socket.emit('send-dm', {
                    toUserId: currentDM,
                    content: content
                });
            }
            
            input.value = '';
        }
        
        async function blockUser(userId) {
            try {
                await fetch('/api/block', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
                
                loadFriends();
            } catch (error) {
                console.error('Error blocking user:', error);
            }
        }
        
        function logout() {
            localStorage.clear();
            window.location.href = '/';
        }
        
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        // Initialize the app
        init();
    </script>
</body>
</html>
`;

const inviteHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Join Server</title>
    <style>
        body { font-family: Arial; text-align: center; padding: 2rem; }
        button { padding: 1rem 2rem; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; }
    </style>
</head>
<body>
    <h2>Server Invitation</h2>
    <p>You've been invited to join a server!</p>
    <button onclick="joinServer()">Join Server</button>
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
`;

// Add the /chat route for compatibility
const chatHTML = appHTML; // Use the same as app for now

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.send(loginHTML);
});

app.get('/app', (req, res) => {
    res.send(appHTML);
});

// Add the missing /chat route
app.get('/chat', (req, res) => {
    res.send(chatHTML);
});

app.get('/invite/:serverId', (req, res) => {
    const invitePage = inviteHTML;
    res.send(invitePage);
});

// API Routes
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const ip = getClientIP(req);
    
    if (!username || !password) {
        return res.json({ success: false, error: 'Username and password required' });
    }
    
    if (users.has(username)) {
        return res.json({ success: false, error: 'Username already exists' });
    }
    
    const userId = generateId();
    users.set(username, {
        id: userId,
        password: password,
        ip: ip,
        createdAt: new Date(),
        friends: [],
        blockedUsers: []
    });
    
    // Create default server
    const serverId = generateId();
    servers.set(serverId, {
        id: serverId,
        name: 'General Chat',
        owner: userId,
        members: [userId],
        createdAt: new Date()
    });
    
    messages.set(serverId, []);
    
    console.log(`✅ User registered: ${username} from IP: ${ip}`);
    
    res.json({ success: true, userId, username });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const ip = getClientIP(req);
    
    const user = users.get(username);
    if (!user) {
        return res.json({ success: false, error: 'User not found' });
    }
    
    if (user.password !== password) {
        return res.json({ success: false, error: 'Invalid password' });
    }
    
    // IP Lock: Check if logging in from different IP
    if (user.ip && user.ip !== ip) {
        return res.json({ success: false, error: 'Account is locked to another device/IP. Please use your original device.' });
    }
    
    console.log(`✅ User logged in: ${username} from IP: ${ip}`);
    res.json({ success: true, userId: user.id, username });
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
    
    if (!name) {
        return res.json({ success: false, error: 'Server name required' });
    }
    
    const serverId = generateId();
    const userId = 'demo-user'; // In real app, get from session
    
    servers.set(serverId, {
        id: serverId,
        name: name,
        owner: userId,
        members: [userId],
        createdAt: new Date()
    });
    
    messages.set(serverId, []);
    
    io.emit('server-created', { id: serverId, name });
    res.json({ success: true, serverId });
});

app.post('/api/servers/join', (req, res) => {
    const { serverId } = req.body;
    const userId = 'demo-user'; // In real app, get from session
    
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
    const serverMessages = messages.get(serverId) || [];
    res.json({ success: true, messages: serverMessages });
});

// Friend routes (simplified for demo)
app.get('/api/friends', (req, res) => {
    res.json({ success: true, friends: [] });
});

app.post('/api/friends/request', (req, res) => {
    res.json({ success: true, message: 'Friend request sent' });
});

app.get('/api/friends/requests', (req, res) => {
    res.json({ success: true, requests: [] });
});

app.post('/api/friends/accept', (req, res) => {
    res.json({ success: true, message: 'Friend request accepted' });
});

app.post('/api/friends/decline', (req, res) => {
    res.json({ success: true, message: 'Friend request declined' });
});

app.post('/api/block', (req, res) => {
    res.json({ success: true, message: 'User blocked' });
});

app.get('/api/dms', (req, res) => {
    res.json({ success: true, dms: [] });
});

app.get('/api/dms/:userId', (req, res) => {
    res.json({ success: true, messages: [] });
});

// Socket.io
io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);
    
    socket.on('user-joined', (user) => {
        onlineUsers.set(socket.id, user);
        console.log(`👋 ${user.username} joined`);
    });
    
    socket.on('send-server-message', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        const message = {
            id: generateId(),
            username: user.username,
            userId: user.id,
            content: data.content,
            timestamp: new Date(),
            serverId: data.serverId
        };
        
        const serverMessages = messages.get(data.serverId) || [];
        serverMessages.push(message);
        messages.set(data.serverId, serverMessages);
        
        io.emit('new-message', { serverId: data.serverId, message });
    });
    
    socket.on('send-dm', (data) => {
        const fromUser = onlineUsers.get(socket.id);
        if (!fromUser) return;
        
        const dmKey = [fromUser.id, data.toUserId].sort().join('_');
        const message = {
            id: generateId(),
            username: fromUser.username,
            userId: fromUser.id,
            content: data.content,
            timestamp: new Date()
        };
        
        const dmMessages = messages.get(dmKey) || [];
        dmMessages.push(message);
        messages.set(dmKey, dmMessages);
        
        io.emit('dm-message', {
            fromUserId: fromUser.id,
            toUserId: data.toUserId,
            message
        });
    });
    
    socket.on('disconnect', () => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            console.log(`👋 ${user.username} left`);
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
        online: onlineUsers.size 
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Enhanced Chat server running on port ${PORT}`);
    console.log(`📧 Open your Render URL in browser`);
    console.log(`🏠 Main page: /`);
    console.log(`💬 Chat app: /app or /chat`);
    console.log(`🔧 API health: /health`);
});
