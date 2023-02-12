const express = require('express')
const router = express.Router()
const ws = require('ws')
const wss = new ws.Server({ noServer: true })
const { v4: uuidv4 } = require('uuid');

const clients = new Set()

wss.broadcast = function(data, sender) {
    clients.forEach((client) => {
        if(client.id !== sender.id){
            client.send(data)
        }
    })
}

const createObject = (ws) => {
    return {"name": ws.name, "id": ws.id}
}

wss.people = () => {
    clients.forEach((paraclient)=> {
        const people = []
        clients.forEach((chiclient)=> {
            if(paraclient !== chiclient){
                people.push(createObject(chiclient))
            }
        })
        const res = {"type": "people", people : people}
        paraclient.send(JSON.stringify(res))
    })
}

wss.Offer = (sender, receiverId, method) => {
    clients.forEach(client => {
        if(client.id === receiverId){
            if(method === "offer"){
                client.requests.push(createObject(sender))
            }
            else {
                client.requests.forEach((req, index) => {
                    if(req.id === createObject(sender).id){
                        client.requests.splice(index, 1)
                    }
                })
            }
            const res = {"type": "request", requests: client.requests}
            client.send(JSON.stringify(res))
        }
    })
}

wss.close = (ws)=> {
    ws.close()
}

wss.left = (sender) => {
    clients.forEach((client)=> {
        client.requests.forEach(req => {
            if(req.id === sender.id){
                wss.Offer(sender, client.id, 'cancel')
            }
        })
    })
}

wss.undoOffer = (receiverId) => {
    clients.forEach(client => {
        if(client.id === receiverId){
            clients.requests
        }
    })
}

const onSocketConnection = (ws) => {

    clients.add(ws)

    setTimeout(()=> {
        wss.close(ws)
    },1000*60)

    ws.on('message', (data)=> {
        const request = JSON.parse(data.toString())
        if (request.type == "open"){
            ws.id = uuidv4(),
            ws.name = request.name
            ws.requests = []
            if(ws.name !== ""){
                ws.send("success")
            }
            else{
                ws.send("failed")
            }
            wss.people()
        }
        else if(request.type == "offer"){
            wss.Offer(ws, request.id, "offer")
        }
        else if(request.type == "cancel"){
            wss.Offer(ws, request.id, "cancel")
        }
        else if(request.type === "message"){
            request.name = ws.name
            wss.broadcast(JSON.stringify(request), ws)
        }
        else if(request.type === "reject"){
            const obj = {
                "type": "reject",
                "rejid": ws.id
            }
            ws.requests.forEach((req, index) => {
                if(req.id === request.id){
                    ws.requests.splice(index, 1)
                }
            })
            clients.forEach(client => {
                if(client.id === request.id){
                    client.send(JSON.stringify(obj))
                }
            })
            const res = {"type": "request", requests: ws.requests}
            ws.send(JSON.stringify(res))
        }
    })

    ws.on('close', ()=> {
        //wss.broadcast("client disconnected man")
        clients.delete(ws)
        wss.people()
        wss.left(ws)
    })
}

router.get('/', (req, res)=> {
    wss.handleUpgrade(req, req.socket, Buffer.alloc(0), onSocketConnection)
})

module.exports = router