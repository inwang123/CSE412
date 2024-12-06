document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('songSearchInput');
    const searchResults = document.getElementById('searchResults');
    let searchTimeout;

    // Song search input handler
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            searchResults.innerHTML = '';
            return;
        }

        searchTimeout = setTimeout(() => searchSongs(query), 500);
    });

    // Set up delete buttons
    setupDeleteButtons();

    async function searchSongs(query) {
        try {
            searchResults.innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div></div>';
            
            const response = await fetch(`/songs/search?query=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Search failed');
            
            const songs = await response.json();
            
            if (songs.length === 0) {
                searchResults.innerHTML = '<div class="alert alert-info">No songs found</div>';
                return;
            }
            
            searchResults.innerHTML = songs.map(song => `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">${song.name}</h6>
                            <small class="text-muted">
                                ${song.artist}
                                ${song.listeners ? ` · ${Number(song.listeners).toLocaleString()} listeners` : ''}
                            </small>
                        </div>
                        <button class="btn btn-sm btn-primary add-song-btn" 
                                onclick="addSongToPlaylist(${JSON.stringify(song).replace(/"/g, '&quot;')})">
                            Add
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            console.error('Error searching songs:', err);
            searchResults.innerHTML = '<div class="alert alert-danger">Error searching songs</div>';
        }
    }
});

function setupDeleteButtons() {
    // Setup playlist delete button
    const deletePlaylistBtn = document.getElementById('deletePlaylistBtn');
    if (deletePlaylistBtn) {
        deletePlaylistBtn.addEventListener('click', deletePlaylist);
    }

    // Setup song remove buttons
    document.querySelectorAll('.remove-song-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const songId = e.target.dataset.songId;
            removeSong(songId);
        });
    });
}

async function deletePlaylist() {
    if (!confirm('Are you sure you want to delete this playlist? This cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/api/playlists/${PLAYLIST_ID}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete playlist');
        }

        // Redirect to playlists page
        window.location.href = '/playlists';
    } catch (error) {
        console.error('Error deleting playlist:', error);
        alert('Failed to delete playlist. Please try again.');
    }
}

async function removeSong(songId) {
    if (!confirm('Are you sure you want to remove this song from the playlist?')) {
        return;
    }

    try {
        const response = await fetch(`/api/playlists/${PLAYLIST_ID}/songs/${songId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to remove song');
        }

        // Refresh the page to show updated playlist
        window.location.reload();
    } catch (error) {
        console.error('Error removing song:', error);
        alert('Failed to remove song. Please try again.');
    }
}

async function addSongToPlaylist(songData) {
    try {
        const response = await fetch('/songs/add-to-playlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                playlistId: PLAYLIST_ID,
                songData: songData
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add song');
        }

        // Show success message
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = '<div class="alert alert-success">Song added successfully!</div>';
        
        // Refresh the page after a brief delay
        setTimeout(() => location.reload(), 1000);
    } catch (err) {
        console.error('Error adding song:', err);
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = `<div class="alert alert-danger">${err.message || 'Failed to add song'}</div>`;
    }
}