const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config(); 

router.get('/', async (req, res) => {
    const LAST_FM_API_KEY = process.env.LAST_FM_API_KEY;
    const LAST_FM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

    if (!LAST_FM_API_KEY) {
        return res.status(500).send('API Key is not set. Please check your .env file.');
    }

    try {
        // Fetch Top Tracks Globally
        const topTracksResponse = await axios.get(LAST_FM_BASE_URL, {
            params: {
                method: 'chart.gettoptracks',
                api_key: LAST_FM_API_KEY,
                format: 'json',
            },
        });
        const topTracks = topTracksResponse.data.tracks.track; 

        // Fetch Top Artists in America
        const topArtistsAmericaResponse = await axios.get(LAST_FM_BASE_URL, {
            params: {
                method: 'geo.gettopartists',
                country: 'United States',
                api_key: LAST_FM_API_KEY,
                format: 'json',
            },
        });
        const topArtistsAmerica = topArtistsAmericaResponse.data.topartists.artist; 
        res.render('pages/discover', {
            topTracks,
            topArtistsAmerica,
        });
    } catch (error) {
        console.error('Error fetching data from Last.fm:', error.message);
        res.status(500).send('An error occurred while loading the Discover page. Please try again later.');
    }
});

module.exports = router;
