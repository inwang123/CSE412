document.addEventListener('DOMContentLoaded', function() {
    loadPlaylists();
    initializeEventListeners();
});

function initializeEventListeners() {
    // Save playlist button click handler
    document.getElementById('savePlaylistBtn').addEventListener('click', createPlaylist);
}

async function loadPlaylists() {
    try {
        const response = await fetch('/api/playlists');
        const playlists = await response.json();
        displayPlaylists(playlists);
    } catch (error) {
        console.error('Error loading playlists:', error);
        showError('Failed to load playlists');
    }
}

function displayPlaylists(playlists) {
    const playlistsGrid = document.getElementById('playlistsGrid');
    
    if (playlists.length === 0) {
        playlistsGrid.innerHTML = `
            <div class="col-12 text-center">
                <div class="card p-5">
                    <h4>No Playlists Yet</h4>
                    <p>Create your first playlist to get started!</p>
                    <button class="btn btn-primary mx-auto" style="width: fit-content;" 
                            data-bs-toggle="modal" data-bs-target="#createPlaylistModal">
                        Create Playlist
                    </button>
                </div>
            </div>
        `;
        return;
    }

    playlistsGrid.innerHTML = playlists.map(playlist => `
        <div class="col-md-4 mb-4" >
            <div class="card h-100" >
                <div class="card-body">
                    <h5 class="card-title">${playlist.name}</h5>
                    <p class="card-text text-muted">
                        ${playlist.description || 'No description'}
                    </p>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            ${playlist.is_public ? 'Public' : 'Private'} · 
                            Created ${new Date(playlist.creation_date).toLocaleDateString()}
                        </small>
                        <button class="btn btn-outline-primary btn-sm view-playlist-btn" 
                                data-playlist-id="${playlist.playlist_id}">
                            View Playlist
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    // Add event listeners to view buttons
    document.querySelectorAll('.view-playlist-btn').forEach(button => {
        button.addEventListener('click', () => viewPlaylist(button.dataset.playlistId));
    });
}

async function createPlaylist() {
    const nameInput = document.getElementById('playlistName');
    const descriptionInput = document.getElementById('playlistDescription');
    const isPublicInput = document.getElementById('isPublic');

    if (!nameInput.value.trim()) {
        showError('Please enter a playlist name');
        return;
    }

    const playlistData = {
        name: nameInput.value.trim(),
        description: descriptionInput.value.trim(),
        is_public: isPublicInput.checked
    };

    try {
        const response = await fetch('/api/playlists', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(playlistData)
        });

        if (!response.ok) {
            throw new Error('Failed to create playlist');
        }

        // Reset form and close modal
        document.getElementById('createPlaylistForm').reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById('createPlaylistModal'));
        modal.hide();

        // Reload playlists
        loadPlaylists();

        // Show success message
        showSuccess('Playlist created successfully!');
    } catch (error) {
        console.error('Error creating playlist:', error);
        showError('Failed to create playlist');
    }
}

function showError(message) {
    // You can implement a better error display system
    alert(message);
}

function showSuccess(message) {
    // You can implement a better success display system
    alert(message);
}

function viewPlaylist(playlistId) {
    // Implement playlist viewing functionality
    // This could navigate to a new page or open a modal with playlist details
    window.location.href = `/playlists/${playlistId}`;
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

async function deletePlaylist() {
    if (!confirm('Are you sure you want to delete this playlist? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/api/playlists/${PLAYLIST_ID}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete playlist');
        }

        // Redirect to playlists page
        window.location.href = '/playlists';
    } catch (err) {
        console.error('Error deleting playlist:', err);
        alert('Failed to delete playlist');
    }
}

async function removeSong(songId) {
    if (!confirm('Are you sure you want to remove this song from the playlist?')) {
        return;
    }

    try {
        const response = await fetch(`/api/playlists/${PLAYLIST_ID}/songs/${songId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to remove song');
        }

        // Refresh the page to show updated playlist
        location.reload();
    } catch (err) {
        console.error('Error removing song:', err);
        alert('Failed to remove song from playlist');
    }
}

// Update your song display code to use the duration formatter
function createSongListItem(song, index) {
    return `
        <tr>
            <td>${index + 1}</td>
            <td>${song.title}</td>
            <td>${song.artist}</td>
            <td>${formatDuration(song.duration_seconds)}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="removeSong(${song.song_id})">
                    Remove
                </button>
            </td>
        </tr>
    `;
}