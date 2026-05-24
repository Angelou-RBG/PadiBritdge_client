const express = require('express')

const authRoutes = require('./auth')
const metadataRoutes = require('./metadata')
const postsRoutes = require('./posts')
const stockRoutes = require('./stock')
const ordersRoutes = require('./orders')
const externalRfqRoutes = require('./externalRfqs')
const addressesRoutes = require('./addresses')

const router = express.Router()

router.use(authRoutes)
router.use(metadataRoutes)
router.use(postsRoutes)
router.use(stockRoutes)
router.use(ordersRoutes)
router.use(externalRfqRoutes)
router.use(addressesRoutes)

module.exports = router