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
     * IMPORTANT: for production, we need to encrypt the signaling messages 
     * sent over ipfs, which can be done using the user's wallets,
     * However, once the RTC connection is established, all p2p traffic 
     * is encrypted end to end. 
     *  */
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

  //sometimes this fires before the associated RTCPeerConnection knows it's dead
  //try to put it out of its misery, and move on ;)
  room.on('peer left', (peer) => {
    debug('ipfs peer ' + peer + ' left...')
    try {
      rtcManager.Peers[peer].connection.destroy()
      delete rtcManager.Peers[peer]
    } catch (err) {}
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