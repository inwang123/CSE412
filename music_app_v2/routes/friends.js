const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get user's friends
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.user_id, u.username, u.full_name 
            FROM users u
            JOIN user_friendships uf ON (u.user_id = uf.friend_id)
            WHERE uf.user_id = $1 AND uf.status = 'accepted'
        `, [req.session.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send friend request
router.post('/request', async (req, res) => {
    const { friendId } = req.body;
    try {
        await pool.query(
            'INSERT INTO user_friendships (user_id, friend_id, friendship_date, status) VALUES ($1, $2, CURRENT_DATE, $3)',
            [req.session.userId, friendId, 'pending']
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Accept friend request
router.put('/accept/:friendId', async (req, res) => {
    const { friendId } = req.params;
    try {
        await pool.query(
            'UPDATE user_friendships SET status = $1 WHERE user_id = $2 AND friend_id = $3',
            ['accepted', friendId, req.session.userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;