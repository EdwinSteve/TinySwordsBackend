// src/sockets/gameSocket.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Inicializa la lógica de Socket.IO para partidas multiplayer.
 * @param {import("socket.io").Server} io 
 */
export function initGameSocket(io) {
  io.on('connection', (socket) => {
    console.log(`⚔️ Jugador conectado: ${socket.id}`);

    let currentMatchId = null;
    let currentUserId = null;

    // 🏰 Unirse a una partida
    socket.on('joinMatch', ({ matchId, userId }) => {
      if (!matchId || !userId) return;
      socket.join(matchId);
      currentMatchId = matchId;
      currentUserId = userId;

      console.log(`🧙‍♂️ Jugador ${userId} se unió a la partida ${matchId}`);
      io.to(matchId).emit('playerJoined', { userId });
    });

    // 🚪 Salir de una partida manualmente
    socket.on('leaveMatch', async ({ matchId, userId }) => {
      try {
        if (!matchId || !userId) return;
        socket.leave(matchId);

        console.log(`🚪 Jugador ${userId} salió del match ${matchId}`);
        io.to(matchId).emit('playerLeft', { userId });

        // 🔥 Lógica de limpieza en la base de datos
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return;

        if (user.role === 'ADMIN') {
          await prisma.user.updateMany({
            where: { matchId },
            data: { matchId: null, role: 'PLAYER', score: 0 },
          });

          await prisma.match.delete({ where: { id: matchId } });
          console.log(`👑 Admin salió — partida ${matchId} eliminada`);
          io.to(matchId).emit('matchEnded', { reason: 'Admin salió' });
        } else {
          await prisma.user.update({
            where: { id: userId },
            data: { matchId: null, role: 'PLAYER', score: 0 },
          });
        }

      } catch (err) {
        console.error('❌ Error en leaveMatch socket:', err);
      }
    });

    // 🧭 Movimiento del jugador
    socket.on('playerMove', ({ matchId, userId, x, y }) => {
      socket.to(matchId).emit('playerMoved', { userId, x, y });
    });

    // ⚔️ Ataque del jugador
    socket.on('playerAttack', ({ matchId, userId, targetId }) => {
      socket.to(matchId).emit('playerAttacked', { userId, targetId });
    });

    // 🔌 Desconexión del jugador
    socket.on('disconnect', async () => {
      console.log(`❎ Jugador desconectado: ${socket.id}`);

      if (!currentUserId || !currentMatchId) return;

      io.to(currentMatchId).emit('playerLeft', { userId: currentUserId });

      try {
        const user = await prisma.user.findUnique({ where: { id: currentUserId } });
        if (!user) return;

        if (user.role === 'ADMIN') {
          await prisma.user.updateMany({
            where: { matchId: currentMatchId },
            data: { matchId: null, role: 'PLAYER', score: 0 },
          });
          await prisma.match.delete({ where: { id: currentMatchId } });
          console.log(`💀 Admin desconectado — partida ${currentMatchId} eliminada`);
          io.to(currentMatchId).emit('matchEnded', { reason: 'Admin desconectado' });
        } else {
          await prisma.user.update({
            where: { id: currentUserId },
            data: { matchId: null, role: 'PLAYER', score: 0 },
          });
        }
      } catch (err) {
        console.error('❌ Error al limpiar en disconnect:', err);
      }
    });
  });
}
