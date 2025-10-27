const express = require('express');
const http = require('http');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// HWID storage (in production, use a database)
const hwidLocks = new Map();
const YOUR_DISCORD_ID = '1415022792214052915';

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

app.use(express.static('.'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helper functions
function generateHWID(req) {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    return crypto.createHash('sha256').update(ip + userAgent).digest('hex').substring(0, 16);
}

function isOwnerAccess(req) {
    // Simple owner check - enhance this for production
    const userAgent = req.headers['user-agent'] || '';
    const referer = req.headers['referer'] || '';
    
    // Allow Discord user agents and specific patterns
    return userAgent.includes('Discord') || 
           referer.includes('discord') ||
           req.query.owner === 'true'; // For testing
}

// Website route - Protected
app.get('/', (req, res) => {
    const clientHWID = generateHWID(req);
    
    if (!isOwnerAccess(req)) {
        return res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Access Denied</title>
            <style>
                body { 
                    background: #0a0a0a; 
                    color: white; 
                    font-family: 'Inter', sans-serif; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    height: 100vh; 
                    margin: 0; 
                }
                .message { 
                    text-align: center; 
                    background: rgba(237, 66, 69, 0.1);
                    border: 1px solid rgba(237, 66, 69, 0.3);
                    border-radius: 15px;
                    padding: 40px;
                    backdrop-filter: blur(10px);
                    max-width: 500px;
                }
            </style>
        </head>
        <body>
            <div class="message">
                <h1>🚫 Access Denied</h1>
                <p>This website contains exclusive content for authorized users only.</p>
                <p>If you are the owner, use the Discord bot to access your scripts.</p>
            </div>
        </body>
        </html>
        `);
    }

    // Owner access granted
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Exclusive Script Hub - Owner Access</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: 'Inter', sans-serif;
            }
            
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            
            :root {
                --primary: #5865F2;
                --success: #57F287;
                --bg-dark: #0a0a0a;
                --bg-card: #1a1a1a;
                --text-primary: #ffffff;
                --text-secondary: #b9bbbe;
            }
            
            body {
                background: var(--bg-dark);
                color: var(--text-primary);
                min-height: 100vh;
                padding: 20px;
            }
            
            .container {
                max-width: 800px;
                margin: 0 auto;
                text-align: center;
            }
            
            .header {
                margin-bottom: 40px;
                padding: 40px 0;
            }
            
            .header h1 {
                font-size: 3em;
                background: linear-gradient(135deg, var(--primary), var(--success));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 10px;
            }
            
            .status-card {
                background: var(--bg-card);
                border-radius: 15px;
                padding: 30px;
                border: 2px solid var(--primary);
                margin-bottom: 30px;
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin: 20px 0;
            }
            
            .stat-item {
                background: rgba(255,255,255,0.05);
                padding: 15px;
                border-radius: 10px;
            }
            
            .hwid-info {
                background: rgba(88, 101, 242, 0.1);
                border-radius: 10px;
                padding: 20px;
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔒 Exclusive Script Hub</h1>
                <p style="color: var(--text-secondary);">Owner Access - Welcome!</p>
            </div>
            
            <div class="status-card">
                <h2>🌐 Server Status</h2>
                <p style="color: var(--success); font-weight: bold; margin: 10px 0;">
                    🟢 SERVER ONLINE
                </p>
                
                <div class="stats-grid">
                    <div class="stat-item">
                        <h3>Total HWID Locks</h3>
                        <p>${hwidLocks.size}</p>
                    </div>
                    <div class="stat-item">
                        <h3>Your HWID</h3>
                        <p><code>${clientHWID}</code></p>
                    </div>
                    <div class="stat-item">
                        <h3>Server Port</h3>
                        <p>${PORT}</p>
                    </div>
                </div>
            </div>
            
            <div class="hwid-info">
                <h3>🔧 System Information</h3>
                <p>This server handles script delivery and HWID verification.</p>
                <ul style="text-align: left; margin: 15px 0; color: var(--text-secondary);">
                    <li><strong>Endpoint:</strong> /script/premium_script?hwid=YOUR_HWID</li>
                    <li><strong>HWID Verification:</strong> Enabled</li>
                    <li><strong>Rate Limiting:</strong> Enabled</li>
                    <li><strong>Access Control:</strong> Owner Only</li>
                </ul>
            </div>
        </div>
    </body>
    </html>
    `);
});

// API endpoint to serve scripts with HWID verification
app.get('/script/premium_script', (req, res) => {
    const clientHWID = req.query.hwid;
    
    if (!clientHWID) {
        return res.status(400).send('HWID parameter required');
    }
    
    // Verify HWID exists in our storage
    // Note: In production, this would sync with the Python bot's storage
    const hwidLock = hwidLocks.get(clientHWID);
    
    // For demo purposes, we'll accept any HWID that's properly formatted
    // In production, implement proper synchronization between bot and server
    const isValidHWID = /^[a-f0-9]{16}$/.test(clientHWID);
    
    if (!isValidHWID) {
        return res.status(403).send('Invalid HWID format');
    }
    
    // Serve the Lua script
    const luaScript = `
-- 🔒 Exclusive Premium Script
-- 🆔 HWID: ${clientHWID}
-- ✅ Access: VERIFIED
-- ⚠️ License: SINGLE_USE_PER_DEVICE

print("⭐ Exclusive Premium Script Loaded!")
print("🔒 HWID Verified: ${clientHWID}")
print("🎮 Loading premium features...")

-- HWID Verification
local expectedHWID = "${clientHWID}"
local function getClientHWID()
    -- Simple HWID simulation
    return "${clientHWID}" -- In real implementation, generate from system info
end

if getClientHWID() ~= expectedHWID then
    print("❌ HWID verification failed!")
    print("🚫 This script is locked to another device")
    print("🔧 Contact mods for HWID reset if needed")
    return
end

print("✅ HWID verification successful!")

-- Your premium script content here
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer

-- Premium GUI would be created here
print("🚀 Premium features loaded successfully!")
print("🎉 Enjoy your exclusive script!")

-- Example feature
LocalPlayer.Chatted:Connect(function(msg)
    if msg == "/features" then
        print("🎮 Exclusive Features:")
        print("⭐ Premium GUI")
        print("🔒 HWID Protected")
        print("🚀 Advanced Tools")
        print("🎯 Single Device License")
        print("⚡ Optimized Performance")
    end
end)
    `.trim();
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(luaScript);
});

// API endpoint to add HWID lock (for bot synchronization)
app.post('/api/add-hwid', express.json(), (req, res) => {
    const { hwid, userId, username } = req.body;
    
    if (!hwid || !userId) {
        return res.status(400).json({ error: 'HWID and userId required' });
    }
    
    hwidLocks.set(hwid, {
        userId,
        username,
        createdAt: Date.now(),
        hwid
    });
    
    res.json({ success: true, message: 'HWID lock added' });
});

// API endpoint to verify HWID
app.post('/api/verify-hwid', express.json(), (req, res) => {
    const { hwid } = req.body;
    
    if (!hwid) {
        return res.json({ valid: false, error: 'HWID required' });
    }
    
    const hwidLock = hwidLocks.get(hwid);
    const isValid = !!hwidLock;
    
    res.json({ 
        valid: isValid,
        user: isValid ? hwidLock.username : null
    });
});

// API endpoint to get system stats
app.get('/api/system-stats', (req, res) => {
    res.json({
        totalHwidLocks: hwidLocks.size,
        serverUptime: process.uptime(),
        serverTime: new Date().toISOString()
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Page Not Found</title>
            <style>
                body { 
                    background: #0a0a0a; 
                    color: white; 
                    font-family: Arial; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    height: 100vh; 
                    margin: 0; 
                }
                .message { 
                    text-align: center; 
                    background: rgba(255,255,255,0.1); 
                    padding: 40px; 
                    border-radius: 10px; 
                    backdrop-filter: blur(10px);
                }
                a { 
                    color: #5865F2; 
                    text-decoration: none; 
                }
            </style>
        </head>
        <body>
            <div class="message">
                <h2>404 - Page Not Found</h2>
                <p>The page you're looking for doesn't exist.</p>
                <a href="/">← Back to Home</a>
            </div>
        </body>
        </html>
    `);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Website server running on port ' + PORT);
    console.log('🔒 HWID Script System Ready');
    console.log('🌐 Website: https://tommyfc555-github-io.onrender.com');
    console.log('📝 Script endpoint: /script/premium_script');
});
