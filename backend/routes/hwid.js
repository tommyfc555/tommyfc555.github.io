module.exports = (db) => {
    const router = require('express').Router();

    // Test route
    router.get('/test', (req, res) => {
        res.json({ message: 'HWID API is working!' });
    });

    return router;
};
