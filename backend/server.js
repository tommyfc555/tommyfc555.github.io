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

// Data storage with persistence
const DATA_FILE = 'data.json';

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return {
        users: new Map(Object.entries(data.users || {})),
        servers: new Map(Object.entries(data.servers || {})),
        messages: new Map(Object.entries(data.messages || {})),
        friendRequests: new Map(Object.entries(data.friendRequests || {}))
      };
    }
  } catch (error) {
    console.log('No existing data file, starting fresh');
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
    const data = {
      users: Object.fromEntries(users),
      servers: Object.fromEntries(servers),
      messages: Object.fromEntries(messages),
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
const activeCalls = new Map();

// Rate limiting configuration
const RATE_LIMITS = {
    message: { window: 1000, max: 10 },
    login: { window: 60000, max: 5 },
    register: { window: 60000, max: 3 },
    friendRequest: { window: 60000, max: 10 },
    serverCreate: { window: 60000, max: 2 }
};

// Enhanced profanity filter
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
app.use(express.static('public'));

// Enhanced Discord-like HTML for /app
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
        
        /* Server List */
        .server-list { width: 72px; background: #202225; display: flex; flex-direction: column; align-items: center; padding: 12px 0; }
        .server-icon { width: 48px; height: 48px; background: #36393f; border-radius: 50%; margin: 8px 0; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: border-radius 0.2s; }
        .server-icon:hover { border-radius: 16px; background: #7289da; }
        .server-icon.active { border-radius: 16px; background: #7289da; }
        
        /* Sidebar */
        .sidebar { width: 240px; background: #2f3136; display: flex; flex-direction: column; }
        .server-header { padding: 16px; border-bottom: 2px solid #202225; cursor: pointer; }
        .server-name { font-weight: bold; color: white; font-size: 16px; display: flex; align-items: center; justify-content: between; }
        .server-dropdown { margin-left: auto; }
        
        .channels { padding: 16px; flex: 1; overflow-y: auto; }
        .channel-category { color: #8e9297; font-size: 12px; font-weight: 600; margin: 16px 0 8px 0; text-transform: uppercase; display: flex; align-items: center; justify-content: space-between; }
        .channel { padding: 6px 8px; border-radius: 4px; margin: 2px 0; cursor: pointer; color: #8e9297; display: flex; align-items: center; }
        .channel:hover { background: #3c3f45; color: #dcddde; }
        .channel.active { background: #42464d; color: white; }
        .channel.hash { margin-right: 6px; font-size: 18px; }
        .channel.voice { margin-right: 6px; }
        
        .voice-users { padding: 8px 16px; }
        .voice-user { padding: 6px 8px; border-radius: 4px; margin: 2px 0; display: flex; align-items: center; color: #8e9297; }
        .voice-user.muted { opacity: 0.7; }
        .voice-user-speaker { width: 8px; height: 8px; background: #43b581; border-radius: 50%; margin-right: 8px; display: none; }
        .voice-user.speaking .voice-user-speaker { display: block; }
        .voice-user-avatar { width: 24px; height: 24px; background: #7289da; border-radius: 50%; margin-right: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
        
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
        .message-avatar { width: 40px; height: 40px; background: #7289da; border-radius: 50%; margin-right: 16px; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; cursor: pointer; }
        .message-content { flex: 1; }
        .message-header { display: flex; align-items: baseline; margin-bottom: 4px; }
        .message-username { font-weight: 600; color: white; margin-right: 8px; cursor: pointer; }
        .message-username:hover { text-decoration: underline; }
        .message-time { color: #72767d; font-size: 12px; }
        .message-text { color: #dcddde; line-height: 1.4; word-wrap: break-word; }
        .message.pinged { background: rgba(114, 137, 218, 0.1); border-radius: 4px; padding: 8px; margin: 4px -8px; }
        .message-mention { color: #7289da; background: rgba(114, 137, 218, 0.1); padding: 2px 4px; border-radius: 3px; cursor: pointer; }
        .message-mention:hover { background: rgba(114, 137, 218, 0.2); }
        
        .message-input-container { margin: 16px; background: #40444b; border-radius: 8px; position: relative; }
        .message-input { width: 100%; background: transparent; border: none; color: #dcddde; font-size: 16px; outline: none; padding: 12px 16px; resize: none; max-height: 200px; min-height: 44px; }
        .message-input::placeholder { color: #72767d; }
        .message-actions { padding: 8px 16px; display: flex; align-items: center; border-top: 1px solid #40444b; }
        .message-action { background: none; border: none; color: #b9bbbe; cursor: pointer; padding: 4px; margin-right: 8px; border-radius: 4px; }
        .message-action:hover { color: #dcddde; background: #4f545c; }
        
        /* File Upload */
        .file-upload { display: none; }
        .file-preview { padding: 8px 16px; border-top: 1px solid #40444b; }
        .file-item { display: flex; align-items: center; padding: 4px; background: #36393f; border-radius: 4px; margin: 4px 0; }
        .file-icon { margin-right: 8px; }
        .file-name { flex: 1; font-size: 14px; }
        .file-remove { background: none; border: none; color: #f04747; cursor: pointer; }
        
        /* Voice Chat */
        .voice-controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #2f3136; padding: 12px; border-radius: 8px; display: flex; gap: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 1000; }
        .voice-btn { width: 48px; height: 48px; border-radius: 50%; border: none; background: #4f545c; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: all 0.2s; }
        .voice-btn:hover { background: #5d6269; transform: scale(1.05); }
        .voice-btn.muted { background: #ed4245; }
        .voice-btn.deafened { background: #faa81a; }
        .voice-btn.screensharing { background: #43b581; }
        
        /* Screen Share */
        .screenshare-container { position: fixed; top: 20px; right: 20px; background: #2f3136; border-radius: 8px; padding: 12px; max-width: 400px; z-index: 999; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        .screenshare-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .screenshare-title { font-weight: 600; color: white; }
        .screenshare-close { background: none; border: none; color: #f04747; cursor: pointer; font-size: 18px; }
        .screenshare-video { width: 100%; max-width: 360px; border-radius: 4px; background: #000; }
        
        /* Loading */
        .loading { display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; background: #36393f; }
        .spinner { border: 3px solid #36393f; border-top: 3px solid #7289da; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 16px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        /* Scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #2e3338; }
        ::-webkit-scrollbar-thumb { background: #202225; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #1a1c20; }
        
        /* Notifications */
        .notification { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #7289da; color: white; padding: 12px 20px; border-radius: 4px; z-index: 2000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    </style>
</head>
<body>
    <div id="loadingScreen" class="loading">
        <div class="spinner"></div>
        <div>Loading Discord-like Chat...</div>
    </div>

    <div id="app" class="app-container" style="display: none;">
        <!-- Server List -->
        <div class="server-list" id="serverList">
            <div class="server-icon active" onclick="switchServer('default')" title="General Server">
                <span>GS</span>
            </div>
        </div>
        
        <!-- Sidebar -->
        <div class="sidebar">
            <div class="server-header" onclick="toggleServerDropdown()">
                <div class="server-name">
                    <span id="currentServerName">General Server</span>
                    <span class="server-dropdown">▼</span>
                </div>
            </div>
            
            <div class="channels">
                <div class="channel-category">
                    <span>TEXT CHANNELS</span>
                </div>
                <div class="channel active" onclick="switchChannel('general')">
                    <span class="channel hash">#</span>
                    <span>general</span>
                </div>
                <div class="channel" onclick="switchChannel('chat')">
                    <span class="channel hash">#</span>
                    <span>chat</span>
                </div>
                
                <div class="channel-category" style="margin-top: 20px;">
                    <span>VOICE CHANNELS</span>
                </div>
                <div class="channel" onclick="joinVoiceChannel('general-voice')">
                    <span class="channel voice">🔊</span>
                    <span>General Voice</span>
                </div>
                <div class="channel" onclick="joinVoiceChannel('lounge')">
                    <span class="channel voice">🔊</span>
                    <span>Lounge</span>
                </div>
                
                <!-- Voice Users -->
                <div class="voice-users" id="voiceUsers" style="display: none;">
                    <div class="channel-category">
                        <span>IN VOICE CHANNEL</span>
                    </div>
                    <div id="voiceUsersList"></div>
                </div>
            </div>
            
            <div class="user-panel">
                <div class="user-avatar" id="userAvatar">U</div>
                <div class="user-info">
                    <div class="username" id="currentUsername">User</div>
                    <div class="user-tag" id="userTag">#0000</div>
                </div>
                <div class="voice-controls-mini">
                    <button class="voice-btn" onclick="toggleMute()" id="muteBtn" title="Mute">🎤</button>
                    <button class="voice-btn" onclick="toggleDeafen()" id="deafenBtn" title="Deafen">🔇</button>
                </div>
            </div>
        </div>
        
        <!-- Main Chat -->
        <div class="main-chat">
            <div class="chat-header">
                <div class="chat-header-hash">#</div>
                <div class="chat-header-name" id="currentChannelName">general</div>
            </div>
            
            <div class="messages" id="messagesContainer">
                <div class="message">
                    <div class="message-avatar">S</div>
                    <div class="message-content">
                        <div class="message-header">
                            <div class="message-username">System</div>
                            <div class="message-time">Just now</div>
                        </div>
                        <div class="message-text">Welcome to the server! Type @username to ping someone. You can also share your screen and join voice channels!</div>
                    </div>
                </div>
            </div>
            
            <div class="message-input-container">
                <textarea class="message-input" placeholder="Message #general" id="messageInput" maxlength="2000" rows="1"></textarea>
                <div class="file-preview" id="filePreview"></div>
                <div class="message-actions">
                    <button class="message-action" onclick="openFilePicker()" title="Upload File">📎</button>
                    <button class="message-action" onclick="showEmojiPicker()" title="Add Emoji">😊</button>
                    <button class="message-action" onclick="sendMessage()" title="Send Message" style="margin-left: auto;">➤</button>
                </div>
            </div>
        </div>
        
        <!-- Voice Controls -->
        <div class="voice-controls" id="voiceControls" style="display: none;">
            <button class="voice-btn" onclick="toggleMute()" id="muteBtnBig" title="Mute/Unmute">🎤</button>
            <button class="voice-btn" onclick="toggleDeafen()" id="deafenBtnBig" title="Deafen/Undeafen">🔇</button>
            <button class="voice-btn" onclick="toggleScreenShare()" id="screenShareBtn" title="Share Screen">🖥️</button>
            <button class="voice-btn" onclick="leaveVoiceChannel()" id="leaveVoiceBtn" title="Leave Voice Call" style="background: #ed4245;">📞</button>
        </div>
        
        <!-- Screen Share Container -->
        <div class="screenshare-container" id="screenshareContainer" style="display: none;">
            <div class="screenshare-header">
                <div class="screenshare-title" id="screenshareTitle">Screen Share</div>
                <button class="screenshare-close" onclick="stopScreenShare()">×</button>
            </div>
            <video id="screenshareVideo" class="screenshare-video" autoplay muted></video>
        </div>
        
        <!-- Hidden File Input -->
        <input type="file" id="fileInput" class="file-upload" multiple accept="image/*,video/*,.pdf,.txt,.mp3,.wav">
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let currentUser = null;
        let currentServer = 'default';
        let currentChannel = 'general';
        let isInVoice = false;
        let isMuted = false;
        let isDeafened = false;
        let isScreenSharing = false;
        let localStream = null;
        let screenStream = null;
        let peerConnections = new Map();
        let filesToUpload = [];
        
        // WebRTC configuration
        const rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
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
            
            // Load existing messages
            loadChannelMessages();
            
            // Show app
            document.getElementById('loadingScreen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            
            // Socket events
            socket.emit('user-joined', { userId, username });
            
            socket.on('new-message', (data) => {
                if (data.serverId === currentServer && data.channelId === currentChannel) {
                    addMessage(data.message);
                }
            });
            
            socket.on('user-pinged', (data) => {
                if (data.message.pings.includes(currentUser.username.toLowerCase())) {
                    playPingSound();
                    showNotification(\`\${data.message.username} mentioned you!\`);
                    
                    if (data.serverId === currentServer && data.channelId === currentChannel) {
                        addMessage(data.message, true);
                    }
                }
            });
            
            socket.on('voice-user-joined', (data) => {
                updateVoiceUsers();
                showNotification(\`\${data.username} joined voice chat\`);
            });
            
            socket.on('voice-user-left', (data) => {
                updateVoiceUsers();
                removePeerConnection(data.userId);
            });
            
            socket.on('voice-user-updated', (data) => {
                updateVoiceUsers();
            });
            
            socket.on('screenshare-started', (data) => {
                showNotification(\`\${data.username} started screen sharing\`);
                if (data.userId !== currentUser.id) {
                    setupScreenShareViewer(data);
                }
            });
            
            socket.on('screenshare-stopped', (data) => {
                if (data.userId !== currentUser.id) {
                    stopScreenShareViewer(data.userId);
                }
            });
            
            socket.on('webrtc-offer', async (data) => {
                await handleOffer(data);
            });
            
            socket.on('webrtc-answer', async (data) => {
                await handleAnswer(data);
            });
            
            socket.on('webrtc-ice-candidate', async (data) => {
                await handleIceCandidate(data);
            });
            
            // Request notification permission
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }
            
            // Message input handler
            const messageInput = document.getElementById('messageInput');
            messageInput.addEventListener('input', autoResize);
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
            
            // File input handler
            document.getElementById('fileInput').addEventListener('change', handleFileSelect);
        }
        
        function autoResize() {
            const textarea = this;
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        }
        
        async function loadChannelMessages() {
            try {
                const response = await fetch(\`/api/servers/\${currentServer}/messages?channelId=\${currentChannel}\`);
                const data = await response.json();
                
                if (data.success && data.messages) {
                    const container = document.getElementById('messagesContainer');
                    container.innerHTML = '';
                    
                    data.messages.forEach(message => {
                        addMessage(message);
                    });
                }
            } catch (error) {
                console.error('Error loading messages:', error);
            }
        }
        
        function sendMessage() {
            const input = document.getElementById('messageInput');
            const content = input.value.trim();
            
            if (!content && filesToUpload.length === 0) return;
            
            const messageData = {
                serverId: currentServer,
                channelId: currentChannel,
                content: content,
                attachments: filesToUpload
            };
            
            socket.emit('send-server-message', messageData);
            
            input.value = '';
            input.style.height = 'auto';
            clearFilePreview();
        }
        
        function addMessage(message, isPinged = false) {
            const container = document.getElementById('messagesContainer');
            const messageEl = document.createElement('div');
            messageEl.className = 'message' + (isPinged ? ' pinged' : '');
            
            const time = new Date(message.timestamp).toLocaleTimeString();
            
            let attachmentsHTML = '';
            if (message.attachments && message.attachments.length > 0) {
                message.attachments.forEach(att => {
                    if (att.type.startsWith('image/')) {
                        attachmentsHTML += \`<div style="margin-top: 8px;"><img src="\${att.url}" style="max-width: 400px; border-radius: 4px; cursor: pointer;" onclick="openImageModal('\${att.url}')" /></div>\`;
                    } else {
                        attachmentsHTML += \`<div style="margin-top: 8px; padding: 8px; background: #2f3136; border-radius: 4px; display: flex; align-items: center;">
                            <span style="margin-right: 8px;">📎</span>
                            <a href="\${att.url}" target="_blank" style="color: #7289da; text-decoration: none;">\${att.name}</a>
                        </div>\`;
                    }
                });
            }
            
            messageEl.innerHTML = \`
                <div class="message-avatar" onclick="mentionUser('\${message.username}')">\${message.username.charAt(0).toUpperCase()}</div>
                <div class="message-content">
                    <div class="message-header">
                        <div class="message-username" onclick="mentionUser('\${message.username}')">\${message.username}</div>
                        <div class="message-time">\${time}</div>
                    </div>
                    <div class="message-text">\${formatMessage(message.content)}</div>
                    \${attachmentsHTML}
                </div>
            \`;
            
            container.appendChild(messageEl);
            container.scrollTop = container.scrollHeight;
        }
        
        function formatMessage(content) {
            if (!content) return '';
            return content.replace(/@(\w+)/g, '<span class="message-mention" onclick="mentionUser(\'$1\')">@$1</span>');
        }
        
        function mentionUser(username) {
            const input = document.getElementById('messageInput');
            input.value = input.value + \`@\${username} \`;
            input.focus();
        }
        
        function playPingSound() {
            const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==');
            audio.volume = 0.3;
            audio.play().catch(() => {});
        }
        
        function showNotification(message) {
            if (Notification.permission === 'granted') {
                new Notification('Discord Chat', { body: message, icon: '/favicon.ico' });
            }
            
            // Show in-app notification
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
        
        // Voice Chat Functions
        async function joinVoiceChannel(channelId) {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({ 
                    video: false, 
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                
                isInVoice = true;
                document.getElementById('voiceControls').style.display = 'flex';
                document.getElementById('voiceUsers').style.display = 'block';
                
                socket.emit('join-voice', { 
                    serverId: currentServer,
                    channelId: channelId 
                });
                
                updateVoiceUsers();
                setupVoiceConnections();
                
            } catch (error) {
                console.error('Error accessing microphone:', error);
                alert('Could not access microphone. Please check permissions.');
            }
        }
        
        function leaveVoiceChannel() {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                localStream = null;
            }
            
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
                screenStream = null;
            }
            
            isInVoice = false;
            isScreenSharing = false;
            document.getElementById('voiceControls').style.display = 'none';
            document.getElementById('voiceUsers').style.display = 'none';
            document.getElementById('screenshareContainer').style.display = 'none';
            
            socket.emit('leave-voice', { 
                serverId: currentServer,
                channelId: 'general-voice' 
            });
            
            peerConnections.forEach(pc => pc.close());
            peerConnections.clear();
        }
        
        function toggleMute() {
            if (!localStream) return;
            
            const audioTracks = localStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            
            isMuted = !track.enabled;
            document.getElementById('muteBtn').classList.toggle('muted', isMuted);
            document.getElementById('muteBtnBig').classList.toggle('muted', isMuted);
            document.getElementById('muteBtnBig').textContent = isMuted ? '🎤❌' : '🎤';
            
            socket.emit('voice-toggle-mute', { 
                serverId: currentServer,
                channelId: 'general-voice',
                muted: isMuted
            });
        }
        
        function toggleDeafen() {
            isDeafened = !isDeafened;
            document.getElementById('deafenBtn').classList.toggle('deafened', isDeafened);
            document.getElementById('deafenBtnBig').classList.toggle('deafened', isDeafened);
            document.getElementById('deafenBtnBig').textContent = isDeafened ? '🔇❌' : '🔇';
            
            // Mute all audio outputs when deafened
            peerConnections.forEach(pc => {
                const audioElements = document.querySelectorAll(\`audio[data-user-id="\${pc.userId}"]\`);
                audioElements.forEach(audio => {
                    audio.muted = isDeafened;
                });
            });
        }
        
        async function toggleScreenShare() {
            if (isScreenSharing) {
                await stopScreenShare();
            } else {
                await startScreenShare();
            }
        }
        
        async function startScreenShare() {
            try {
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: 'always' },
                    audio: true
                });
                
                isScreenSharing = true;
                document.getElementById('screenShareBtn').classList.add('screensharing');
                document.getElementById('screenshareContainer').style.display = 'block';
                document.getElementById('screenshareTitle').textContent = \`\${currentUser.username}'s Screen\`;
                
                const video = document.getElementById('screenshareVideo');
                video.srcObject = screenStream;
                
                socket.emit('start-screenshare', { 
                    serverId: currentServer,
                    channelId: 'general-voice'
                });
                
                // Add screen track to existing peer connections
                peerConnections.forEach(pc => {
                    if (pc.addTrack && screenStream.getVideoTracks().length > 0) {
                        pc.addTrack(screenStream.getVideoTracks()[0], screenStream);
                    }
                });
                
                screenStream.getVideoTracks()[0].onended = () => {
                    stopScreenShare();
                };
                
            } catch (error) {
                console.error('Error sharing screen:', error);
            }
        }
        
        async function stopScreenShare() {
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
                screenStream = null;
            }
            
            isScreenSharing = false;
            document.getElementById('screenShareBtn').classList.remove('screensharing');
            document.getElementById('screenshareContainer').style.display = 'none';
            
            socket.emit('stop-screenshare', { 
                serverId: currentServer,
                channelId: 'general-voice'
            });
        }
        
        function setupScreenShareViewer(data) {
            // This would set up viewing someone else's screen share
            console.log('Setting up screen share viewer for:', data.username);
        }
        
        function stopScreenShareViewer(userId) {
            console.log('Stopping screen share viewer for:', userId);
        }
        
        function updateVoiceUsers() {
            // This would update the voice users list from server data
            const usersList = document.getElementById('voiceUsersList');
            usersList.innerHTML = '<div class="voice-user"><div class="voice-user-avatar">Y</div><span>You</span></div>';
        }
        
        // WebRTC Functions
        async function setupVoiceConnections() {
            // Initialize WebRTC connections with other users in voice channel
            // This is a simplified version - real implementation would be more complex
        }
        
        async function handleOffer(data) {
            // Handle incoming WebRTC offer
        }
        
        async function handleAnswer(data) {
            // Handle incoming WebRTC answer
        }
        
        async function handleIceCandidate(data) {
            // Handle incoming ICE candidate
        }
        
        function removePeerConnection(userId) {
            if (peerConnections.has(userId)) {
                peerConnections.get(userId).close();
                peerConnections.delete(userId);
            }
        }
        
        // File Handling
        function openFilePicker() {
            document.getElementById('fileInput').click();
        }
        
        function handleFileSelect(event) {
            filesToUpload = Array.from(event.target.files);
            updateFilePreview();
        }
        
        function updateFilePreview() {
            const preview = document.getElementById('filePreview');
            preview.innerHTML = '';
            
            filesToUpload.forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = \`
                    <span class="file-icon">\${getFileIcon(file.type)}</span>
                    <span class="file-name">\${file.name}</span>
                    <button class="file-remove" onclick="removeFile(\${index})">×</button>
                \`;
                preview.appendChild(fileItem);
            });
        }
        
        function getFileIcon(type) {
            if (type.startsWith('image/')) return '🖼️';
            if (type.startsWith('video/')) return '🎥';
            if (type.startsWith('audio/')) return '🎵';
            if (type === 'application/pdf') return '📄';
            return '📎';
        }
        
        function removeFile(index) {
            filesToUpload.splice(index, 1);
            updateFilePreview();
        }
        
        function clearFilePreview() {
            filesToUpload = [];
            document.getElementById('filePreview').innerHTML = '';
            document.getElementById('fileInput').value = '';
        }
        
        // UI Functions
        function switchServer(serverId) {
            currentServer = serverId;
            switchChannel('general');
            document.querySelectorAll('.server-icon').forEach(icon => icon.classList.remove('active'));
            event.target.closest('.server-icon').classList.add('active');
        }
        
        function switchChannel(channelName) {
            currentChannel = channelName;
            document.querySelectorAll('.channel').forEach(ch => ch.classList.remove('active'));
            event.target.closest('.channel').classList.add('active');
            document.getElementById('currentChannelName').textContent = channelName;
            document.getElementById('messageInput').placeholder = \`Message #\${channelName}\`;
            loadChannelMessages();
        }
        
        function toggleServerDropdown() {
            // Implement server dropdown menu
        }
        
        function showEmojiPicker() {
            // Implement emoji picker
            alert('Emoji picker would open here');
        }
        
        function openImageModal(url) {
            window.open(url, '_blank');
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
        online: onlineUsers.size,
        voiceChannels: voiceChannels.size
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
        friends: [],
        avatar: null,
        status: 'online'
    });
    
    // Create default server if none exists
    if (servers.size === 0) {
        const serverId = 'default';
        servers.set(serverId, {
            id: serverId,
            name: 'General Server',
            owner: userId,
            members: [userId],
            channels: ['general', 'chat'],
            voiceChannels: ['general-voice', 'lounge'],
            createdAt: new Date()
        });
        
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
        
        voiceChannels.set('lounge', {
            id: 'lounge',
            serverId: serverId,
            name: 'Lounge',
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
        
        console.log(`👋 ${userData.username} joined`);
        
        // Update user status
        const user = users.get(userData.username.toLowerCase());
        if (user) {
            user.status = 'online';
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
        const serverMessages = messages.get(data.serverId) || new Map();
        const channelMessages = serverMessages.get(data.channelId) || [];
        channelMessages.push(message);
        serverMessages.set(data.channelId, channelMessages);
        messages.set(data.serverId, serverMessages);
        
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
            
            socket.join(`voice-${data.channelId}`);
            
            io.emit('voice-user-joined', {
                userId: user.id,
                username: user.username,
                channelId: data.channelId
            });
            
            // Send current voice users to the new member
            const voiceUsers = Array.from(voiceChannel.members.values()).map(member => ({
                id: member.id,
                username: member.username,
                muted: member.muted,
                deafened: member.deafened,
                speaking: member.speaking
            }));
            
            socket.emit('voice-users-update', {
                channelId: data.channelId,
                users: voiceUsers
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
            
            io.emit('voice-user-left', { 
                userId: user.id,
                channelId: data.channelId
            });
        }
    });
    
    socket.on('voice-toggle-mute', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        const voiceChannel = voiceChannels.get(data.channelId);
        if (voiceChannel && voiceChannel.members.has(user.id)) {
            const member = voiceChannel.members.get(user.id);
            member.muted = data.muted;
            
            io.emit('voice-user-updated', {
                userId: user.id,
                username: user.username,
                muted: member.muted,
                deafened: member.deafened,
                channelId: data.channelId
            });
        }
    });
    
    socket.on('voice-toggle-deafen', (data) => {
        const user = onlineUsers.get(socket.id);
        if (!user) return;
        
        const voiceChannel = voiceChannels.get(data.channelId);
        if (voiceChannel && voiceChannel.members.has(user.id)) {
            const member = voiceChannel.members.get(user.id);
            member.deafened = data.deafened;
            
            io.emit('voice-user-updated', {
                userId: user.id,
                username: user.username,
                muted: member.muted,
                deafened: member.deafened,
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
            
            console.log(`🖥️ ${user.username} started screen sharing`);
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
            
            console.log(`🖥️ ${user.username} stopped screen sharing`);
        }
    });
    
    // WebRTC signaling
    socket.on('webrtc-offer', (data) => {
        socket.to(data.targetSocketId).emit('webrtc-offer', {
            offer: data.offer,
            socketId: socket.id
        });
    });
    
    socket.on('webrtc-answer', (data) => {
        socket.to(data.targetSocketId).emit('webrtc-answer', {
            answer: data.answer
        });
    });
    
    socket.on('webrtc-ice-candidate', (data) => {
        socket.to(data.targetSocketId).emit('webrtc-ice-candidate', {
            candidate: data.candidate
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
            
            onlineUsers.delete(socket.id);
        }
    });
});

// Auto-save data every 30 seconds
setInterval(saveData, 30000);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Enhanced Discord Chat running on port ${PORT}`);
    console.log(`🔒 Features: Voice chat, screen sharing, file sharing, ping system`);
    console.log(`💾 Data persistence enabled`);
    console.log(`👉 Open: https://tommyfc555-github-io.onrender.com`);
});
