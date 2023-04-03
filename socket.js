const express = require('express')
const router = express.Router()
const ws = require('ws')
const wss = new ws.Server({ noServer: true })
const { v4: uuidv4 } = require('uuid');

const clients = new Set()

wss.close = (ws) => {
    ws.close()
}

wss.withdraw = (ws, id) => {
    ws.people.forEach((peer) => {
        if(peer.id === id){
            peer.requests.forEach((req, index)=> {
                if(req.uid === ws.id){
                    peer.requests.splice(index, 1);
                    peer.send(JSON.stringify({
                        type: "request",
                        requests: peer.requests
                    }))
                }
            })
        }
    })
}

wss.deny = (ws, id) => {
    ws.requests.forEach((req, index) => {
        if(req.uid === id){
            ws.requests.splice(index, 1);
        }
    })
    const resObj = {
        type: "request",
        requests: ws.requests
    }
    ws.send(JSON.stringify(resObj))
    clients.forEach(client => {
        if(client.id === id){
            const resObj = {
                type: 'deny',
                uid: ws.id
            }
            client.send(JSON.stringify(resObj))
        }
    })
}

wss.people = () => {
    clients.forEach(client => {
        let resObj={}
        resObj.type = "peerlist"
        resObj.peers = []
        client.people.forEach(ws => {
            resObj.peers.push({name: ws.name, uid:ws.id, sent: false})
        })
        client.send(JSON.stringify(resObj))
    })
}

wss.accept = (ws, id) => {
    const resObj = {
        type: 'accept',
        name: ws.name,
        id: ws.id
    }
    clients.forEach(client => {
        if(client.id === id){
            client.send(JSON.stringify(resObj))
        }
    })
}

wss.message = (ws, message) => {
    ws.people.forEach((peer)=> {
        peer.send(JSON.stringify(message))
    })
}

wss.offer = (ws, obj) => {
    ws.people.forEach(peer => {
        if(peer.id === obj.uid){
            const resObj = {
                type: "offer",
                sdp: obj.sdp
            }
            peer.send(JSON.stringify(resObj))
        }
    })
}

wss.answer = (ws, obj) => {
    ws.people.forEach(peer => {
        if(peer.id === obj.uid){
            const resObj = {
                type: "answer",
                sdp: obj.sdp
            }
            peer.send(JSON.stringify(resObj))
        }
    })
}

wss.request = (ws, message) => {
    ws.people.forEach(peers => {
        if(peers.uid === message.data.uid){
            peers.send = true;
        }
    })
    ws.people.forEach((peer)=> {
        if(message.data.uid === peer.id){
            peer.requests.push({
                name: ws.name,
                uid: ws.id
            })
            const resObj = {
                type: "request",
                requests: peer.requests
            }
            peer.send(JSON.stringify(resObj))
        }
    })
}

const onSocketConnection = (ws) => {

    setTimeout(()=> {
        ws.close()
    }, 1000*60*60)

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
                ws.requests = []
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

            if(json.type === "withdraw"){
                wss.withdraw(ws, json.id)
            }

            if(json.type === "deny"){
                wss.deny(ws, json.uid)
            }

            if(json.type === "accept"){
                wss.accept(ws, json.uid)
            }

            if(json.type === "offer"){
                wss.offer(ws, json)
            }

            if(json.type === "answer"){
                wss.answer(ws, json)
            }

            if(json.type === "success"){
                ws.people.forEach(peer => {
                    if(peer.id === json.uid){
                        peer.send(JSON.stringify({
                            type: "success"
                        }))
                        ws.send(JSON.stringify({
                            type: "success"
                        }))
                    }
                })
            }

            if(json.type === "error"){
                ws.people.forEach(peer => {
                    if(peer.id === json.uid){
                        peer.send(JSON.stringify({
                            type: "error"
                        }))
                        ws.send(JSON.stringify({
                            type: "error"
                        }))
                    }
                })
            }
        }
        catch(err){
            ws.close()
        }
    })

    ws.on('close', ()=> {
        clients.delete(ws)
        clients.forEach(client => {
            client.requests.forEach((req, index) => {
                if(req.uid === ws.id){
                    client.requests.splice(index, 1)
                }
            })
            const resObj = {
                type: "request",
                requests: client.requests
            }
            client.send(JSON.stringify(resObj))
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