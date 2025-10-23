const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage
const users = new Map();
const activeSessions = new Map();
const licenseKeys = new Map();
const subscriptions = new Map();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Utility functions
function generateToken() {
    return 'token-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function generateLicenseKey(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < length; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key.match(/.{1,4}/g).join('-');
}

function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Access token required' });
    
    let user = null;
    let username = null;
    
    for (let [userName, userData] of users.entries()) {
        if (userData.token === token) {
            user = userData;
            username = userName;
            break;
        }
    }
    
    if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
    
    req.user = user;
    req.username = username;
    next();
}

// Admin middleware
function authenticateAdmin(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Access token required' });
    
    let user = null;
    let username = null;
    
    for (let [userName, userData] of users.entries()) {
        if (userData.token === token) {
            user = userData;
            username = userName;
            break;
        }
    }
    
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    if (!user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    
    req.user = user;
    req.username = username;
    next();
}

// ==================== AUTH ROUTES ====================
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
        password: password,
        hwid: hwid,
        createdAt: new Date(),
        lastLogin: null,
        isOnline: false,
        token: null,
        isAdmin: false,
        subscription: null,
        gameJoins: 0
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
    
    // Check password
    if (user.password !== password) {
        return res.status(400).json({ error: 'Invalid username or password' });
    }
    
    // HWID LOCK: Check if HWID matches
    if (user.hwid !== hwid) {
        console.log('🚫 HWID mismatch for user:', username);
        return res.status(403).json({ 
            error: 'ACCOUNT LOCKED TO ANOTHER DEVICE',
            details: 'This account can only be accessed from the original registration device.',
            solution: 'If this is your device, contact support. Otherwise, create a new account.'
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
        isAdmin: user.isAdmin,
        subscription: user.subscription
    });
});

// Check if user is admin
app.get('/api/auth/check-admin', authenticateToken, (req, res) => {
    const user = req.user;
    
    res.json({
        success: true,
        isAdmin: user.isAdmin || false,
        username: req.username
    });
});

// Get user dashboard data
app.get('/api/auth/dashboard', authenticateToken, (req, res) => {
    const user = req.user;
    const username = req.username;
    
    const hasActiveSub = user.subscription && new Date(user.subscription.expiresAt) > new Date();
    const daysLeft = hasActiveSub ? 
        Math.ceil((new Date(user.subscription.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
    
    res.json({
        success: true,
        user: {
            username: username,
            email: user.email,
            isAdmin: user.isAdmin || false,
            subscription: user.subscription,
            hasActiveSubscription: hasActiveSub,
            daysLeft: daysLeft,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            gameJoins: user.gameJoins || 0
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
            isOnline: user.isOnline,
            isAdmin: user.isAdmin
        }
    });
});

// ==================== LICENSE KEY ROUTES ====================
// Create license key (Admin only)
app.post('/api/admin/keys/create', authenticateAdmin, (req, res) => {
    const { duration, uses, note } = req.body;
    const createdBy = req.username;
    
    if (!duration) {
        return res.status(400).json({ error: 'Duration is required' });
    }
    
    const key = generateLicenseKey();
    const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    
    const keyData = {
        key: key,
        duration: duration,
        uses: uses || 1,
        used: 0,
        createdAt: new Date(),
        expiresAt: expiresAt,
        createdBy: createdBy,
        note: note || '',
        isActive: true
    };
    
    licenseKeys.set(key, keyData);
    
    console.log(`🔑 License key created by ${createdBy}: ${key}`);
    
    res.json({
        success: true,
        message: 'License key created successfully',
        key: key,
        keyData: keyData
    });
});

// Get all keys (Admin only)
app.get('/api/admin/keys', authenticateAdmin, (req, res) => {
    const keysArray = Array.from(licenseKeys.values());
    
    res.json({
        success: true,
        keys: keysArray,
        total: keysArray.length,
        active: keysArray.filter(k => k.isActive).length,
        expired: keysArray.filter(k => new Date() > new Date(k.expiresAt)).length
    });
});

// Delete license key (Admin only)
app.delete('/api/admin/keys/:key', authenticateAdmin, (req, res) => {
    const { key } = req.params;
    
    if (!licenseKeys.has(key)) {
        return res.status(404).json({ error: 'License key not found' });
    }
    
    licenseKeys.delete(key);
    
    res.json({
        success: true,
        message: 'License key deleted successfully'
    });
});

// Activate/Deactivate key (Admin only)
app.post('/api/admin/keys/:key/toggle', authenticateAdmin, (req, res) => {
    const { key } = req.params;
    
    const keyData = licenseKeys.get(key);
    if (!keyData) {
        return res.status(404).json({ error: 'License key not found' });
    }
    
    keyData.isActive = !keyData.isActive;
    
    res.json({
        success: true,
        message: `License key ${keyData.isActive ? 'activated' : 'deactivated'}`,
        isActive: keyData.isActive
    });
});

// Redeem license key
app.post('/api/auth/redeem', authenticateToken, (req, res) => {
    const { key } = req.body;
    const username = req.username;
    const user = req.user;
    
    if (!key) {
        return res.status(400).json({ error: 'License key is required' });
    }
    
    const keyData = licenseKeys.get(key);
    if (!keyData) {
        return res.status(404).json({ error: 'Invalid license key' });
    }
    
    if (!keyData.isActive) {
        return res.status(400).json({ error: 'License key is inactive' });
    }
    
    if (new Date() > new Date(keyData.expiresAt)) {
        return res.status(400).json({ error: 'License key has expired' });
    }
    
    if (keyData.used >= keyData.uses) {
        return res.status(400).json({ error: 'License key has reached maximum uses' });
    }
    
    // Check if user already has active subscription
    if (user.subscription && new Date(user.subscription.expiresAt) > new Date()) {
        return res.status(400).json({ error: 'You already have an active subscription' });
    }
    
    // Apply subscription
    const expiresAt = new Date(Date.now() + keyData.duration * 24 * 60 * 60 * 1000);
    user.subscription = {
        key: key,
        activatedAt: new Date(),
        expiresAt: expiresAt,
        duration: keyData.duration
    };
    
    // Update key usage
    keyData.used += 1;
    keyData.lastUsed = new Date();
    keyData.usedBy = username;
    
    // Store subscription
    subscriptions.set(username, user.subscription);
    
    console.log(`✅ License key redeemed by ${username}: ${key}`);
    
    res.json({
        success: true,
        message: `Subscription activated for ${keyData.duration} days!`,
        subscription: {
            expiresAt: expiresAt,
            duration: keyData.duration,
            key: key
        }
    });
});

// Check subscription status
app.get('/api/auth/subscription', authenticateToken, (req, res) => {
    const user = req.user;
    
    const hasActiveSub = user.subscription && new Date(user.subscription.expiresAt) > new Date();
    
    res.json({
        success: true,
        subscription: user.subscription,
        isActive: hasActiveSub,
        daysLeft: hasActiveSub ? 
            Math.ceil((new Date(user.subscription.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)) : 0
    });
});

// ==================== ADMIN ROUTES ====================
// Get all users (Admin only)
app.get('/api/admin/users', authenticateAdmin, (req, res) => {
    const userList = Array.from(users.entries()).map(([username, userData]) => ({
        username,
        email: userData.email,
        hwid: userData.hwid,
        createdAt: userData.createdAt,
        lastLogin: userData.lastLogin,
        isOnline: userData.isOnline,
        isAdmin: userData.isAdmin,
        subscription: userData.subscription,
        gameJoins: userData.gameJoins || 0
    }));
    
    res.json({
        success: true,
        users: userList,
        total: userList.length,
        online: userList.filter(u => u.isOnline).length
    });
});

// Make user admin (Admin only)
app.post('/api/admin/users/:username/make-admin', authenticateAdmin, (req, res) => {
    const { username } = req.params;
    
    const user = users.get(username);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    user.isAdmin = true;
    
    res.json({
        success: true,
        message: `${username} is now an admin`
    });
});

// Get admin stats
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
    const totalUsers = users.size;
    const onlineUsers = Array.from(users.values()).filter(u => u.isOnline).length;
    const totalKeys = licenseKeys.size;
    const activeSubs = Array.from(users.values()).filter(u => 
        u.subscription && new Date(u.subscription.expiresAt) > new Date()
    ).length;
    
    res.json({
        success: true,
        stats: {
            totalUsers,
            onlineUsers,
            totalKeys,
            activeSubscriptions: activeSubs,
            serverUptime: process.uptime()
        }
    });
});

// ==================== GAME ROUTES ====================
app.post('/api/game/join', authenticateToken, (req, res) => {
    const user = req.user;
    const { jobId } = req.body;
    
    // Check subscription
    if (!user.subscription || new Date(user.subscription.expiresAt) <= new Date()) {
        return res.status(403).json({ 
            error: 'Subscription required',
            details: 'You need an active subscription to join games'
        });
    }
    
    if (!jobId || !isValidUUID(jobId)) {
        return res.status(400).json({ error: 'Valid Job ID required' });
    }
    
    // Update user stats
    user.gameJoins = (user.gameJoins || 0) + 1;
    user.lastActive = new Date();
    
    res.json({
        success: true,
        message: `Joined game: ${jobId}`,
        jobId: jobId,
        timestamp: new Date().toISOString(),
        totalJoins: user.gameJoins
    });
});

// ==================== PUBLIC ROUTES ====================
app.get('/api/status', (req, res) => {
    res.json({
        status: '🟢 Online',
        users: users.size,
        online: Array.from(users.values()).filter(u => u.isOnline).length,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/test', (req, res) => {
    res.json({ 
        message: '✅ Backend is working!',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        message: '🔑 KeyAuth System API',
        version: '2.0.0',
        status: '🟢 Operational',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                redeem: 'POST /api/auth/redeem',
                subscription: 'GET /api/auth/subscription',
                dashboard: 'GET /api/auth/dashboard'
            },
            game: {
                join: 'POST /api/game/join'
            },
            admin: {
                users: 'GET /api/admin/users',
                keys: 'GET /api/admin/keys',
                createKey: 'POST /api/admin/keys/create',
                stats: 'GET /api/admin/stats'
            }
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

// Initialize with admin user
function initializeAdmin() {
    if (!users.has('admin')) {
        const adminHWID = 'admin-hwid-default';
        users.set('admin', {
            email: 'admin@system.com',
            password: 'admin123',
            hwid: adminHWID,
            createdAt: new Date(),
            isOnline: false,
            token: null,
            isAdmin: true,
            subscription: null,
            gameJoins: 0
        });
        console.log('👑 Admin user created: admin / admin123');
    }
}

// Cleanup expired subscriptions and sessions
setInterval(() => {
    let cleanedSubs = 0;
    let cleanedSessions = 0;
    
    // Clean expired subscriptions
    users.forEach(user => {
        if (user.subscription && new Date(user.subscription.expiresAt) <= new Date()) {
            user.subscription = null;
            cleanedSubs++;
        }
    });
    
    // Clean old sessions (24 hours)
    const now = new Date();
    activeSessions.forEach((session, token) => {
        if (now - session.loginTime > 24 * 60 * 60 * 1000) {
            const user = users.get(session.username);
            if (user) {
                user.isOnline = false;
                user.token = null;
            }
            activeSessions.delete(token);
            cleanedSessions++;
        }
    });
    
    if (cleanedSubs > 0 || cleanedSessions > 0) {
        console.log(`🧹 Cleaned ${cleanedSubs} expired subscriptions and ${cleanedSessions} old sessions`);
    }
}, 60 * 60 * 1000); // Every hour

// Start server
app.listen(PORT, '0.0.0.0', () => {
    initializeAdmin();
    console.log('🚀 KeyAuth Server Started!');
    console.log('📍 Port:', PORT);
    console.log('🔑 License System: Active');
    console.log('👑 Admin Panel: Ready');
    console.log('🔒 HWID Locking: Enabled');
    console.log('⚡ Server ready!');
});
