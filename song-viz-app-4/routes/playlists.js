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

router.get('/friends-list', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT user_id, username 
             FROM users 
             WHERE user_id != $1 
             ORDER BY username`, 
            [req.session.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching friends:', err);
        res.status(500).json({ error: 'Failed to fetch friends' });
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

async function loadFriends() {
    try {
        console.log('Loading friends...');
        const response = await fetch('/api/friends/friends-list');
        const friends = await response.json();
        console.log('Friends loaded:', friends);
        
        const friendSelect = document.getElementById('friendSelect');
        if (!friendSelect) {
            console.error('Friend select element not found!');
            return;
        }
        
        friendSelect.innerHTML = `
            <option value="">Choose a friend...</option>
            ${friends.map(friend => `
                <option value="${friend.user_id}">${friend.username}</option>
            `).join('')}
        `;
    } catch (error) {
        console.error('Error loading friends:', error);
        showError('Failed to load friends list');
    }
}


async function sendRecommendation() {
    const playlistId = document.getElementById('recommendPlaylistId').value;
    const recipientId = document.getElementById('friendSelect').value;
    const reason = document.getElementById('recommendationReason').value;

    if (!recipientId) {
        showError('Please select a friend');
        return;
    }

    try {
        const response = await fetch('/api/recommendations/playlists', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                playlistId,
                recipientId,
                reason
            })
        });

        if (!response.ok) throw new Error('Failed to send recommendation');

        // Close modal and reset form
        const modal = bootstrap.Modal.getInstance(document.getElementById('recommendPlaylistModal'));
        modal.hide();
        document.getElementById('recommendationReason').value = '';
        document.getElementById('friendSelect').value = '';

        showSuccess('Playlist recommended successfully!');
    } catch (error) {
        console.error('Error sending recommendation:', error);
        showError('Failed to send recommendation');
    }
}


// And in your playlist routes
router.get('/:playlistId', async (req, res) => {
    try {
        // Fetch playlist details
        const playlistResult = await pool.query(
            `SELECT * FROM playlists 
             WHERE playlist_id = $1 AND (creator_id = $2 OR is_public = true)`,
            [req.params.playlistId, req.session.userId]
        );

        if (playlistResult.rows.length === 0) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        // Fetch songs in the playlist
        const songsResult = await pool.query(
            `SELECT s.*, ps.position_in_playlist
             FROM songs s
             JOIN playlist_songs ps ON s.song_id = ps.song_id
             WHERE ps.playlist_id = $1
             ORDER BY ps.position_in_playlist`,
            [req.params.playlistId]
        );

        const playlistData = {
            ...playlistResult.rows[0],
            songs: songsResult.rows
        };

        res.json(playlistData);
    } catch (err) {
        console.error('Error fetching playlist details:', err);
        res.status(500).json({ error: 'Failed to fetch playlist details' });
    }
});

// Add to your initializeEventListeners function
function initializeEventListeners() {
    // Existing event listeners...
    
    // Add send recommendation button listener
    document.getElementById('sendRecommendationBtn').addEventListener('click', sendRecommendation);
}

module.exports = router;