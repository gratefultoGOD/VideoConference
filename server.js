const express = require('express');
const { PeerServer } = require('peer');
const path = require('path');

const app = express();
const server = require('http').Server(app);

// Serve static files
app.use(express.static(path.join(__dirname)));

// Create PeerJS server with proper configuration
const peerServer = PeerServer({
    port: 3002,
    path: '/',
    proxied: false,
    debug: true,
    allow_discovery: true
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`HTTP Server running on port ${PORT}`);
    console.log(`PeerJS Server running on port 3002`);
}); 