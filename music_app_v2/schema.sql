-- Drop tables if they exist (in correct order due to dependencies)
DROP TABLE IF EXISTS song_recommendations CASCADE;
DROP TABLE IF EXISTS playlist_recommendations CASCADE;
DROP TABLE IF EXISTS recommendations CASCADE;
DROP TABLE IF EXISTS user_listening_history CASCADE;
DROP TABLE IF EXISTS playlist_songs CASCADE;
DROP TABLE IF EXISTS playlists CASCADE;
DROP TABLE IF EXISTS user_friendships CASCADE;
DROP TABLE IF EXISTS songs CASCADE;
DROP TABLE IF EXISTS session CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    date_joined DATE NOT NULL,
    total_listening_time INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create songs table
CREATE TABLE songs (
    song_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(100) NOT NULL,
    album VARCHAR(100),
    genre VARCHAR(50),
    release_year INT,
    duration_seconds INT,
    global_play_count INT DEFAULT 0
);

-- Create playlists table
CREATE TABLE playlists (
    playlist_id SERIAL PRIMARY KEY,
    creator_id INT REFERENCES users(user_id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    creation_date DATE NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    total_duration_seconds INT DEFAULT 0
);

-- Create playlist songs junction table
CREATE TABLE playlist_songs (
    playlist_id INT REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    song_id INT REFERENCES songs(song_id) ON DELETE CASCADE,
    added_date DATE NOT NULL,
    position_in_playlist INT NOT NULL,
    PRIMARY KEY (playlist_id, song_id)
);

-- Create user friends relationship table
CREATE TABLE user_friendships (
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    friend_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    friendship_date DATE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'accepted', 'blocked')),
    PRIMARY KEY (user_id, friend_id)
);

-- Create user listening history table
CREATE TABLE user_listening_history (
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    song_id INT REFERENCES songs(song_id) ON DELETE CASCADE,
    listen_date TIMESTAMP NOT NULL,
    listen_duration_seconds INT NOT NULL,
    PRIMARY KEY (user_id, song_id, listen_date)
);

-- Create recommendations table
CREATE TABLE recommendations (
    recommendation_id SERIAL PRIMARY KEY,
    recommender_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    recipient_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    recommendation_type VARCHAR(50) NOT NULL,
    recommendation_date TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected'))
);

-- Create song recommendations table
CREATE TABLE song_recommendations (
    recommendation_id INT PRIMARY KEY REFERENCES recommendations(recommendation_id) ON DELETE CASCADE,
    song_id INT REFERENCES songs(song_id) ON DELETE CASCADE,
    reason TEXT
);

-- Create playlist recommendations table
CREATE TABLE playlist_recommendations (
    recommendation_id INT PRIMARY KEY REFERENCES recommendations(recommendation_id) ON DELETE CASCADE,
    playlist_id INT REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    reason TEXT
);

-- Create sessions table for express-session
CREATE TABLE "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);


