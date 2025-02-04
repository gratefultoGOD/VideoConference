# Video Conference App

A Discord-style video conference application built with PeerJS that allows users to join a single room for video conferencing. The application supports both desktop and mobile devices.

## Features

- Discord-like UI/UX
- Video and audio streaming
- Screen sharing
- Mute/unmute audio
- Enable/disable video
- Responsive design for mobile devices
- Real-time participants list
- Single room for all participants

## Prerequisites

- Node.js (v12 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd video-conference-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3001
```

## Usage

1. When you first open the application, you'll be prompted to enter your username
2. Grant camera and microphone permissions when requested
3. Use the control buttons at the bottom to:
   - Mute/unmute your microphone
   - Enable/disable your camera
   - Share your screen

## Mobile Support

The application is fully responsive and works on mobile devices. The UI will automatically adjust to provide the best experience on smaller screens.

## Browser Support

The application works best with modern browsers that support WebRTC:
- Google Chrome (recommended)
- Firefox
- Safari
- Microsoft Edge

## Security Note

This is a basic implementation and should not be used in production without additional security measures such as:
- HTTPS
- User authentication
- Room access control
- Data encryption

## License

MIT 