import express from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { createMatch, getMatches, incrementScore, joinMatch, kickUser, leaveMatch } from "../controllers/match.controller.js";

const router = express.Router();

router.get("/", auth, getMatches);
router.post("/create", auth, createMatch);
router.post("/join/:id", auth, joinMatch);
router.post("/leave/:id", auth, leaveMatch);
router.post("/kick/:userId", auth, kickUser);
router.post("score/increment", auth, incrementScore);

export default router;