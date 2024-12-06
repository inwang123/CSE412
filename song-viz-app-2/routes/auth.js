const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('../db');
const { check, validationResult } = require('express-validator');

// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Login route
router.post('/login', [
    check('email').isEmail().withMessage('Please enter a valid email'),
    check('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('pages/login', {
                errors: errors.array(),
                email: req.body.email
            });
        }

        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length > 0) {
            const valid = await bcrypt.compare(password, result.rows[0].password_hash);
            if (valid) {
                // Set session data
                req.session.userId = result.rows[0].user_id;
                req.session.user = {
                    username: result.rows[0].username,
                    email: result.rows[0].email
                };
                res.redirect('/');
            } else {
                // Invalid password
                res.status(401).render('pages/login', {
                    errors: [{ msg: 'Invalid email or password' }],
                    email: email
                });
            }
        } else {
            // User not found
            res.status(401).render('pages/login', {
                errors: [{ msg: 'Invalid email or password' }],
                email: email
            });
        }
    } catch (err) {
        console.error('Login error:', err);
        let errorMessage = 'An error occurred during login. Please try again.';
        
        if (err.code === '42P01') {
            errorMessage = 'System error. Please contact administrator.';
        }

        res.status(500).render('pages/login', {
            errors: [{ msg: errorMessage }],
            email: req.body.email
        });
    }
});

// Logout route
router.get('/logout', (req, res) => {
    // Destroy the session
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Error logging out' });
        }
        
        // Clear the cookie
        res.clearCookie('connect.sid');
        
        // Redirect to login page
        res.redirect('/login');
    });
});


// Register route
router.post('/register', [
    check('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
    check('email').isEmail().withMessage('Please enter a valid email'),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    check('full_name').notEmpty().withMessage('Full name is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('pages/register', {
                errors: errors.array(),
                user: req.body
            });
        }

        const { username, email, password, full_name } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash, full_name, date_joined) VALUES ($1, $2, $3, $4, CURRENT_DATE) RETURNING *',
            [username, email, hashedPassword, full_name]
        );

        req.session.userId = result.rows[0].user_id;
        req.session.user = {
            username: result.rows[0].username,
            email: result.rows[0].email
        };

        res.redirect('/');
    } catch (err) {
        console.error('Registration error:', err);
        let errorMessage = 'An error occurred during registration.';
        
        if (err.code === '42P01') {
            errorMessage = 'Database setup required. Please contact administrator.';
        } else if (err.code === '23505') {
            if (err.constraint.includes('username')) {
                errorMessage = 'Username already taken';
            } else if (err.constraint.includes('email')) {
                errorMessage = 'Email already registered';
            }
        }

        res.status(500).render('pages/register', {
            errors: [{ msg: errorMessage }],
            user: req.body
        });
    }
});



module.exports = router;