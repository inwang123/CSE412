const express = require('express');
const router = express.Router();
const { pool } = require('../db');


// Delete a playlist
router.delete('/:playlistId', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { playlistId } = req.params;

        // Verify ownership
        const playlistCheck = await client.query(
            'SELECT creator_id FROM playlists WHERE playlist_id = $1',
            [playlistId]
        );

        if (playlistCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        if (playlistCheck.rows[0].creator_id !== req.session.userId) {
            return res.status(403).json({ error: 'Unauthorized to delete this playlist' });
        }

        // Delete playlist songs first (due to foreign key constraint)
        await client.query(
            'DELETE FROM playlist_songs WHERE playlist_id = $1',
            [playlistId]
        );

        // Delete the playlist
        await client.query(
            'DELETE FROM playlists WHERE playlist_id = $1',
            [playlistId]
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting playlist:', err);
        res.status(500).json({ error: 'Error deleting playlist' });
    } finally {
        client.release();
    }
});

// Remove song from playlist
router.delete('/:playlistId/songs/:songId', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { playlistId, songId } = req.params;

        // Verify ownership
        const playlistCheck = await client.query(
            'SELECT creator_id FROM playlists WHERE playlist_id = $1',
            [playlistId]
        );

        if (playlistCheck.rows[0].creator_id !== req.session.userId) {
            throw new Error('Unauthorized to modify this playlist');
        }

        // Remove the song
        await client.query(
            'DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2',
            [playlistId, songId]
        );

        // Reorder remaining songs
        await client.query(`
            WITH numbered_songs AS (
                SELECT song_id, ROW_NUMBER() OVER (ORDER BY position_in_playlist) as new_position
                FROM playlist_songs
                WHERE playlist_id = $1
            )
            UPDATE playlist_songs ps
            SET position_in_playlist = ns.new_position
            FROM numbered_songs ns
            WHERE ps.playlist_id = $1 AND ps.song_id = ns.song_id
        `, [playlistId]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error removing song:', err);
        res.status(500).json({ error: 'Error removing song from playlist' });
    } finally {
        client.release();
    }
});

// Get playlist details
router.post('/:playlistId/songs', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { playlistId } = req.params;
        const { songId, songName, artist } = req.body;

        let finalSongId = songId;

        // If it's a new song, insert it first
        if (songId === 'new') {
            const songResult = await client.query(`
                INSERT INTO songs (title, artist, duration_seconds)
                VALUES ($1, $2, $3)
                RETURNING song_id
            `, [songName, artist, 180]); // Default 3 minutes duration
            finalSongId = songResult.rows[0].song_id;
        }

        // Get current max position
        const posResult = await client.query(`
            SELECT COALESCE(MAX(position_in_playlist), 0) as max_pos 
            FROM playlist_songs 
            WHERE playlist_id = $1
        `, [playlistId]);
        
        const newPosition = posResult.rows[0].max_pos + 1;

        // Add song to playlist
        await client.query(`
            INSERT INTO playlist_songs (
                playlist_id, 
                song_id, 
                added_date, 
                position_in_playlist
            ) VALUES ($1, $2, CURRENT_DATE, $3)
        `, [playlistId, finalSongId, newPosition]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding song to playlist:', err);
        res.status(500).json({ error: 'Error adding song to playlist' });
    } finally {
        client.release();
    }
});


// Get all playlists for the current user
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM playlists 
             WHERE creator_id = $1 
             ORDER BY creation_date DESC`, 
            [req.session.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching playlists:', err);
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
});



// Create new playlist
router.post('/', async (req, res) => {
    try {
        const { name, description, is_public } = req.body;
        
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Playlist name is required' });
        }

        const result = await pool.query(
            `INSERT INTO playlists (
                creator_id, 
                name, 
                description, 
                creation_date, 
                is_public
            ) VALUES ($1, $2, $3, CURRENT_DATE, $4) 
            RETURNING *`,
            [req.session.userId, name.trim(), description?.trim(), is_public]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating playlist:', err);
        res.status(500).json({ error: 'Failed to create playlist' });
    }
});

module.exports = router;