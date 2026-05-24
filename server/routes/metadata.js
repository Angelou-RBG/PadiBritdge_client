const express = require('express')

const { db, sendDatabaseError } = require('../data-access')

const router = express.Router()

router.get('/api/health', (request, response) => {
    db.get('SELECT 1 AS ok', (error, result) => {
        if (error) {
            return sendDatabaseError(response, error)
        }

        return response.json({ ok: Boolean(result?.ok) })
    })
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

module.exports = router