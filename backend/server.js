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
