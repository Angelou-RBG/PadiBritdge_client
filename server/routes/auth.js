const express = require('express')
const crypto = require('crypto')

const { db, hashPassword, buildUserRow, sendDatabaseError } = require('../data-access')
const { upload, cleanupUploadedFiles } = require('./common')

const router = express.Router()

router.post('/api/auth/signup', (request, response) => {
    const { fullName, username, email, password } = request.body || {}

    if (!fullName || !username || !email || !password) {
        return response.status(400).json({ message: 'fullName, username, email, and password are required.' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const normalizedUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    const normalizedFullName = String(fullName).trim()
    const passwordHash = hashPassword(String(password))

    if (!normalizedUsername) {
        return response.status(400).json({ message: 'Invalid username format. Use alphanumeric characters and underscores.' })
    }

    db.get(
        'SELECT email, username FROM users WHERE email = ? OR username = ?',
        [normalizedEmail, normalizedUsername],
        (selectError, existingUser) => {
            if (selectError) {
                return sendDatabaseError(response, selectError)
            }

            if (existingUser) {
                if (existingUser.username === normalizedUsername) {
                    return response.status(409).json({ message: 'Username is already taken.' })
                }
                return response.status(409).json({ message: 'An account with that email already exists.' })
            }

            db.run(
                'INSERT INTO users (full_name, username, email, password_hash) VALUES (?, ?, ?, ?)',
                [normalizedFullName, normalizedUsername, normalizedEmail, passwordHash],
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
                            username: normalizedUsername,
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
        'SELECT id, username, full_name, email, user_type FROM users WHERE email = ? AND password_hash = ?',
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
    upload.single('profilePicture')(request, response, (uploadError) => {
        if (uploadError) {
            if (request.file && typeof cleanupUploadedFiles === 'function') cleanupUploadedFiles([request.file])
            return response.status(400).json({ message: 'Unable to upload profile picture.' })
        }

        const userId = Number(request.params.id)
        const { fullName, username, email, removeProfilePicture } = request.body || {}

        if (!Number.isInteger(userId) || userId <= 0) {
            if (request.file && typeof cleanupUploadedFiles === 'function') cleanupUploadedFiles([request.file])
            return response.status(400).json({ message: 'Valid user id is required.' })
        }

        const normalizedEmail = String(email || '').trim().toLowerCase()
        const normalizedUsername = String(username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
        const normalizedFullName = String(fullName || '').trim()

        if (!normalizedEmail || !normalizedFullName || !normalizedUsername) {
            if (request.file && typeof cleanupUploadedFiles === 'function') cleanupUploadedFiles([request.file])
            return response.status(400).json({ message: 'Full name, username, and email are required.' })
        }

        db.get('SELECT profile_picture FROM users WHERE id = ?', [userId], (err, currentUser) => {
            if (err || !currentUser) {
                if (request.file && typeof cleanupUploadedFiles === 'function') cleanupUploadedFiles([request.file])
                return response.status(404).json({ message: 'User not found.' })
            }

            let finalProfilePicture = currentUser.profile_picture;
            if (request.file) {
                finalProfilePicture = request.file.filename;
            } else if (removeProfilePicture === 'true') {
                finalProfilePicture = null;
            }

            db.get(
                'SELECT email, username FROM users WHERE (email = ? OR username = ?) AND id != ?',
                [normalizedEmail, normalizedUsername, userId],
                (error, existingUser) => {
                    if (error) {
                        if (request.file && typeof cleanupUploadedFiles === 'function') cleanupUploadedFiles([request.file])
                        return sendDatabaseError(response, error)
                    }

                    if (existingUser) {
                        if (request.file && typeof cleanupUploadedFiles === 'function') cleanupUploadedFiles([request.file])
                        if (existingUser.username === normalizedUsername) return response.status(409).json({ message: 'Username is already taken.' })
                        return response.status(409).json({ message: 'Email is already in use by another account.' })
                    }

                    db.run(
                        'UPDATE users SET full_name = ?, username = ?, email = ?, profile_picture = ? WHERE id = ?',
                        [normalizedFullName, normalizedUsername, normalizedEmail, finalProfilePicture, userId],
                        (updateError) => {
                            if (updateError) {
                                if (request.file && typeof cleanupUploadedFiles === 'function') cleanupUploadedFiles([request.file])
                                return sendDatabaseError(response, updateError)
                            }

                            db.get('SELECT id, username, full_name, email, user_type, profile_picture FROM users WHERE id = ?', [userId], (fetchError, updatedUser) => {
                                if (fetchError) return sendDatabaseError(response, fetchError)
                                return response.json({ user: buildUserRow(updatedUser) })
                            })
                        }
                    )
                }
            )
        })
    })
})

module.exports = router