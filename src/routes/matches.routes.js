import express from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { createMatch, getMatches, incrementScore, joinMatch, kickUser, leaveMatch } from "../controllers/match.controller.js";

const router = express.Router();

router.get("/", auth, getMatches);
router.post("/create", auth, createMatch);
router.post("/join/:id", auth, joinMatch);
router.put("/leave/:id", auth, leaveMatch);
router.put("/kick/:userId", auth, kickUser);
router.put("score/increment", auth, incrementScore);

export default router;