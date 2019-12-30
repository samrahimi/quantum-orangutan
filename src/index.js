/* PLEASE CHANGE THIS TO SOMETHING THAT UNIQUELY IDENTIFIES YOUR APP! 
   Either a DNS-style package ID or your github repo name are good options. 
   The IPFS pubsub stack is in alpha, and does not enforce any sort of 
   namespacing of subscription topic strings. Clients must take care of this 
   themselves to avoid naming collisions with other apps */ 
const APP_ID = "im.svn.rtc."


const IPFS = require('ipfs')
const Room = require('ipfs-pubsub-room')      
const RTCManager = require('./rtcmanager')    
const ArweaveManager = require('./arweave')                                           
const debug = console.log;

var ipfs

const announceRetryInterval = 5000
const announce = (room) => {
  room.broadcast(JSON.stringify({type:'announce'}))
}

const joinChannel = (channel, userInfo, callback) => {
  const room = Room(ipfs, 'im.svn.rtc.'+channel)
  const rtcManager = RTCManager(room, userInfo)
  room.on("subscribed", () => {
    debug(`Subscribed to ${channel} on IPFS pubsub, listening for connection requests`)

    room.on('peer joined', (peer) => 
    {
        if (peer == userInfo.id)
          debug("ignoring echoed join event")
        else
        {
          debug('ipfs peer ' + peer + ' joined, sending rtc connection request')
          rtcManager.requestConnection(peer)
        }
    }) 

    /* ipfs-pubsub-room does not have a stable implementation of direct 
     * messaging to ipfs peers listening on a pubsub topic. Therefore 
     * we implement message routing ourselves - the RTCManager sends 
     * SDP offers and answers using room.broadcast, specifying the recipient id
     * in the "to" field of message.data; the code below parses and filters 
     * incoming messages, and only handles those addressed to the current client 
     * 
     * Keep in mind that this is not secure, given that we're exchanging detailed
     * information about each client's external AND internal IPs and firewall config.
     * An exercise for the reader is to leverage Arweave or another blockchain to 
     * encrypt the messages with the recipients's public key (which is their address on the blockchain)
     * That way, only the intended recipient can decrypt the message, because they have the 
     * private key in their wallet
     * 
     * Due to the lack of security and the high latency of IPFS pubsub, 
     * we are using this network ONLY for peer discovery and exchange of metadata
     * needed to setup direct p2p connections between the peers: when a client joins a 
     * channel, they are connected directly to each of the clients listening on the channel. 
     * This allows the formation of a webrtc P2P mesh network for each channel 
     * that is totally self contained and secure, allowing clients to exchange data 
     * without any external dependencies once connected */
    room.on("message", (message) => {
      if (message.from == userInfo.id) {
        debug("ignoring broadcast message from self")
        return
      }

      var payload = JSON.parse(message.data)
      if (payload.to == userInfo.id || payload.type =="announce") {
        switch (payload.type) {
          case "announce":
            rtcManager.requestConnection(message.from)
            break
          case "rtc_connection_request":
            rtcManager.acceptConnectionRequest(message.from, payload)
            break
          case "rtc_connection_response":
            rtcManager.completeConnection(message.from, payload)
            break
        }
      }
    })
  })


  room.on('peer left', (peer) => {
    debug('ipfs peer ' + peer + ' left...')
  })
  callback({room, rtcManager, ipfs})
}

const joinWhenConnectedToSwarm = (channel, userInfo, callback) =>
{    
  //ipfs.ready fires prematurely... it can take a few seconds 
  //to peer with other ipfs nodes (the swarm, not the nodes subscribed to this topic)
  ipfs.swarm.peers((err, peers) => {
    if (err) throw err
    debug('IPFS peers in swarm: ', peers)
    if (!peers || peers.length == 0) {
      setTimeout(() => {joinWhenConnectedToSwarm(channel, userInfo, callback)}, 1000)
    } else {
      joinChannel(channel, userInfo, callback)
    }
  })
}

//Entry point. If no channel is specified, it will use the window's location hash as the channel
//userInfo can be whatever you want... as long as the interface is consistent between users
//listening on a given topic
const start = (channelToJoin, userInfo, callback) => {
  ipfs = new IPFS({
    repo: repo(),
    EXPERIMENTAL: {
      pubsub: true
    },
    config: {
      Addresses: {
        Swarm: [
          '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
        ]
      }
    }
  })
  console.log("connecting to ipfs bootstrap nodes")
  ipfs.once('ready', () => ipfs.id((err, info) => {
    if (err) { console.error(err) }
    debug('IPFS node ready with address ' + info.id)
    userInfo.id = info.id //so we can filter out our own messages lol
    const channel= APP_ID+channelToJoin

    joinWhenConnectedToSwarm(channel, userInfo, callback)
  }))
}

function repo () {
  return 'ipfs/im-svn-rtc/' + Math.random()
}

window["ServerlessSignalHub"] = {
  init: (channelToJoin, userInfo, callback) => start(channelToJoin, userInfo, callback),
  arweaveManager: (appId) => ArweaveManager(appId)
}