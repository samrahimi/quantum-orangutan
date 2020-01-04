    module.exports = (appId) => {
        return new ArweaveManager(appId)
    }

    var {and, or, equals} = require('./arql-ops');

    //permanent persona is a "login with arweave" paradigm i'm demoing here 
    //it should be refactored into a separate library, as it is not 
    //app-specific
    const PERMANENT_PERSONA_APP_ID = "persona.arweave"


    class ArweaveManager {
        constructor(appId) {
            //todo: clean up my dependencies!
            this.arweaveSdk = window["Arweave"].init()

            this._currentWallet = {address: '', balance: 0, keystore: null, rawJson: ''}
            this._persona  = null
            this._allChannels = []
            this._currentChannel = {}   
            this.AR_APP_ID = appId
            this.getNetworkStatus(info => console.log(info))
        }
        async getAllChannels() {
            this._allChannels= []
        
            const query = and(  
              equals('AR_APP_ID', this.AR_APP_ID),
              equals('type', 'channel')
            )
        
            const txids = await this.arweaveSdk.arql(query)
            console.log("get all channels - step 1")
            console.log(JSON.stringify(txids))
        
            for (var i=0; i< txids.length; i++) {
              var txid = txids[i]
              var tx = await this.arweaveSdk.transactions.get(txid)
              this._allChannels.push(JSON.parse(tx.get('data', {decode: true, string: true})))
            }
        
            console.log("get all channels - step 2")
            console.log(JSON.stringify(this._allChannels))
        
            return this._allChannels;
          }        

        async getOrCreateChannel(channelName, creator) {
            var allChannels = await this.getAllChannels()
            if (allChannels.filter(channel => channel.name == channelName).length > 0) {
                console.log("returning existing channel "+channelName)
                this._currentChannel = allChannels.filter(channel => channel.name == name)[0]
            } else {
                
                var newChannel = {name: channelName, creator: creator, createdAt: (new Date()).getTime()}
                this._currentChannel = newChannel
        
                console.log("created new channel "+channelName+", submitting in background")
                var tx = await this.arweaveSdk.createTransaction({data: JSON.stringify(newChannel)}, this._currentWallet.keystore)
        
                tx.addTag('Content-Type', 'text/plain')
                tx.addTag('AR_APP_ID', this.AR_APP_ID)
                tx.addTag('type', 'channel')
        
                await this.arweaveSdk.transactions.sign(tx, this._currentWallet.keystore)
                //console.log(JSON.stringify(tx))
                var response = await this.arweaveSdk.transactions.post(tx)
                console.log(`saving channel to arweave. Check status at https://viewblock.io/arweave/tx/${tx.id}`)
                
            }
            return this._currentChannel
        }

        async createPermanentPersona(name, profile) {
            //TODO: enforce name uniqueness!

            var persona = {name: name, address: this._currentWallet.address, profile: profile}
            var tx = await this.arweaveSdk.createTransaction({data: JSON.stringify(persona)}, this._currentWallet.keystore)
            tx.addTag('Content-Type', 'text/plain')
            tx.addTag('AR_APP_ID', PERMANENT_PERSONA_APP_ID)
            tx.addTag('AR_APP_CREATED_BY', this.AR_APP_ID)

            tx.addTag('type', 'persona')
            tx.addTag('publickey', this._currentWallet.address)

            await this.arweaveSdk.transactions.sign(tx, this._currentWallet.keystore)
            console.log(JSON.stringify(tx))
            var response = await this.arweaveSdk.transactions.post(tx)
            console.log(`saving persona to arweave. Check status at https://viewblock.io/arweave/tx/${tx.id}`)
            
            this._persona = persona
            return persona;
        }

        //by default will lookup the Permanent Persona associated with this._currentWallet.address
        //this is a public user profile that has a unique name and maps 1:1 with a wallet address
        getPermanentPersona(walletAddress, cb) {
            const query = and(  
                equals('AR_APP_ID', PERMANENT_PERSONA_APP_ID),
                equals('type', 'persona'),
                equals('publickey', walletAddress || this._currentWallet.address)
              )
            this.arweaveSdk.arql(query).then(txids => {
                if (txids.length == 0) 
                    cb(null)
                else
                {
                    this.arweaveSdk.transactions.get(txids[0]).then(tx => {
                        this._persona=JSON.parse(tx.get('data', {decode: true, string: true}))     
                        this._persona.txid=txids[0]
                        cb(this._persona)
                    })
                }
            })
        }
        
        loginWithWalletString(walletJson, cb) {
            try {
            var wallet = JSON.parse(walletJson)
            this.arweaveSdk.wallets.jwkToAddress(wallet).then((address) => {
                this.arweaveSdk.wallets.getBalance(address).then((balance)=> {
                    this._currentWallet = {address: address, balance: balance, keystore: wallet}
            
                    if (balance < 100000) {
                        console.log("Balance extremely low, app may not work. Visit tokens.arweave.org and get a new wallet + 1.00000 AR in free tokens")
                    }
                    
                    //to prevent private keys from getting dumped into logfiles etc...
                    cb({address: address, balance: balance})
                })
            })
            } catch (err) {
            console.log(JSON.stringify(err, null, 2))
            alert("Not an Arweave wallet file! Visit tokens.arweave.org and get a new wallet + 1.00000 AR in free tokens")
            }
        }

        //If the user has uploaded their wallet using an HTML file input
        //expects a File object from the browser
        loginWithWalletFile(fileObj, callback) {
            const reader = new FileReader()
            reader.readAsText(fileObj)
            reader.onloadend = () => {
                this.loginWithWalletString(reader.result, callback)
            }
        }

        getNetworkStatus(callback) {
            this.arweaveSdk.network.getInfo().then(info => callback(info))
        }
  }