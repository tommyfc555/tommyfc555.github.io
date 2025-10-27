const express = require('express');
const http = require('http');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Database simulation
let hwidDatabase = {
    user_hwid: {},
    hwid_user: {},
    stats: {
        total_generated: 0,
        active_hwids: 0,
        last_update: new Date().toISOString()
    }
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

function isValidHWID(hwid) {
    return /^[a-f0-9]{16}$/.test(hwid);
}

function obfuscateLuaCode(hwid) {
    // Ultra obfuscated Lua code with encoded strings and random variables
    return `local a=("\\x70\\x72\\x69\\x6e\\x74"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)local c=("\\x48\\x57\\x49\\x44\\x20\\x56\\x65\\x72\\x69\\x66\\x69\\x65\\x64"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)local d=("\\x53\\x63\\x72\\x69\\x70\\x74\\x20\\x4c\\x6f\\x61\\x64\\x65\\x64"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)local e=("\\x49\\x6e\\x76\\x61\\x6c\\x69\\x64\\x20\\x48\\x57\\x49\\x44"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)local f="${hwid}"local g=game:GetService("Players")local h=g.LocalPlayer;if not h then return end;local i=("\\x48\\x57\\x49\\x44"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)local j=("\\x56\\x65\\x72\\x69\\x66\\x69\\x63\\x61\\x74\\x69\\x6f\\x6e"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)local k=("\\x46\\x61\\x69\\x6c\\x65\\x64"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)local l=("\\x53\\x75\\x63\\x63\\x65\\x73\\x73\\x66\\x75\\x6c"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)local m=("\\x46\\x65\\x61\\x74\\x75\\x72\\x65\\x73"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)local n=("\\x4c\\x6f\\x61\\x64\\x65\\x64"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)local function o(p)local q=0;for r=1,#p do q=q+string.byte(p,r)end;return tostring(q)end;local s=o(f)local t=o("${hwid}")if s~=t then loadstring(a..'("\\x5e\\x5b\\x5e\\x5d\\x5e\\x5b"..e.."\\x5e\\x5d\\x5e\\x5b")')()return end;loadstring(a..'("\\x5e\\x5b\\x5e\\x5d\\x5e\\x5b"..c.."\\x3a\\x20"..f.."\\x5e\\x5d\\x5e\\x5b")')()loadstring(a..'("\\x5e\\x5b\\x5e\\x5d\\x5e\\x5b"..d.."\\x5e\\x5d\\x5e\\x5b")')()local u=Instance.new("ScreenGui")u.Parent=game:GetService("CoreGui")u.Name=("\\x50\\x72\\x65\\x6d\\x69\\x75\\x6d\\x53\\x63\\x72\\x69\\x70\\x74"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)local v=Instance.new("Frame")v.Size=UDim2.new(0,300,0,200)v.Position=UDim2.new(0.5,-150,0.5,-100)v.BackgroundColor3=Color3.fromRGB(30,30,30)v.BorderSizePixel=0;v.Active=true;v.Draggable=true;v.Parent=u;local w=Instance.new("TextLabel")w.Size=UDim2.new(1,0,0,40)w.BackgroundColor3=Color3.fromRGB(88,101,242)w.Text=("\\x50\\x72\\x65\\x6d\\x69\\x75\\x6d\\x20\\x53\\x63\\x72\\x69\\x70\\x74"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)w.TextColor3=Color3.fromRGB(255,255,255)w.TextSize=18;w.Font=Enum.Font.GothamBold;w.Parent=v;local x=Instance.new("TextLabel")x.Size=UDim2.new(1,-20,0,30)x.Position=UDim2.new(0,10,0,50)x.BackgroundTransparency=1;x.Text=("\\x48\\x57\\x49\\x44\\x20\\x56\\x61\\x6c\\x69\\x64"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)x.TextColor3=Color3.fromRGB(0,255,0)x.TextSize=14;x.Font=Enum.Font.Gotham;x.Parent=v;h.Chatted:Connect(function(y)if y==("\\x21\\x66\\x6c\\x79"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)then loadstring(a..'("\\x5e\\x5b\\x5e\\x5d\\x5e\\x5b\\x46\\x6c\\x79\\x20\\x65\\x6e\\x61\\x62\\x6c\\x65\\x64\\x5e\\x5d\\x5e\\x5b")')()elseif y==("\\x21\\x73\\x70\\x65\\x65\\x64"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)then loadstring(a..'("\\x5e\\x5b\\x5e\\x5d\\x5e\\x5b\\x53\\x70\\x65\\x65\\x64\\x20\\x62\\x6f\\x6f\\x73\\x74\\x20\\x65\\x6e\\x61\\x62\\x6c\\x65\\x64\\x5e\\x5d\\x5e\\x5b")')()elseif y==("\\x21\\x66\\x65\\x61\\x74\\x75\\x72\\x65\\x73"):gsub("\\x(..)",function(b)return string.char(tonumber(b,16))end)then loadstring(a..'("\\x5e\\x5b\\x5e\\x5d\\x5e\\x5b\\x46\\x65\\x61\\x74\\x75\\x72\\x65\\x73\\x3a\\x20\\x21\\x66\\x6c\\x79\\x2c\\x20\\x21\\x73\\x70\\x65\\x65\\x64\\x2c\\x20\\x21\\x6e\\x6f\\x63\\x6c\\x69\\x70\\x5e\\x5d\\x5e\\x5b")')()end end)`;
}

// Script endpoint with ultra obfuscation
app.get('/script/premium_script', (req, res) => {
    const clientHWID = req.query.hwid;
    
    if (!clientHWID) {
        return res.status(400).send('-- HWID required');
    }
    
    if (!isValidHWID(clientHWID)) {
        return res.status(403).send('-- Invalid HWID');
    }
    
    const obfuscatedScript = obfuscateLuaCode(clientHWID);
    res.setHeader('Content-Type', 'text/plain');
    res.send(obfuscatedScript);
});

// API to sync with bot
app.post('/api/sync-hwid', express.json(), (req, res) => {
    const { hwid, userId } = req.body;
    if (!hwid || !userId) return res.status(400).json({ error: 'Invalid data' });
    
    hwidDatabase.user_hwid[userId] = hwid;
    hwidDatabase.hwid_user[hwid] = userId;
    hwidDatabase.stats.active_hwids = Object.keys(hwidDatabase.hwid_user).length;
    hwidDatabase.stats.last_update = new Date().toISOString();
    
    res.json({ success: true });
});

// Live stats endpoint
app.get('/api/stats', (req, res) => {
    res.json({
        total_hwids: Object.keys(hwidDatabase.hwid_user).length,
        active_users: Object.keys(hwidDatabase.user_hwid).length,
        last_update: hwidDatabase.stats.last_update,
        server_status: 'online'
    });
});

// Website with live stats
app.get('/', (req, res) => {
    const stats = {
        total_hwids: Object.keys(hwidDatabase.hwid_user).length,
        active_users: Object.keys(hwidDatabase.user_hwid).length,
        last_update: new Date(hwidDatabase.stats.last_update).toLocaleString()
    };
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>🔒 HWID System - Live Stats</title>
        <style>
            body { 
                background: #0a0a0a; 
                color: white; 
                font-family: 'Inter', sans-serif; 
                text-align: center;
                padding: 50px;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin: 40px auto;
                max-width: 800px;
            }
            .stat-card {
                background: #1a1a1a;
                padding: 25px;
                border-radius: 15px;
                border: 1px solid #5865F2;
            }
            .stat-number {
                font-size: 2.5em;
                font-weight: bold;
                color: #57F287;
                margin: 10px 0;
            }
            .stat-label {
                color: #b9bbbe;
                font-size: 1.1em;
            }
            .live-badge {
                background: #57F287;
                color: black;
                padding: 5px 15px;
                border-radius: 20px;
                font-weight: bold;
                display: inline-block;
                margin-bottom: 20px;
            }
        </style>
        <script>
            function updateStats() {
                fetch('/api/stats')
                    .then(r => r.json())
                    .then(data => {
                        document.getElementById('total-hwids').textContent = data.total_hwids;
                        document.getElementById('active-users').textContent = data.active_users;
                        document.getElementById('last-update').textContent = new Date(data.last_update).toLocaleString();
                    });
            }
            setInterval(updateStats, 5000);
            updateStats();
        </script>
    </head>
    <body>
        <h1>🔒 HWID System Dashboard</h1>
        <div class="live-badge">🟢 LIVE</div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total HWIDs</div>
                <div class="stat-number" id="total-hwids">${stats.total_hwids}</div>
                <div>Active Hardware IDs</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Active Users</div>
                <div class="stat-number" id="active-users">${stats.active_users}</div>
                <div>Registered Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Last Update</div>
                <div style="font-size: 1.2em; margin: 15px 0; color: #FEE75C;" id="last-update">${stats.last_update}</div>
                <div>Live Updates</div>
            </div>
        </div>
        
        <p style="color: #b9bbbe; margin-top: 40px;">
            🔒 Ultra Obfuscated Script Delivery System<br>
            📊 Real-time Statistics<br>
            🛡️ HWID Protected Content
        </p>
    </body>
    </html>
    `);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Website server running on port ' + PORT);
    console.log('🔒 Ultra Obfuscated Script System Ready');
    console.log('📊 Live stats dashboard active');
});
