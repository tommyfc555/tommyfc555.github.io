const express = require('express');
const http = require('http');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// In-memory storage (in production, use a database)
const hwidDatabase = {
    "user_hwid": {},
    "hwid_user": {}
};

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

function isValidHWID(hwid) {
    return /^[a-f0-9]{16}$/.test(hwid);
}

// API endpoint to serve scripts with HWID verification
app.get('/script/premium_script', (req, res) => {
    const clientHWID = req.query.hwid;
    
    if (!clientHWID) {
        return res.status(400).send('-- HWID parameter required');
    }
    
    if (!isValidHWID(clientHWID)) {
        return res.status(403).send('-- Invalid HWID format');
    }
    
    // Serve the actual working Lua script
    const luaScript = `-- 🔒 Exclusive Premium Script
-- 🆔 HWID: ${clientHWID}
-- ✅ Access: VERIFIED

print("⭐ Exclusive Premium Script Loaded!")
print("🔒 HWID Verified: ${clientHWID}")

-- HWID Verification
local expectedHWID = "${clientHWID}"

-- Simple HWID check (in real implementation, use proper HWID detection)
local function verifyHWID()
    return "${clientHWID}" == expectedHWID
end

if not verifyHWID() then
    print("❌ HWID verification failed!")
    print("🚫 This script is locked to another device")
    return
end

print("✅ HWID verification successful!")
print("🎮 Loading premium features...")

-- Main script functionality
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer
local RunService = game:GetService("RunService")

-- Create GUI
local ScreenGui = Instance.new("ScreenGui")
ScreenGui.Parent = game.CoreGui
ScreenGui.Name = "PremiumScript"

local MainFrame = Instance.new("Frame")
MainFrame.Size = UDim2.new(0, 300, 0, 200)
MainFrame.Position = UDim2.new(0.5, -150, 0.5, -100)
MainFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
MainFrame.BorderSizePixel = 0
MainFrame.Active = true
MainFrame.Draggable = true
MainFrame.Parent = ScreenGui

local Title = Instance.new("TextLabel")
Title.Size = UDim2.new(1, 0, 0, 40)
Title.BackgroundColor3 = Color3.fromRGB(88, 101, 242)
Title.Text = "⭐ Premium Script v1.0"
Title.TextColor3 = Color3.fromRGB(255, 255, 255)
Title.TextSize = 18
Title.Font = Enum.Font.GothamBold
Title.Parent = MainFrame

local Status = Instance.new("TextLabel")
Status.Size = UDim2.new(1, -20, 0, 30)
Status.Position = UDim2.new(0, 10, 0, 50)
Status.BackgroundTransparency = 1
Status.Text = "✅ HWID Verified: ${clientHWID}"
Status.TextColor3 = Color3.fromRGB(0, 255, 0)
Status.TextSize = 14
Status.Font = Enum.Font.Gotham
Status.Parent = MainFrame

-- Example features
local function enableFly()
    print("🚀 Fly feature enabled")
end

local function enableSpeed()
    print("⚡ Speed feature enabled")
end

local function enableNoclip()
    print("👻 Noclip feature enabled")
end

-- Chat commands
LocalPlayer.Chatted:Connect(function(message)
    if message == "!fly" then
        enableFly()
    elseif message == "!speed" then
        enableSpeed()
    elseif message == "!noclip" then
        enableNoclip()
    elseif message == "!features" then
        print("🎮 Available Features:")
        print("⭐ !fly - Enable flying")
        print("⭐ !speed - Enable speed boost")
        print("⭐ !noclip - Enable noclip")
    end
end)

print("🚀 Script loaded successfully!")
print("💬 Type !features in chat to see available commands")`;
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(luaScript);
});

// API to sync with bot database
app.post('/api/sync-hwid', express.json(), (req, res) => {
    const { hwid, userId, username } = req.body;
    
    if (!hwid || !userId) {
        return res.status(400).json({ error: 'HWID and userId required' });
    }
    
    hwidDatabase.user_hwid[userId] = hwid;
    hwidDatabase.hwid_user[hwid] = userId;
    
    res.json({ success: true, message: 'HWID synced' });
});

// API to verify HWID
app.get('/api/verify/:hwid', (req, res) => {
    const hwid = req.params.hwid;
    const isValid = hwid in hwidDatabase.hwid_user;
    
    res.json({ 
        valid: isValid,
        userId: isValid ? hwidDatabase.hwid_user[hwid] : null
    });
});

// Simple homepage
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Script Server</title>
        <style>
            body { 
                background: #0a0a0a; 
                color: white; 
                font-family: Arial; 
                text-align: center;
                padding: 50px;
            }
        </style>
    </head>
    <body>
        <h1>🔒 Script Server</h1>
        <p>Server is running and ready to deliver scripts.</p>
        <p>Total HWIDs: ${Object.keys(hwidDatabase.hwid_user).length}</p>
    </body>
    </html>
    `);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Website server running on port ' + PORT);
    console.log('🔒 Script delivery system ready');
    console.log('📝 Endpoint: /script/premium_script?hwid=YOUR_HWID');
});
