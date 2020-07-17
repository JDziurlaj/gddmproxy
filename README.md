# GDDM Proxy

This tool intercepts and replaces TCP packets between a TN5250 client and an AS/400. It can be used to observe behavior changes in client/server interactions.

This tool was designed to test various changes and their potential impact on an AS/400s GDDM orders.

# Running

Tested with Node 12.14.1
```sh
npm install
node tcpproxy.js
```