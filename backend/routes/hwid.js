module.exports = (db) => {
    const router = require('express').Router();

    // Get user's HWID
    router.get('/my-hwid', (req, res) => {
        const userId = req.user.userId;
        
        db.get(
            'SELECT hwid FROM hwids WHERE user_id = ?',
            [userId],
            (err, row) => {
                if (err || !row) {
                    return res.status(404).json({ error: 'HWID not found' });
                }
                res.json({ hwid: row.hwid });
            }
        );
    });

    return router;
};
