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

router.post('/leave-beacon', async (req, res) => {
  try {
    const { token, matchId } = req.body;

    if (!token || !matchId) {
      return res.status(400).json({ error: 'Token y matchId requeridos' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const playerId = payload.id;

    // Buscar usuario antes de modificarlo
    const user = await prisma.user.findUnique({ where: { id: playerId } });

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Si era admin → eliminar partida y resetear todos los jugadores
    if (user.role === 'ADMIN') {
      await prisma.user.updateMany({
        where: { matchId },
        data: { matchId: null, role: 'PLAYER', score: 0 },
      });

      await prisma.match.delete({ where: { id: matchId } });

      console.log(`🧹 Admin ${user.id} salió → partida ${matchId} eliminada`);
      return res.json({
        message: 'El administrador salió; la partida fue eliminada y todos fueron expulsados',
      });
    }

    // Si era jugador normal → solo salir
    await prisma.user.update({
      where: { id: playerId },
      data: { matchId: null, role: 'PLAYER', score: 0 },
    });

    console.log(`🚪 Jugador ${user.id} salió del match ${matchId}`);
    res.json({ message: 'Jugador removido por beacon' });
  } catch (err) {
    console.error('Error beacon:', err);
    res.status(500).json({ error: 'Error al salir de la partida via beacon' });
  }
});

// Unirse a una partida (rol PLAYER)
router.post('/join/:id', auth, async (req, res) => {
  try {
    const matchId = req.params.id;
    const userId = req.user.id;

    // Buscar la partida
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { players: true },
    });

    if (!match) {
      return res.status(404).json({ error: 'Partida no encontrada' });
    }

    // Buscar usuario
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.matchId) {
      return res.status(400).json({ error: 'Ya estás participando en una partida' });
    }

    // Verificar cupo
    if (match.players.length >= match.maxPlayers) {
      return res.status(400).json({ error: 'La partida ya está llena' });
    }

    // Unir usuario a la partida
    await prisma.user.update({
      where: { id: userId },
      data: { matchId, role: 'PLAYER' },
    });

    // Obtener partida actualizada con jugadores
    const updatedMatch = await prisma.match.findUnique({
      where: { id: matchId },
      include: { players: true },
    });

    // 🔥 Devolver también el jugador que acaba de entrar
    const joinedPlayer = updatedMatch.players.find(p => p.id === userId);

    res.json({
      match: updatedMatch,
      player: joinedPlayer,
    });

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

// Enviar solicitud de amistad
router.post('/friends/request/:id', auth, async (req, res) => {
  const userId = req.user.id;
  const friendId = req.params.id.trim();

  if (userId === friendId) {
    return res.status(400).json({ error: 'No puedes agregarte a ti mismo' });
  }

  try {
    const friend = await prisma.user.findUnique({ where: { id: friendId } });
    if (!friend) return res.status(404).json({ error: 'El usuario no existe' });

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'PENDING') {
        return res.status(400).json({ error: 'Ya hay una solicitud pendiente' });
      } else if (existing.status === 'ACCEPTED') {
        return res.status(400).json({ error: 'Ya son amigos' });
      }
    }

    await prisma.friendship.create({
      data: {
        userId,
        friendId,
        requestedBy: userId,
        status: 'PENDING',
      },
    });

    res.json({ message: 'Solicitud de amistad enviada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar la solicitud' });
  }
});

//Listar solicitudes de amistad

router.get('/friends/requests', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const requests = await prisma.friendship.findMany({
      where: { friendId: userId, status: 'PENDING' },
      include: {
        user: { select: { id: true, nickname: true, fullName: true } },
      },
    });

    res.json(requests.map(r => ({
      id: r.id,
      from: r.user,
      createdAt: r.createdAt
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// Aceptar solicitud de amistad
router.post('/friends/accept/:id', auth, async (req, res) => {
  const userId = req.user.id;
  const requesterId = req.params.id.trim(); // el que envió la solicitud

  try {
    // Buscar la amistad pendiente
    const friendship = await prisma.friendship.findFirst({
      where: {
        userId: requesterId,
        friendId: userId,
        status: 'PENDING',
      },
    });

    if (!friendship) {
      return res.status(404).json({ error: 'No hay solicitud pendiente de este usuario' });
    }

    // Actualizar estado a ACCEPTED
    await prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: 'ACCEPTED' },
    });

    // Buscar el usuario que envió la solicitud para obtener el nickname
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { nickname: true },
    });

    const nickname = requester?.nickname || 'Jugador';

    res.json({ message: `Solicitud de amistad de ${nickname} aceptada ✅` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al aceptar solicitud' });
  }
});

// Rechazar solicitud de amistad
router.post('/friends/reject/:id', auth, async (req, res) => {
  const userId = req.user.id;
  const requesterId = req.params.id.trim(); // ID del jugador que envió la solicitud

  try {
    // Buscar la solicitud pendiente
    const friendship = await prisma.friendship.findFirst({
      where: {
        userId: requesterId,
        friendId: userId,
        status: 'PENDING',
      },
    });

    if (!friendship) {
      return res.status(404).json({ error: 'No hay solicitud pendiente de este usuario' });
    }

    // Actualizar el estado a RECHAZED
    await prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: 'REJECTED' },
    });

    // Buscar el nickname del jugador que envió la solicitud
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { nickname: true },
    });

    const nickname = requester?.nickname || 'Jugador';

    res.json({ message: `Solicitud de amistad de ${nickname} rechazada ❌` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al rechazar solicitud' });
  }
});

// Obtener lista de amigos aceptados (bidireccional)
router.get('/friends', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { userId },     // yo envié la solicitud
          { friendId: userId } // yo recibí la solicitud
        ],
      },
      include: {
        user: {
          select: { id: true, nickname: true, fullName: true, email: true },
        },
        friend: {
          select: { id: true, nickname: true, fullName: true, email: true },
        },
      },
    });

    // Mapear para devolver siempre el “otro usuario” como amigo
    const friends = friendships.map(f => {
      if (f.userId === userId) return f.friend; // yo soy user, el otro es friend
      return f.user; // yo soy friend, el otro es user
    });

    res.json(friends);
  } catch (err) {
    console.error('Error al obtener amigos:', err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
