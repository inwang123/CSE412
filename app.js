require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./db');
const path = require('path');

const app = express();

// Middlewar
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
    store: new pgSession({
        pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'your_fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } 
}));

// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Make user data available to all templates
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    next();
});

// Public routes
app.get('/login', (req, res) => {
    res.render('pages/login');
});

app.get('/register', (req, res) => {
    res.render('pages/register');
});

const discoverRouter = require('./routes/discover'); 
app.use('/discover', discoverRouter); 

// Protected routes (require authentication)
app.get('/', isAuthenticated, (req, res) => {
    res.render('pages/index');
});

app.get('/playlists', isAuthenticated, (req, res) => {
    res.render('pages/playlists');
});

// Add this with your other protected routes
app.get('/playlists/:id', isAuthenticated, async (req, res) => {
    try {
        const playlistResult = await pool.query(`
            SELECT p.*, u.username as creator_name
            FROM playlists p
            JOIN users u ON p.creator_id = u.user_id
            WHERE p.playlist_id = $1
        `, [req.params.id]);

        if (playlistResult.rows.length === 0) {
            return res.status(404).render('pages/error', { 
                message: 'Playlist not found' 
            });
        }

        const playlist = playlistResult.rows[0];
        
        // Get songs in playlist
        const songsResult = await pool.query(`
            SELECT s.*, ps.position_in_playlist
            FROM songs s
            JOIN playlist_songs ps ON s.song_id = ps.song_id
            WHERE ps.playlist_id = $1
            ORDER BY ps.position_in_playlist
        `, [req.params.id]);

        res.render('pages/playlist-detail', {
            playlist: playlist,
            songs: songsResult.rows
        });
    } catch (err) {
        console.error('Error fetching playlist:', err);
        res.status(500).render('pages/error', { 
            message: 'Error loading playlist' 
        });
    }
});

// API Routes
app.use('/auth', require('./routes/auth'));
app.use('/songs', isAuthenticated, require('./routes/songs'));
app.use('/api/playlists', isAuthenticated, require('./routes/playlists'));
app.use('/friends', isAuthenticated, require('./routes/friends'));
const usersRouter = require('./routes/users');
app.use('/users', usersRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});