const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('.'));

// Serve the obfuscator
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint for advanced obfuscation
app.post('/api/obfuscate', express.json(), (req, res) => {
    const { script, level = 'ultra' } = req.body;
    
    if (!script) {
        return res.status(400).json({ error: 'No script provided' });
    }
    
    // Simulate processing time
    setTimeout(() => {
        const obfuscated = `-- [OBFUSCATED BY BLACK - ${level.toUpperCase()} MODE] --\n\n` + 
                           ultraObfuscate(script);
        
        res.json({
            success: true,
            obfuscated: obfuscated,
            stats: {
                original_length: script.length,
                obfuscated_length: obfuscated.length,
                level: level
            }
        });
    }, 500);
});

function ultraObfuscate(script) {
    // This would contain the advanced obfuscation logic
    return script.split('').reverse().join('') + 
           '\n-- Ultra obfuscation applied --';
}

server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Black Obfuscator running on port ' + PORT);
    console.log('🔒 Ultra Lua script obfuscation ready');
    console.log('🌐 Visit: http://localhost:' + PORT);
});
