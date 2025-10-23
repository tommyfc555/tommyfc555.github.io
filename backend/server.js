const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend is working!' });
});

// Auth routes
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, hwid } = req.body;
    
    console.log('Register attempt:', { username, email, hwid });
    
    // Simple validation
    if (!username || !password || !hwid) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Success response
    res.json({ 
        message: 'Registration successful!', 
        token: 'token-' + Date.now(),
        username: username
    });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password, hwid } = req.body;
    
    console.log('Login attempt:', { username, hwid });
    
    // Simple validation
    if (!username || !password || !hwid) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Success response
    res.json({ 
        message: 'Login successful!', 
        token: 'token-' + Date.now(),
        username: username
    });
});

// HWID routes
app.get('/api/hwid/test', (req, res) => {
    res.json({ message: 'HWID API working!' });
});

app.get('/api/hwid/my-hwid', (req, res) => {
    res.json({ hwid: 'demo-hwid-12345' });
});

// Root route
app.get('/', (req, res) => {
    res.json({ 
        message: 'Roblox Joiner Backend API',
        endpoints: {
            test: '/api/test',
            register: '/api/auth/register',
            login: '/api/auth/login',
            hwid_test: '/api/hwid/test'
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Test URL: http://localhost:${PORT}/api/test`);
});
