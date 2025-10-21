import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import matchRoutes from './routes/matches.js';
import { initGameSocket } from './sockets/gameSocket.js';

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);

// Socket.IO
initGameSocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
