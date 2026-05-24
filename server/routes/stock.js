const express = require('express')

const { db, sendDatabaseError } = require('../data-access')

const router = express.Router()

function insertInventoryLogEntries(entries, transactionId, varietyId, onComplete, onError) {
    if (!entries.length) {
        return onComplete()
    }

    const [entry, ...remainingEntries] = entries
    db.run(
        `INSERT INTO inventory_logs (transaction_id, variety_id, value_changed, before_value, after_value, logged_at) VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now', 'localtime')))`,
        [transactionId, varietyId, entry.valueChanged, entry.beforeValue, entry.afterValue, entry.loggedAt || null],
        (error) => {
            if (error) {
                return onError(error)
            }

            return insertInventoryLogEntries(remainingEntries, transactionId, varietyId, onComplete, onError)
        }
    )
}

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

        const inventoryLogEntries = []

        if (newPhysical !== currentStock.physical_sacks) {
            inventoryLogEntries.push({
                valueChanged: 'physical_sacks',
                beforeValue: currentStock.physical_sacks,
                afterValue: newPhysical,
                loggedAt: timestamp || null,
            })
        }

        if (newAllocated !== currentStock.allocated_sacks) {
            inventoryLogEntries.push({
                valueChanged: 'allocated_sacks',
                beforeValue: currentStock.allocated_sacks,
                afterValue: newAllocated,
                loggedAt: timestamp || null,
            })
        }

        if (newPrice !== currentStock.wholesale_price) {
            inventoryLogEntries.push({
                valueChanged: 'wholesale_price',
                beforeValue: currentStock.wholesale_price,
                afterValue: newPrice,
                loggedAt: timestamp || null,
            })
        }

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

            if (inventoryLogEntries.length > 0) {
                db.run(
                    `INSERT INTO transactions (user_id, transaction_type, reference_id, customer_id, timestamp) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now', 'localtime')))`,
                    [userId, 'MANUAL_CORRECTION', referenceId || 'MODIFICATION', null, timestamp || null],
                    function (txError) {
                        if (txError) return db.run('ROLLBACK', () => sendDatabaseError(response, txError))
                        insertInventoryLogEntries(
                            inventoryLogEntries,
                            this.lastID,
                            currentStock.variety_id,
                            updateStock,
                            (insertError) => db.run('ROLLBACK', () => sendDatabaseError(response, insertError))
                        )
                    }
                )
            } else {
                updateStock()
            }
        })
    })
})

router.get('/api/inventory-logs', (request, response) => {
    const { userId } = request.query

    const normalizedUserId = Number(userId)
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
        return response.status(400).json({ message: 'Valid user id is required.' })
    }

    let sql = `
        SELECT 
            il.log_id,
            t.transaction_id,
            t.user_id,
            il.variety_id,
            t.transaction_type,
            il.value_changed,
            il.before_value,
            il.after_value,
            il.logged_at,
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

    const params = [normalizedUserId]
    sql += ` WHERE t.user_id = ?`

    sql += ` ORDER BY t.timestamp DESC`

    db.all(sql, params, (error, rows) => {
        if (error) {
            return sendDatabaseError(response, error)
        }
        return response.json({ inventoryLogs: rows || [] })
    })
})

router.get('/api/transactions', (request, response) => {
    const { userId } = request.query

    const normalizedUserId = Number(userId)
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
        return response.status(400).json({ message: 'Valid user id is required.' })
    }

    db.all(
        `SELECT
            t.transaction_id,
            t.user_id,
            u.full_name AS user_name,
            t.transaction_type,
            t.reference_id,
            t.customer_id,
            t.timestamp
         FROM transactions t
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.user_id = ?
         ORDER BY t.timestamp DESC`,
        [normalizedUserId],
        (error, rows) => {
            if (error) {
                return sendDatabaseError(response, error)
            }

            return response.json({ transactions: rows || [] })
        }
    )
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
            il.value_changed,
            il.before_value,
            il.after_value,
            il.logged_at,
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

        db.get(
            'SELECT physical_sacks FROM stock_listing WHERE user_id = ? AND variety_id = ?',
            [userId, varietyId],
            (stockError, stockRow) => {
                if (stockError) return sendDatabaseError(response, stockError)

                const currentPhysical = Number(stockRow?.physical_sacks || 0)
                const nextPhysical = Math.max(0, currentPhysical + actualChange)

                db.run('BEGIN TRANSACTION', (beginError) => {
                    if (beginError) return sendDatabaseError(response, beginError)

                    db.run(
                        `INSERT INTO transactions (user_id, transaction_type, reference_id, customer_id, timestamp) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now', 'localtime')))`,
                        [userId, transactionType, referenceId || '', customerId || null, timestamp || null],
                        function (txError) {
                            if (txError) return db.run('ROLLBACK', () => sendDatabaseError(response, txError))
                            const transactionId = this.lastID

                            db.run(
                                `INSERT INTO inventory_logs (transaction_id, variety_id, value_changed, before_value, after_value) VALUES (?, ?, ?, ?, ?)`,
                                [transactionId, varietyId, 'physical_sacks', currentPhysical, nextPhysical, timestamp || null],
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
            }
        )
    })
})

module.exports = router