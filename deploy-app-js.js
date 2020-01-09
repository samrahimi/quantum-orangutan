//because our app.js is 5.4 megs after minification
//this way we can build and deploy it separately from the html page and window-level scripts
//and spend less coins when we update the front end.

//Requires: app.js built and presence in docs/js
//index.html present in docs/js with all resources inlined except for app.js

//1. deploy app.min.js (our browserfied app + deps)
const Arweave = require('arweave/node');
const fs = require('fs')

//change this to your own wallet file, which obviously should not be part of this repo 
const WALLET_FILE= "/Users/sam/Downloads/arweave-keyfile-JEsrrfZGLyq7ga7anWGwq41l8EOK91yY_nOB_AtjB3Q.json"

const arweave = Arweave.init({
    host: 'arweave.net',// Hostname or IP address for a Arweave host
    port: 443,          // Port
    protocol: 'https',  // Network protocol http or https
    timeout: 300000,     // Network request timeouts in milliseconds
    logging: false,     // Enable network request logging
}
);

arweave.network.getInfo().then(console.log);

const privateKey = JSON.parse(fs.readFileSync(WALLET_FILE))



arweave.wallets.jwkToAddress(privateKey).then(async(address) => {
    console.log(address);

    let tx = await arweave.createTransaction({
        data: fs.readFileSync('./docs/js/app.js', "utf8")
    }, privateKey)

    tx.addTag("Content-Type", "application/javascript")
    tx.addTag("AR_APP_ID",  "im.svn.rtc.")
    tx.addTag("AR_APP_ROLE", "app.min.js")
    tx.addTag("AR_CREATED_AT", Date.now())
    await arweave.transactions.sign(tx, privateKey);
    const response = await arweave.transactions.post(tx);
    console.log(`Tx is posted and will be minted shortly. Check status at https://viewblock.io/arweave/tx/${tx.id}`);

    console.log("After it is up, update the app.js script tag in index.html to point to the arweave url")
    console.log("Or be REALLY cool, and have a loader script that runs on index.html and uses ARQL to query over the tags above, find the latest version, and inject it into the document")
});

//2. combine and deploy the other top level deps
//3. update index.html with the references
//4. deploy that.