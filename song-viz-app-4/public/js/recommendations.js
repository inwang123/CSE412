document.addEventListener('DOMContentLoaded', function() {
    loadRecommendedPlaylists();
});

async function loadRecommendedPlaylists() {
    try {
        const response = await fetch('/api/recommendations/playlists');
        const recommendations = await response.json();
        displayRecommendedPlaylists(recommendations);
    } catch (error) {
        console.error('Error loading recommended playlists:', error);
        showError('Failed to load recommended playlists');
    }
}

function displayRecommendedPlaylists(recommendations) {
    console.log('Received recommendations:', recommendations);
    
    const recommendedSection = document.getElementById('recommendedPlaylistsSection');
    
    if (!recommendedSection) {
        const playlistsGrid = document.getElementById('playlistsGrid');
        const section = document.createElement('div');
        section.id = 'recommendedPlaylistsSection';
        section.innerHTML = `
            <h3 class="mt-5 mb-4 text-white">Recommended Playlists</h3>
            <div class="row" id="recommendedPlaylistsGrid"></div>
        `;
        playlistsGrid.parentNode.insertBefore(section, playlistsGrid.nextSibling);
    }

    const recommendedGrid = document.getElementById('recommendedPlaylistsGrid');
    
    if (recommendations.length === 0) {
        recommendedGrid.innerHTML = `
            <div class="col-12">
                <div class="card p-4">
                    <p class="text-muted mb-0">No recommendations yet</p>
                </div>
            </div>
        `;
        return;
    }

    // Clear existing content before adding new recommendations
    recommendedGrid.innerHTML = '';

    recommendations.forEach(rec => {
        const recElement = document.createElement('div');
        recElement.className = 'col-md-4 mb-4';
        recElement.innerHTML = `
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">${rec.name}</h5>
                    <p class="card-text text-muted">
                        ${rec.description || 'No description'}
                    </p>
                    <p class="card-text">
                        <small class="text-muted">Recommended by ${rec.recommender_name}</small>
                    </p>
                    ${rec.reason ? `
                        <p class="card-text">
                            <small class="text-muted">"${rec.reason}"</small>
                        </p>
                    ` : ''}
                    <div class="d-flex justify-content-between align-items-center mt-3">
                        <div>
                            <button class="btn btn-sm btn-success me-2 accept-recommendation"
                                    data-recommendation-id="${rec.recommendation_id}">
                                Accept
                            </button>
                            <button class="btn btn-sm btn-danger reject-recommendation"
                                    data-recommendation-id="${rec.recommendation_id}">
                                Reject
                            </button>
                        </div>
                        <button class="btn btn-sm btn-outline-primary view-playlist-btn"
                                data-playlist-id="${rec.playlist_id}">
                            View Playlist
                        </button>
                    </div>
                </div>
            </div>
        `;
        recommendedGrid.appendChild(recElement);
    });

    // Re-attach event listeners
    document.querySelectorAll('.accept-recommendation').forEach(button => {
        button.addEventListener('click', () => acceptRecommendation(button.dataset.recommendationId));
    });

    document.querySelectorAll('.reject-recommendation').forEach(button => {
        button.addEventListener('click', () => rejectRecommendation(button.dataset.recommendationId));
    });

    document.querySelectorAll('.view-playlist-btn').forEach(button => {
        button.addEventListener('click', () => viewPlaylist(button.dataset.playlistId));
    });
}

function viewPlaylist(playlistId) {
    // Implement playlist viewing functionality
    console.log('Viewing playlist:', playlistId);
    window.location.href = `/playlists/${playlistId}`;
}

async function acceptRecommendation(recommendationId) {
    try {
        const response = await fetch(`/api/recommendations/playlists/${recommendationId}/accept`, {
            method: 'POST'  // Changed from PUT to POST
        });
        
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.error || 'Failed to accept recommendation');
        
        // If a new playlist was created, you might want to redirect or reload
        if (result.newPlaylistId) {
            window.location.href = `/playlists/${result.newPlaylistId}`;
        }
        
        // Reload recommended playlists
        loadRecommendedPlaylists();
        showSuccess('Recommendation accepted!');
    } catch (error) {
        console.error('Error accepting recommendation:', error);
        showError(error.message || 'Failed to accept recommendation');
    }
}

async function rejectRecommendation(recommendationId) {
    try {
        const response = await fetch(`/api/recommendations/playlists/${recommendationId}/reject`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to reject recommendation');
        }
        
        // Completely reload recommended playlists instead of appending
        await loadRecommendedPlaylists();
        showSuccess('Recommendation rejected');
    } catch (error) {
        console.error('Error rejecting recommendation:', error);
        showError(error.message || 'Failed to reject recommendation');
    }
}