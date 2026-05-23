const express = require('express')
const cors = require('cors')
const path = require('path')
const crypto = require('crypto')
const {
    db,
    databasePath,
    hashPassword,
    buildUserRow,
    sendDatabaseError,
    initializeDatabase,
} = require('./database')

const app = express()

app.use(express.static(path.join(__dirname, 'public')))
app.use(cors())
app.use(express.json())

const port = process.env.PORT || 5000

initializeDatabase(() => {
    app.listen(port, () => {
        console.log(`Server listening on port ${port}`)
        console.log(`Using database file ${databasePath}`)
    })
})

app.get('/api/health', (request, response) => {
    db.get('SELECT 1 AS ok', (error, result) => {
        if (error) {
            return sendDatabaseError(response, error)
        }

        return response.json({ ok: Boolean(result?.ok) })
    })
})

app.post('/api/auth/signup', (request, response) => {
    const { fullName, email, password } = request.body || {}

    if (!fullName || !email || !password) {
        return response.status(400).json({ message: 'fullName, email, and password are required.' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const normalizedFullName = String(fullName).trim()
    const passwordHash = hashPassword(String(password))

    db.get(
        'SELECT id FROM users WHERE email = ?',
        [normalizedEmail],
        (selectError, existingUser) => {
            if (selectError) {
                return sendDatabaseError(response, selectError)
            }

            if (existingUser) {
                return response.status(409).json({ message: 'An account with that email already exists.' })
            }

            db.run(
                'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)',
                [normalizedFullName, normalizedEmail, passwordHash],
                function (insertError) {
                    if (insertError) {
                        return sendDatabaseError(response, insertError)
                    }

                    const token = crypto.randomUUID()

                    return response.status(201).json({
                        token,
                        user: {
                            id: this.lastID,
                            fullName: normalizedFullName,
                            email: normalizedEmail,
                        },
                    })
                }
            )
        }
    )
})

app.post('/api/auth/login', (request, response) => {
    const { email, password } = request.body || {}

    if (!email || !password) {
        return response.status(400).json({ message: 'email and password are required.' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const passwordHash = hashPassword(String(password))

    db.get(
        'SELECT id, full_name, email FROM users WHERE email = ? AND password_hash = ?',
        [normalizedEmail, passwordHash],
        (error, user) => {
            if (error) {
                return sendDatabaseError(response, error)
            }

            if (!user) {
                return response.status(401).json({ message: 'Invalid email or password.' })
            }

            return response.json({
                token: crypto.randomUUID(),
                user: buildUserRow(user),
            })
        }
    )
})

app.get('/api/post-types', (request, response) => {
    db.all(
        'SELECT id, name FROM post_types ORDER BY name ASC',
        (error, rows) => {
            if (error) {
                return sendDatabaseError(response, error)
            }

            return response.json({ postTypes: rows || [] })
        }
    )
})

app.get('/api/tags', (request, response) => {
    db.all(
        'SELECT id, name FROM tags ORDER BY name ASC',
        (error, rows) => {
            if (error) {
                return sendDatabaseError(response, error)
            }

            return response.json({ tags: rows || [] })
        }
    )
})

function mapPostRow(row) {
    const tags = typeof row.tags === 'string' && row.tags.trim()
        ? row.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : []

    return {
        id: row.post_id,
        userId: row.user_id,
        title: row.title,
        user: row.full_name,
        postType: row.post_type,
        tags,
        textBody: row.text_body,
        dateCreated: row.date_created,
    }
}

app.get('/api/posts', (request, response) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 15, 1), 50)
    const offset = Math.max(Number(request.query.offset) || 0, 0)
    const fetchLimit = limit + 1

    db.all(
        `SELECT
            posts.post_id,
            posts.user_id,
            posts.title,
            posts.post_type,
            posts.tags,
            posts.text_body,
            posts.date_created,
            users.full_name
         FROM posts
         INNER JOIN users ON users.id = posts.user_id
         ORDER BY posts.date_created DESC, posts.post_id DESC
         LIMIT ? OFFSET ?`,
        [fetchLimit, offset],
        (error, rows) => {
            if (error) {
                return sendDatabaseError(response, error)
            }

            const safeRows = Array.isArray(rows) ? rows : []
            const hasMore = safeRows.length > limit
            const posts = safeRows.slice(0, limit).map(mapPostRow)

            return response.json({ posts, hasMore })
        }
    )
})

app.post('/api/posts', (request, response) => {
    const { userId, title, postTypeId, tagIds, textBody } = request.body || {}

    const normalizedTitle = String(title || '').trim()
    const normalizedTextBody = String(textBody || '').trim()
    const normalizedUserId = Number(userId)
    const normalizedPostTypeId = Number(postTypeId)
    const normalizedTagIds = Array.isArray(tagIds)
        ? tagIds.map((tagId) => Number(tagId)).filter((tagId) => Number.isInteger(tagId) && tagId > 0)
        : []

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
        return response.status(400).json({ message: 'userId is required.' })
    }

    if (!normalizedTitle || !normalizedTextBody) {
        return response.status(400).json({ message: 'title and textBody are required.' })
    }

    if (!Number.isInteger(normalizedPostTypeId) || normalizedPostTypeId <= 0) {
        return response.status(400).json({ message: 'postTypeId is required.' })
    }

    db.get(
        'SELECT id, name FROM post_types WHERE id = ?',
        [normalizedPostTypeId],
        (postTypeError, postTypeRow) => {
            if (postTypeError) {
                return sendDatabaseError(response, postTypeError)
            }

            if (!postTypeRow) {
                return response.status(400).json({ message: 'Selected post type is invalid.' })
            }

            if (normalizedTagIds.length === 0) {
                return insertPost(null, postTypeRow.name)
            }

            const placeholders = normalizedTagIds.map(() => '?').join(', ')

            db.all(
                `SELECT id, name FROM tags WHERE id IN (${placeholders})`,
                normalizedTagIds,
                (tagsError, rows) => {
                    if (tagsError) {
                        return sendDatabaseError(response, tagsError)
                    }

                    if (!rows || rows.length !== normalizedTagIds.length) {
                        return response.status(400).json({ message: 'One or more selected tags are invalid.' })
                    }

                    const tagById = new Map(rows.map((row) => [row.id, row.name]))
                    const resolvedTags = normalizedTagIds.map((tagId) => tagById.get(tagId)).filter(Boolean)

                    return insertPost(resolvedTags.join(', '), postTypeRow.name)
                }
            )

                    function insertPost(tagValue, postTypeName) {
                db.run(
                    'INSERT INTO posts (user_id, title, post_type, tags, text_body) VALUES (?, ?, ?, ?, ?)',
                    [normalizedUserId, normalizedTitle, postTypeName, tagValue, normalizedTextBody],
                    function (insertError) {
                        if (insertError) {
                            return sendDatabaseError(response, insertError)
                        }

                        return response.status(201).json({
                            post: {
                                id: this.lastID,
                                userId: normalizedUserId,
                                title: normalizedTitle,
                                postType: postTypeName,
                                tags: tagValue ? tagValue.split(', ').filter(Boolean) : [],
                                textBody: normalizedTextBody,
                            },
                        })
                    }
                )
            }
        }
    )
})

app.get('/api/posts/latest', (request, response) => {
    db.get(
        `SELECT
            posts.post_id,
            posts.user_id,
            posts.title,
            posts.post_type,
            posts.tags,
            posts.text_body,
            posts.date_created,
            users.full_name
         FROM posts
         INNER JOIN users ON users.id = posts.user_id
         ORDER BY posts.date_created DESC, posts.post_id DESC
         LIMIT 1`,
        (error, row) => {
            if (error) {
                return sendDatabaseError(response, error)
            }

            if (!row) {
                return response.status(404).json({ message: 'No posts found.' })
            }

            return response.json({
                post: mapPostRow(row),
            })
        }
    )
})