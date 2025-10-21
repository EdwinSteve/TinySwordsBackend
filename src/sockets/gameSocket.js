export const initGameSocket = (io) => {
  const rooms = new Map();

  io.on('connection', (socket) => {
    console.log('Jugador conectado:', socket.id);

    socket.on('join-room', (roomId, player) => {
      socket.join(roomId);
      if (!rooms.has(roomId)) rooms.set(roomId, []);
      rooms.get(roomId).push({ id: socket.id, player, score: 0 });
      io.to(roomId).emit('players-update', rooms.get(roomId));
    });

    socket.on('update-score', (roomId, playerId, score) => {
      const players = rooms.get(roomId) || [];
      const player = players.find(p => p.player.id === playerId);
      if (player) player.score = score;
      io.to(roomId).emit('scoreboard', players);
    });

    socket.on('disconnect', () => {
      for (const [roomId, players] of rooms.entries()) {
        const filtered = players.filter(p => p.id !== socket.id);
        rooms.set(roomId, filtered);
        io.to(roomId).emit('players-update', filtered);
      }
      console.log('Jugador desconectado:', socket.id);
    });
  });
};
