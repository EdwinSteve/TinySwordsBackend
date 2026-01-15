import matchService from "../services/match.service.js";

export async function getMatches(req, res) {
  try {
    const matches = await matchService.getMatches();
    res.json(matches);
  } catch (err) {
    console.error("Error al obtener partidas:", err);
    res.status(500).json({
      success: false,
      error: "Error al obtener partidas"
    });
  }
}

export async function createMatch(req, res) {
  const creatorId = req.user.id;
  const { title } = req.body;

  if (!title) return res.status(422).json({ error: "El titulo es obligatorio" });
  
  try {
    const match = await matchService.createMatchFlow(title, creatorId);
    return res.status(201).json(match);
  } catch (err) {
    console.error("Error creando la partida:", err);
    res.status(500).json({
      success: false,
      error: "Error creando la partida"
    });
  }
}

export async function joinMatch(req, res) {
  const matchId = req.params.id;
  const userId = req.user.id;

  try {
    const { match, player } = await matchService.joinMatchFlow(matchId, userId);
    res.json({ match, player, });
  } catch (err) {
    console.error("Error al unirse a la partida:", err);
    res.status(500).json({
      success: false,
      error: "Error al unirse a la partida"
    });
  }
}

export async function leaveMatch(req, res) {
  const matchId = req.params.id;
  const userId = req.user.id;

  try {
    const { message } = await matchService.leaveMatch(matchId, userId);
    res.json({ message });
  } catch (err) {
    console.error("Error al salir de partida:", err);
    res.status(500).json({
      success: false,
      error: "Error al salir de partida"
    });
  }
}

export async function kickUser(req, res) {
  const adminId = req.user.id;
  const kickedId = req.params.userId;

  try {
    const { message } = await matchService.kickUser(adminId, kickedId);
    res.json({ message });
  } catch (err) {
    console.error("Error sacando a usuario de la partida:", err);
    res.status(500).json({
      success: false,
      error: "Error sacando a usuario de la partida"
    });
  }
}

export async function incrementScore(req, res) {
  const userId = req.user.id;
  const { points } = req.body;
  
  if (typeof points !== "number" || points === 0) {
    return res.status(422).json({ error: "Los puntos deben ser un número distinto de 0" });
  }

  try {
    const newScore = await matchService.incrementScore(userId, points);

    res.json({
      message: `Tu puntaje ha sido actualizado (+${score})`,
      newScore
    });
  } catch (err) {
    console.error("Error al incrementar puntaje:", err);
    res.status(500).json({
      success: false,
      error: "Error al incrementar puntaje"
    });
  }
}