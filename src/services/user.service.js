import prisma from "../prisma/client.js";

class UserService {
  async getByUserId(userId) {
    return prisma.user.findUnique({ where: { id: userId } });
  }

  async isUserInActiveMatch(userId) {
    const user = await this.getByUserId(userId);
    return Boolean(user?.matchId);
  }

  async setPlayerRoleAsAdmin(userId, matchId) {
  return prisma.user.update({
    where: { id: userId },
    data: { matchId, role: 'ADMIN' }
  });
  }

  async deleteMatchIdFromUser(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { matchId: null, role: 'PLAYER', score: 0 },
    });
  }

  async deleteMatchIdFromPlayers(matchId) {
    return prisma.user.updateMany({
      where: { matchId },
      data: { matchId: null, role: 'PLAYER', score: 0 },
    });
  }
}

export default new UserService();