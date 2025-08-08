const socket = io();
const statusText = document.getElementById('status');
const remoteAudio = document.getElementById('remoteAudio');
const startBtn = document.getElementById('startBtn');
const endBtn = document.getElementById('endBtn');

let peerConnection;
let localStream;
let isCaller = false;
let hasJoined = false;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Button handlers
startBtn.onclick = () => {
  if (!hasJoined) {
    socket.emit('join');
    hasJoined = true;
    statusText.textContent = 'Joining...';
  }
};

endBtn.onclick = () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteAudio.srcObject = null;
  statusText.textContent = 'Call ended.';
  startBtn.disabled = false;
  endBtn.disabled = true;
};

// Socket.IO handlers
socket.on('joined', () => {
  statusText.textContent = 'Waiting for peer...';
});

socket.on('ready', async () => {
  isCaller = true;
  await startCall();
});

socket.on('signal', async (data) => {
  if (!peerConnection) await startCall();

  if (data.sdp) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    if (data.sdp.type === 'offer') {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', { sdp: answer });
    }
  } else if (data.candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (err) {
      console.warn('Error adding ICE candidate', err);
    }
  }
});

socket.on('leave', () => {
  statusText.textContent = 'Peer disconnected.';
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteAudio.srcObject = null;
  startBtn.disabled = false;
  endBtn.disabled = true;
});

// WebRTC logic
async function startCall() {
  statusText.textContent = 'Connecting...';

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    statusText.textContent = 'Microphone error: ' + err.message;
    return;
  }

  peerConnection = new RTCPeerConnection(config);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { candidate: event.candidate });
    }
  };

  peerConnection.ontrack = (event) => {
    const [remoteStream] = event.streams;
    if (remoteStream && remoteAudio.srcObject !== remoteStream) {
      remoteAudio.srcObject = remoteStream;
      remoteAudio.play().catch(err => console.warn('Autoplay failed:', err));
    }
  };

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  if (isCaller) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { sdp: offer });
  }

  statusText.textContent = 'Call in progress...';
  startBtn.disabled = true;
  endBtn.disabled = false;
}
