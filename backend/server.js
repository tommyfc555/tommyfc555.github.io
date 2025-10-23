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
    
    if (!username || !password || !hwid) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (users.has(username)) {
        return res.status(400).json({ error: 'Username already taken' });
    }
    
    // Check HWID uniqueness
    for (let userData of users.values()) {
        if (userData.hwid === hwid) {
            return res.status(400).json({ error: 'This device is already registered' });
        }
    }
    
    const userData = {
        email: email || '',
        password: password,
        hwid: hwid,
        createdAt: new Date(),
        isOnline: false,
        token: null,
        isAdmin: false, // Default to non-admin
        subscription: null
    };
    
    users.set(username, userData);
    
    res.json({ 
        success: true,
        message: 'Account created!',
        token: generateToken(),
        username: username
    });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password, hwid } = req.body;
    
    const user = users.get(username);
    if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    if (user.password !== password) {
        return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    if (user.hwid !== hwid) {
        return res.status(403).json({ error: 'Account locked to another device' });
    }
    
    const token = generateToken();
    user.isOnline = true;
    user.token = token;
    user.lastLogin = new Date();
    
    activeSessions.set(token, { username, loginTime: new Date() });
    
    res.json({ 
        success: true,
        message: 'Login successful!',
        token: token,
        username: username,
        isAdmin: user.isAdmin,
        subscription: user.subscription
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
    const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000); // Convert days to ms
    
    const keyData = {
        key: key,
        duration: duration, // in days
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
        subscription: userData.subscription
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
    
    res.json({
        success: true,
        message: `Joined game: ${jobId}`,
        jobId: jobId,
        timestamp: new Date().toISOString()
    });
});

// ==================== PUBLIC ROUTES ====================
app.get('/api/status', (req, res) => {
    res.json({
        status: '🟢 Online',
        users: users.size,
        online: Array.from(users.values()).filter(u => u.isOnline).length,
        uptime: process.uptime()
    });
});

app.get('/', (req, res) => {
    res.json({
        message: '🔑 KeyAuth System API',
        version: '2.0.0',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                redeem: 'POST /api/auth/redeem',
                subscription: 'GET /api/auth/subscription'
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

// Initialize with admin user
function initializeAdmin() {
    if (!users.has('admin')) {
        const adminHWID = 'admin-hwid-default';
        users.set('admin', {
            email: 'admin@system.com',
            password: 'admin123', // Change this!
            hwid: adminHWID,
            createdAt: new Date(),
            isOnline: false,
            token: null,
            isAdmin: true,
            subscription: null
        });
        console.log('👑 Admin user created: admin / admin123');
    }
}

// Cleanup expired subscriptions
setInterval(() => {
    let cleaned = 0;
    users.forEach(user => {
        if (user.subscription && new Date(user.subscription.expiresAt) <= new Date()) {
            user.subscription = null;
            cleaned++;
        }
    });
    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired subscriptions`);
    }
}, 60 * 60 * 1000); // Every hour

app.listen(PORT, '0.0.0.0', () => {
    initializeAdmin();
    console.log('🚀 KeyAuth Server Started!');
    console.log('📍 Port:', PORT);
    console.log('🔑 License System: Active');
    console.log('👑 Admin Panel: Ready');
    console.log('⚡ Server ready!');
});
