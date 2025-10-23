const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage (replace with database in production)
const users = new Map();
const activeSessions = new Map();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Utility function to validate UUID
function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

// Generate secure token
function generateToken() {
    return 'token-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    // Find user by token
    let user = null;
    let username = null;
    
    for (let [userName, userData] of users.entries()) {
        if (userData.token === token) {
            user = userData;
            username = userName;
            break;
        }
    }
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    req.username = username;
    next();
}

// Test route
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Backend is working!',
        timestamp: new Date().toISOString(),
        usersCount: users.size
    });
});

// Get server status
app.get('/api/status', (req, res) => {
    res.json({
        status: '🟢 Online',
        users: users.size,
        activeSessions: activeSessions.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Register route with HWID locking
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, hwid } = req.body;
    
    console.log('📝 Register attempt:', { username, email, hwid });
    
    // Validation
    if (!username || !password || !hwid) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (username.length > 20) {
        return res.status(400).json({ error: 'Username must be less than 20 characters' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    if (email && !email.includes('@')) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Check if user already exists
    if (users.has(username)) {
        return res.status(400).json({ error: 'Username already taken' });
    }
    
    // Check if HWID is already registered to another account
    for (let [existingUser, userData] of users.entries()) {
        if (userData.hwid === hwid) {
            return res.status(400).json({ 
                error: 'This device is already registered to another account',
                details: `Device is locked to username: ${existingUser}`
            });
        }
    }
    
    // Create user account
    const userData = {
        email: email || '',
        password: password, // In production, hash this with bcrypt!
        hwid: hwid,
        createdAt: new Date(),
        lastLogin: null,
        isOnline: false,
        token: null,
        gameJoins: 0,
        lastActive: new Date()
    };
    
    users.set(username, userData);
    
    console.log('✅ User registered:', username);
    
    // Success response
    res.json({ 
        success: true,
        message: 'Account created and locked to this device!',
        token: generateToken(),
        username: username,
        hwid: hwid
    });
});

// Login route with HWID verification
app.post('/api/auth/login', (req, res) => {
    const { username, password, hwid } = req.body;
    
    console.log('🔐 Login attempt:', { username, hwid });
    
    // Validation
    if (!username || !password || !hwid) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user exists
    const user = users.get(username);
    if (!user) {
        return res.status(400).json({ error: 'Invalid username or password' });
    }
    
    // Check password (in production, use bcrypt.compare)
    if (user.password !== password) {
        return res.status(400).json({ error: 'Invalid username or password' });
    }
    
    // HWID LOCK: Check if HWID matches
    if (user.hwid !== hwid) {
        console.log('🚫 HWID mismatch for user:', username);
        return res.status(403).json({ 
            error: 'ACCOUNT LOCKED TO ANOTHER DEVICE',
            details: 'This account can only be accessed from the original registration device.',
            solution: 'If this is your device, contact support. Otherwise, create a new account.',
            registeredHWID: user.hwid.substring(0, 20) + '...', // Partial for security
            attemptedHWID: hwid.substring(0, 20) + '...'
        });
    }
    
    // Check if user is already logged in elsewhere
    if (user.isOnline) {
        return res.status(409).json({ 
            error: 'Account is already active',
            details: 'This account is currently logged in on another session.'
        });
    }
    
    // Update user status
    const token = generateToken();
    user.isOnline = true;
    user.lastLogin = new Date();
    user.lastActive = new Date();
    user.token = token;
    
    // Track active session
    activeSessions.set(token, {
        username: username,
        loginTime: new Date(),
        hwid: hwid
    });
    
    console.log('✅ User logged in:', username);
    
    // Success response
    res.json({ 
        success: true,
        message: 'Login successful! Device verified.',
        token: token,
        username: username,
        profile: {
            email: user.email,
            createdAt: user.createdAt,
            gameJoins: user.gameJoins
        }
    });
});

// Logout route
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    const { username, user } = req;
    
    user.isOnline = false;
    user.token = null;
    activeSessions.delete(req.headers.authorization.replace('Bearer ', ''));
    
    console.log('👋 User logged out:', username);
    
    res.json({ 
        success: true,
        message: 'Logged out successfully'
    });
});

// Get user profile
app.get('/api/auth/profile', authenticateToken, (req, res) => {
    const { username, user } = req;
    
    res.json({
        success: true,
        profile: {
            username: username,
            email: user.email,
            hwid: user.hwid,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            gameJoins: user.gameJoins,
            isOnline: user.isOnline
        }
    });
});

// Join game endpoint
app.post('/api/game/join', authenticateToken, (req, res) => {
    const { username, user } = req;
    const { jobId } = req.body;
    
    console.log('🎮 Game join attempt:', { username, jobId });
    
    if (!jobId) {
        return res.status(400).json({ error: 'Job ID is required' });
    }
    
    if (!isValidUUID(jobId)) {
        return res.status(400).json({ error: 'Invalid Job ID format. Must be UUID.' });
    }
    
    // Update user stats
    user.gameJoins = (user.gameJoins || 0) + 1;
    user.lastActive = new Date();
    
    // Simulate game joining process
    const joinResult = {
        success: true,
        message: `Successfully joined game with Job ID: ${jobId}`,
        joinData: {
            jobId: jobId,
            timestamp: new Date().toISOString(),
            server: `GameServer-${Math.floor(Math.random() * 1000)}`,
            position: Math.floor(Math.random() * 20) + 1
        },
        userStats: {
            totalJoins: user.gameJoins,
            lastJoin: user.lastActive
        }
    };
    
    console.log('✅ Game joined by:', username, 'Job ID:', jobId);
    
    res.json(joinResult);
});

// Get user statistics
app.get('/api/user/stats', authenticateToken, (req, res) => {
    const { username, user } = req;
    
    res.json({
        success: true,
        stats: {
            username: username,
            totalJoins: user.gameJoins || 0,
            accountAge: Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)) + ' days',
            lastActive: user.lastActive,
            status: user.isOnline ? '🟢 Online' : '🔴 Offline',
            hwidLock: '🔒 Enabled'
        }
    });
});

// Admin route - Get all users (for monitoring)
app.get('/api/admin/users', (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    
    // Simple admin authentication
    if (adminKey !== 'secret-admin-key-123') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const userList = [];
    users.forEach((userData, username) => {
        userList.push({
            username,
            email: userData.email,
            hwid: userData.hwid,
            createdAt: userData.createdAt,
            lastLogin: userData.lastLogin,
            isOnline: userData.isOnline,
            gameJoins: userData.gameJoins || 0
        });
    });
    
    res.json({
        totalUsers: users.size,
        activeSessions: activeSessions.size,
        users: userList
    });
});

// Cleanup inactive sessions (runs every 5 minutes)
setInterval(() => {
    const now = new Date();
    let cleaned = 0;
    
    activeSessions.forEach((session, token) => {
        // If session older than 24 hours, clean it up
        if (now - session.loginTime > 24 * 60 * 60 * 1000) {
            const user = users.get(session.username);
            if (user) {
                user.isOnline = false;
                user.token = null;
            }
            activeSessions.delete(token);
            cleaned++;
        }
    });
    
    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} inactive sessions`);
    }
}, 5 * 60 * 1000);

// Root route
app.get('/', (req, res) => {
    res.json({ 
        message: '🎮 Roblox Joiner Backend API',
        version: '1.0.0',
        status: '🟢 Operational',
        endpoints: {
            test: 'GET /api/test',
            status: 'GET /api/status',
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login',
            profile: 'GET /api/auth/profile',
            joinGame: 'POST /api/game/join',
            userStats: 'GET /api/user/stats',
            logout: 'POST /api/auth/logout'
        },
        security: {
            hwidLocking: 'Enabled',
            deviceBinding: 'Strict',
            sessionManagement: 'Active'
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found: ' + req.originalUrl,
        availableEndpoints: {
            home: 'GET /',
            test: 'GET /api/test',
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login'
        }
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('💥 Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    console.log(`📊 Final stats - Users: ${users.size}, Active sessions: ${activeSessions.size}`);
    process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Roblox Joiner Server Started!');
    console.log('📍 Port:', PORT);
    console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
    console.log('🔒 HWID Locking: Enabled');
    console.log('💾 Storage: In-Memory (' + users.size + ' users)');
    console.log('📊 Endpoints:');
    console.log('   GET  /              - Server info');
    console.log('   GET  /api/test      - Test endpoint');
    console.log('   POST /api/auth/register - Register user');
    console.log('   POST /api/auth/login    - Login with HWID check');
    console.log('   POST /api/game/join     - Join Roblox game');
    console.log('');
    console.log('⚡ Server ready! Waiting for connections...');
});
