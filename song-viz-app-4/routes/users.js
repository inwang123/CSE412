const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get list of users for recommendation
router.get('/list', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT user_id, username FROM users WHERE user_id != $1 ORDER BY username',
            [req.session.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Error fetching users' });
    }
});

module.exports = router;