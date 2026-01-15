import prisma from "../prisma/client";
import userService from "./user.service.js";

class MatchService {
  async getMatches() {
    return prisma.match.findMany({ include: { players: true } });
  }

  async getMatchById(matchId) {
    return prisma.match.findUnique({
      where: { id: matchId },
      include: { players: true }
    });
  }

  async exitsMatchByCreatorId(creatorId) {
    return prisma.match.count({ where: { creatorId } }) > 0;
  }
  
  async createMatch(title, creatorId) {
    return prisma.match.create({
      data: {
        title,
        maxPlayers: 5,
        creatorId
      }
    });
  }
  
  async createMatchFlow(title, creatorId) {
    if (await this.exitsMatchByCreatorId(creatorId)) {
      throw new Error("Ya has creado una partida");
    }
    
    if (await userService.isUserInActiveMatch(creatorId)) {
      throw new Error("Ya estas en una partida activa");
    }

    const match = await this.createMatch(title, creatorId);

    await userService.setPlayerRoleAsAdmin(creatorId, match.id);

    return this.getMatchById(match.id);
  }

  async joinMatch(matchId, userId) {
    return prisma.user.update({
      where: { id: userId },
      data: { matchId, role: 'PLAYER' },
    });
  }

  async joinMatchFlow(matchId, userId) {
    const match = await this.getMatchById(matchId);

    if (!match) {
      throw new Error("Partida no encontrada");
    }

    if (await userService.isUserInActiveMatch(userId)) {
      throw new Error("Ya estas en una partida activa");
    }

    if (match.players.length >= match.maxPlayers) {
      throw new Error("La partida esta llena");
    }

    this.joinMatch(matchId, userId);

    const matchUpdated = this.getMatchById(matchId);

    const joinedPlayer = matchUpdated.players.find(p => p.id === userId);

    return { match: matchUpdated, player: joinedPlayer };
  }

  async leaveMatch(matchId, userId) {
    const user = await userService.getByUserId(userId);

    if (user.matchId !== matchId) {
      throw new Error("No perteneces a esta partida");
    }

    if (user.role === "ADMIN") {
      await userService.deleteMatchIdFromPlayers(matchId);
      
      this.deleteMatchById(matchId);

      return { message: "El administrador salió, la partida fue eliminada y todos fueron expulsados" };
    }
    userService.deleteMatchIdFromUser(userId);
    
    return { message: "Has salido de la partida" };
  }

  async kickUser(adminId, kickedId) {
    const admin = await userService.getByUserId(adminId);
    
    if (!admin.match) {
      throw new Error("No estás en una partida");
    }
    
    if (admin.role !== "ADMIN") {
      throw new Error("Solo el administrador puede expulsar jugadores");
    }
    
    const kickedUser = await userService.getByUserId(kickedId);

    if (!kickedUser || kickedUser.matchId !== admin.match.id) {
      throw new Error("El jugador no pertenece a tu partida");
    }

    if (kickedUser.id === adminId) {
      throw new Error("No puedes expulsarte a ti mismo");
    }

    await userService.deleteMatchIdFromUser(kickedId);

    return { message: `El jugador ${kickedUser.nickname} fue expulsado de la partida` };
  }
  
  async incrementScore(userId, points) {
    if (!(await userService.isUserInActiveMatch(userId))) {
      throw new Error("No estas en una partida activa");
    }

    const userUpdated = await prisma.user.update({
      where: { id: userId },
      data: { score: { increment: points } },
    });

    return userUpdated.score;
  }
  
  async deleteMatchById(matchId) {
    await prisma.match.delete({ where: { id: matchId } });
  }
}

export default new MatchService();