import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const prisma = new PrismaClient();


// Middleware de autenticación
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}


// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { nickname, password, fullName, email, birthDate } = req.body;

    if (!nickname || !password || !fullName || !email || !birthDate) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { nickname }] },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'El email o nickname ya están en uso' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        id: uuidv4(),
        nickname,
        password: hashedPassword,
        fullName,
        email,
        birthDate: new Date(birthDate),
      },
    });

    const { password: _, ...safeUser } = newUser;

    res.status(201).json({
      message: 'Usuario creado correctamente',
      user: safeUser,
    });
  } catch (err) {
    console.error('Error en /register:', err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});


// Login (por email o nickname)
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Debes ingresar email o nickname y contraseña' });
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { nickname: identifier }] },
    });

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign(
      { id: user.id, nickname: user.nickname },
      process.env.JWT_SECRET,
      { expiresIn: '3h' }
    );

    res.json({ message: 'Login exitoso', token });
  } catch (err) {
    console.error('Error en /login:', err);
    res.status(500).json({ error: 'Error en el login' });
  }
});


// Editar datos del usuario autenticado
router.put('/edit', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { nickname, fullName, email, birthDate, password } = req.body;

    // Validar si hay al menos un campo para actualizar
    if (!nickname && !fullName && !email && !birthDate && !password) {
      return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
    }

    const dataToUpdate = {};

    if (nickname) dataToUpdate.nickname = nickname;
    if (fullName) dataToUpdate.fullName = fullName;
    if (email) dataToUpdate.email = email;
    if (birthDate) dataToUpdate.birthDate = new Date(birthDate);
    if (password) dataToUpdate.password = await bcrypt.hash(password, 10);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });

    const { password: _, ...safeUser } = updatedUser;

    res.json({ message: 'Datos actualizados correctamente', user: safeUser });
  } catch (err) {
    console.error('Error en /edit:', err);
    res.status(500).json({ error: 'Error al editar el usuario' });
  }
});

router.delete('/delete', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { matchId: null, score: 0 },
    });

    await prisma.user.delete({ where: { id: userId } });

    res.json({ message: 'Tu cuenta ha sido eliminada y has sido desconectado' });
  } catch (err) {
    console.error('Error en /delete:', err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

export default router;
