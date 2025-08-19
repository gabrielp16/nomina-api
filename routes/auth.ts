import express from 'express';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import { asyncHandler, createError } from '../middleware/errorHandler.js';
import { auth } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { logAuthActivity } from '../middleware/activityLogger.js';

const router = express.Router();

// Función para generar JWT
const generateToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
};

// Validaciones
const loginValidation = [
  body('correo')
    .isEmail()
    .normalizeEmail()
    .withMessage('Por favor ingresa un correo válido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
];

const registerValidation = [
  body('nombre')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  body('apellido')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres'),
  body('correo')
    .isEmail()
    .normalizeEmail()
    .withMessage('Por favor ingresa un correo válido'),
  body('numeroCelular')
    .matches(/^\+?[\d\s\-\(\)]{10,}$/)
    .withMessage('Por favor ingresa un número celular válido'),
  body('password')
    .isLength({ min: 6 })
    .matches(/(?=.*[a-z])/)
    .withMessage('La contraseña debe tener al menos una letra minúscula')
    .matches(/(?=.*[A-Z])/)
    .withMessage('La contraseña debe tener al menos una letra mayúscula')
    .matches(/(?=.*\d)/)
    .withMessage('La contraseña debe tener al menos un número')
];

// @route   POST /api/auth/register
// @desc    Registrar nuevo usuario
// @access  Public
router.post('/register', registerValidation, asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const { nombre, apellido, correo, numeroCelular, password } = req.body;

  // Verificar si el usuario ya existe
  const existingUser = await User.findOne({ correo });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'El usuario ya existe con este correo'
    });
  }

  // Buscar rol por defecto para nuevos usuarios
  let defaultRole = await Role.findOne({ nombre: 'USER' });
  if (!defaultRole) {
    // Crear rol USER si no existe
    const readPermission = await Permission.findOne({ nombre: 'READ_USERS' });
    defaultRole = new Role({
      nombre: 'USER',
      descripcion: 'Usuario básico del sistema',
      permisos: readPermission ? [readPermission._id] : []
    });
    await defaultRole.save();
  }

  // Crear usuario
  const user = new User({
    nombre,
    apellido,
    correo,
    numeroCelular,
    password,
    role: defaultRole._id,
    authProvider: 'local'
  });

  await user.save();

  // Generar token
  const token = generateToken(user._id.toString());

  // Obtener datos completos del usuario con rol y permisos
  const userWithRole = await User.findById(user._id)
    .populate({
      path: 'role',
      populate: {
        path: 'permisos',
        model: 'Permission'
      }
    });

  const role = userWithRole?.role as any;
  const permissions = role?.permisos?.map((p: any) => p.nombre) || [];

  res.status(201).json({
    success: true,
    message: 'Usuario registrado exitosamente',
    data: {
      user: {
        id: userWithRole?._id,
        email: userWithRole?.correo,
        name: `${userWithRole?.nombre} ${userWithRole?.apellido}`,
        permissions,
        role: role?.nombre || 'USER'
      },
      token
    }
  });
}));

// @route   POST /api/auth/login
// @desc    Iniciar sesión
// @access  Public
router.post('/login', loginValidation, asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const { correo, password } = req.body;
  
  console.log('🔍 Login attempt:', { correo, passwordLength: password?.length });

  // Buscar usuario
  const user = await User.findOne({ correo: correo })
    .populate({
      path: 'role',
      populate: {
        path: 'permisos',
        model: 'Permission'
      }
    });

  if (!user || !user.isActive) {
    console.log('❌ User not found or inactive:', { found: !!user, active: user?.isActive });
    
    // Log failed login attempt if user exists
    if (user) {
      await logAuthActivity(
        user._id.toString(),
        `${user.nombre} ${user.apellido}`,
        user.correo,
        'FAILED_LOGIN',
        req,
        'error'
      );
    }
    
    return res.status(400).json({
      success: false,
      message: 'Credenciales inválidas'
    });
  }

  // Verificar contraseña
  console.log('🔐 Comparing passwords...');
  const isMatch = await user.comparePassword(password);
  console.log('🔐 Password match result:', isMatch);
  
  if (!isMatch) {
    console.log('❌ Password mismatch');
    
    // Log failed login attempt
    await logAuthActivity(
      user._id.toString(),
      `${user.nombre} ${user.apellido}`,
      user.correo,
      'FAILED_LOGIN',
      req,
      'error'
    );
    
    return res.status(400).json({
      success: false,
      message: 'Credenciales inválidas'
    });
  }

  // Actualizar último login
  user.lastLogin = new Date();
  await user.save();

  // Generar token
  const token = generateToken(user._id.toString());

  const role = user.role as any;
  const permissions = role?.permisos?.map((p: any) => p.nombre) || [];

  // Log successful login activity
  await logAuthActivity(
    user._id.toString(),
    `${user.nombre} ${user.apellido}`,
    user.correo,
    'LOGIN',
    req,
    'success'
  );

  res.json({
    success: true,
    message: 'Login exitoso',
    data: {
      user: {
        id: user._id,
        email: user.correo,
        name: `${user.nombre} ${user.apellido}`,
        permissions,
        role: role?.nombre || 'USER'
      },
      token
    }
  });
}));

// @route   POST /api/auth/verify
// @desc    Verificar token
// @access  Private
router.get('/verify', asyncHandler(async (req: Request, res: Response) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    
    const user = await User.findById(decoded.userId)
      .populate({
        path: 'role',
        populate: {
          path: 'permisos',
          model: 'Permission'
        }
      });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    const role = user.role as any;
    const permissions = role?.permisos?.map((p: any) => p.nombre) || [];

    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.correo,
        name: `${user.nombre} ${user.apellido}`,
        permissions,
        role: role?.nombre || 'USER'
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
}));

// @route   POST /api/auth/refresh
// @desc    Refrescar token
// @access  Private
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    const newToken = generateToken(decoded.userId);

    res.json({
      success: true,
      data: { token: newToken }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
}));

// @route   POST /api/auth/logout
// @desc    Cerrar sesión
// @access  Private
router.post('/logout', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  // Log logout activity
  if (req.user) {
    await logAuthActivity(
      req.user.id,
      req.user.name,
      req.user.email,
      'LOGOUT',
      req,
      'success'
    );
  }
  
  // En un sistema con JWT stateless, no hay mucho que hacer aquí
  // En producción, podrías implementar una blacklist de tokens
  res.json({
    success: true,
    message: 'Logout exitoso'
  });
}));

// @route   GET /api/auth/status
// @desc    Verificar estado de configuración de JWT
// @access  Public (solo en desarrollo)
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!isDevelopment) {
    return res.status(404).json({
      success: false,
      message: 'Not found'
    });
  }

  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpires = process.env.JWT_EXPIRES_IN;
  
  res.json({
    success: true,
    data: {
      environment: process.env.NODE_ENV,
      jwtConfigured: !!jwtSecret,
      jwtSecretLength: jwtSecret?.length || 0,
      jwtExpires: jwtExpires || '7d',
      timestamp: new Date().toISOString()
    }
  });
}));

export default router;
