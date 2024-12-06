// Search functionality
let searchTimeout;
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const searchSpinner = document.getElementById('searchSpinner');

searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
        searchResults.innerHTML = '';
        return;
    }

    searchTimeout = setTimeout(() => performSearch(query), 500);
});

async function performSearch(query) {
    try {
        searchSpinner.classList.remove('d-none');
        const response = await fetch(`/songs/search?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (!data || data.length === 0) {
            searchResults.innerHTML = '<p class="text-muted">No results found</p>';
            return;
        }

        searchResults.innerHTML = data.map(song => `
            <div class="song-result p-3 border-bottom hover-bg-light">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${song.name}</h6>
                        <p class="text-muted mb-0">${song.artist}</p>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary add-to-playlist-btn" 
                                data-song='${JSON.stringify(song)}'>
                            Add to Playlist
                        </button>
                        <button class="btn btn-sm btn-outline-success recommend-btn"
                                data-song='${JSON.stringify(song)}'>
                            Recommend
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners to buttons
        attachSongButtonListeners();
    } catch (err) {
        console.error('Search error:', err);
        searchResults.innerHTML = '<p class="text-danger">Error searching for songs</p>';
    } finally {
        searchSpinner.classList.add('d-none');
    }
}

function attachSongButtonListeners() {
    // Add to playlist buttons
    document.querySelectorAll('.add-to-playlist-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const song = JSON.parse(e.target.dataset.song);
            const playlists = await fetchUserPlaylists();
            showPlaylistSelectionModal(song, playlists);
        });
    });

    // Recommend buttons
    document.querySelectorAll('.recommend-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const song = JSON.parse(e.target.dataset.song);
            showRecommendModal(song);
        });
    });
}

// Recent Activity
async function loadRecentActivity() {
    const activityContainer = document.getElementById('recentActivity');
    try {
        const response = await fetch('/songs/recommendations');
        const data = await response.json();
        
        if (!data || data.length === 0) {
            activityContainer.innerHTML = '<p class="text-muted">No recent activity</p>';
            return;
        }

        activityContainer.innerHTML = data.map(activity => `
            <div class="activity-item p-2 border-bottom">
                <small class="text-muted d-block">
                    ${new Date(activity.recommendation_date).toLocaleDateString()}
                </small>
                <p class="mb-1">
                    <strong>${activity.recommender_name}</strong> recommended
                    <strong>${activity.title}</strong>
                </p>
                <small class="text-muted">${activity.reason || ''}</small>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading activity:', err);
        activityContainer.innerHTML = '<p class="text-danger">Error loading activity</p>';
    }
}

// Playlist Management
async function fetchUserPlaylists() {
    const playlistsContainer = document.getElementById('userPlaylists');
    try {
        const response = await fetch('/playlists');
        const playlists = await response.json();
        
        if (!playlists || playlists.length === 0) {
            playlistsContainer.innerHTML = '<p class="text-muted">No playlists yet</p>';
            return playlists;
        }

        playlistsContainer.innerHTML = playlists.map(playlist => `
            <div class="playlist-item p-2 border-bottom">
                <h6 class="mb-1">${playlist.name}</h6>
                <small class="text-muted">${playlist.description || ''}</small>
            </div>
        `).join('');

        return playlists;
    } catch (err) {
        console.error('Error loading playlists:', err);
        playlistsContainer.innerHTML = '<p class="text-danger">Error loading playlists</p>';
        return [];
    }
}

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadRecentActivity();
    fetchUserPlaylists();
    
    // Initialize the create playlist button
    const createPlaylistBtn = document.getElementById('createPlaylistBtn');
    const createPlaylistModal = new bootstrap.Modal(document.getElementById('createPlaylistModal'));
    
    createPlaylistBtn?.addEventListener('click', () => {
        createPlaylistModal.show();
    });

    // Handle playlist creation
    document.getElementById('savePlaylistBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('playlistName').value;
        const description = document.getElementById('playlistDescription').value;
        const isPublic = document.getElementById('isPublic').checked;

        try {
            const response = await fetch('/playlists', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, description, is_public: isPublic })
            });

            if (response.ok) {
                createPlaylistModal.hide();
                await fetchUserPlaylists(); // Refresh the playlists list
            } else {
                throw new Error('Failed to create playlist');
            }
        } catch (err) {
            console.error('Error creating playlist:', err);
            alert('Error creating playlist. Please try again.');
        }
    });
});