const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get user's friends
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.user_id, u.username, u.full_name 
            FROM users u
            JOIN user_friendships uf 
            ON (u.user_id = uf.friend_id OR u.user_id = uf.user_id)
            WHERE (uf.user_id = $1 OR uf.friend_id = $1) 
            AND uf.status = 'accepted'
            AND u.user_id != $1 -- Exclude the logged-in user
        `, [req.session.userId]);

        res.render('pages/friends', { friends: result.rows, user: req.session.user });
    } catch (err) {
        res.status(500).send('Error loading friends page');
    }
});

router.get('/friends-list', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.user_id, u.username, u.full_name 
            FROM users u
            JOIN user_friendships uf 
            ON (u.user_id = uf.friend_id OR u.user_id = uf.user_id)
            WHERE uf.status = 'accepted' 
            AND (uf.user_id = $1 OR uf.friend_id = $1)
            AND u.user_id != $1 -- Exclude the logged-in user
        `, [req.session.userId]);

        res.json(result.rows); // Return JSON for frontend
    } catch (err) {
        res.status(500).json({ error: 'Error fetching friends list' });
    }
});


// Send friend request
router.post('/request', async (req, res) => {
    const { friendId } = req.body;
    try {
        // Check for duplicate requests
        const existingRequest = await pool.query(
            'SELECT * FROM user_friendships WHERE user_id = $1 AND friend_id = $2',
            [req.session.userId, friendId]
        );
        if (existingRequest.rows.length > 0) {
            return res.status(400).json({ error: 'Friend request already sent.' });
        }
        // Insert the friend request
        await pool.query(
            'INSERT INTO user_friendships (user_id, friend_id, friendship_date, status) VALUES ($1, $2, CURRENT_DATE, $3)',
            [req.session.userId, friendId, 'pending']
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get pending friend requests
router.get('/pending', async (req, res) => {
    try {
        // Requests received by the logged-in user
        const receivedRequests = await pool.query(`
            SELECT u.user_id, u.username, u.full_name 
            FROM users u
            JOIN user_friendships uf ON (u.user_id = uf.user_id)
            WHERE uf.friend_id = $1 AND uf.status = 'pending'
        `, [req.session.userId]);

        // Requests sent by the logged-in user
        const sentRequests = await pool.query(`
            SELECT u.user_id, u.username, u.full_name 
            FROM users u
            JOIN user_friendships uf ON (u.user_id = uf.friend_id)
            WHERE uf.user_id = $1 AND uf.status = 'pending'
        `, [req.session.userId]);

        res.json({ received: receivedRequests.rows, sent: sentRequests.rows });
    } catch (err) {
        res.status(500).json({ error: 'Error fetching pending friend requests' });
    }
});

// Accept friend request
router.put('/accept/:friendId', async (req, res) => {
    const { friendId } = req.params;
    try {
        // Fix this query to ensure correct parameter order
        const existingRequest = await pool.query(
            'SELECT * FROM user_friendships WHERE user_id = $1 AND friend_id = $2 AND status = $3',
            [friendId, req.session.userId, 'pending']
        );

        if (existingRequest.rows.length === 0) {
            return res.status(400).json({ error: 'No pending friend request found.' });
        }

        // Ensure the UPDATE query is correct
        await pool.query(
            'UPDATE user_friendships SET status = $1 WHERE user_id = $2 AND friend_id = $3',
            ['accepted', friendId, req.session.userId]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Decline friend request
router.delete('/decline/:friendId', async (req, res) => {
    const { friendId } = req.params;
    try {
        await pool.query(
            'DELETE FROM user_friendships WHERE user_id = $1 AND friend_id = $2 AND status = $3',
            [friendId, req.session.userId, 'pending']
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error declining friend request' });
    }
});

// Unfriend a user
router.delete('/unfriend/:friendId', async (req, res) => {
    const { friendId } = req.params;
    const userId = req.session.userId;

    try {
        // Delete the friendship relationship
        await pool.query(`
            DELETE FROM user_friendships 
            WHERE (user_id = $1 AND friend_id = $2) 
            OR (user_id = $2 AND friend_id = $1)
        `, [userId, friendId]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error unfriending user' });
    }
});

// Search for user by username
router.get('/search', async (req, res) => {
    const { username } = req.query;
    try {
        const result = await pool.query(
            'SELECT user_id, username, full_name FROM users WHERE username = $1',
            [username]
        );
        if (result.rows.length === 0) {
            res.json({ error: 'User not found' });
        } else {
            res.json(result.rows[0]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Error searching for user' });
    }
});

module.exports = router;