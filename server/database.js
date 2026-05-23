const fs = require('fs')
const sqlite3 = require('sqlite3').verbose()
const crypto = require('crypto')
const path = require('path')

const databasePath = process.env.DB_PATH || path.join(__dirname, 'db', 'PadiBridge.db')
const uploadsDir = path.join(__dirname, 'uploads')
const db = new sqlite3.Database(databasePath)

// Wait up to 5 seconds if the database is temporarily locked by another process
db.configure('busyTimeout', 5000)

fs.mkdirSync(uploadsDir, { recursive: true })

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex')
}

function buildUserRow(user) {
    return {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        userType: user.user_type || 'basic',
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
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                user_type TEXT NOT NULL DEFAULT 'basic'
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

                                                                db.run(
                                                                    `CREATE TABLE IF NOT EXISTS comment_sections (
                                                                        comment_section_id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                        post_id INTEGER NOT NULL,
                                                                        status TEXT NOT NULL DEFAULT 'active',
                                                                        FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
                                                                    )`,
                                                                    (commentSectionError) => {
                                                                        if (commentSectionError) {
                                                                            console.error('Failed to prepare comment_sections table:', commentSectionError.message)
                                                                            process.exit(1)
                                                                        }

                                                                        db.run(
                                                                            `CREATE TABLE IF NOT EXISTS comments (
                                                                                comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                                user_id INTEGER NOT NULL,
                                                                                replying_to INTEGER,
                                                                                comment_section_id INTEGER NOT NULL,
                                                                                content TEXT NOT NULL,
                                                                                date_sent TEXT DEFAULT CURRENT_TIMESTAMP,
                                                                                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                                                                                FOREIGN KEY (replying_to) REFERENCES comments(comment_id) ON DELETE CASCADE,
                                                                                FOREIGN KEY (comment_section_id) REFERENCES comment_sections(comment_section_id) ON DELETE CASCADE
                                                                            )`,
                                                                            (commentsTableError) => {
                                                                                if (commentsTableError) {
                                                                                    console.error('Failed to prepare comments table:', commentsTableError.message)
                                                                                    process.exit(1)
                                                                                }

                                                                                db.run(
                                                                                    `CREATE TABLE IF NOT EXISTS rice_varieties (
                                                                                        variety_id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                                        name TEXT NOT NULL,
                                                                                        quality_grade TEXT NOT NULL
                                                                                    )`,
                                                                                    (riceVarietiesError) => {
                                                                                        if (riceVarietiesError) {
                                                                                            console.error('Failed to prepare rice_varieties table:', riceVarietiesError.message)
                                                                                            process.exit(1)
                                                                                        }

                                                                                        db.run(
                                                                                            `CREATE TABLE IF NOT EXISTS stock_listing (
                                                                                                stock_id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                                                user_id INTEGER NOT NULL,
                                                                                                variety_id INTEGER NOT NULL,
                                                                                                physical_sacks INTEGER DEFAULT 0 CHECK (physical_sacks >= 0),
                                                                                                allocated_sacks INTEGER DEFAULT 0 CHECK (allocated_sacks >= 0),
                                                                                                wholesale_price REAL DEFAULT 0.0,
                                                                                                last_updated TEXT DEFAULT (datetime('now', 'localtime')),
                                                                                                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                                                                                                FOREIGN KEY (variety_id) REFERENCES rice_varieties(variety_id),
                                                                                                UNIQUE (user_id, variety_id) 
                                                                                            )`,
                                                                                            (stockListingError) => {
                                                                                                if (stockListingError) {
                                                                                                    console.error('Failed to prepare stock_listing table:', stockListingError.message)
                                                                                                    process.exit(1)
                                                                                                }

                                                                                                db.run(
                                                                                                    `CREATE TABLE IF NOT EXISTS production_batches (
                                                                                                        batch_id TEXT NOT NULL,
                                                                                                        user_id INTEGER NOT NULL,
                                                                                                        variety_id INTEGER NOT NULL,
                                                                                                        current_stage TEXT NOT NULL,
                                                                                                        est_yield_sacks INTEGER NOT NULL,
                                                                                                        actual_yield_sacks INTEGER,
                                                                                                        PRIMARY KEY (batch_id, user_id), 
                                                                                                        FOREIGN KEY (user_id) REFERENCES users(id),
                                                                                                        FOREIGN KEY (variety_id) REFERENCES rice_varieties(variety_id)
                                                                                                    )`,
                                                                                                    (productionBatchesError) => {
                                                                                                        if (productionBatchesError) {
                                                                                                            console.error('Failed to prepare production_batches table:', productionBatchesError.message)
                                                                                                            process.exit(1)
                                                                                                        }

                                                                                                        db.run(
                                                                                                            `CREATE TABLE IF NOT EXISTS order_rfqs (
                                                                                                                order_id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                                                                buyer_id INTEGER NOT NULL,
                                                                                                                miller_id INTEGER NOT NULL,
                                                                                                                variety_id INTEGER NOT NULL,
                                                                                                                requested_sacks INTEGER NOT NULL,
                                                                                                                status TEXT NOT NULL DEFAULT 'Pending',
                                                                                                                date_recorded TEXT DEFAULT (datetime('now', 'localtime')),
                                                                                                                fulfillment_deadline TEXT NOT NULL,
                                                                                                                FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
                                                                                                                FOREIGN KEY (miller_id) REFERENCES users(id) ON DELETE CASCADE,
                                                                                                                FOREIGN KEY (variety_id) REFERENCES rice_varieties(variety_id)
                                                                                                            )`,
                                                                                                            (orderRfqsError) => {
                                                                                                                if (orderRfqsError) {
                                                                                                                    console.error('Failed to prepare order_rfqs table:', orderRfqsError.message)
                                                                                                                    process.exit(1)
                                                                                                                }

                                                                                                                db.run(
                                                                                                                    `CREATE TABLE IF NOT EXISTS external_rfqs (
                                                                                                                        order_id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                                                                        buyer_name TEXT NOT NULL,
                                                                                                                        miller_id INTEGER NOT NULL,
                                                                                                                        variety_id INTEGER NOT NULL,
                                                                                                                        requested_sacks INTEGER NOT NULL,
                                                                                                                        status TEXT NOT NULL DEFAULT 'Pending',
                                                                                                                        date_recorded TEXT DEFAULT (datetime('now', 'localtime')),
                                                                                                                        fulfillment_deadline TEXT NOT NULL,
                                                                                                                        FOREIGN KEY (miller_id) REFERENCES users(id) ON DELETE CASCADE,
                                                                                                                        FOREIGN KEY (variety_id) REFERENCES rice_varieties(variety_id)
                                                                                                                    )`,
                                                                                                                    (externalRfqsError) => {
                                                                                                                        if (externalRfqsError) {
                                                                                                                            console.error('Failed to prepare external_rfqs table:', externalRfqsError.message)
                                                                                                                            process.exit(1)
                                                                                                                        }

                                                                                                                db.run(
                                                                                                                    `CREATE TABLE IF NOT EXISTS inventory_logs (
                                                                                                                        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                                                                        user_id INTEGER NOT NULL,
                                                                                                                        variety_id INTEGER NOT NULL,
                                                                                                                        transaction_type TEXT NOT NULL,
                                                                                                                        quantity_change INTEGER NOT NULL,
                                                                                                                        reference_id TEXT NOT NULL,
                                                                                                                        timestamp TEXT DEFAULT (datetime('now', 'localtime')),
                                                                                                                        FOREIGN KEY (user_id) REFERENCES users(id),
                                                                                                                        FOREIGN KEY (variety_id) REFERENCES rice_varieties(variety_id)
                                                                                                                    )`,
                                                                                                                    (inventoryLogsError) => {
                                                                                                                        if (inventoryLogsError) {
                                                                                                                            console.error('Failed to prepare inventory_logs table:', inventoryLogsError.message)
                                                                                                                            process.exit(1)
                                                                                                                        }
                                                                                        
                                                                                        db.run(
                                                                                            `CREATE TABLE IF NOT EXISTS transaction_types (
                                                                                                type_name TEXT NOT NULL UNIQUE,
                                                                                                category TEXT NOT NULL CHECK(category IN ('Inbound', 'Outbound', 'Adjustment')),
                                                                                                quantity_direction TEXT NOT NULL CHECK(quantity_direction IN ('Positive (+)', 'Negative (-)', 'Both (+/-)')),
                                                                                                description TEXT,
                                                                                                PRIMARY KEY(type_name)
                                                                                            )`,
                                                                                            (transactionTypesError) => {
                                                                                                if (transactionTypesError) {
                                                                                                    console.error('Failed to prepare transaction_types table:', transactionTypesError.message)
                                                                                                    process.exit(1)
                                                                                                }

                                                                                                db.run(
                                                                                                    `INSERT OR IGNORE INTO transaction_types (type_name, category, quantity_direction, description) VALUES
                                                                                                    ('RESTOCK', 'Inbound', 'Positive (+)', 'Receiving fresh rice inventory from external suppliers or wholesale distributors.'),
                                                                                                    ('PRODUCTION', 'Inbound', 'Positive (+)', 'When a raw harvest finishes processing in your mill and becomes commercial sacks.'),
                                                                                                    ('CUSTOMER_RETURN', 'Inbound', 'Positive (+)', 'Cancelled orders or rejected stock that is physically returned to shelf inventory.'),
                                                                                                    ('SALE', 'Outbound', 'Negative (-)', 'Standard depletion of stock triggered by a customer purchase or order fulfillment.'),
                                                                                                    ('ALLOCATION_REMOVAL', 'Outbound', 'Negative (-)', 'Deducting directly from physical stock to fulfill a specific pre-committed obligation.'),
                                                                                                    ('WASTAGE', 'Outbound', 'Negative (-)', 'Writing off inventory due to spoilage, water damage, pest infestation, or broken sacks.'),
                                                                                                    ('MANUAL_CORRECTION', 'Adjustment', 'Both (+/-)', 'Realigning the database count with a real-world physical count during a warehouse audit.')`,
                                                                                                    (insertError) => {
                                                                                                        if (insertError) {
                                                                                                            console.error('Failed to insert default transaction types:', insertError.message)
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