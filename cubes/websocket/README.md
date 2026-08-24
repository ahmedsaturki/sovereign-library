# WebSocket / Transport Cube v0.1

Standalone RFC 6455 WebSocket transport for Node.js using only built-in modules.

## Included

- client/server handshake helpers
- frame encode/decode
- client masking and server unmasking validation
- text/binary messages
- fragmentation assembly
- ping/pong
- close handshake
- payload limits
- backpressure signal
- deterministic typed protocol errors
- native `node:http`, `node:net`, `node:tls`, and `node:crypto`

## Not included in v0.1

- third-party WebSocket packages
- Socket.IO
- compression/extensions
- reconnection policy
- broker/pubsub
- authentication framework
- distributed state

The cube is considered released only after the repository CI matrix passes on Ubuntu, Windows, and macOS.
