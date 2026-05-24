const express = require('express')

const { db, sendDatabaseError } = require('../data-access')

const router = express.Router()

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

                let pending = items.length
                let hasError = false

                items.forEach((item) => {
                    db.run(
                        `INSERT INTO order_rfq_items (order_id, variety_id, requested_sacks) VALUES (?, ?, ?)`,
                        [orderId, item.varietyId, item.requestedSacks],
                        (itemError) => {
                            if (hasError) return
                            if (itemError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, itemError)) }
                            pending--
                            if (pending === 0) {
                                db.run('COMMIT', (commitError) => {
                                    if (commitError) return db.run('ROLLBACK', () => sendDatabaseError(response, commitError))
                                    return response.status(201).json({ orderId })
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
                db.all(`SELECT ori.*, rv.name AS variety_name, rv.quality_grade, sl.wholesale_price FROM order_rfq_items ori LEFT JOIN rice_varieties rv ON ori.variety_id = rv.variety_id LEFT JOIN order_rfqs o ON ori.order_id = o.order_id LEFT JOIN stock_listing sl ON o.miller_id = sl.user_id AND ori.variety_id = sl.variety_id WHERE ori.order_id IN (${placeholders})`, orders.map((o) => o.order_id), (itemsError, itemsRows) => {
                    if (itemsError) return sendDatabaseError(response, itemsError)
                    const itemsByOrder = {}
                    itemsRows.forEach((row) => { if (!itemsByOrder[row.order_id]) itemsByOrder[row.order_id] = []; itemsByOrder[row.order_id].push(row) })
                    return response.json({ orderRfqs: orders.map((o) => ({ ...o, items: itemsByOrder[o.order_id] || [] })) })
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
                        let pending = items.length; let hasError = false
                        if (pending === 0) return db.run('COMMIT', () => response.json({ message: 'Order approved.' }))
                        items.forEach((item) => {
                            db.run(`UPDATE stock_listing SET allocated_sacks = allocated_sacks + ?, last_updated = datetime('now', 'localtime') WHERE user_id = ? AND variety_id = ?`, [item.requested_sacks, order.miller_id, item.variety_id], (stockError) => {
                                if (hasError) return
                                if (stockError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, stockError)) }
                                pending--
                                if (pending === 0) return db.run('COMMIT', () => response.json({ message: 'Order approved and stock allocated.' }))
                            })
                        })
                    } else if (status === 'Fulfilled' && order.status !== 'Fulfilled') {
                        db.run(`INSERT INTO transactions (user_id, transaction_type, reference_id, customer_id, timestamp) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now', 'localtime')))`, [order.miller_id, 'SALE', referenceId || `RFQ-${orderId}`, order.buyer_id, timestamp || null], function (txError) {
                            if (txError) return db.run('ROLLBACK', () => sendDatabaseError(response, txError))
                            const txId = this.lastID
                            let pending = items.length; let hasError = false
                            if (pending === 0) return db.run('COMMIT', () => response.json({ message: 'Order fulfilled.' }))
                            items.forEach((item) => {
                                db.run(`INSERT INTO inventory_logs (transaction_id, variety_id, quantity_change) VALUES (?, ?, ?)`, [txId, item.variety_id, -Math.abs(item.requested_sacks)], (invError) => {
                                    if (hasError) return
                                    if (invError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, invError)) }
                                    db.run(`UPDATE stock_listing SET allocated_sacks = MAX(0, allocated_sacks - ?), physical_sacks = MAX(0, physical_sacks - ?), last_updated = datetime('now', 'localtime') WHERE user_id = ? AND variety_id = ?`, [item.requested_sacks, item.requested_sacks, order.miller_id, item.variety_id], (stockError) => {
                                        if (hasError) return
                                        if (stockError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, stockError)) }
                                        db.run(`INSERT INTO receipts (transaction_id, item, item_quantity, cost, date) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now', 'localtime')))`, [txId, item.variety_name, item.requested_sacks, item.requested_sacks * (item.wholesale_price || 0), timestamp || null], (receiptError) => {
                                            if (hasError) return
                                            if (receiptError) { hasError = true; return db.run('ROLLBACK', () => sendDatabaseError(response, receiptError)) }
                                            pending--
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

module.exports = router