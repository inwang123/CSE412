const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get recommended playlists for the user
router.get('/playlists', async (req, res) => {
    try {
        // Get playlists recommended by friends
        const result = await pool.query(`
            SELECT DISTINCT p.*, 
                   u.username as recommender_name, 
                   pr.reason, 
                   r.recommendation_date,
                   r.recommendation_id
            FROM playlists p
            JOIN playlist_recommendations pr ON p.playlist_id = pr.playlist_id
            JOIN recommendations r ON pr.recommendation_id = r.recommendation_id
            JOIN users u ON r.recommender_id = u.user_id
            WHERE r.recipient_id = $1 AND r.status = 'pending'
            ORDER BY r.recommendation_date DESC
        `, [req.session.userId]);
        
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching recommended playlists:', err);
        res.status(500).json({ error: 'Failed to fetch recommended playlists' });
    }
});

// Recommend a playlist to a friend
router.post('/playlists', async (req, res) => {
    const { playlistId, recipientId, reason } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Create recommendation record
        const recResult = await client.query(
            `INSERT INTO recommendations 
            (recommender_id, recipient_id, recommendation_type, recommendation_date, status)
            VALUES ($1, $2, 'playlist', CURRENT_TIMESTAMP, 'pending')
            RETURNING recommendation_id`,
            [req.session.userId, recipientId]
        );
        
        // Create playlist recommendation record
        await client.query(
            `INSERT INTO playlist_recommendations 
            (recommendation_id, playlist_id, reason)
            VALUES ($1, $2, $3)`,
            [recResult.rows[0].recommendation_id, playlistId, reason]
        );
        
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating playlist recommendation:', err);
        res.status(500).json({ error: 'Failed to create recommendation' });
    } finally {
        client.release();
    }
});

// Accept a playlist recommendation
router.post('/playlists/:recommendationId/accept', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { recommendationId } = req.params;

        // Verify the recommendation exists and is for the current user
        const recommendationCheck = await client.query(
            `SELECT 
                pr.playlist_id, 
                r.recipient_id 
            FROM playlist_recommendations pr
            JOIN recommendations r ON pr.recommendation_id = r.recommendation_id
            WHERE pr.recommendation_id = $1`,
            [recommendationId]
        );

        if (recommendationCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Recommendation not found' });
        }

        const recommendation = recommendationCheck.rows[0];

        // Ensure the current user is the recipient
        if (recommendation.recipient_id !== req.session.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Copy the playlist to the user's playlists
        const playlistCopy = await client.query(`
            INSERT INTO playlists (
                creator_id, 
                name, 
                description, 
                creation_date, 
                is_public
            )
            SELECT $1, 
                   name || ' (Recommended)', 
                   description, 
                   CURRENT_DATE, 
                   is_public 
            FROM playlists 
            WHERE playlist_id = $2
            RETURNING playlist_id
        `, [req.session.userId, recommendation.playlist_id]);

        const newPlaylistId = playlistCopy.rows[0].playlist_id;

        // Copy songs to the new playlist
        await client.query(`
            INSERT INTO playlist_songs (
                playlist_id, 
                song_id, 
                added_date, 
                position_in_playlist
            )
            SELECT $1, 
                   song_id, 
                   CURRENT_DATE, 
                   position_in_playlist
            FROM playlist_songs
            WHERE playlist_id = $2
        `, [newPlaylistId, recommendation.playlist_id]);

        // Mark recommendation and related record as accepted
        await client.query(
            `UPDATE recommendations 
             SET status = 'accepted' 
             WHERE recommendation_id = $1`,
            [recommendationId]
        );

        await client.query('COMMIT');
        res.json({ success: true, newPlaylistId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error accepting recommendation:', err);
        res.status(500).json({ error: 'Failed to accept recommendation' });
    } finally {
        client.release();
    }
});

// Reject recommendation
router.post('/playlists/:recommendationId/reject', async (req, res) => {
    try {
        await pool.query(
            `UPDATE recommendations 
             SET status = 'rejected' 
             WHERE recommendation_id = $1`,
            [req.params.recommendationId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Error rejecting recommendation:', err);
        res.status(500).json({ error: 'Failed to reject recommendation' });
    }
});

module.exports = router;