require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./db');
const path = require('path');

const app = express();

// Middleware
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
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

// Make user data available to all templates
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    next();
});

// Home route
app.get('/', (req, res) => {
    res.render('pages/index');
});

// Login route
app.get('/login', (req, res) => {
    res.render('pages/login');
});

// Register route
app.get('/register', (req, res) => {
    res.render('pages/register');
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/songs', require('./routes/songs'));
app.use('/playlists', require('./routes/playlists'));
app.use('/friends', require('./routes/friends'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});