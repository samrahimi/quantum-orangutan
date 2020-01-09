# Demonstrating the power of p2p in the browser

Realtime p2p videoconferencing over webrtc, browser-browser with no servers, 
thanks to a distributed signaling solution that uses ipfs-pubsub as a transport. 
Note that the bundle is ~7 megs because you're running a full libp2p and ipfs stack 
in your browser :)

# Live Demo 

https://arweave.net/eJXM-idMQ2oRzJtVKGVcW62UUG20dMwt5Mos7hNt-Lk

## Pre-requisites

* Most recent stable version of Node and npm
* Browserify CLI (npm install -g browserify)

## Install dependencies

```
$ cd quantum-orangutan
$ sudo npm install -g --unsafe-perm=true --allow-root
```

On Mac OS the unsafe perms are needed to compile necessary networking libraries. At least on my system.

## Build (debug)

```
$ npm run-script compile
```

Browserify builds the node-style networking code starting from index.js
down the tree, into public/app.js - which lets any UI code communicate with the network. 


## Build (release)

```
$ npm run-script build
```

Creates a minified build, which is still very large. You can look at deploy-app-js.js for the beginning of a toolchain for deploying this to arweave :)  

## Run

```
$ npm start
```

## Open in browser

Using a recent version of Chrome or Firefox, open [http://localhost:12345#quantum-orangutan]
(http://localhost:12345#quantum-orangutan). 

Maybe you'll see me there. 

If you wanna make a donation to the Church of P2P, we accept bitcoin, ether, arweaves, random 
 tokens, hard currency, hardware, and whatever else :)

Check the console logs to understand the eonnction process, it is kinda cool.

## License

MIT
# quantum-orangutan
