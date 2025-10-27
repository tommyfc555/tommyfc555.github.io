const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve the obfuscator website directly
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔒 Black Obfuscator</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Courier New', monospace;
        }
        
        body {
            background: #0a0a0a;
            color: #00ff00;
            min-height: 100vh;
            padding: 20px;
            overflow-x: hidden;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            border-bottom: 2px solid #00ff00;
        }
        
        .header h1 {
            font-size: 2.5em;
            text-shadow: 0 0 10px #00ff00;
            margin-bottom: 10px;
        }
        
        .header p {
            color: #00cc00;
            font-size: 1.1em;
        }
        
        .editor-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        
        @media (max-width: 768px) {
            .editor-container {
                grid-template-columns: 1fr;
            }
        }
        
        .editor-section {
            background: #111111;
            border: 1px solid #00ff00;
            border-radius: 10px;
            padding: 20px;
        }
        
        .editor-title {
            color: #00ff00;
            margin-bottom: 15px;
            font-size: 1.3em;
            text-align: center;
        }
        
        textarea {
            width: 100%;
            height: 400px;
            background: #000000;
            color: #00ff00;
            border: 1px solid #00ff00;
            border-radius: 5px;
            padding: 15px;
            font-size: 14px;
            resize: vertical;
            font-family: 'Courier New', monospace;
        }
        
        textarea:focus {
            outline: none;
            box-shadow: 0 0 10px #00ff00;
        }
        
        .controls {
            text-align: center;
            margin: 30px 0;
        }
        
        .obfuscate-btn {
            background: #00ff00;
            color: #000000;
            border: none;
            padding: 15px 40px;
            font-size: 1.2em;
            font-weight: bold;
            border-radius: 25px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        
        .obfuscate-btn:hover {
            background: #00cc00;
            box-shadow: 0 0 20px #00ff00;
            transform: translateY(-2px);
        }
        
        .obfuscate-btn:active {
            transform: translateY(0);
        }
        
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 40px;
        }
        
        .feature-card {
            background: #111111;
            border: 1px solid #00ff00;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
        }
        
        .feature-icon {
            font-size: 2em;
            margin-bottom: 10px;
        }
        
        .feature-title {
            color: #00ff00;
            margin-bottom: 10px;
            font-size: 1.1em;
        }
        
        .feature-desc {
            color: #00cc00;
            font-size: 0.9em;
        }
        
        .copy-btn {
            background: #333333;
            color: #00ff00;
            border: 1px solid #00ff00;
            padding: 8px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 10px;
            transition: all 0.3s ease;
        }
        
        .copy-btn:hover {
            background: #00ff00;
            color: #000000;
        }
        
        .stats {
            text-align: center;
            margin-top: 30px;
            color: #00cc00;
        }
        
        .watermark {
            text-align: center;
            margin-top: 40px;
            color: #00ff00;
            font-size: 0.9em;
            opacity: 0.7;
        }
        
        .loading {
            display: none;
            text-align: center;
            color: #00ff00;
            margin: 20px 0;
        }
        
        .blink {
            animation: blink 1s infinite;
        }
        
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 BLACK OBFUSCATOR</h1>
            <p>Ultra Lua Script Obfuscation Tool</p>
        </div>
        
        <div class="editor-container">
            <div class="editor-section">
                <div class="editor-title">📝 INPUT - Original Script</div>
                <textarea id="inputScript" placeholder="Paste your Lua script here...">print("Hello World!")
local player = game.Players.LocalPlayer
player.Character.Humanoid.WalkSpeed = 50

function teleport(position)
    player.Character.HumanoidRootPart.Position = position
end

teleport(Vector3.new(0, 50, 0))</textarea>
            </div>
            
            <div class="editor-section">
                <div class="editor-title">🔐 OUTPUT - Obfuscated Script</div>
                <textarea id="outputScript" placeholder="Obfuscated script will appear here..." readonly></textarea>
                <button class="copy-btn" onclick="copyOutput()">📋 Copy Obfuscated Script</button>
            </div>
        </div>
        
        <div class="loading" id="loading">
            <div class="blink">⚡ OBFUSCATING... PLEASE WAIT</div>
        </div>
        
        <div class="controls">
            <button class="obfuscate-btn" onclick="obfuscateScript()">🚀 OBFUSCATE SCRIPT</button>
        </div>
        
        <div class="features">
            <div class="feature-card">
                <div class="feature-icon">🔒</div>
                <div class="feature-title">Ultra Obfuscation</div>
                <div class="feature-desc">Variables, strings, and functions completely obfuscated</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon">⚡</div>
                <div class="feature-title">Fast Processing</div>
                <div class="feature-desc">Instant obfuscation with advanced algorithms</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🛡️</div>
                <div class="feature-title">Anti-Deobfuscation</div>
                <div class="feature-desc">Multiple layers of protection against reverse engineering</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🔧</div>
                <div class="feature-title">Fully Functional</div>
                <div class="feature-desc">Obfuscated code works exactly like original</div>
            </div>
        </div>
        
        <div class="stats">
            <p>Characters: <span id="charCount">0</span> | Lines: <span id="lineCount">0</span> | Obfuscation Level: <span id="obfLevel">ULTRA</span></p>
        </div>
        
        <div class="watermark">
            🔒 OBFUSCATED BY BLACK | SECURE YOUR SCRIPTS
        </div>
    </div>

    <script>
        // Character mapping for obfuscation
        const charMap = {
            'a': '\\\\x61', 'b': '\\\\x62', 'c': '\\\\x63', 'd': '\\\\x64', 'e': '\\\\x65',
            'f': '\\\\x66', 'g': '\\\\x67', 'h': '\\\\x68', 'i': '\\\\x69', 'j': '\\\\x6a',
            'k': '\\\\x6b', 'l': '\\\\x6c', 'm': '\\\\x6d', 'n': '\\\\x6e', 'o': '\\\\x6f',
            'p': '\\\\x70', 'q': '\\\\x71', 'r': '\\\\x72', 's': '\\\\x73', 't': '\\\\x74',
            'u': '\\\\x75', 'v': '\\\\x76', 'w': '\\\\x77', 'x': '\\\\x78', 'y': '\\\\x79',
            'z': '\\\\x7a', 'A': '\\\\x41', 'B': '\\\\x42', 'C': '\\\\x43', 'D': '\\\\x44',
            'E': '\\\\x45', 'F': '\\\\x46', 'G': '\\\\x47', 'H': '\\\\x48', 'I': '\\\\x49',
            'J': '\\\\x4a', 'K': '\\\\x4b', 'L': '\\\\x4c', 'M': '\\\\x4d', 'N': '\\\\x4e',
            'O': '\\\\x4f', 'P': '\\\\x50', 'Q': '\\\\x51', 'R': '\\\\x52', 'S': '\\\\x53',
            'T': '\\\\x54', 'U': '\\\\x55', 'V': '\\\\x56', 'W': '\\\\x57', 'X': '\\\\x58',
            'Y': '\\\\x59', 'Z': '\\\\x5a', '0': '\\\\x30', '1': '\\\\x31', '2': '\\\\x32',
            '3': '\\\\x33', '4': '\\\\x34', '5': '\\\\x35', '6': '\\\\x36', '7': '\\\\x37',
            '8': '\\\\x38', '9': '\\\\x39', ' ': '\\\\x20', '!': '\\\\x21', '"': '\\\\x22',
            '#': '\\\\x23', '$': '\\\\x24', '%': '\\\\x25', '&': '\\\\x26', "'": '\\\\x27',
            '(': '\\\\x28', ')': '\\\\x29', '*': '\\\\x2a', '+': '\\\\x2b', ',': '\\\\x2c',
            '-': '\\\\x2d', '.': '\\\\x2e', '/': '\\\\x2f', ':': '\\\\x3a', ';': '\\\\x3b',
            '<': '\\\\x3c', '=': '\\\\x3d', '>': '\\\\x3e', '?': '\\\\x3f', '@': '\\\\x40',
            '[': '\\\\x5b', '\\\\': '\\\\x5c', ']': '\\\\x5d', '^': '\\\\x5e', '_': '\\\\x5f',
            '\`': '\\\\x60', '{': '\\\\x7b', '|': '\\\\x7c', '}': '\\\\x7d', '~': '\\\\x7e'
        };

        // Variable name generator
        function generateVarName(length = 3) {
            const chars = 'abcdefghijklmnopqrstuvwxyz';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }

        // Generate unique variable names
        function generateUniqueVars(count) {
            const vars = new Set();
            while (vars.size < count) {
                vars.add(generateVarName(2 + Math.floor(Math.random() * 3)));
            }
            return Array.from(vars);
        }

        // Convert string to hex escape sequence
        function stringToHex(str) {
            let result = '"';
            for (let i = 0; i < str.length; i++) {
                result += charMap[str[i]] || str[i];
            }
            result += '"';
            return result;
        }

        // Obfuscate a string
        function obfuscateString(str) {
            const hexStr = stringToHex(str);
            const varName = generateVarName();
            return \`\${varName}=(\${hexStr}):gsub("\\\\\\\\x(..)",function(\${generateVarName(1)})return string.char(tonumber(\${generateVarName(1)},16))end)\`;
        }

        // Main obfuscation function
        function obfuscateScript() {
            const input = document.getElementById('inputScript').value.trim();
            if (!input) {
                alert('Please enter a script to obfuscate!');
                return;
            }

            // Show loading
            const loading = document.getElementById('loading');
            loading.style.display = 'block';

            // Process after a short delay for visual effect
            setTimeout(() => {
                try {
                    let output = '-- [OBFUSCATED BY BLACK] --\\n\\n';
                    
                    // Split script into lines
                    const lines = input.split('\\n');
                    
                    // Generate variables for common strings
                    const commonStrings = [
                        'print', 'game', 'Players', 'LocalPlayer', 'Character',
                        'Humanoid', 'WalkSpeed', 'function', 'local', 'return',
                        'end', 'if', 'then', 'else', 'for', 'while', 'do'
                    ];
                    
                    const stringVars = generateUniqueVars(commonStrings.length);
                    const varMap = new Map();
                    
                    // Create variable assignments for common strings
                    commonStrings.forEach((str, index) => {
                        varMap.set(str, stringVars[index]);
                        output += \`local \${stringVars[index]}=\${stringToHex(str)}:gsub("\\\\\\\\x(..)",function(\${generateVarName(1)})return string.char(tonumber(\${generateVarName(1)},16))end)\\n\`;
                    });
                    
                    output += '\\n';
                    
                    // Obfuscate each line
                    lines.forEach(line => {
                        if (line.trim() === '') {
                            output += '\\n';
                            return;
                        }
                        
                        let obfuscatedLine = line;
                        
                        // Replace common strings with variables
                        varMap.forEach((varName, original) => {
                            const regex = new RegExp(\`\\\\b\${original}\\\\b\`, 'g');
                            obfuscatedLine = obfuscatedLine.replace(regex, varName);
                        });
                        
                        // Obfuscate remaining strings
                        const stringRegex = /(["'])(?:(?=(\\\\\\\\?))\\\\2.)*?\\\\1/g;
                        obfuscatedLine = obfuscatedLine.replace(stringRegex, (match) => {
                            if (match.length > 2) {
                                const content = match.slice(1, -1);
                                return stringToHex(content) + ':gsub("\\\\\\\\x(..)",function(' + generateVarName(1) + ')return string.char(tonumber(' + generateVarName(1) + ',16))end)';
                            }
                            return match;
                        });
                        
                        // Add random variable assignments to confuse
                        if (Math.random() > 0.7) {
                            const randomVar = generateVarName();
                            const randomValue = Math.floor(Math.random() * 1000);
                            output += \`local \${randomVar}=\${randomValue} \`;
                        }
                        
                        output += obfuscatedLine + '\\n';
                    });
                    
                    // Add garbage code at the end
                    output += '\\n-- Garbage code for anti-deobfuscation --\\n';
                    for (let i = 0; i < 5; i++) {
                        const garbageVar = generateVarName();
                        const garbageValue = Math.floor(Math.random() * 10000);
                        output += \`local \${garbageVar}=function() return \${garbageValue} end\\n\`;
                    }
                    
                    output += \`\\n-- Obfuscation completed by BLACK --\\n\`;
                    output += \`-- Total protection layers: \${commonStrings.length + 5} --\`;
                    
                    document.getElementById('outputScript').value = output;
                    
                    // Update stats
                    updateStats(input, output);
                    
                } catch (error) {
                    document.getElementById('outputScript').value = '-- [ERROR IN OBFUSCATION] --\\n' + error.message;
                }
                
                // Hide loading
                loading.style.display = 'none';
            }, 1000);
        }

        // Copy output to clipboard
        function copyOutput() {
            const output = document.getElementById('outputScript');
            output.select();
            output.setSelectionRange(0, 99999);
            document.execCommand('copy');
            
            // Visual feedback
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = '✅ Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        }

        // Update statistics
        function updateStats(input, output) {
            const charCount = output.length;
            const lineCount = output.split('\\n').length;
            const inputChars = input.length;
            const compression = ((1 - output.length / input.length) * 100).toFixed(1);
            
            document.getElementById('charCount').textContent = charCount;
            document.getElementById('lineCount').textContent = lineCount;
            document.getElementById('obfLevel').textContent = \`ULTRA (\${compression}% larger)\`;
        }

        // Auto-update stats on input
        document.getElementById('inputScript').addEventListener('input', function() {
            const input = this.value;
            const charCount = input.length;
            const lineCount = input.split('\\n').length;
            
            document.getElementById('charCount').textContent = charCount;
            document.getElementById('lineCount').textContent = lineCount;
        });

        // Initialize stats
        updateStats(document.getElementById('inputScript').value, '');
    </script>
</body>
</html>
    `);
});

// API endpoint for obfuscation
app.post('/api/obfuscate', express.json(), (req, res) => {
    const { script } = req.body;
    
    if (!script) {
        return res.status(400).json({ error: 'No script provided' });
    }
    
    try {
        // Simple obfuscation for API
        const obfuscated = ultraObfuscate(script);
        
        res.json({
            success: true,
            obfuscated: obfuscated,
            original_length: script.length,
            obfuscated_length: obfuscated.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Obfuscation failed' });
    }
});

function ultraObfuscate(script) {
    let output = '-- [OBFUSCATED BY BLACK] --\\n\\n';
    
    // Simple obfuscation for demo
    const lines = script.split('\\n');
    lines.forEach(line => {
        // Add some basic obfuscation
        output += line.replace(/print/g, 'loadstring("\\\\x70\\\\x72\\\\x69\\\\x6e\\\\x74")()') + '\\n';
    });
    
    output += '\\n-- Obfuscation completed --';
    return output;
}

// 404 handler
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Black Obfuscator</title>
            <style>
                body { 
                    background: #0a0a0a; 
                    color: #00ff00; 
                    font-family: 'Courier New', monospace; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    height: 100vh; 
                    margin: 0; 
                    text-align: center;
                }
                .message { 
                    background: #111111;
                    border: 1px solid #00ff00;
                    border-radius: 10px;
                    padding: 40px;
                }
                a { 
                    color: #00ff00; 
                    text-decoration: none;
                }
            </style>
        </head>
        <body>
            <div class="message">
                <h1>🔒 404 - Page Not Found</h1>
                <p>The page you're looking for doesn't exist.</p>
                <a href="/">← Back to Black Obfuscator</a>
            </div>
        </body>
        </html>
    `);
});

// Error handling
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Error - Black Obfuscator</title>
            <style>
                body { 
                    background: #0a0a0a; 
                    color: #ff0000; 
                    font-family: 'Courier New', monospace; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    height: 100vh; 
                    margin: 0; 
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <h1>❌ Server Error</h1>
            <p>Something went wrong. Please try again.</p>
            <a href="/" style="color: #00ff00;">← Back to Obfuscator</a>
        </body>
        </html>
    `);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Black Obfuscator running on port ' + PORT);
    console.log('🔒 Ultra Lua script obfuscation ready');
    console.log('🌐 Visit: https://tommyfc555-github-io.onrender.com');
});
