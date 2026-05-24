const crypto = require('crypto')
const fs = require('fs')
const multer = require('multer')
const path = require('path')

const { db, uploadsDir } = require('../data-access')

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

module.exports = {
    upload,
    parseTagIds,
    mapImageRow,
    mapPostRow,
    cleanupUploadedFiles,
    loadPostImages,
    insertPostImages,
}