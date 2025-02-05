const ROOM_ID = 'global-room'; // Single room for all users
let myPeer;
let myStream;
let myScreenStream;
let username = '';
const peers = {};
const participants = new Map();

const videoGrid = document.getElementById('video-grid');
const participantsList = document.getElementById('participants');
const joinModal = document.getElementById('joinModal');
const usernameInput = document.getElementById('username');
const joinBtn = document.getElementById('joinBtn');
const muteBtn = document.getElementById('muteBtn');
const videoBtn = document.getElementById('videoBtn');
const screenShareBtn = document.getElementById('screenShareBtn');

// Join room functionality
joinBtn.addEventListener('click', () => {
    username = usernameInput.value.trim();
    if (username) {
        joinModal.style.display = 'none';
        document.querySelector('.username').textContent = username;
        initializePeer();
    }
});

async function initializePeer() {
    try {
        // First check if the browser supports getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Tarayıcınız kamera ve mikrofon erişimini desteklemiyor. Lütfen Chrome veya Firefox\'un güncel bir sürümünü kullanın.');
        }

        // Request permissions with clear constraints for Firefox
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: {
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
                frameRate: { ideal: 30, max: 60 }
            }
        };

        try {
            // First request audio permission separately (helps with Firefox)
            await navigator.mediaDevices.getUserMedia({ audio: constraints.audio });
            console.log('Mikrofon izni alındı');

            // Then request video permission
            await navigator.mediaDevices.getUserMedia({ video: constraints.video });
            console.log('Kamera izni alındı');

            // Finally get both streams together
            myStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Tüm medya akışları başarıyla alındı');

        } catch (err) {
            console.error('Media error:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                throw new Error('Kamera ve mikrofon erişimi reddedildi. Lütfen tarayıcı ayarlarınızdan izin verin ve sayfayı yenileyin.');
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                throw new Error('Kamera veya mikrofon bulunamadı. Lütfen cihaz bağlantılarınızı kontrol edin.');
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                throw new Error('Kamera veya mikrofonunuz başka bir uygulama tarafından kullanılıyor.');
            } else if (err.name === 'OverconstrainedError') {
                throw new Error('Kamera özellikleriniz desteklenmiyor. Lütfen farklı bir kamera kullanın.');
            } else {
                throw new Error(`Medya cihazlarına erişilemedi: ${err.message}`);
            }
        }
        
        // Add self video without audio
        const selfVideo = document.createElement('video');
        selfVideo.muted = true; // Mute self video to prevent feedback
        selfVideo.srcObject = myStream;
        selfVideo.addEventListener('loadedmetadata', () => {
            selfVideo.play();
        });
        
        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-container';
        const usernameLabel = document.createElement('div');
        usernameLabel.className = 'username-label';
        usernameLabel.textContent = 'Me';
        videoContainer.appendChild(selfVideo);
        videoContainer.appendChild(usernameLabel);
        videoGrid.appendChild(videoContainer);

        // Initialize peer with a random ID prefixed with the room ID
        const peerId = `${ROOM_ID}-${Math.random().toString(36).substr(2, 9)}`;
        myPeer = new Peer(peerId, {
            host: 'localhost',
            port: 3002,
            path: '/',
            debug: 3,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        // Add connection error handling
        myPeer.on('disconnected', () => {
            console.log('Connection lost. Attempting to reconnect...');
            myPeer.reconnect();
        });

        myPeer.on('error', (err) => {
            console.error('PeerJS error:', err);
            if (err.type === 'peer-unavailable') {
                console.log('Peer unavailable, they may have left the room');
            } else {
                alert('Connection error. Please refresh the page and try again.');
            }
        });

        myPeer.on('open', (id) => {
            console.log('Successfully connected to PeerJS server with ID:', id);
            participants.set(id, { username, stream: myStream });
            updateParticipantsList();
            
            // Broadcast our presence to all peers
            const broadcastData = {
                type: 'new-user',
                username: username,
                peerId: id
            };

            myPeer.listAllPeers(peers => {
                console.log('Available peers:', peers);
                peers.forEach(peerId => {
                    if (peerId !== id && peerId.startsWith(ROOM_ID)) {
                        // Connect to each peer
                        const conn = myPeer.connect(peerId);
                        conn.on('open', () => {
                            console.log('Sending presence to:', peerId);
                            conn.send(broadcastData);
                        });
                    }
                });
            });
        });

        // Handle incoming data connections
        myPeer.on('connection', (conn) => {
            console.log('New connection from:', conn.peer);
            
            conn.on('data', (data) => {
                console.log('Received data:', data);
                if (data.type === 'new-user') {
                    console.log('New user joined:', data.username);
                    participants.set(data.peerId, { username: data.username, stream: null });
                    updateParticipantsList();

                    // Initiate video call to the new peer
                    const call = myPeer.call(data.peerId, myStream);
                    console.log('Initiating call to:', data.peerId);

                    call.on('stream', (userVideoStream) => {
                        console.log('Received stream from:', data.peerId);
                        if (!peers[data.peerId]) {
                            addVideoStream(userVideoStream, data.username);
                            peers[data.peerId] = call;
                        }
                    });

                    // Also send our info back
                    const responseConn = myPeer.connect(data.peerId);
                    responseConn.on('open', () => {
                        responseConn.send({
                            type: 'user-joined',
                            username: username,
                            peerId: myPeer.id
                        });
                    });
                }
                else if (data.type === 'user-joined') {
                    console.log('Existing user responded:', data.username);
                    participants.set(data.peerId, { username: data.username, stream: null });
                    updateParticipantsList();
                }
            });
        });

        // Handle incoming calls
        myPeer.on('call', (call) => {
            console.log('Receiving call from:', call.peer);
            call.answer(myStream);
            
            call.on('stream', (userVideoStream) => {
                console.log('Received stream in call from:', call.peer);
                if (!peers[call.peer]) {
                    addVideoStream(userVideoStream, participants.get(call.peer)?.username || 'Anonymous');
                    peers[call.peer] = call;
                }
            });

            call.on('error', (error) => {
                console.error('Call error:', error);
                if (peers[call.peer]) {
                    delete peers[call.peer];
                    updateParticipantsList();
                }
            });

            call.on('close', () => {
                console.log('Call closed with:', call.peer);
                if (peers[call.peer]) {
                    const videos = document.querySelectorAll('video');
                    videos.forEach(video => {
                        if (video.srcObject === peers[call.peer].stream) {
                            video.parentElement.remove();
                        }
                    });
                    delete peers[call.peer];
                    participants.delete(call.peer);
                    updateParticipantsList();
                }
            });
        });

        // Handle peer disconnection
        myPeer.on('close', () => {
            console.log('Connection to server closed');
            cleanup();
        });

    } catch (err) {
        console.error('Media access error:', err);
        alert(err.message || 'Kamera ve mikrofona erişilemedi. Lütfen izinleri kontrol edin ve tekrar deneyin.');
        return;
    }
}

function addVideoStream(stream, username) {
    // Check if this stream is already displayed
    const videos = document.querySelectorAll('video');
    for (let video of videos) {
        if (video.srcObject === stream) {
            console.log('Stream already displayed, skipping');
            return;
        }
    }

    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    
    const video = document.createElement('video');
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    
    const usernameLabel = document.createElement('div');
    usernameLabel.className = 'username-label';
    usernameLabel.textContent = username;
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(usernameLabel);
    videoGrid.appendChild(videoContainer);
}

function updateParticipantsList() {
    participantsList.innerHTML = '';
    participants.forEach((participant, id) => {
        const li = document.createElement('li');
        li.textContent = participant.username;
        participantsList.appendChild(li);
    });
}

// Control buttons functionality
muteBtn.addEventListener('click', () => {
    const enabled = myStream.getAudioTracks()[0].enabled;
    myStream.getAudioTracks()[0].enabled = !enabled;
    muteBtn.classList.toggle('active');
    muteBtn.querySelector('i').className = enabled ? 'fas fa-microphone-slash' : 'fas fa-microphone';
});

videoBtn.addEventListener('click', () => {
    const enabled = myStream.getVideoTracks()[0].enabled;
    myStream.getVideoTracks()[0].enabled = !enabled;
    videoBtn.classList.toggle('active');
    videoBtn.querySelector('i').className = enabled ? 'fas fa-video-slash' : 'fas fa-video';
});

screenShareBtn.addEventListener('click', async () => {
    try {
        if (!myScreenStream) {
            const stream = await navigator.mediaDevices.getDisplayMedia();
            myScreenStream = stream;
            addVideoStream(stream, username + ' (Screen)');
            screenShareBtn.classList.add('active');

            stream.getVideoTracks()[0].onended = () => {
                stopScreenShare();
            };
        } else {
            stopScreenShare();
        }
    } catch (err) {
        console.error('Error sharing screen:', err);
    }
});

function stopScreenShare() {
    if (myScreenStream) {
        myScreenStream.getTracks().forEach(track => track.stop());
        myScreenStream = null;
        screenShareBtn.classList.remove('active');
        // Remove screen share video element
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (video.srcObject === myScreenStream) {
                video.parentElement.remove();
            }
        });
    }
}

function cleanup() {
    // Clean up all connections
    Object.keys(peers).forEach(peerId => {
        if (peers[peerId]) {
            peers[peerId].close();
            delete peers[peerId];
        }
    });
    participants.clear();
    updateParticipantsList();
}

// Handle window/tab close
window.addEventListener('beforeunload', () => {
    if (myPeer) {
        myPeer.destroy();
    }
    if (myStream) {
        myStream.getTracks().forEach(track => track.stop());
    }
    if (myScreenStream) {
        myScreenStream.getTracks().forEach(track => track.stop());
    }
}); 