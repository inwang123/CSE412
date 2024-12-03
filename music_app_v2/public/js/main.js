// Search functionality
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
let searchTimeout;

searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const query = e.target.value;
        if (query.length < 2) {
            searchResults.innerHTML = '';
            return;
        }

        try {
            const response = await fetch(`/songs/search?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            searchResults.innerHTML = data.map(track => `
                <div class="song-result p-2 border-bottom">
                    <h5>${track.name}</h5>
                    <p class="text-muted mb-1">by ${track.artist}</p>
                    <button class="btn btn-sm btn-primary recommend-btn" 
                            data-song='${JSON.stringify(track)}'>
                        Recommend
                    </button>
                </div>
            `).join('');

            // Add event listeners to recommend buttons
            document.querySelectorAll('.recommend-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const songData = JSON.parse(e.target.dataset.song);
                    await recommendSong(songData);
                });
            });
        } catch (err) {
            console.error('Search error:', err);
            searchResults.innerHTML = '<p class="text-danger">Error searching for songs</p>';
        }
    }, 300);
});

// Recommend song function
async function recommendSong(songData) {
    try {
        const response = await fetch('/songs/recommend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                song_data: songData,
                recipient_id: null, // Will be implemented when friend selection is added
                reason: 'Recommended from search'
            })
        });
        
        if (response.ok) {
            alert('Song recommended successfully!');
        } else {
            throw new Error('Failed to recommend song');
        }
    } catch (err) {
        console.error('Recommendation error:', err);
        alert('Error recommending song');
    }
}

// Initialize trending chart
const trendingChart = document.getElementById('trendingChart');
if (trendingChart) {
    new Chart(trendingChart, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Times Recommended',
                data: [],
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Load recent activity
async function loadRecentActivity() {
    const activityContainer = document.getElementById('recentActivity');
    if (!activityContainer) return;

    try {
        const response = await fetch('/songs/recommendations');
        const data = await response.json();
        
        activityContainer.innerHTML = data.map(rec => `
            <div class="activity-item p-2 border-bottom">
                <p class="mb-1">
                    <strong>${rec.recommender_name}</strong> recommended
                    <strong>${rec.title}</strong>
                </p>
                <small class="text-muted">
                    ${new Date(rec.recommendation_date).toLocaleDateString()}
                </small>
            </div>
        `).join('') || '<p>No recent activity</p>';
    } catch (err) {
        console.error('Error loading activity:', err);
        activityContainer.innerHTML = '<p class="text-danger">Error loading activity</p>';
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadRecentActivity();
});