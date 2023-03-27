const express = require('express')
const router = express.Router()
const ws = require('ws')
const wss = new ws.Server({ noServer: true })
const { v4: uuidv4 } = require('uuid');

const clients = new Set()

wss.close = (ws)=> {
    ws.close()
}

wss.people = () => {
    clients.forEach(client => {
        let resObj={}
        resObj.type = "peerlist"
        resObj.peers = []
        client.people.forEach(ws => {
            resObj.peers.push({name: ws.name, uid:ws.id})
        })
        client.send(JSON.stringify(resObj))
    })
}

wss.message = (ws, message) => {
    ws.people.forEach((peer)=> {
        peer.send(JSON.stringify(message))
    })
}

wss.request = (ws, message) => {
    ws.people.forEach((peer)=> {
        if(message.data.uid === peer.id){
            const resObj = {
                type: "request",
                name: ws.name,
                uid: ws.id
            }
            peer.send(JSON.stringify(resObj))
        }
    })
}

const onSocketConnection = (ws) => {

    ws.on('message', (data)=> {
        try{
            const str = data.toString()
            const json = JSON.parse(str)
            if(json.type == "init"){
                clients.add(ws)
                ws.name = json.name
                ws.id = uuidv4()
                ws.ip = json.ip
                ws.people = []
                clients.forEach(client => {
                    if(client !== ws && ws.ip === client.ip){
                        client.people.push(ws)
                        ws.people.push(client)
                    }
                })
                wss.people()
            }

            if(json.type === "message"){
                wss.message(ws, json)
            }

            if(json.type === "request"){
                wss.request(ws, json)
            }

            if(json.type === "offer"){
                console.log(json.uid)
            }
        }
        catch(err){
            ws.close()
        }
    })

    ws.on('close', ()=> {
        clients.delete(ws)
        clients.forEach(client => {
            client.people = []
            clients.forEach(pclient => {
                if(client !== pclient && pclient.ip === client.ip){
                    client.people.push(pclient)
                }
            })
        })
        wss.people()
    })
}

router.get('/', (req, res)=> {
    wss.handleUpgrade(req, req.socket, Buffer.alloc(0), onSocketConnection)
})

module.exports = router