const socket = io();
const statusText = document.getElementById('status');
const remoteAudio = document.getElementById('remoteAudio');

let peerConnection;
let localStream;
let isCaller = false;

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Join the signaling server on page load
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
  remoteAudio.srcObject = null;
});

async function startCall() {
  statusText.textContent = 'Starting voice call...';

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    statusText.textContent = 'Error accessing microphone: ' + err.message;
    console.error('getUserMedia error:', err);
    return;
  }

  peerConnection = new RTCPeerConnection(config);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { candidate: event.candidate });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
  };

  peerConnection.ontrack = (event) => {
    console.log('Track received:', event.track.kind);
    if (remoteAudio.srcObject !== event.streams[0]) {
      remoteAudio.srcObject = event.streams[0];
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

  statusText.textContent = 'Call connected!';
}
