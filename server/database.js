const fs = require('fs')
const sqlite3 = require('sqlite3').verbose()
const crypto = require('crypto')
const path = require('path')

const databasePath = process.env.DB_PATH || path.join(__dirname, 'db', 'PadiBridge.db')
const uploadsDir = path.join(__dirname, 'uploads')
const db = new sqlite3.Database(databasePath)

fs.mkdirSync(uploadsDir, { recursive: true })

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex')
}

function buildUserRow(user) {
    return {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
    }
}

function sendDatabaseError(response) {
    console.error('Database error: ', arguments[1] || '(no error provided)')
    return response.status(500).json({ message: 'Database connection failed.' })
}

function initializeDatabase(callback) {
    db.on('error', (error) => {
        console.error('SQLite error:', error.message)
    })

    db.serialize(() => {
        db.run(
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`,
            (tableError) => {
                if (tableError) {
                    console.error('Failed to prepare users table:', tableError.message)
                    process.exit(1)
                }

                db.run(
                    `CREATE TABLE IF NOT EXISTS posts (
                        post_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        title TEXT NOT NULL,
                        post_type TEXT NOT NULL,
                        tags TEXT,
                        status TEXT NOT NULL DEFAULT 'not',
                        text_body TEXT NOT NULL,
                        date_created TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )`,
                    (postsTableError) => {
                        if (postsTableError) {
                            console.error('Failed to prepare posts table:', postsTableError.message)
                            process.exit(1)
                        }

                        db.run(
                            `CREATE TABLE IF NOT EXISTS post_types (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                name TEXT NOT NULL UNIQUE
                            )`,
                            (postTypesError) => {
                                if (postTypesError) {
                                    console.error('Failed to prepare post_types table:', postTypesError.message)
                                    process.exit(1)
                                }

                                db.run(
                                    `CREATE TABLE IF NOT EXISTS tags (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        name TEXT NOT NULL UNIQUE,
                                        color TEXT NOT NULL DEFAULT '#dce7dc'
                                    )`,
                                    (tagsError) => {
                                        if (tagsError) {
                                            console.error('Failed to prepare tags table:', tagsError.message)
                                            process.exit(1)
                                        }

                                        db.run(
                                            `CREATE TABLE IF NOT EXISTS post_images (
                                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                post_id INTEGER NOT NULL,
                                                image_path TEXT NOT NULL,
                                                original_name TEXT NOT NULL,
                                                mime_type TEXT NOT NULL,
                                                sort_order INTEGER NOT NULL DEFAULT 0,
                                                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                                                FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
                                            )`,
                                            (postImagesError) => {
                                                if (postImagesError) {
                                                    console.error('Failed to prepare post_images table:', postImagesError.message)
                                                    process.exit(1)
                                                }

                                                db.run(
                                                    `CREATE INDEX IF NOT EXISTS idx_post_images_post_sort
                                                     ON post_images (post_id, sort_order, id)`,
                                                    (postImagesIndexError) => {
                                                        if (postImagesIndexError) {
                                                            console.error('Failed to prepare post_images index:', postImagesIndexError.message)
                                                            process.exit(1)
                                                        }

                                                        db.run(
                                                            `CREATE INDEX IF NOT EXISTS idx_posts_user_date
                                                             ON posts (user_id, date_created DESC)`,
                                                            (indexError) => {
                                                                if (indexError) {
                                                                    console.error('Failed to prepare posts index:', indexError.message)
                                                                    process.exit(1)
                                                                }

                                                                if (typeof callback === 'function') {
                                                                    callback()
                                                                }
                                                            }
                                                        )
                                                    }
                                                )
                                            }
                                        )
                                    }
                                )
                            }
                        )
                    }
                )
            }
        )
    })
}

module.exports = {
    db,
    databasePath,
    uploadsDir,
    hashPassword,
    buildUserRow,
    sendDatabaseError,
    initializeDatabase,
}