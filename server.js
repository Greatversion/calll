// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

const room = 'room1';

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', () => {
    const clients = io.sockets.adapter.rooms.get(room) || new Set();
    const numClients = clients.size;

    if (numClients < 2) {
      socket.join(room);
      console.log(`User ${socket.id} joined ${room}`);
      socket.emit('joined');

      if (numClients === 1) {
        // second user just joined; notify both
        socket.emit('ready');
        socket.to(room).emit('ready');
      }
    } else {
      socket.emit('full');
    }

    socket.on('signal', (data) => {
      socket.to(room).emit('signal', data);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      socket.to(room).emit('leave');
    });
  });
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
