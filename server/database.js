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
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        userType: user.user_type || 'basic',
    }
}

function sendDatabaseError(response) {
    console.error('Database error: ', arguments[1] || '(no error provided)')
    return response.status(500).json({ message: 'Database connection failed.' })
}

function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (error) {
            if (error) {
                return reject(error)
            }

            return resolve({
                lastID: this.lastID,
                changes: this.changes,
            })
        })
    })
}

function getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
            if (error) {
                return reject(error)
            }

            return resolve(row)
        })
    })
}

function allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) {
                return reject(error)
            }

            return resolve(rows || [])
        })
    })
}

function execAsync(sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, (error) => {
            if (error) {
                return reject(error)
            }

            return resolve()
        })
    })
}

async function withTransaction(work) {
    await execAsync('BEGIN TRANSACTION')

    try {
        const result = await work({
            db,
            run: runAsync,
            get: getAsync,
            all: allAsync,
            exec: execAsync,
        })

        await execAsync('COMMIT')

        return result
    } catch (error) {
        try {
            await execAsync('ROLLBACK')
        } catch (rollbackError) {
            console.error('Failed to rollback transaction:', rollbackError.message)
        }

        throw error
    }
}

function initializeDatabase(callback) {
    db.on('error', (error) => {
        console.error('SQLite error:', error.message)
    })

    db.serialize(() => {
        const handleErr = (tableName) => (err) => {
            if (err) {
                console.error(`Failed to prepare ${tableName}:`, err.message)
                process.exit(1)
            }
        }

        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                user_type TEXT NOT NULL DEFAULT 'basic'
            )
        `, handleErr('users'))

        db.run(`
            CREATE TABLE IF NOT EXISTS posts (
                post_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                post_type TEXT NOT NULL,
                tags TEXT,
                status TEXT NOT NULL DEFAULT 'not',
                text_body TEXT NOT NULL,
                attachment_type TEXT DEFAULT 'none',
                date_created TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `, handleErr('posts'))

        db.run(`
            CREATE TABLE IF NOT EXISTS post_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            )
        `, handleErr('post_types'))

        db.run(`
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL DEFAULT '#dce7dc'
            )
        `, handleErr('tags'))

        db.run(`
            CREATE TABLE IF NOT EXISTS post_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                image_path TEXT NOT NULL,
                original_name TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
            )
        `, handleErr('post_images'))

        db.run(`CREATE INDEX IF NOT EXISTS idx_post_images_post_sort ON post_images (post_id, sort_order, id)`, handleErr('idx_post_images_post_sort'))
        db.run(`CREATE INDEX IF NOT EXISTS idx_posts_user_date ON posts (user_id, date_created DESC)`, handleErr('idx_posts_user_date'))

        db.run(`
            CREATE TABLE IF NOT EXISTS comment_sections (
                comment_section_id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
            )
        `, handleErr('comment_sections'))

        db.run(`
            CREATE TABLE IF NOT EXISTS comments (
                comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                replying_to INTEGER,
                comment_section_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                date_sent TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (replying_to) REFERENCES comments(comment_id) ON DELETE CASCADE,
                FOREIGN KEY (comment_section_id) REFERENCES comment_sections(comment_section_id) ON DELETE CASCADE
            )
        `, handleErr('comments'))

        db.run(`
            CREATE TABLE IF NOT EXISTS rice_varieties (
                variety_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                quality_grade TEXT NOT NULL
            )
        `, handleErr('rice_varieties'))

        db.run(`
            CREATE TABLE IF NOT EXISTS stock_listing (
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
            )
        `, handleErr('stock_listing'))

        db.run(`
            CREATE TABLE IF NOT EXISTS production_batches (
                batch_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                variety_id INTEGER NOT NULL,
                current_stage TEXT NOT NULL,
                est_yield_sacks INTEGER NOT NULL,
                actual_yield_sacks INTEGER,
                PRIMARY KEY (batch_id, user_id), 
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (variety_id) REFERENCES rice_varieties(variety_id)
            )
        `, handleErr('production_batches'))

        db.run(`
            CREATE TABLE IF NOT EXISTS order_rfqs (
                order_id INTEGER PRIMARY KEY AUTOINCREMENT,
                buyer_id INTEGER NOT NULL,
                miller_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending',
                date_recorded TEXT DEFAULT (datetime('now', 'localtime')),
                fulfillment_deadline TEXT NOT NULL,
                FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (miller_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `, handleErr('order_rfqs'))

        db.run(`
            CREATE TABLE IF NOT EXISTS order_rfq_items (
                item_id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                variety_id INTEGER NOT NULL,
                requested_sacks INTEGER NOT NULL,
                FOREIGN KEY (order_id) REFERENCES order_rfqs(order_id) ON DELETE CASCADE,
                FOREIGN KEY (variety_id) REFERENCES rice_varieties(variety_id)
            )
        `, handleErr('order_rfq_items'))

        db.run(`
            CREATE TABLE IF NOT EXISTS external_rfqs (
                order_id INTEGER PRIMARY KEY AUTOINCREMENT,
                buyer_name TEXT NOT NULL,
                miller_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending',
                date_recorded TEXT DEFAULT (datetime('now', 'localtime')),
                fulfillment_deadline TEXT NOT NULL,
                FOREIGN KEY (miller_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `, handleErr('external_rfqs'))

        db.run(`
            CREATE TABLE IF NOT EXISTS external_rfq_items (
                item_id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                variety_id INTEGER NOT NULL,
                requested_sacks INTEGER NOT NULL,
                FOREIGN KEY (order_id) REFERENCES external_rfqs(order_id) ON DELETE CASCADE,
                FOREIGN KEY (variety_id) REFERENCES rice_varieties(variety_id)
            )
        `, handleErr('external_rfq_items'))

        db.run(`
            CREATE TABLE IF NOT EXISTS transactions (
                transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                transaction_type TEXT NOT NULL,
                reference_id TEXT NOT NULL,
                customer_id TEXT,
                timestamp TEXT DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, handleErr('transactions'))

        db.run(`
            CREATE TABLE IF NOT EXISTS inventory_logs (
                log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER NOT NULL,
                variety_id INTEGER NOT NULL,
                value_changed TEXT NOT NULL,
                before_value REAL NOT NULL,
                after_value REAL NOT NULL,
                logged_at TEXT DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE,
                FOREIGN KEY (variety_id) REFERENCES rice_varieties(variety_id)
            )
        `, handleErr('inventory_logs'))

        db.all(`PRAGMA table_info(inventory_logs)`, (inventoryLogError, columns) => {
            if (inventoryLogError) {
                return handleErr('inventory_logs')(inventoryLogError)
            }

            const existingColumns = new Set((columns || []).map((column) => column.name))

            if (!existingColumns.has('value_changed')) {
                db.run(`ALTER TABLE inventory_logs ADD COLUMN value_changed TEXT`, handleErr('inventory_logs'))
            }

            if (!existingColumns.has('before_value')) {
                db.run(`ALTER TABLE inventory_logs ADD COLUMN before_value REAL`, handleErr('inventory_logs'))
            }

            if (!existingColumns.has('after_value')) {
                db.run(`ALTER TABLE inventory_logs ADD COLUMN after_value REAL`, handleErr('inventory_logs'))
            }

            if (!existingColumns.has('logged_at')) {
                db.run(`ALTER TABLE inventory_logs ADD COLUMN logged_at TEXT`, handleErr('inventory_logs'))
            }
        })

        db.all(`PRAGMA table_info(posts)`, (err, columns) => {
            if (err) {
                return handleErr('posts')(err)
            }
            const existingColumns = new Set((columns || []).map((column) => column.name))
            if (!existingColumns.has('attachment_type')) {
                db.run(`ALTER TABLE posts ADD COLUMN attachment_type TEXT DEFAULT 'none'`, handleErr('posts'))
            }
        })

        db.all(`PRAGMA table_info(users)`, (err, columns) => {
            if (err) return handleErr('users')(err)
            const existingColumns = new Set((columns || []).map((column) => column.name))
            if (!existingColumns.has('username')) {
                db.run(`ALTER TABLE users ADD COLUMN username TEXT`, (alterErr) => {
                    if (alterErr) return handleErr('users')(alterErr)
                    db.run(`UPDATE users SET username = LOWER(REPLACE(REPLACE(full_name, ' ', ''), '@', '')) || id WHERE username IS NULL`, (updateErr) => {
                        if (updateErr) return handleErr('users')(updateErr)
                        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`, handleErr('users'))
                    })
                })
            }
        })

        db.run(`
            CREATE TABLE IF NOT EXISTS transaction_types (
                type_name TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL CHECK(category IN ('Inbound', 'Outbound', 'Adjustment')),
                quantity_direction TEXT NOT NULL CHECK(quantity_direction IN ('Positive (+)', 'Negative (-)', 'Both (+/-)')),
                description TEXT,
                PRIMARY KEY(type_name)
            )
        `, handleErr('transaction_types'))

        db.run(`
            INSERT OR IGNORE INTO transaction_types (type_name, category, quantity_direction, description) VALUES
            ('RESTOCK', 'Inbound', 'Positive (+)', 'Receiving fresh rice inventory from external suppliers or wholesale distributors.'),
            ('PRODUCTION', 'Inbound', 'Positive (+)', 'When a raw harvest finishes processing in your mill and becomes commercial sacks.'),
            ('CUSTOMER_RETURN', 'Inbound', 'Positive (+)', 'Cancelled orders or rejected stock that is physically returned to shelf inventory.'),
            ('SALE', 'Outbound', 'Negative (-)', 'Standard depletion of stock triggered by a customer purchase or order fulfillment.'),
            ('ALLOCATION_REMOVAL', 'Outbound', 'Negative (-)', 'Deducting directly from physical stock to fulfill a specific pre-committed obligation.'),
            ('WASTAGE', 'Outbound', 'Negative (-)', 'Writing off inventory due to spoilage, water damage, pest infestation, or broken sacks.'),
            ('MANUAL_CORRECTION', 'Adjustment', 'Both (+/-)', 'Realigning the database count with a real-world physical count during a warehouse audit.')
        `, handleErr('default transaction types'))

        db.run(`
            CREATE TABLE IF NOT EXISTS receipts (
                receipt_id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER,
                item TEXT NOT NULL,
                item_quantity INTEGER NOT NULL,
                cost REAL NOT NULL,
                date TEXT DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE
            )
        `, (err) => {
            handleErr('receipts')(err)
            if (typeof callback === 'function') {
                callback()
            }
        })
    })
}

module.exports = {
    db,
    databasePath,
    uploadsDir,
    hashPassword,
    buildUserRow,
    sendDatabaseError,
    runAsync,
    getAsync,
    allAsync,
    execAsync,
    withTransaction,
    initializeDatabase,
}