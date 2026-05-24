const express = require('express')
const crypto = require('crypto')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const {
    db,
    uploadsDir,
    hashPassword,
    buildUserRow,
    sendDatabaseError,
} = require('./database')

const router = express.Router()

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

router.get('/api/health', (request, response) => {
    db.get('SELECT 1 AS ok', (error, result) => {
        if (error) {
            return sendDatabaseError(response, error)
        }

        return response.json({ ok: Boolean(result?.ok) })
    })
})

router.post('/api/auth/signup', (request, response) => {
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
                            userType: 'basic',
                        },
                    })
                }
            )
        }
    )
})

router.post('/api/auth/login', (request, response) => {
    const { email, password } = request.body || {}

    if (!email || !password) {
        return response.status(400).json({ message: 'email and password are required.' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const passwordHash = hashPassword(String(password))

    db.get(
        'SELECT id, full_name, email, user_type FROM users WHERE email = ? AND password_hash = ?',
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

router.put('/api/users/:id', (request, response) => {
    const userId = Number(request.params.id)
    const { fullName, email } = request.body || {}

    if (!Number.isInteger(userId) || userId <= 0) {
        return response.status(400).json({ message: 'Valid user id is required.' })
    }

    const normalizedEmail = String(email || '').trim().toLowerCase()
    const normalizedFullName = String(fullName || '').trim()

    if (!normalizedEmail || !normalizedFullName) {
        return response.status(400).json({ message: 'Full name and email are required.' })
    }

    db.get(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [normalizedEmail, userId],
        (error, existingUser) => {
            if (error) {
                return sendDatabaseError(response, error)
            }

            if (existingUser) {
                return response.status(409).json({ message: 'Email is already in use by another account.' })
            }

            db.run(
                'UPDATE users SET full_name = ?, email = ? WHERE id = ?',
                [normalizedFullName, normalizedEmail, userId],
                (updateError) => {
                    if (updateError) {
                        return sendDatabaseError(response, updateError)
                    }

                    db.get('SELECT id, full_name, email, user_type FROM users WHERE id = ?', [userId], (fetchError, updatedUser) => {
                        if (fetchError) {
                            return sendDatabaseError(response, fetchError)
                        }
                        return response.json({ user: buildUserRow(updatedUser) })
                    })
                }
            )
        }
    )
})

router.get('/api/post-types', (request, response) => {
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

router.get('/api/tags', (request, response) => {
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

router.get('/api/posts', (request, response) => {
    const { limit: qLimit, offset: qOffset, postType, tags, startDate, endDate } = request.query

    const limit = Math.min(Math.max(Number(qLimit) || 15, 1), 50)
    const offset = Math.max(Number(qOffset) || 0, 0)
    const fetchLimit = limit + 1

    const whereClauses = ["posts.status <> 'deleted'"]
    const queryParams = []

    if (postType) {
        whereClauses.push('posts.post_type = ?')
        queryParams.push(postType)
    }

    if (tags) {
        const tagList = String(tags).split(',').filter(Boolean)
        if (tagList.length > 0) {
            const tagWhere = tagList.map(() => `(',' || REPLACE(posts.tags, ', ', ',') || ',' LIKE ?)`).join(' OR ')
            whereClauses.push(`(${tagWhere})`)
            tagList.forEach(tag => queryParams.push(`%,${tag},%`))
        }
    }

    if (startDate) {
        whereClauses.push('DATE(posts.date_created) >= DATE(?)')
        queryParams.push(startDate)
    }

    if (endDate) {
        whereClauses.push('DATE(posts.date_created) <= DATE(?)')
        queryParams.push(endDate)
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const sql = `SELECT
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
         ${whereString}
         ORDER BY posts.date_created DESC, posts.post_id DESC
         LIMIT ? OFFSET ?`

    const finalParams = [...queryParams, fetchLimit, offset]

    db.all(sql, finalParams, (error, rows) => {
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
    })
})

// Moved latest endpoint ABOVE /:id endpoint to prevent shadowing
router.get('/api/posts/latest', (request, response) => {
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

router.get('/api/posts/:id', (request, response) => {
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

router.get('/api/posts/:id/comments', (request, response) => {
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

router.post('/api/posts/:id/comments', (request, response) => {
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

router.delete('/api/posts/:id', (request, response) => {
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

router.put('/api/posts/:id', (request, response) => {
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

router.post('/api/posts', (request, response) => {
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

router.get('/api/stock-listings', (request, response) => {
    const { userId } = request.query
    let sql = `SELECT
            sl.stock_id,
            sl.variety_id,
            sl.user_id,
            sl.physical_sacks,
            sl.allocated_sacks,
            sl.wholesale_price,
            rv.name,
            rv.quality_grade
         FROM stock_listing sl
         INNER JOIN rice_varieties rv ON sl.variety_id = rv.variety_id`
    const params = []
    
    if (userId) {
        sql += ` WHERE sl.user_id = ?`
        params.push(Number(userId))
    }
    
    sql += ` ORDER BY sl.last_updated DESC`

    db.all(
        sql,
        params,
        (error, rows) => {
            if (error) {
                return sendDatabaseError(response, error)
            }

            return response.json({ stockListings: rows || [] })
        }
    )
})

router.put('/api/stock-listings/:id', (request, response) => {
    const stockId = Number(request.params.id)
    const { userId, physicalSacks, allocatedSacks, wholesalePrice, referenceId, timestamp } = request.body || {}

    if (!Number.isInteger(stockId) || stockId <= 0) {
        return response.status(400).json({ message: 'Valid stock id is required.' })
    }

    if (!userId) {
        return response.status(400).json({ message: 'User ID is required.' })
    }

    const newPhysical = Number(physicalSacks)
    const newAllocated = Number(allocatedSacks)
    const newPrice = Number(wholesalePrice)

    if (!Number.isInteger(newPhysical) || newPhysical < 0 || !Number.isInteger(newAllocated) || newAllocated < 0 || isNaN(newPrice) || newPrice < 0) {
        return response.status(400).json({ message: 'Invalid stock values provided.' })
    }

    db.get('SELECT * FROM stock_listing WHERE stock_id = ? AND user_id = ?', [stockId, userId], (error, currentStock) => {
        if (error) return sendDatabaseError(response, error)
        if (!currentStock) return response.status(404).json({ message: 'Stock listing not found or unauthorized.' })

        const physicalChange = newPhysical - currentStock.physical_sacks

        db.run('BEGIN TRANSACTION', (beginError) => {
            if (beginError) return sendDatabaseError(response, beginError)

            const updateStock = () => {
                db.run(
                    `UPDATE stock_listing 
                     SET physical_sacks = ?, allocated_sacks = ?, wholesale_price = ?, last_updated = datetime('now', 'localtime') 
                     WHERE stock_id = ?`,
                    [newPhysical, newAllocated, newPrice, stockId],
                    (updateError) => {
                        if (updateError) return db.run('ROLLBACK', () => sendDatabaseError(response, updateError))
                        db.run('COMMIT', (commitError) => {
                            if (commitError) return db.run('ROLLBACK', () => sendDatabaseError(response, commitError))
                            return response.json({ message: 'Stock updated successfully.' })
                        })
                    }
                )
            }

            if (physicalChange !== 0) {
                db.run(
                    `INSERT INTO transactions (user_id, transaction_type, reference_id, customer_id, timestamp) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now', 'localtime')))`,
                    [userId, 'MANUAL_CORRECTION', referenceId || 'MODIFICATION', null, timestamp || null],
                    function (txError) {
                        if (txError) return db.run('ROLLBACK', () => sendDatabaseError(response, txError))
                        db.run(
                            `INSERT INTO inventory_logs (transaction_id, variety_id, quantity_change) VALUES (?, ?, ?)`,
                            [this.lastID, currentStock.variety_id, physicalChange],
                            (insertError) => {
                                if (insertError) return db.run('ROLLBACK', () => sendDatabaseError(response, insertError))
                                updateStock()
                            }
                        )
                    }
                )
            } else {
                updateStock()
            }
        })
    })
})

router.get('/api/rice-varieties', (request, response) => {
    db.all(
        'SELECT variety_id, name, quality_grade FROM rice_varieties ORDER BY name ASC',
        (error, rows) => {
            if (error) {
                return sendDatabaseError(response, error)
            }
            return response.json({ riceVarieties: rows || [] })
        }
    )
})

router.get('/api/transaction-types', (request, response) => {
    db.all(
        `SELECT type_name, category, quantity_direction, description FROM transaction_types ORDER BY category ASC, type_name ASC`,
        (error, rows) => {
            if (error) {
                return sendDatabaseError(response, error)
            }

            return response.json({ transactionTypes: rows || [] })
        }
    )
})

router.get('/api/inventory-logs', (request, response) => {
    const { userId } = request.query
    
    let sql = `
        SELECT 
            il.log_id,
            t.transaction_id,
            t.user_id,
            il.variety_id,
            t.transaction_type,
            il.quantity_change,
            t.reference_id,
            t.timestamp,
            t.customer_id,
            rv.name AS variety_name,
            rv.quality_grade,
            tt.category,
            tt.quantity_direction
        FROM inventory_logs il
        INNER JOIN transactions t ON il.transaction_id = t.transaction_id
        LEFT JOIN rice_varieties rv ON il.variety_id = rv.variety_id
        LEFT JOIN transaction_types tt ON t.transaction_type = tt.type_name
    `
    
    const params = []
    if (userId) {
        sql += ` WHERE t.user_id = ?`
        params.push(Number(userId))
    }
    
    sql += ` ORDER BY t.timestamp DESC`

    db.all(sql, params, (error, rows) => {
        if (error) {
            return sendDatabaseError(response, error)
        }
        return response.json({ inventoryLogs: rows || [] })
    })
})

router.get('/api/inventory-logs/:id', (request, response) => {
    const logId = Number(request.params.id)

    if (!Number.isInteger(logId) || logId <= 0) {
        return response.status(400).json({ message: 'Valid log id is required.' })
    }

    db.get(
        `SELECT 
            il.log_id,
            t.transaction_id,
            t.user_id,
            il.variety_id,
            t.transaction_type,
            il.quantity_change,
            t.reference_id,
            t.timestamp,
            t.customer_id,
            rv.name AS variety_name,
            rv.quality_grade,
            tt.category,
            tt.quantity_direction
        FROM inventory_logs il
        INNER JOIN transactions t ON il.transaction_id = t.transaction_id
        LEFT JOIN rice_varieties rv ON il.variety_id = rv.variety_id
        LEFT JOIN transaction_types tt ON t.transaction_type = tt.type_name
        WHERE il.log_id = ?`,
        [logId],
        (error, row) => {
            if (error) {
                return sendDatabaseError(response, error)
            }
            if (!row) {
                return response.status(404).json({ message: 'Inventory log not found.' })
            }
            return response.json({ inventoryLog: row })
        }
    )
})

router.post('/api/inventory-logs', (request, response) => {
    const { userId, varietyId, transactionType, quantityChange, referenceId, customerId, timestamp } = request.body || {}

    if (!userId || !varietyId || !transactionType || quantityChange === undefined) {
        return response.status(400).json({ message: 'Missing required fields for inventory log.' })
    }

    const inputChange = Number(quantityChange)
    if (!Number.isInteger(inputChange)) {
        return response.status(400).json({ message: 'Quantity change must be an integer.' })
    }

    db.get('SELECT quantity_direction FROM transaction_types WHERE type_name = ?', [transactionType], (typeError, typeRow) => {
        if (typeError) return sendDatabaseError(response, typeError)
        if (!typeRow) return response.status(400).json({ message: 'Invalid transaction type.' })

        let actualChange = inputChange
        if (typeRow.quantity_direction === 'Negative (-)') {
            actualChange = -Math.abs(inputChange)
        } else if (typeRow.quantity_direction === 'Positive (+)') {
            actualChange = Math.abs(inputChange)
        }

        db.run('BEGIN TRANSACTION', (beginError) => {
            if (beginError) return sendDatabaseError(response, beginError)

            db.run(
                `INSERT INTO transactions (user_id, transaction_type, reference_id, customer_id, timestamp) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now', 'localtime')))`,
                [userId, transactionType, referenceId || '', customerId || null, timestamp || null],
                function (txError) {
                    if (txError) return db.run('ROLLBACK', () => sendDatabaseError(response, txError))
                    const transactionId = this.lastID

                    db.run(
                        `INSERT INTO inventory_logs (transaction_id, variety_id, quantity_change) VALUES (?, ?, ?)`,
                        [transactionId, varietyId, actualChange],
                        function (insertError) {
                            if (insertError) return db.run('ROLLBACK', () => sendDatabaseError(response, insertError))
                            const logId = this.lastID

                            db.run(
                                `INSERT INTO stock_listing (user_id, variety_id, physical_sacks, allocated_sacks, wholesale_price)
                                 VALUES (?, ?, MAX(0, ?), 0, 0.0)
                                 ON CONFLICT(user_id, variety_id) DO UPDATE SET
                                 physical_sacks = MAX(0, physical_sacks + ?), last_updated = datetime('now', 'localtime')`,
                                [userId, varietyId, actualChange, actualChange],
                                (upsertError) => {
                                    if (upsertError) return db.run('ROLLBACK', () => sendDatabaseError(response, upsertError))
                                    db.run('COMMIT', (commitError) => {
                                        if (commitError) return db.run('ROLLBACK', () => sendDatabaseError(response, commitError))
                                        return response.status(201).json({ logId })
                                    })
                                }
                            )
                        }
                    )
                }
            )
        })
    })
})

router.post('/api/order-rfqs', (request, response) => {
    const { buyerId, millerId, items, fulfillmentDeadline } = request.body || {}

    if (!buyerId || !millerId || !items || !items.length || !fulfillmentDeadline) {
        return response.status(400).json({ message: 'Missing required fields for allocation request.' })
    }

    db.run('BEGIN TRANSACTION', (beginError) => {
        if (beginError) return sendDatabaseError(response, beginError)
        db.run(
            `INSERT INTO order_rfqs (buyer_id, miller_id, fulfillment_deadline, status) VALUES (?, ?, ?, 'Pending')`,
            [buyerId, millerId, fulfillmentDeadline],
            function (insertError) {
                if (insertError) return db.run('ROLLBACK', () => sendDatabaseError(response, insertError))
                const orderId = this.lastID

                let pending = items.length;
                let hasError = false;

                items.forEach(item => {
                    db.run(
                        `INSERT INTO order_rfq_items (order_id, variety_id, requested_sacks) VALUES (?, ?, ?)`,
                        [orderId, item.varietyId, item.requestedSacks],
                        (itemError) => {
                            if (hasError) return;
                            if (itemError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, itemError)); }
                            pending--;
                            if (pending === 0) {
                                db.run('COMMIT', (commitError) => {
                                    if (commitError) return db.run('ROLLBACK', () => sendDatabaseError(response, commitError));
                                    return response.status(201).json({ orderId });
                                })
                            }
                        }
                    )
                })
            }
        )
    })
})

router.get('/api/order-rfqs', (request, response) => {
    db.run(`UPDATE order_rfqs SET status = 'Expired' WHERE status = 'Pending' AND date(fulfillment_deadline) < date('now', 'localtime')`, () => {
        db.run(`UPDATE order_rfqs SET status = 'Late' WHERE status = 'Approved' AND date(fulfillment_deadline) < date('now', 'localtime')`, () => {
            const { buyerId, millerId } = request.query
            let sql = `SELECT * FROM order_rfqs WHERE 1=1`
            const params = []
            if (buyerId) { sql += ` AND buyer_id = ?`; params.push(Number(buyerId)) }
            if (millerId) { sql += ` AND miller_id = ?`; params.push(Number(millerId)) }
            sql += ` ORDER BY order_id DESC`
            db.all(sql, params, (error, orders) => {
                if (error) return sendDatabaseError(response, error)
                if (!orders || orders.length === 0) return response.json({ orderRfqs: [] })
                
                const placeholders = orders.map(() => '?').join(', ')
                db.all(`SELECT ori.*, rv.name AS variety_name, rv.quality_grade, sl.wholesale_price FROM order_rfq_items ori LEFT JOIN rice_varieties rv ON ori.variety_id = rv.variety_id LEFT JOIN order_rfqs o ON ori.order_id = o.order_id LEFT JOIN stock_listing sl ON o.miller_id = sl.user_id AND ori.variety_id = sl.variety_id WHERE ori.order_id IN (${placeholders})`, orders.map(o => o.order_id), (itemsError, itemsRows) => {
                    if (itemsError) return sendDatabaseError(response, itemsError)
                    const itemsByOrder = {}
                    itemsRows.forEach(row => { if (!itemsByOrder[row.order_id]) itemsByOrder[row.order_id] = []; itemsByOrder[row.order_id].push(row) })
                    return response.json({ orderRfqs: orders.map(o => ({ ...o, items: itemsByOrder[o.order_id] || [] })) })
                })
            })
        })
    })
})

router.put('/api/order-rfqs/:id', (request, response) => {
    const orderId = Number(request.params.id)
    const { status, referenceId, timestamp } = request.body || {}

    if (!Number.isInteger(orderId) || orderId <= 0) {
        return response.status(400).json({ message: 'Valid order id is required.' })
    }

    if (!['Approved', 'Rejected', 'Pending', 'Late', 'Expired', 'Fulfilled'].includes(status)) {
        return response.status(400).json({ message: 'Invalid status.' })
    }

    db.get(`SELECT * FROM order_rfqs WHERE order_id = ?`, [orderId], (error, order) => {
        if (error) return sendDatabaseError(response, error)
        if (!order) return response.status(404).json({ message: 'Order not found.' })

        if (order.status === status) {
            return response.json({ message: 'Order status updated successfully.' })
        }

        db.all(`SELECT ori.*, sl.wholesale_price, rv.name AS variety_name FROM order_rfq_items ori LEFT JOIN stock_listing sl ON ? = sl.user_id AND ori.variety_id = sl.variety_id LEFT JOIN rice_varieties rv ON ori.variety_id = rv.variety_id WHERE ori.order_id = ?`, [order.miller_id, orderId], (itemsError, items) => {
            if (itemsError) return sendDatabaseError(response, itemsError)
            db.run('BEGIN TRANSACTION', (beginError) => {
                if (beginError) return sendDatabaseError(response, beginError)
                db.run(`UPDATE order_rfqs SET status = ? WHERE order_id = ?`, [status, orderId], (updateError) => {
                    if (updateError) return db.run('ROLLBACK', () => sendDatabaseError(response, updateError))

                    if (status === 'Approved' && order.status !== 'Approved') {
                        let pending = items.length; let hasError = false;
                        if (pending === 0) return db.run('COMMIT', () => response.json({ message: 'Order approved.' }));
                        items.forEach(item => {
                            db.run(`UPDATE stock_listing SET allocated_sacks = allocated_sacks + ?, last_updated = datetime('now', 'localtime') WHERE user_id = ? AND variety_id = ?`, [item.requested_sacks, order.miller_id, item.variety_id], (stockError) => {
                                if (hasError) return;
                                if (stockError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, stockError)); }
                                pending--;
                                if (pending === 0) return db.run('COMMIT', () => response.json({ message: 'Order approved and stock allocated.' }))
                            })
                        })
                    } else if (status === 'Fulfilled' && order.status !== 'Fulfilled') {
                        db.run(`INSERT INTO transactions (user_id, transaction_type, reference_id, customer_id, timestamp) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now', 'localtime')))`, [order.miller_id, 'SALE', referenceId || `RFQ-${orderId}`, order.buyer_id, timestamp || null], function (txError) {
                            if (txError) return db.run('ROLLBACK', () => sendDatabaseError(response, txError))
                            const txId = this.lastID
                            let pending = items.length; let hasError = false;
                            if (pending === 0) return db.run('COMMIT', () => response.json({ message: 'Order fulfilled.' }));
                            items.forEach(item => {
                                db.run(`INSERT INTO inventory_logs (transaction_id, variety_id, quantity_change) VALUES (?, ?, ?)`, [txId, item.variety_id, -Math.abs(item.requested_sacks)], (invError) => {
                                    if (hasError) return;
                                    if (invError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, invError)); }
                                    db.run(`UPDATE stock_listing SET allocated_sacks = MAX(0, allocated_sacks - ?), physical_sacks = MAX(0, physical_sacks - ?), last_updated = datetime('now', 'localtime') WHERE user_id = ? AND variety_id = ?`, [item.requested_sacks, item.requested_sacks, order.miller_id, item.variety_id], (stockError) => {
                                        if (hasError) return;
                                        if (stockError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, stockError)); }
                                        db.run(`INSERT INTO receipts (transaction_id, item, item_quantity, cost, date) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now', 'localtime')))`, [txId, item.variety_name, item.requested_sacks, item.requested_sacks * (item.wholesale_price || 0), timestamp || null], (receiptError) => {
                                            if (hasError) return;
                                            if (receiptError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, receiptError)); }
                                            pending--;
                                            if (pending === 0) return db.run('COMMIT', () => response.json({ message: 'Order fulfilled successfully.' }))
                                        })
                                    })
                                })
                            })
                        })
                    } else {
                        db.run('COMMIT', () => response.json({ message: 'Order status updated successfully.' }))
                    }
                })
            })
        })
    })
})

router.post('/api/external-rfqs', (request, response) => {
    const { buyerName, millerId, items, fulfillmentDeadline } = request.body || {}

    if (!buyerName || !millerId || !items || !items.length || !fulfillmentDeadline) {
        return response.status(400).json({ message: 'Missing required fields for external allocation request.' })
    }

    db.run('BEGIN TRANSACTION', (beginError) => {
        if (beginError) return sendDatabaseError(response, beginError)
        db.run(
            `INSERT INTO external_rfqs (buyer_name, miller_id, fulfillment_deadline, status) VALUES (?, ?, ?, 'Pending')`,
            [buyerName, millerId, fulfillmentDeadline],
            function (insertError) {
                if (insertError) return db.run('ROLLBACK', () => sendDatabaseError(response, insertError))
                const orderId = this.lastID

                let pending = items.length;
                let hasError = false;

                items.forEach(item => {
                    db.run(
                        `INSERT INTO external_rfq_items (order_id, variety_id, requested_sacks) VALUES (?, ?, ?)`,
                        [orderId, item.varietyId, item.requestedSacks],
                        (itemError) => {
                            if (hasError) return;
                            if (itemError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, itemError)); }
                            pending--;
                            if (pending === 0) {
                                db.run('COMMIT', (commitError) => {
                                    if (commitError) return db.run('ROLLBACK', () => sendDatabaseError(response, commitError));
                                    return response.status(201).json({ orderId });
                                })
                            }
                        }
                    )
                })
            }
        )
    })
})

router.get('/api/external-rfqs', (request, response) => {
    db.run(`UPDATE external_rfqs SET status = 'Expired' WHERE status = 'Pending' AND date(fulfillment_deadline) < date('now', 'localtime')`, () => {
        db.run(`UPDATE external_rfqs SET status = 'Late' WHERE status = 'Approved' AND date(fulfillment_deadline) < date('now', 'localtime')`, () => {
            const { millerId } = request.query
            let sql = `SELECT * FROM external_rfqs WHERE 1=1`
            const params = []
            if (millerId) { sql += ` AND miller_id = ?`; params.push(Number(millerId)) }
            sql += ` ORDER BY order_id DESC`
            db.all(sql, params, (error, orders) => {
                if (error) return sendDatabaseError(response, error)
                if (!orders || orders.length === 0) return response.json({ externalRfqs: [] })
                
                const placeholders = orders.map(() => '?').join(', ')
                db.all(`SELECT eri.*, rv.name AS variety_name, rv.quality_grade, sl.wholesale_price FROM external_rfq_items eri LEFT JOIN rice_varieties rv ON eri.variety_id = rv.variety_id LEFT JOIN external_rfqs e ON eri.order_id = e.order_id LEFT JOIN stock_listing sl ON e.miller_id = sl.user_id AND eri.variety_id = sl.variety_id WHERE eri.order_id IN (${placeholders})`, orders.map(o => o.order_id), (itemsError, itemsRows) => {
                    if (itemsError) return sendDatabaseError(response, itemsError)
                    const itemsByOrder = {}
                    itemsRows.forEach(row => { if (!itemsByOrder[row.order_id]) itemsByOrder[row.order_id] = []; itemsByOrder[row.order_id].push(row) })
                    return response.json({ externalRfqs: orders.map(o => ({ ...o, items: itemsByOrder[o.order_id] || [] })) })
                })
            })
        })
    })
})

router.put('/api/external-rfqs/:id', (request, response) => {
    const orderId = Number(request.params.id)
    const { status, referenceId, timestamp } = request.body || {}
    
    if (!Number.isInteger(orderId) || orderId <= 0) {
        return response.status(400).json({ message: 'Valid order id is required.' })
    }

    if (!['Approved', 'Rejected', 'Pending', 'Late', 'Expired', 'Fulfilled'].includes(status)) {
        return response.status(400).json({ message: 'Invalid status.' })
    }
    
    db.get(`SELECT * FROM external_rfqs WHERE order_id = ?`, [orderId], (error, order) => {
        if (error) return sendDatabaseError(response, error)
        if (!order) return response.status(404).json({ message: 'Order not found.' })

        if (order.status === status) {
            return response.json({ message: 'External order status updated successfully.' })
        }

        db.all(`SELECT eri.*, sl.wholesale_price, rv.name AS variety_name FROM external_rfq_items eri LEFT JOIN stock_listing sl ON ? = sl.user_id AND eri.variety_id = sl.variety_id LEFT JOIN rice_varieties rv ON eri.variety_id = rv.variety_id WHERE eri.order_id = ?`, [order.miller_id, orderId], (itemsError, items) => {
            if (itemsError) return sendDatabaseError(response, itemsError)
            db.run('BEGIN TRANSACTION', (beginError) => {
                if (beginError) return sendDatabaseError(response, beginError)
                db.run(`UPDATE external_rfqs SET status = ? WHERE order_id = ?`, [status, orderId], (updateError) => {
                    if (updateError) return db.run('ROLLBACK', () => sendDatabaseError(response, updateError))

                    if (status === 'Approved' && order.status !== 'Approved') {
                        let pending = items.length; let hasError = false;
                        if (pending === 0) return db.run('COMMIT', () => response.json({ message: 'External order approved.' }));
                        items.forEach(item => {
                            db.run(`UPDATE stock_listing SET allocated_sacks = allocated_sacks + ?, last_updated = datetime('now', 'localtime') WHERE user_id = ? AND variety_id = ?`, [item.requested_sacks, order.miller_id, item.variety_id], (stockError) => {
                                if (hasError) return;
                                if (stockError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, stockError)); }
                                pending--;
                                if (pending === 0) return db.run('COMMIT', () => response.json({ message: 'External order approved and stock allocated.' }))
                            })
                        })
                    } else if (status === 'Fulfilled' && order.status !== 'Fulfilled') {
                        db.run(`INSERT INTO transactions (user_id, transaction_type, reference_id, customer_id, timestamp) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now', 'localtime')))`, [order.miller_id, 'SALE', referenceId || `EXT-RFQ-${orderId}`, order.buyer_name, timestamp || null], function (txError) {
                            if (txError) return db.run('ROLLBACK', () => sendDatabaseError(response, txError))
                            const txId = this.lastID
                            let pending = items.length; let hasError = false;
                            if (pending === 0) return db.run('COMMIT', () => response.json({ message: 'External order fulfilled.' }));
                            items.forEach(item => {
                                db.run(`INSERT INTO inventory_logs (transaction_id, variety_id, quantity_change) VALUES (?, ?, ?)`, [txId, item.variety_id, -Math.abs(item.requested_sacks)], (invError) => {
                                    if (hasError) return;
                                    if (invError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, invError)); }
                                    db.run(`UPDATE stock_listing SET allocated_sacks = MAX(0, allocated_sacks - ?), physical_sacks = MAX(0, physical_sacks - ?), last_updated = datetime('now', 'localtime') WHERE user_id = ? AND variety_id = ?`, [item.requested_sacks, item.requested_sacks, order.miller_id, item.variety_id], (stockError) => {
                                        if (hasError) return;
                                        if (stockError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, stockError)); }
                                        db.run(`INSERT INTO receipts (transaction_id, item, item_quantity, cost, date) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now', 'localtime')))`, [txId, item.variety_name, item.requested_sacks, item.requested_sacks * (item.wholesale_price || 0), timestamp || null], (receiptError) => {
                                            if (hasError) return;
                                            if (receiptError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, receiptError)); }
                                            pending--;
                                            if (pending === 0) return db.run('COMMIT', () => response.json({ message: 'External order fulfilled successfully.' }))
                                        })
                                    })
                                })
                            })
                        })
                    } else {
                        db.run('COMMIT', () => response.json({ message: 'External order status updated successfully.' }))
                    }
                })
            })
        })
    })
})

module.exports = router