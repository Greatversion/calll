const socket = io();
const callBtn = document.getElementById('callBtn');
const statusText = document.getElementById('status');

let peerConnection;
let localStream;
let isCaller = false;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// ✅ Join the signaling server on page load
window.addEventListener('DOMContentLoaded', () => {
  socket.emit('join');
});

socket.on('joined', () => {
  statusText.textContent = 'Waiting for peer to join...';
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
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

socket.on('leave', () => {
  statusText.textContent = 'Peer disconnected.';
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
});

async function startCall() {
  statusText.textContent = 'Starting voice call...';

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  peerConnection = new RTCPeerConnection(config);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { candidate: event.candidate });
    }
  };

  peerConnection.ontrack = (event) => {
    const audio = document.createElement('audio');
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
    document.body.appendChild(audio);
  };

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  if (isCaller) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { sdp: offer });
  }

  statusText.textContent = 'Call connected!';
}
