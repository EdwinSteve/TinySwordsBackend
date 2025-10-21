import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();

// Middleware para verificar token
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// Crear partida (rol ADMIN)
router.post('/create', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title } = req.body; //Recibir título

    if (!title) return res.status(400).json({ error: 'El título es obligatorio' });

    const existingCreated = await prisma.match.findUnique({
      where: { creatorId: userId },
    });
    if (existingCreated)
      return res.status(400).json({ error: 'Ya has creado una partida' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.matchId)
      return res.status(400).json({ error: 'Ya estás en una partida activa' });

    const match = await prisma.match.create({
      data: {
        title,
        maxPlayers: 5,
        creatorId: userId,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { matchId: match.id, role: 'ADMIN' },
    });

    const fullMatch = await prisma.match.findUnique({
      where: { id: match.id },
      include: { players: true },
    });

    res.json(fullMatch);
  } catch (err) {
    console.error('Error al crear partida:', err);
    res.status(500).json({ error: err.message });
  }
});


// Unirse a una partida (rol PLAYER)
router.post('/join/:id', auth, async (req, res) => {
  try {
    const matchId = req.params.id;
    const userId = req.user.id;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { players: true },
    });

    if (!match) return res.status(404).json({ error: 'Partida no encontrada' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.matchId)
      return res.status(400).json({ error: 'Ya estás participando en una partida' });

    if (match.players.length >= match.maxPlayers)
      return res.status(400).json({ error: 'La partida ya está llena' });

    await prisma.user.update({
      where: { id: userId },
      data: { matchId, role: 'PLAYER' },
    });

    const updatedMatch = await prisma.match.findUnique({
      where: { id: matchId },
      include: { players: true },
    });

    res.json(updatedMatch);
  } catch (err) {
    console.error('Error al unirse a partida:', err);
    res.status(500).json({ error: err.message });
  }
});

// Salir de una partida
router.post('/leave/:id', auth, async (req, res) => {
  try {
    const matchId = req.params.id;
    const userId = req.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.matchId !== matchId)
      return res.status(400).json({ error: 'No perteneces a esta partida' });

    if (user.role === 'ADMIN') {
      await prisma.user.updateMany({
        where: { matchId },
        data: { matchId: null, role: 'PLAYER', score: 0 },
      });

      await prisma.match.delete({ where: { id: matchId } });

      return res.json({
        message: 'El administrador salió; la partida fue eliminada y todos fueron expulsados',
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { matchId: null, role: 'PLAYER', score: 0 },
    });


    res.json({ message: 'Has salido de la partida' });
  } catch (err) {
    console.error('Error al salir de partida:', err);
    res.status(500).json({ error: err.message });
  }
});

// Expulsar jugador (solo ADMIN)
router.post('/kick/:userId', auth, async (req, res) => {
  try {
    const adminId = req.user.id;
    const targetUserId = req.params.userId;

    // Obtener al administrador
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      include: { match: true },
    });

    if (!admin.match)
      return res.status(400).json({ error: 'No estás en una partida' });

    if (admin.role !== 'ADMIN')
      return res.status(403).json({ error: 'Solo el administrador puede expulsar jugadores' });

    // Obtener al jugador objetivo
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser || targetUser.matchId !== admin.match.id)
      return res.status(400).json({ error: 'El jugador no pertenece a tu partida' });

    if (targetUser.id === adminId)
      return res.status(400).json({ error: 'No puedes expulsarte a ti mismo' });

    // Expulsar jugador
    await prisma.user.update({
      where: { id: targetUserId },
      data: { matchId: null, role: 'PLAYER', score: 0 },
    });

    res.json({ message: `El jugador ${targetUser.nickname} fue expulsado de la partida` });
  } catch (err) {
    console.error('Error al expulsar jugador:', err);
    res.status(500).json({ error: err.message });
  }
});

// Listar partidas
router.get('/', auth, async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      include: { players: true },
    });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Incrementar score del jugador actual
router.post('/score/increment', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { points } = req.body;

    // Validación básica
    if (typeof points !== 'number' || points === 0) {
      return res.status(400).json({ error: 'Los puntos deben ser un número distinto de 0' });
    }

    // Verificar que el usuario esté en una partida
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user.matchId) {
      return res.status(400).json({ error: 'No estás en una partida activa' });
    }

    // Actualizar su puntaje sumando los puntos recibidos
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { score: { increment: points } },
    });

    // Respuesta
    res.json({
      message: `Tu puntaje ha sido actualizado (+${points})`,
      newScore: updatedUser.score,
    });
  } catch (err) {
    console.error('Error al incrementar score:', err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
