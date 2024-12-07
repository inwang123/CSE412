document.addEventListener('DOMContentLoaded', function() {
    loadPlaylists();
    initializeEventListeners();
});

function initializeEventListeners() {
    // Save playlist button click handler
    document.getElementById('savePlaylistBtn').addEventListener('click', createPlaylist);
    document.getElementById('sendRecommendationBtn').addEventListener('click', sendRecommendation);
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

async function loadFriends() {
    try {
        console.log('Loading friends...');
        const response = await fetch('/api/friends/friends-list');
        const friends = await response.json();
        
        console.log('Friends loaded:', friends);
        console.log('Number of friends:', friends.length);
        
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
        <div class="col-md-4 mb-4">
            <div class="card h-100">
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
                        <div>
                            <button class="btn btn-outline-primary btn-sm me-2 recommend-playlist-btn" 
                                    data-playlist-id="${playlist.playlist_id}"
                                    data-playlist-name="${playlist.name}"
                                    data-bs-toggle="modal" 
                                    data-bs-target="#recommendPlaylistModal">
                                Recommend
                            </button>
                            <button class="btn btn-outline-primary btn-sm view-playlist-btn" 
                                    data-playlist-id="${playlist.playlist_id}">
                                View Playlist
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    // Add event listeners to all buttons
    document.querySelectorAll('.view-playlist-btn').forEach(button => {
        button.addEventListener('click', () => viewPlaylist(button.dataset.playlistId));
    });

    document.querySelectorAll('.recommend-playlist-btn').forEach(button => {
        button.addEventListener('click', () => setupRecommendModal(button.dataset.playlistId, button.dataset.playlistName));
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
function setupRecommendModal(playlistId, playlistName) {
    console.log('Setting up recommend modal for playlist:', playlistName);
    // Set the playlist information in the modal
    document.getElementById('recommendPlaylistId').value = playlistId;
    document.getElementById('recommendPlaylistName').textContent = `Recommend "${playlistName}"`;
    
    // Explicitly call loadFriends
    loadFriends();
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

async function sendRecommendation() {
    const playlistId = document.getElementById('recommendPlaylistId').value;
    const recipientId = document.getElementById('friendSelect').value;
    const reason = document.getElementById('recommendationReason').value;

    console.log('Sending recommendation:', { playlistId, recipientId, reason });

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

        const responseData = await response.json(); // Parse response

        if (!response.ok) {
            console.error('Recommendation error:', responseData);
            throw new Error(responseData.error || 'Failed to send recommendation');
        }

        // Close modal and reset form
        const modal = bootstrap.Modal.getInstance(document.getElementById('recommendPlaylistModal'));
        modal.hide();
        document.getElementById('recommendationReason').value = '';
        document.getElementById('friendSelect').value = '';

        showSuccess('Playlist recommended successfully!');
    } catch (error) {
        console.error('Full error sending recommendation:', error);
        showError(error.message || 'Failed to send recommendation');
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