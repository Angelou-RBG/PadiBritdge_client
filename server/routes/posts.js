const express = require('express')
const multer = require('multer')
const path = require('path')

const { db, sendDatabaseError, uploadsDir } = require('../data-access')
const { upload, parseTagIds, cleanupUploadedFiles, loadPostImages, insertPostImages } = require('./common')

const router = express.Router()

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
            tagList.forEach((tag) => queryParams.push(`%,${tag},%`))
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
            posts.attachment_type,
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

router.get('/api/posts/latest', (request, response) => {
    db.get(
        `SELECT
            posts.post_id,
            posts.user_id,
            posts.title,
            posts.post_type,
            posts.tags,
            posts.text_body,
            posts.attachment_type,
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
            posts.attachment_type,
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
            `SELECT c.*, u.full_name, u.username
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

            db.get('SELECT c.*, u.full_name, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE c.comment_id = ?', [newCommentId], (fetchError, newComment) => {
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

        const postId = Number(request.params.id)

        if (!Number.isInteger(postId) || postId <= 0) {
            cleanupUploadedFiles(request.files || [])
            return response.status(400).json({ message: 'Valid post id is required.' })
        }

        const { title, postTypeId, tagIds, textBody, attachmentType, retainedImageIds } = request.body || {}
        const normalizedTitle = String(title || '').trim()
        const normalizedTextBody = String(textBody || '').trim()
        const normalizedPostTypeId = Number(postTypeId)
        const normalizedAttachmentType = String(attachmentType || 'none').trim()
        const normalizedTagIds = parseTagIds(tagIds)
            .map((tagId) => Number(tagId))
            .filter((tagId) => Number.isInteger(tagId) && tagId > 0)

        if (!normalizedTitle || !normalizedTextBody) {
            cleanupUploadedFiles(request.files || [])
            return response.status(400).json({ message: 'title and textBody are required.' })
        }

        if (!Number.isInteger(normalizedPostTypeId) || normalizedPostTypeId <= 0) {
            cleanupUploadedFiles(request.files || [])
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
                    cleanupUploadedFiles(request.files || [])
                    return sendDatabaseError(response, lookupError)
                }

                if (!postRow) {
                    cleanupUploadedFiles(request.files || [])
                    return response.status(404).json({ message: 'Post not found.' })
                }

                if (postRow.status === 'deleted') {
                    cleanupUploadedFiles(request.files || [])
                    return response.status(410).json({ message: 'Post is unavailable.' })
                }

                db.get(
                    'SELECT id, name FROM post_types WHERE id = ?',
                    [normalizedPostTypeId],
                    (postTypeError, postTypeRow) => {
                        if (postTypeError) {
                            cleanupUploadedFiles(request.files || [])
                            return sendDatabaseError(response, postTypeError)
                        }

                        if (!postTypeRow) {
                            cleanupUploadedFiles(request.files || [])
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
                                    if (tagsError) return callback(tagsError)
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
                                cleanupUploadedFiles(request.files || [])
                                if (tagError.message === 'One or more selected tags are invalid.') {
                                    return response.status(400).json({ message: tagError.message })
                                }
                                return sendDatabaseError(response, tagError)
                            }

                            db.run('BEGIN TRANSACTION', (beginError) => {
                                if (beginError) {
                                    cleanupUploadedFiles(request.files || [])
                                    return sendDatabaseError(response, beginError)
                                }

                                db.run(
                                    `UPDATE posts
                                     SET title = ?, post_type = ?, tags = ?, text_body = ?, attachment_type = ?
                                     WHERE post_id = ?`,
                                    [normalizedTitle, postTypeRow.name, tagValue, normalizedTextBody, normalizedAttachmentType, postId],
                                    (updateError) => {
                                        if (updateError) {
                                            cleanupUploadedFiles(request.files || [])
                                            return db.run('ROLLBACK', () => sendDatabaseError(response, updateError))
                                        }

                                        let parsedRetainedIds = []
                                        if (retainedImageIds) {
                                            try { parsedRetainedIds = JSON.parse(retainedImageIds) } catch(e) {}
                                        }
                                        parsedRetainedIds = parsedRetainedIds.map(Number).filter(id => Number.isInteger(id) && id > 0)

                                        let selectSql = `SELECT id, image_path FROM post_images WHERE post_id = ?`
                                        let selectParams = [postId]
                                        if (parsedRetainedIds.length > 0) {
                                            selectSql += ` AND id NOT IN (${parsedRetainedIds.map(() => '?').join(', ')})`
                                            selectParams.push(...parsedRetainedIds)
                                        }

                                        db.all(selectSql, selectParams, (selectErr, rowsToDelete) => {
                                            if (selectErr) {
                                                cleanupUploadedFiles(request.files || [])
                                                return db.run('ROLLBACK', () => sendDatabaseError(response, selectErr))
                                            }

                                            let deleteSql = `DELETE FROM post_images WHERE post_id = ?`
                                            let deleteParams = [postId]
                                            if (parsedRetainedIds.length > 0) {
                                                deleteSql += ` AND id NOT IN (${parsedRetainedIds.map(() => '?').join(', ')})`
                                                deleteParams.push(...parsedRetainedIds)
                                            }

                                            db.run(deleteSql, deleteParams, (deleteErr) => {
                                                if (deleteErr) {
                                                    cleanupUploadedFiles(request.files || [])
                                                    return db.run('ROLLBACK', () => sendDatabaseError(response, deleteErr))
                                                }

                                                const filesToDelete = (rowsToDelete || []).map(row => ({ path: path.join(uploadsDir, row.image_path) }))
                                                cleanupUploadedFiles(filesToDelete)

                                                insertPostImages(postId, request.files || [], (insertErr, insertedImages) => {
                                                    if (insertErr) {
                                                        cleanupUploadedFiles(request.files || [])
                                                        return db.run('ROLLBACK', () => sendDatabaseError(response, insertErr))
                                                    }

                                                    db.run('COMMIT', (commitError) => {
                                                        if (commitError) {
                                                            cleanupUploadedFiles(request.files || [])
                                                            return db.run('ROLLBACK', () => sendDatabaseError(response, commitError))
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
                                                                attachmentType: normalizedAttachmentType,
                                                            },
                                                        })
                                                    })
                                                })
                                            })
                                        })
                                    }
                                )
                            })
                        })
                    }
                )
            }
        )
    })
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
        const { userId, title, postTypeId, tagIds, textBody, attachmentType } = request.body || {}

        const normalizedTitle = String(title || '').trim()
        const normalizedTextBody = String(textBody || '').trim()
        const normalizedUserId = Number(userId)
        const normalizedAttachmentType = String(attachmentType || 'none').trim()
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
                            'INSERT INTO posts (user_id, title, post_type, tags, status, text_body, attachment_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [normalizedUserId, normalizedTitle, postTypeRow.name, tagValue, 'not', normalizedTextBody, normalizedAttachmentType],
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
                                                        attachmentType: normalizedAttachmentType,
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

module.exports = router