const express = require('express')
const crypto = require('crypto')

const { db, hashPassword, buildUserRow, sendDatabaseError } = require('../data-access')

const router = express.Router()

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

module.exports = router