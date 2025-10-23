const API_BASE = 'http://localhost:3000/api';

// Register function
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const hwid = getHWID();

    // Basic validation
    if (username.length < 3) {
        alert('Username must be at least 3 characters long');
        return;
    }

    if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password, hwid })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', username);
            alert('Registration successful! Your HWID has been locked to this account.');
            window.location.href = 'dashboard.html';
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Registration failed: ' + error.message);
    }
});

// Login function
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const hwid = getHWID();

    if (!username || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password, hwid })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', username);
            window.location.href = 'dashboard.html';
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
});

// Check if user is already logged in
function checkAuth() {
    const token = localStorage.getItem('token');
    if (token && (window.location.pathname.includes('index.html') || window.location.pathname === '/')) {
        window.location.href = 'dashboard.html';
    }
}

// Initialize auth check
checkAuth();
