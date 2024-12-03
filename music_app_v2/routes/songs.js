const express = require('express');
const router = express.Router();
const axios = require('axios');
const { pool } = require('../db');

// Create axios instance for Last.fm API
const lastfm = axios.create({
    baseURL: 'http://ws.audioscrobbler.com/2.0/',
    params: {
        api_key: process.env.LASTFM_API_KEY,
        format: 'json'
    }
});

// Search songs
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;
        const response = await lastfm.get('', {
            params: {
                method: 'track.search',
                track: query,
                limit: 10
            }
        });

        const tracks = response.data.results.trackmatches.track.map(track => ({
            name: track.name,
            artist: track.artist,
            url: track.url,
            listeners: track.listeners,
            image: track.image?.find(img => img.size === 'medium')?.[('#text')] || ''
        }));

        res.json(tracks);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Error searching songs' });
    }
});

// Get recent recommendations
router.get('/recommendations', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                r.recommendation_id,
                r.recommendation_date,
                s.title,
                s.artist,
                u.username as recommender_name,
                sr.reason
            FROM recommendations r
            JOIN song_recommendations sr ON r.recommendation_id = sr.recommendation_id
            JOIN songs s ON sr.song_id = s.song_id
            JOIN users u ON r.recommender_id = u.user_id
            WHERE r.recipient_id = $1
            ORDER BY r.recommendation_date DESC
            LIMIT 10
        `, [req.session.userId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching recommendations:', err);
        res.status(500).json({ error: 'Error fetching recommendations' });
    }
});

// Add song recommendation
router.post('/recommend', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { song_data, recipient_id, reason } = req.body;

        // First check if song exists
        let songResult = await client.query(
            'SELECT song_id FROM songs WHERE title = $1 AND artist = $2',
            [song_data.name, song_data.artist]
        );

        let song_id;
        if (songResult.rows.length === 0) {
            // Insert new song
            const insertSong = await client.query(
                `INSERT INTO songs (
                    title, 
                    artist, 
                    duration_seconds, 
                    global_play_count
                ) VALUES ($1, $2, $3, $4) 
                RETURNING song_id`,
                [
                    song_data.name,
                    song_data.artist,
                    song_data.duration || 0,
                    parseInt(song_data.listeners) || 0
                ]
            );
            song_id = insertSong.rows[0].song_id;
        } else {
            song_id = songResult.rows[0].song_id;
        }

        // Create recommendation
        const recResult = await client.query(
            `INSERT INTO recommendations (
                recommender_id, 
                recipient_id, 
                recommendation_type, 
                recommendation_date,
                status
            ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4) 
            RETURNING recommendation_id`,
            [req.session.userId, recipient_id || req.session.userId, 'song', 'pending']
        );

        // Add song recommendation details
        await client.query(
            `INSERT INTO song_recommendations (
                recommendation_id, 
                song_id, 
                reason
            ) VALUES ($1, $2, $3)`,
            [recResult.rows[0].recommendation_id, song_id, reason || '']
        );

        await client.query('COMMIT');
        res.json({ success: true, recommendation_id: recResult.rows[0].recommendation_id });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating recommendation:', err);
        res.status(500).json({ error: 'Error creating recommendation' });
    } finally {
        client.release();
    }
});

// Get top recommended songs
router.get('/top-recommendations', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                s.title,
                s.artist,
                COUNT(sr.recommendation_id) as recommendation_count
            FROM songs s
            JOIN song_recommendations sr ON s.song_id = sr.song_id
            JOIN recommendations r ON sr.recommendation_id = r.recommendation_id
            GROUP BY s.song_id, s.title, s.artist
            ORDER BY recommendation_count DESC
            LIMIT 5
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching top recommendations:', err);
        res.status(500).json({ error: 'Error fetching top recommendations' });
    }
});

// Get user's listening history
router.get('/history', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                s.title,
                s.artist,
                ulh.listen_date,
                ulh.listen_duration_seconds
            FROM user_listening_history ulh
            JOIN songs s ON ulh.song_id = s.song_id
            WHERE ulh.user_id = $1
            ORDER BY ulh.listen_date DESC
            LIMIT 20
        `, [req.session.userId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching listening history:', err);
        res.status(500).json({ error: 'Error fetching listening history' });
    }
});

// Add song to listening history
router.post('/history', async (req, res) => {
    try {
        const { song_id, duration } = req.body;
        await pool.query(
            `INSERT INTO user_listening_history (
                user_id, 
                song_id, 
                listen_date, 
                listen_duration_seconds
            ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
            [req.session.userId, song_id, duration]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Error recording listening history:', err);
        res.status(500).json({ error: 'Error recording listening history' });
    }
});

module.exports = router;