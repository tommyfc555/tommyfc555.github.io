module.exports = (db, jwt, JWT_SECRET) => {
    const router = require('express').Router();

    // Middleware to verify JWT token
    const authenticateToken = (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ error: 'Invalid or expired token' });
            }
            req.user = user;
            next();
        });
    };

    // Get user's HWID
    router.get('/my-hwid', authenticateToken, (req, res) => {
        const userId = req.user.userId;
        
        db.get(
            'SELECT hwid FROM hwids WHERE user_id = ?',
            [userId],
            (err, row) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!row) {
                    return res.status(404).json({ error: 'HWID not found for this user' });
                }
                res.json({ hwid: row.hwid });
            }
        );
    });

    // Check if current HWID matches registered HWID
    router.post('/verify', authenticateToken, (req, res) => {
        const userId = req.user.userId;
        const { hwid } = req.body;

        if (!hwid) {
            return res.status(400).json({ error: 'HWID is required' });
        }

        db.get(
            'SELECT hwid FROM hwids WHERE user_id = ? AND hwid = ?',
            [userId, hwid],
            (err, row) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!row) {
                    return res.status(403).json({ 
                        error: 'HWID mismatch - this account is locked to different hardware' 
                    });
                }
                res.json({ valid: true, message: 'HWID verification successful' });
            }
        );
    });

    // Get all HWIDs for a user (admin function)
    router.get('/user-hwids', authenticateToken, (req, res) => {
        const userId = req.user.userId;
        
        db.all(
            'SELECT hwid, created_at FROM hwids WHERE user_id = ? ORDER BY created_at DESC',
            [userId],
            (err, rows) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ hwids: rows });
            }
        );
    });

    // Add new HWID to user account (for multi-device support)
    router.post('/add-hwid', authenticateToken, (req, res) => {
        const userId = req.user.userId;
        const { hwid } = req.body;

        if (!hwid) {
            return res.status(400).json({ error: 'HWID is required' });
        }

        // Check if HWID already exists for any user
        db.get(
            'SELECT user_id FROM hwids WHERE hwid = ?',
            [hwid],
            (err, row) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                if (row) {
                    return res.status(400).json({ error: 'HWID already registered to another user' });
                }

                // Add new HWID
                db.run(
                    'INSERT INTO hwids (user_id, hwid) VALUES (?, ?)',
                    [userId, hwid],
                    function(err) {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).json({ error: 'Failed to add HWID' });
                        }
                        res.json({ 
                            success: true, 
                            message: 'HWID added successfully',
                            hwidId: this.lastID 
                        });
                    }
                );
            }
        );
    });

    // Remove HWID from user account
    router.delete('/remove-hwid', authenticateToken, (req, res) => {
        const userId = req.user.userId;
        const { hwid } = req.body;

        if (!hwid) {
            return res.status(400).json({ error: 'HWID is required' });
        }

        // Check if user has at least one HWID remaining
        db.get(
            'SELECT COUNT(*) as count FROM hwids WHERE user_id = ?',
            [userId],
            (err, row) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                if (row.count <= 1) {
                    return res.status(400).json({ error: 'Cannot remove last HWID. Account must have at least one HWID.' });
                }

                // Remove the HWID
                db.run(
                    'DELETE FROM hwids WHERE user_id = ? AND hwid = ?',
                    [userId, hwid],
                    function(err) {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).json({ error: 'Failed to remove HWID' });
                        }
                        if (this.changes === 0) {
                            return res.status(404).json({ error: 'HWID not found for this user' });
                        }
                        res.json({ success: true, message: 'HWID removed successfully' });
                    }
                );
            }
        );
    });

    // Get HWID statistics
    router.get('/stats', authenticateToken, (req, res) => {
        const userId = req.user.userId;
        
        db.get(
            `SELECT 
                COUNT(*) as total_hwids,
                MIN(created_at) as first_registered,
                MAX(created_at) as last_registered
             FROM hwids 
             WHERE user_id = ?`,
            [userId],
            (err, row) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ stats: row });
            }
        );
    });

    return router;
};
