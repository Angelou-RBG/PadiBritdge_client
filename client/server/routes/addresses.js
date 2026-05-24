const express = require('express')
const { db, sendDatabaseError } = require('../data-access')

const router = express.Router()

router.get('/api/addresses', (request, response) => {
    const { userId } = request.query
    if (!userId) return response.status(400).json({ message: 'userId is required' })

    db.all('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC', [userId], (error, rows) => {
        if (error) return sendDatabaseError(response, error)
        
        const mapped = rows.map(r => ({
            id: r.id,
            userId: r.user_id,
            street: r.street,
            city: r.city,
            province: r.province,
            zipCode: r.zip_code,
            isDefault: Boolean(r.is_default)
        }))
        return response.json(mapped)
    })
})

router.get('/api/addresses/:id', (request, response) => {
    db.get('SELECT * FROM addresses WHERE id = ?', [request.params.id], (error, row) => {
        if (error) return sendDatabaseError(response, error)
        if (!row) return response.status(404).json({ message: 'Address not found' })
        
        return response.json({
            id: row.id,
            userId: row.user_id,
            street: row.street,
            city: row.city,
            province: row.province,
            zipCode: row.zip_code,
            isDefault: Boolean(row.is_default)
        })
    })
})

router.post('/api/addresses', (request, response) => {
    const { userId, street, city, province, zipCode, isDefault } = request.body || {}
    
    if (!userId || !street || !city || !province || !zipCode) {
        return response.status(400).json({ message: 'Missing required address fields.' })
    }

    db.run('BEGIN TRANSACTION', (beginError) => {
        if (beginError) return sendDatabaseError(response, beginError)

        const insertAddress = () => {
            db.run(
                'INSERT INTO addresses (user_id, street, city, province, zip_code, is_default) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, street, city, province, zipCode, isDefault ? 1 : 0],
                function (err) {
                    if (err) return db.run('ROLLBACK', () => sendDatabaseError(response, err))
                    const newId = this.lastID
                    db.run('COMMIT', (commitErr) => {
                        if (commitErr) return db.run('ROLLBACK', () => sendDatabaseError(response, commitErr))
                        return response.status(201).json({ id: newId, message: 'Address created' })
                    })
                }
            )
        }

        if (isDefault) {
            db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId], (err) => {
                if (err) return db.run('ROLLBACK', () => sendDatabaseError(response, err))
                insertAddress()
            })
        } else {
            insertAddress()
        }
    })
})

router.put('/api/addresses/:id/default', (request, response) => {
    const id = request.params.id
    const { userId } = request.body || {}
    if (!userId) return response.status(400).json({ message: 'userId is required' })

    db.run(`UPDATE addresses SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE user_id = ?`, [id, userId], (err) => {
        if (err) return sendDatabaseError(response, err)
        return response.json({ message: 'Default address updated' })
    })
})

router.delete('/api/addresses/:id', (request, response) => {
    db.run('DELETE FROM addresses WHERE id = ?', [request.params.id], (err) => {
        if (err) return sendDatabaseError(response, err)
        return response.json({ message: 'Address deleted' })
    })
})

module.exports = router