const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const multer = require('multer')
const {
    db,
    databasePath,
    uploadsDir,
    hashPassword,
    buildUserRow,
    sendDatabaseError,
    initializeDatabase,
} = require('./database')

const app = express()

app.use(express.static(path.join(__dirname, 'public')))
app.use('/uploads', express.static(uploadsDir))
app.use(cors())
app.use(express.json())

const port = process.env.PORT || 5000

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

const upload = multer({
    storage: multer.diskStorage({
        destination(request, file, callback) {
            callback(null, uploadsDir)
        },
        filename(request, file, callback) {
            const extension = path.extname(file.originalname || '').toLowerCase()
            callback(null, `${crypto.randomUUID()}${extension}`)
        },
    }),
    fileFilter(request, file, callback) {
        if (!allowedImageTypes.has(file.mimetype)) {
            return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname))
        }

        return callback(null, true)
    },
    limits: {
        files: 5,
        fileSize: 5 * 1024 * 1024,
    },
})

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
        'SELECT id, name, color FROM tags ORDER BY name ASC',
        (error, rows) => {
            if (error) {
                return sendDatabaseError(response, error)
            }

            return response.json({ tags: rows || [] })
        }
    )
})

function parseTagIds(rawTagIds) {
    if (Array.isArray(rawTagIds)) {
        return rawTagIds
    }

    if (typeof rawTagIds === 'string' && rawTagIds.trim()) {
        try {
            const parsedTagIds = JSON.parse(rawTagIds)

            if (Array.isArray(parsedTagIds)) {
                return parsedTagIds
            }
        } catch (parseError) {
            return []
        }
    }

    return []
}

function mapImageRow(row) {
    return {
        id: row.id,
        url: `/uploads/${row.image_path}`,
        originalName: row.original_name,
        mimeType: row.mime_type,
        sortOrder: row.sort_order,
    }
}

function mapPostRow(row, images = []) {
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
        status: row.status || 'not',
        textBody: row.text_body,
        dateCreated: row.date_created,
        images,
    }
}

function cleanupUploadedFiles(files = []) {
    files.forEach((file) => {
        if (file?.path && fs.existsSync(file.path)) {
            try {
                fs.unlinkSync(file.path)
            } catch (error) {
                console.error('Failed to clean up uploaded file:', file.path, error.message)
            }
        }
    })
}

function loadPostImages(rows, callback) {
    const safeRows = Array.isArray(rows) ? rows : []

    if (safeRows.length === 0) {
        return callback(null, [])
    }

    const postIds = safeRows.map((row) => row.post_id)
    const placeholders = postIds.map(() => '?').join(', ')

    db.all(
        `SELECT id, post_id, image_path, original_name, mime_type, sort_order
         FROM post_images
         WHERE post_id IN (${placeholders})
         ORDER BY post_id ASC, sort_order ASC, id ASC`,
        postIds,
        (error, imageRows) => {
            if (error) {
                return callback(error)
            }

            const imagesByPostId = new Map()

            ;(Array.isArray(imageRows) ? imageRows : []).forEach((imageRow) => {
                if (!imagesByPostId.has(imageRow.post_id)) {
                    imagesByPostId.set(imageRow.post_id, [])
                }

                imagesByPostId.get(imageRow.post_id).push(mapImageRow(imageRow))
            })

            return callback(
                null,
                safeRows.map((row) => mapPostRow(row, imagesByPostId.get(row.post_id) || []))
            )
        }
    )
}

function insertPostImages(postId, files, callback) {
    const imageFiles = Array.isArray(files) ? files : []

    if (imageFiles.length === 0) {
        return callback(null, [])
    }

    const insertedImages = []

    function insertNext(index) {
        if (index >= imageFiles.length) {
            return callback(null, insertedImages)
        }

        const file = imageFiles[index]

        db.run(
            `INSERT INTO post_images (post_id, image_path, original_name, mime_type, sort_order)
             VALUES (?, ?, ?, ?, ?)`,
            [postId, file.filename, file.originalname, file.mimetype, index],
            function (error) {
                if (error) {
                    return callback(error)
                }

                insertedImages.push({
                    id: this.lastID,
                    url: `/uploads/${file.filename}`,
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    sortOrder: index,
                })

                return insertNext(index + 1)
            }
        )
    }

    return insertNext(0)
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
            posts.status,
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
            const limitedRows = safeRows.slice(0, limit)

            return loadPostImages(limitedRows, (imagesError, posts) => {
                if (imagesError) {
                    return sendDatabaseError(response, imagesError)
                }

                return response.json({ posts, hasMore })
            })
        }
    )
})

app.get('/api/posts/:id', (request, response) => {
    const postId = Number(request.params.id)

    if (!Number.isInteger(postId) || postId <= 0) {
        return response.status(400).json({ message: 'Valid post id is required.' })
    }

    db.get(
        `SELECT
            posts.post_id,
            posts.user_id,
            posts.title,
            posts.post_type,
            posts.tags,
            posts.status,
            posts.text_body,
            posts.date_created,
            users.full_name
         FROM posts
         INNER JOIN users ON users.id = posts.user_id
         WHERE posts.post_id = ?`,
        [postId],
        (error, row) => {
            if (error) {
                return sendDatabaseError(response, error)
            }

            if (!row) {
                return response.status(404).json({ message: 'Post not found.' })
            }

            if (row.status === 'deleted') {
                return response.json({
                    post: {
                        post_id: row.post_id,
                        status: row.status,
                    },
                })
            }

            return loadPostImages([row], (imagesError, posts) => {
                if (imagesError) {
                    return sendDatabaseError(response, imagesError)
                }

                return response.json({ post: posts[0] })
            })
        }
    )
})

app.get('/api/posts/:id/comments', (request, response) => {
    const postId = Number(request.params.id)

    if (!Number.isInteger(postId) || postId <= 0) {
        return response.status(400).json({ message: 'Valid post id is required.' })
    }

    db.get('SELECT comment_section_id FROM comment_sections WHERE post_id = ?', [postId], (error, section) => {
        if (error) {
            return sendDatabaseError(response, error)
        }

        if (!section) {
            return response.json({ comments: [] })
        }

        const commentSectionId = section.comment_section_id

        db.all(
            `SELECT c.*, u.full_name
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.comment_section_id = ?
             ORDER BY c.date_sent ASC`,
            [commentSectionId],
            (commentsError, comments) => {
                if (commentsError) {
                    return sendDatabaseError(response, commentsError)
                }

                return response.json({ comments: comments || [] })
            }
        )
    })
})

app.post('/api/posts/:id/comments', (request, response) => {
    const postId = Number(request.params.id)
    const { userId, content, replyingTo } = request.body || {}

    if (!Number.isInteger(postId) || postId <= 0) {
        return response.status(400).json({ message: 'Valid post id is required.' })
    }

    if (!Number.isInteger(userId) || userId <= 0) {
        return response.status(400).json({ message: 'userId is required.' })
    }

    const normalizedContent = String(content || '').trim()
    if (!normalizedContent) {
        return response.status(400).json({ message: 'Comment content cannot be empty.' })
    }

    const normalizedReplyingTo = replyingTo ? Number(replyingTo) : null
    if (replyingTo && (!Number.isInteger(normalizedReplyingTo) || normalizedReplyingTo <= 0)) {
        return response.status(400).json({ message: 'Invalid replying_to value.' })
    }

    db.get('SELECT comment_section_id FROM comment_sections WHERE post_id = ?', [postId], (error, section) => {
        if (error) {
            return sendDatabaseError(response, error)
        }

        if (!section) {
            return response.status(404).json({ message: 'Comment section for this post not found.' })
        }

        const commentSectionId = section.comment_section_id

        const columns = ['user_id', 'comment_section_id', 'content']
        const values = [userId, commentSectionId, normalizedContent]
        const placeholders = ['?', '?', '?']

        if (normalizedReplyingTo) {
            columns.push('replying_to')
            values.push(normalizedReplyingTo)
            placeholders.push('?')
        }

        const sql = `INSERT INTO comments (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`

        db.run(sql, values, function (insertError) {
            if (insertError) {
                return sendDatabaseError(response, insertError)
            }

            const newCommentId = this.lastID

            db.get('SELECT c.*, u.full_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.comment_id = ?', [newCommentId], (fetchError, newComment) => {
                if (fetchError) {
                    return response.status(201).json({ comment: { id: newCommentId } })
                }

                return response.status(201).json({ comment: newComment })
            })
        })
    })
})

app.delete('/api/posts/:id', (request, response) => {
    const postId = Number(request.params.id)

    if (!Number.isInteger(postId) || postId <= 0) {
        return response.status(400).json({ message: 'Valid post id is required.' })
    }

    db.get(
        'SELECT post_id FROM posts WHERE post_id = ?',
        [postId],
        (error, row) => {
            if (error) {
                return sendDatabaseError(response, error)
            }

            if (!row) {
                return response.status(404).json({ message: 'Post not found.' })
            }

            db.run(
                "UPDATE posts SET status = 'deleted' WHERE post_id = ?",
                [postId],
                (updateError) => {
                    if (updateError) {
                        return sendDatabaseError(response, updateError)
                    }

                    return response.json({
                        post: {
                            post_id: postId,
                            status: 'deleted',
                        },
                    })
                }
            )
        }
    )
})

app.put('/api/posts/:id', (request, response) => {
    const postId = Number(request.params.id)

    if (!Number.isInteger(postId) || postId <= 0) {
        return response.status(400).json({ message: 'Valid post id is required.' })
    }

    const { title, postTypeId, tagIds, textBody } = request.body || {}
    const normalizedTitle = String(title || '').trim()
    const normalizedTextBody = String(textBody || '').trim()
    const normalizedPostTypeId = Number(postTypeId)
    const normalizedTagIds = parseTagIds(tagIds)
        .map((tagId) => Number(tagId))
        .filter((tagId) => Number.isInteger(tagId) && tagId > 0)

    if (!normalizedTitle || !normalizedTextBody) {
        return response.status(400).json({ message: 'title and textBody are required.' })
    }

    if (!Number.isInteger(normalizedPostTypeId) || normalizedPostTypeId <= 0) {
        return response.status(400).json({ message: 'postTypeId is required.' })
    }

    db.get(
        `SELECT
            posts.post_id,
            posts.user_id,
            posts.status
         FROM posts
         WHERE posts.post_id = ?`,
        [postId],
        (lookupError, postRow) => {
            if (lookupError) {
                return sendDatabaseError(response, lookupError)
            }

            if (!postRow) {
                return response.status(404).json({ message: 'Post not found.' })
            }

            if (postRow.status === 'deleted') {
                return response.status(410).json({ message: 'Post is unavailable.' })
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

                    const resolveTagValue = (callback) => {
                        if (normalizedTagIds.length === 0) {
                            return callback(null, null)
                        }

                        const placeholders = normalizedTagIds.map(() => '?').join(', ')

                        db.all(
                            `SELECT id, name FROM tags WHERE id IN (${placeholders})`,
                            normalizedTagIds,
                            (tagsError, rows) => {
                                if (tagsError) {
                                    return callback(tagsError)
                                }

                                if (!rows || rows.length !== normalizedTagIds.length) {
                                    return callback(new Error('One or more selected tags are invalid.'))
                                }

                                const tagById = new Map(rows.map((row) => [row.id, row.name]))
                                const resolvedTags = normalizedTagIds.map((tagId) => tagById.get(tagId)).filter(Boolean)

                                return callback(null, resolvedTags.join(', '))
                            }
                        )
                    }

                    resolveTagValue((tagError, tagValue) => {
                        if (tagError) {
                            if (tagError.message === 'One or more selected tags are invalid.') {
                                return response.status(400).json({ message: tagError.message })
                            }

                            return sendDatabaseError(response, tagError)
                        }

                        db.run(
                            `UPDATE posts
                             SET title = ?, post_type = ?, tags = ?, text_body = ?
                             WHERE post_id = ?`,
                            [normalizedTitle, postTypeRow.name, tagValue, normalizedTextBody, postId],
                            (updateError) => {
                                if (updateError) {
                                    return sendDatabaseError(response, updateError)
                                }

                                return response.json({
                                    post: {
                                        id: postId,
                                        userId: postRow.user_id,
                                        title: normalizedTitle,
                                        postType: postTypeRow.name,
                                        tags: tagValue ? tagValue.split(', ').filter(Boolean) : [],
                                        status: postRow.status,
                                        textBody: normalizedTextBody,
                                    },
                                })
                            }
                        )
                    })
                }
            )
        }
    )
})

app.post('/api/posts', (request, response) => {
    upload.array('images', 5)(request, response, (uploadError) => {
        if (uploadError) {
            cleanupUploadedFiles(request.files || [])

            if (uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE') {
                return response.status(400).json({ message: 'Each image must be 5 MB or smaller.' })
            }

            if (uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_COUNT') {
                return response.status(400).json({ message: 'You can upload up to 5 images.' })
            }

            if (uploadError instanceof multer.MulterError) {
                return response.status(400).json({ message: 'Only image files are allowed.' })
            }

            return response.status(400).json({ message: 'Unable to upload images.' })
        }

        const uploadedFiles = Array.isArray(request.files) ? request.files : []
        const { userId, title, postTypeId, tagIds, textBody } = request.body || {}

        const normalizedTitle = String(title || '').trim()
        const normalizedTextBody = String(textBody || '').trim()
        const normalizedUserId = Number(userId)
        const normalizedPostTypeId = Number(postTypeId)
        const normalizedTagIds = parseTagIds(tagIds)
            .map((tagId) => Number(tagId))
            .filter((tagId) => Number.isInteger(tagId) && tagId > 0)

        if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
            cleanupUploadedFiles(uploadedFiles)
            return response.status(400).json({ message: 'userId is required.' })
        }

        if (!normalizedTitle || !normalizedTextBody) {
            cleanupUploadedFiles(uploadedFiles)
            return response.status(400).json({ message: 'title and textBody are required.' })
        }

        if (!Number.isInteger(normalizedPostTypeId) || normalizedPostTypeId <= 0) {
            cleanupUploadedFiles(uploadedFiles)
            return response.status(400).json({ message: 'postTypeId is required.' })
        }

        db.get(
            'SELECT id, name FROM post_types WHERE id = ?',
            [normalizedPostTypeId],
            (postTypeError, postTypeRow) => {
                if (postTypeError) {
                    cleanupUploadedFiles(uploadedFiles)
                    return sendDatabaseError(response, postTypeError)
                }

                if (!postTypeRow) {
                    cleanupUploadedFiles(uploadedFiles)
                    return response.status(400).json({ message: 'Selected post type is invalid.' })
                }

                const resolveTagValue = (callback) => {
                    if (normalizedTagIds.length === 0) {
                        return callback(null, null)
                    }

                    const placeholders = normalizedTagIds.map(() => '?').join(', ')

                    db.all(
                        `SELECT id, name FROM tags WHERE id IN (${placeholders})`,
                        normalizedTagIds,
                        (tagsError, rows) => {
                            if (tagsError) {
                                return callback(tagsError)
                            }

                            if (!rows || rows.length !== normalizedTagIds.length) {
                                return callback(new Error('One or more selected tags are invalid.'))
                            }

                            const tagById = new Map(rows.map((row) => [row.id, row.name]))
                            const resolvedTags = normalizedTagIds.map((tagId) => tagById.get(tagId)).filter(Boolean)

                            return callback(null, resolvedTags.join(', '))
                        }
                    )
                }

                resolveTagValue((tagError, tagValue) => {
                    if (tagError) {
                        cleanupUploadedFiles(uploadedFiles)

                        if (tagError.message === 'One or more selected tags are invalid.') {
                            return response.status(400).json({ message: tagError.message })
                        }

                        return sendDatabaseError(response, tagError)
                    }

                    db.run('BEGIN TRANSACTION', (beginError) => {
                        if (beginError) {
                            cleanupUploadedFiles(uploadedFiles)
                            return sendDatabaseError(response, beginError)
                        }

                        db.run(
                            'INSERT INTO posts (user_id, title, post_type, tags, status, text_body) VALUES (?, ?, ?, ?, ?, ?)',
                            [normalizedUserId, normalizedTitle, postTypeRow.name, tagValue, 'not', normalizedTextBody],
                            function (insertError) {
                                if (insertError) {
                                    cleanupUploadedFiles(uploadedFiles)

                                    return db.run('ROLLBACK', () => {
                                        sendDatabaseError(response, insertError)
                                    })
                                }

                                const postId = this.lastID

                                db.run(
                                    'INSERT INTO comment_sections (post_id) VALUES (?)',
                                    [postId],
                                    (commentSectionError) => {
                                        if (commentSectionError) {
                                            cleanupUploadedFiles(uploadedFiles)
                                            return db.run('ROLLBACK', () => {
                                                sendDatabaseError(response, commentSectionError)
                                            })
                                        }

                                        insertPostImages(postId, uploadedFiles, (imageError, insertedImages) => {
                                            if (imageError) {
                                                cleanupUploadedFiles(uploadedFiles)

                                                return db.run('ROLLBACK', () => {
                                                    sendDatabaseError(response, imageError)
                                                })
                                            }

                                            db.run('COMMIT', (commitError) => {
                                                if (commitError) {
                                                    cleanupUploadedFiles(uploadedFiles)

                                                    return db.run('ROLLBACK', () => {
                                                        sendDatabaseError(response, commitError)
                                                    })
                                                }

                                                return response.status(201).json({
                                                    post: {
                                                        id: postId,
                                                        userId: normalizedUserId,
                                                        title: normalizedTitle,
                                                        postType: postTypeRow.name,
                                                        tags: tagValue ? tagValue.split(', ').filter(Boolean) : [],
                                                        status: 'not',
                                                        textBody: normalizedTextBody,
                                                        images: insertedImages,
                                                    },
                                                })
                                            })
                                        })
                                    }
                                )
                            }
                        )
                    })
                })
            }
        )
    })
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

            return loadPostImages([row], (imagesError, posts) => {
                if (imagesError) {
                    return sendDatabaseError(response, imagesError)
                }

                return response.json({
                    post: posts[0],
                })
            })
        }
    )
})