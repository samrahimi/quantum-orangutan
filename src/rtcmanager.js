module.exports = (room, me) => {
    return new RTCManager(room, me)
}

const RTCPeer = require('simple-peer')
const EventEmitter = require('events');

//a few public bootstrap nodes to help punch through your firewall and 
//get you connected p2p... 
//feel free to add to this list
const peerConfig =  
{
    "iceServers":[
          {"urls":
            ["stun:173.194.196.127:19302",
             "stun:[2607:f8b0:4001:c1a::7f]:19302"
            ]},
          {
            "urls": "stun:relay.instant.io:3478?transport=udp"
          },
          {
            "urls": "turn:relay.instant.io:3478?transport=udp",
            "username": "relay.instant.io",
            "credential": "nepal-cheddar-baize-oleander"
          },
          {
            "urls": "turn:relay.instant.io:3478?transport=tcp",
            "username": "relay.instant.io",
            "credential": "nepal-cheddar-baize-oleander"
          },
          {
            "urls": "turn:relay.instant.io:443?transport=tcp",
            "username": "relay.instant.io",
            "credential": "nepal-cheddar-baize-oleander"
          }
      
        ]
}

class RTCManager extends EventEmitter {
    constructor(room, me) {
      super()
      this.Room = room
      this.Peers = {}
      this.Me = me //a json dictionary that identifies me...
                   //my peers will associate this with my ipfs peer id 
                   //and the webrtc connection they have with me
                   //everyone sends their "me" when requesting or accepting a connection
    }

    //once you know which of the peers got connected, send them here to 
    //bind close/end/destroy
    addErrorHandlers(peer) {
      peer.connection.on('close', () => delete this.Peers[peer.id])
      peer.connection.on('end', () => delete this.Peers[peer.id])
      peer.connection.on('destroy', () => delete this.Peers[peer.id])
    }

     sendToAll(message)  {
      var peerConnections = this.getConnectedPeers()
      peerConnections.forEach(connectedPeer => {
        if (connectedPeer.connected)
          connectedPeer.send(message)
      })
    }

    send(peerId, message){
      this.Peers[peerId].connection.send(message)
    }

    requestConnection(user) {
      if (this.Peers[user]) 
      {
          console.log("connection with "+user+"already in progress, ignoring")
          return
      }

      var initiator =  new RTCPeer({
          initiator: true, 
          trickle: false, 
          config: peerConfig,
          stream: window["RTC_OUTBOUND_STREAM"]
        })

      this.Peers[user] = {
        initiator: initiator,
        receiver: null,
        connection: null,
        id: user
      }
      initiator.on('signal', (sdpRequest) => {
        console.log("send rtc_connection_request to "+user)

        this.Room.broadcast(JSON.stringify({
          to: user,
          type: "rtc_connection_request",
          peerInfo: this.Me,
          signaling: sdpRequest
        }))
      })

      initiator.on('connect', () => {
        console.log("rtc connection complete with "+user+" (as initiator)")
        this.Peers[user].connection = initiator
        this.Peers[user].connection.send("CONNECT")
        this.addErrorHandlers(this.Peers[user])
        this.emit('peer_connected', this.Peers[user].peerInfo || null)

      })
      initiator.on('data', (data) => {
        this.emit("peer_data_received", {peer: this.Peers[user].peerInfo, data: data})
      })
      initiator.on('stream', (remoteVideoStream) => {
        this.emit("peer_video_received", {stream: remoteVideoStream, peer: this.Peers[user].peerInfo || null})
      })
    }

    acceptConnectionRequest(from, payload) {
        /*
        if (this.Peers[from]) 
        {
            console.log("connection with "+from+"already in progress, ignoring")
            return
        } */
      if (!this.Peers[from]) {
          this.Peers[from] =
          {
           initiator: null,
           connection: null,
           id: from
          }
      }
      var receiver = new RTCPeer({
          trickle:false, 
          config: peerConfig, 
          stream: window["RTC_OUTBOUND_STREAM"]
      })
      this.Peers[from].receiver = receiver
      this.Peers[from].peerInfo  = payload.peerInfo

      receiver.signal(payload.signaling)

      receiver.on('signal', (sdpResponse) => {
        console.log("send rtc_connection_response to "+from)

        this.Room.broadcast(JSON.stringify({
            to: from,
            type: "rtc_connection_response",
            peerInfo: this.Me,
            signaling: sdpResponse
          }))    
      })

      receiver.on('data', (data) => {
        if (data == "CONNECT") {
            if (this.Peers[from].connection != null) {
                console.log("already connected to "+from)
                return
            }
        
            console.log("rtc connection complete with "+from+" (as receiver)")
            this.Peers[from].connection = receiver
            this.addErrorHandlers(this.Peers[from])

            this.emit('peer_connected', this.Peers[from].peerInfo || null)
        } else {
            //HANDLE DATA
            this.emit("peer_data_received", {peer: this.Peers[from].peerInfo, data: data})
        }
      })

        receiver.on('stream', (remoteVideoStream) => {
            this.emit("peer_video_received", {stream: remoteVideoStream, peer: this.Peers[from].peerInfo || null})
        })
      }

    //this gets called if I receive a response
    //which means that I'm the initiator
    //I've already connected as the receiver
    //I ignore it. Otherwise I process the signal, 
    //which fires my connect event
    completeConnection(from, payload) {
      if (this.Peers[from].connection != null) {
        console.log("already connected to "+from)
        return
      }
      this.Peers[from].peerInfo = payload.peerInfo
      this.Peers[from].initiator.signal(payload.signaling)
    }

    //returns all Peers that are currently connected
    getConnectedPeers() {
      var peers = this.Peers
      var p=[]

      for (let key in peers){
        if(peers.hasOwnProperty(key)){
          p.push(peers[key])
        }
      }

      var peerConnections = p.filter(x => x.connection && x.connection != null).map(y => y.connection)
      return peerConnections;
    }
  }
  