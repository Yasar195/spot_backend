const express = require('express')
const app = express()
const server = require('http').createServer(app)
const port = process.env.PORT || 5000
const socket = require('./socket.js')

app.use('/socket', socket)

app.get('/', (req, res)=> {
    res.send({"message": "i am alive"})
})

server.listen(port)

