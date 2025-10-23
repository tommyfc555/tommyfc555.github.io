// Check authentication
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = 'login.html';
}

// Load user data
function loadUserData() {
    try {
        // Display username
        const username = localStorage.getItem('username') || 'User';
        document.getElementById('usernameDisplay').textContent = username;
        
        // Display HWID
        const hwid = getHWID();
        document.getElementById('userHWID').textContent = hwid;
        
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Join Roblox game
function joinGame() {
    const jobId = document.getElementById('jobId').value.trim();
    
    if (!jobId) {
        alert('Please enter a Job ID');
        return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
        alert('Please enter a valid UUID format Job ID\nExample: b525a501-8e03-45ad-9aa7-0bb2544f6bf4');
        return;
    }

    // Show loading state
    const joinBtn = document.querySelector('.joiner-section .btn-primary');
    const originalText = joinBtn.textContent;
    joinBtn.textContent = 'Launching...';
    joinBtn.disabled = true;

    // Launch Roblox instantly
    const robloxUrl = `roblox://placeID=0&gameInstanceId=${jobId}`;
    window.location.href = robloxUrl;
    
    // Fallback after 1 second
    setTimeout(() => {
        joinBtn.textContent = originalText;
        joinBtn.disabled = false;
        
        if (confirm('If Roblox did not open automatically, click OK to open in browser')) {
            window.open(`https://www.roblox.com/games/0?gameInstanceId=${jobId}`, '_blank');
        }
    }, 1000);
}

// Set example Job ID
function setJobId(jobId) {
    document.getElementById('jobId').value = jobId;
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = 'index.html';
}

// Enter key to join game
document.getElementById('jobId')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        joinGame();
    }
});

// Initialize dashboard
loadUserData();
