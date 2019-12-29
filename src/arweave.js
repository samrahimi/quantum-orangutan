    module.exports = (appId) => {
        return new ArweaveManager(appId)
    }

    // expects Arweave JS SDK to be on window["Arweave"]
    // therefore you must include it with a script tag before you load the bundle (including this file)
    const arweaveSdk = window["Arweave"].init()

    //Interacts with the arweave blockchain to handle simple database-like
    //tasks: login, get / create public channels, pin content, send money
    //appId: a unique namespace for your keys   
    class ArweaveManager {
        constructor(appId) {
            this._currentWallet = {address: '', balance: 0, keystore: null, rawJson: ''}
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
        
            txids.forEach(async(txid) => {
              var tx = await this.arweaveSdk.transactions.get(txid)
              this._allChannels.push(JSON.parse(tx.get('data', {decode: true, string: true})))
            })
        
            console.log("get all channels - step 2")
            console.log(JSON.stringify(this._allChannels))
        
            return this._allChannels;
          }        

          async getOrCreateChannel(channelName, creatorName) {
            var allChannels = await this.getAllChannels()
            if (allChannels.filter(channel => channel.name == channelName).length > 0) {
              console.log("returning existing channel "+channelName)
              this._currentChannel = allChannels.filter(channel => channel.name == name)[0]
              this.currentChannel$.next(this._currentChannel) 
            } else {
              
              var newChannel = {name: channelName, creator: creatorName, createdAt: (new Date()).getTime()}
              this._currentChannel = newChannel
              this.currentChannel$.next(this._currentChannel)
        
              console.log("created new channel "+channelName+", submitting in background")
              var tx = await this.arweaveSdk.createTransaction({data: JSON.stringify(newChannel)}, this._currentWallet.keystore)
        
              tx.addTag('Content-Type', 'text/plain')
              tx.addTag('AR_APP_ID', this.AR_APP_ID)
              tx.addTag('type', 'channel')
        
              await this.arweaveSdk.transactions.sign(tx, this._currentWallet.keystore)
              console.log(JSON.stringify(tx))
              var response = await this.arweaveSdk.transactions.post(tx)
              console.log(JSON.stringify(response))
            }
          }
        
        loginWithWalletString(walletJson, cb) {
            try {
            var wallet = JSON.parse(walletJson)
            this.arweaveSdk.wallets.jwkToAddress(wallet).then((address) => {
                this.arweaveSdk.wallets.getBalance(address).then((balance)=> {
                    this._currentWallet = {address: address, balance: balance, keystore: wallet, rawJson: JSON.stringify(wallet, null, 2)}
            
                    if (balance < 100000) {
                        console.log("Balance extremely low, app may not work. Visit tokens.arweave.org and get a new wallet + 1.00000 AR in free tokens")
                    }
                    
                    cb(this._currentWallet)
                })
            })
            } catch (err) {
            console.log(JSON.stringify(err, null, 2))
            alert("Not an Arweave wallet file! Visit tokens.arweave.org and get a new wallet + 1.00000 AR in free tokens")
            }
        }

        //If the user has uploaded their wallet using an HTML file input
        //expects a File object from the browser
        loginWithWalletFile(fileObj) {
            const reader = new FileReader()
            reader.readAsText(jsonFile)
            reader.onloadend = () => {
                this.loginWithWalletString(reader.result)
            }
        }

        getNetworkStatus(callback) {
            this.arweaveSdk.network.getInfo().then(info => callback(info))
        }
  }