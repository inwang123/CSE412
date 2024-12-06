const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all playlists for a user
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM playlists WHERE creator_id = $1 ORDER BY creation_date DESC',
            [req.session.userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new playlist
router.post('/', async (req, res) => {
    const { name, description, is_public } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO playlists (creator_id, name, description, creation_date, is_public) VALUES ($1, $2, $3, CURRENT_DATE, $4) RETURNING *',
            [req.session.userId, name, description, is_public]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add song to playlist
router.post('/:playlistId/songs', async (req, res) => {
    const { playlistId } = req.params;
    const { songId } = req.body;
    try {
        // Get current max position in playlist
        const posResult = await pool.query(
            'SELECT COALESCE(MAX(position_in_playlist), 0) as max_pos FROM playlist_songs WHERE playlist_id = $1',
            [playlistId]
        );
        const newPosition = posResult.rows[0].max_pos + 1;

        await pool.query(
            'INSERT INTO playlist_songs (playlist_id, song_id, added_date, position_in_playlist) VALUES ($1, $2, CURRENT_DATE, $3)',
            [playlistId, songId, newPosition]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;