//WIP refactor of top-level integration code currently in index.js and index.html
function getUniqueRepoName () {
    return 'ipfs/im-svn-rtc/' + Math.random()
}

const debug = console.log

const ipfsConfigDefaults = {
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
  }


class PeerChan extends EventEmitter {
    pollForPeers() {
        this.ipfs.swarm.peers((err, peers) => {
            if (err) throw err
            debug('IPFS peers in swarm: ', peers)
            if (!peers || peers.length == 0) {
              setTimeout(this.pollForPeers, 250)
            } else {
              //we have been connected to at least 1 peer, 
              //which means we're ready to publish and subscribed
              this.emit("ipfs_connected")
            }
        })
    }
    constructor(appId, ipfsConfigOverride) {
        this.APP_ID = appId;
        this.IPFS_PEER_ID = null
        this.IPFS_REPO = getUniqueRepoName();

        this.Channels = {}      //channels currently listening on
                                //each channel has an ipfs-pubsub room 
                                //for signaling and peer discovery, 
                                //and an RTCmanager to handle the P2p 
                                //networking for that channel;
        this.rtcManager = null

        let ipfsConfig = ipfsConfigOverride || ipfsConfigDefaults
        ipfsConfig.repo = this.IPFS_REPO
        this.ipfs = new IPFS(ipfsConfig)
        this.ipfs.once('ready', () => {
            this.ipfs.id((err, info) => {
                if (err) {
                    debug(err)
                }
                if (info.id) {
                    debug('IPFS address is ' + info.id+', looking for peers...')
                    this.IPFS_PEER_ID = info.id
                    this.pollForPeers()
                }
            })
        })
    }
    init()

}

  