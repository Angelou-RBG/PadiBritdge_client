const express = require('express')
const cors = require('cors')
const path = require('path')
const {
    databasePath,
    uploadsDir,
    initializeDatabase,
} = require('./database')
const routes = require('./routes')

const app = express()

app.use(express.static(path.join(__dirname, 'public')))
app.use('/uploads', express.static(uploadsDir))
app.use(cors())
app.use(express.json())

const port = process.env.PORT || 5000

app.use('/', routes)

initializeDatabase(() => {
    app.listen(port, () => {
        console.log(`Server listening on port ${port}`)
        console.log(`Using database file ${databasePath}`)
    })
})