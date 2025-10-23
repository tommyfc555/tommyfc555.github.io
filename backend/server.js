const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage
const licenseKeys = new Map();
const activatedKeys = new Map(); // HWID -> key data

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Utility functions
function generateLicenseKey(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < length; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key.match(/.{1,4}/g).join('-');
}

// ==================== SIMPLE KEY SYSTEM ====================

// Create license key
app.post('/api/create-key', (req, res) => {
    const { duration, uses, note } = req.body;
    
    if (!duration) {
        return res.status(400).json({ error: 'Duration is required' });
    }
    
    const key = generateLicenseKey();
    const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    
    const keyData = {
        key: key,
        duration: parseInt(duration),
        uses: parseInt(uses) || 1,
        used: 0,
        createdAt: new Date(),
        expiresAt: expiresAt,
        note: note || '',
        isActive: true
    };
    
    licenseKeys.set(key, keyData);
    
    console.log(`🔑 License key created: ${key} (${duration} days)`);
    
    res.json({
        success: true,
        message: 'License key created successfully',
        key: key,
        keyData: keyData
    });
});

// Get all keys
app.get('/api/keys', (req, res) => {
    const keysArray = Array.from(licenseKeys.values());
    
    res.json({
        success: true,
        keys: keysArray,
        total: keysArray.length,
        active: keysArray.filter(k => k.isActive).length,
        expired: keysArray.filter(k => new Date() > new Date(k.expiresAt)).length
    });
});

// Simple key validation
app.post('/api/validate-key', (req, res) => {
    const { key } = req.body;
    
    console.log('🔑 Key validation request:', key);
    
    if (!key) {
        return res.json({ valid: false, error: 'No key provided' });
    }
    
    const keyData = licenseKeys.get(key);
    if (!keyData) {
        return res.json({ valid: false, error: 'Invalid key' });
    }
    
    if (!keyData.isActive) {
        return res.json({ valid: false, error: 'Key is not active' });
    }
    
    if (new Date() > new Date(keyData.expiresAt)) {
        return res.json({ valid: false, error: 'Key has expired' });
    }
    
    if (keyData.used >= keyData.uses) {
        return res.json({ valid: false, error: 'Key has reached maximum uses' });
    }
    
    res.json({
        valid: true,
        duration: keyData.duration,
        uses: keyData.uses,
        used: keyData.used,
        expiresAt: keyData.expiresAt,
        note: keyData.note
    });
});

// Activate key
app.post('/api/activate-key', (req, res) => {
    const { key, hwid } = req.body;
    
    console.log('🎯 Key activation request:', { key, hwid });
    
    if (!key || !hwid) {
        return res.json({ success: false, error: 'Key and HWID required' });
    }
    
    const keyData = licenseKeys.get(key);
    if (!keyData) {
        return res.json({ success: false, error: 'Invalid key' });
    }
    
    if (!keyData.isActive) {
        return res.json({ success: false, error: 'Key is not active' });
    }
    
    if (new Date() > new Date(keyData.expiresAt)) {
        return res.json({ success: false, error: 'Key has expired' });
    }
    
    if (keyData.used >= keyData.uses) {
        return res.json({ success: false, error: 'Key has reached maximum uses' });
    }
    
    // Check if HWID already has an active key
    if (activatedKeys.has(hwid)) {
        const existing = activatedKeys.get(hwid);
        if (new Date() < new Date(existing.expiresAt)) {
            return res.json({ 
                success: false, 
                error: 'HWID already has an active key',
                existingKey: existing.key
            });
        }
    }
    
    // Mark key as used
    keyData.used += 1;
    keyData.lastUsed = new Date();
    keyData.usedBy = hwid;
    
    // Store activation
    const activationData = {
        key: key,
        hwid: hwid,
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + keyData.duration * 24 * 60 * 60 * 1000),
        duration: keyData.duration
    };
    
    activatedKeys.set(hwid, activationData);
    
    console.log(`✅ Key activated: ${key} by HWID: ${hwid}`);
    
    res.json({
        success: true,
        message: `Key activated for ${keyData.duration} days!`,
        duration: keyData.duration,
        expiresAt: activationData.expiresAt
    });
});

// Check access status
app.post('/api/check-access', (req, res) => {
    const { hwid } = req.body;
    
    if (!hwid) {
        return res.json({ hasAccess: false, error: 'HWID required' });
    }
    
    const activation = activatedKeys.get(hwid);
    
    if (activation) {
        const isActive = new Date() < new Date(activation.expiresAt);
        const daysLeft = isActive ? 
            Math.ceil((new Date(activation.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
        
        res.json({
            hasAccess: isActive,
            key: activation.key,
            activatedAt: activation.activatedAt,
            expiresAt: activation.expiresAt,
            daysLeft: daysLeft,
            duration: activation.duration
        });
    } else {
        res.json({ hasAccess: false });
    }
});

// Delete key
app.delete('/api/keys/:key', (req, res) => {
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

// ==================== PUBLIC ROUTES ====================
app.get('/api/status', (req, res) => {
    res.json({
        status: '🟢 Online',
        totalKeys: licenseKeys.size,
        activeActivations: Array.from(activatedKeys.values()).filter(a => 
            new Date() < new Date(a.expiresAt)
        ).length,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/test', (req, res) => {
    res.json({ 
        message: '✅ Server is working!',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        message: '🔑 Simple Key System API',
        version: '1.0.0',
        endpoints: {
            createKey: 'POST /api/create-key',
            validateKey: 'POST /api/validate-key',
            activateKey: 'POST /api/activate-key',
            checkAccess: 'POST /api/check-access',
            getKeys: 'GET /api/keys',
            status: 'GET /api/status'
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found: ' + req.originalUrl,
        availableEndpoints: {
            home: 'GET /',
            status: 'GET /api/status',
            createKey: 'POST /api/create-key',
            validateKey: 'POST /api/validate-key',
            activateKey: 'POST /api/activate-key'
        }
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('💥 Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: 'Something went wrong'
    });
});

// Cleanup expired activations
setInterval(() => {
    let cleaned = 0;
    const now = new Date();
    
    activatedKeys.forEach((activation, hwid) => {
        if (now > new Date(activation.expiresAt)) {
            activatedKeys.delete(hwid);
            cleaned++;
        }
    });
    
    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired activations`);
    }
}, 60 * 60 * 1000); // Every hour

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Simple Key System Started!');
    console.log('📍 Port:', PORT);
    console.log('🔑 Key System: Ready');
    console.log('⚡ Endpoints:');
    console.log('   POST /api/create-key    - Create license key');
    console.log('   POST /api/activate-key  - Activate key with HWID');
    console.log('   POST /api/validate-key  - Check if key is valid');
    console.log('   POST /api/check-access  - Check HWID access');
    console.log('');
    console.log('⚡ Server ready!');
});
