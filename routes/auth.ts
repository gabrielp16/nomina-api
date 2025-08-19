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

// @route   POST /api/auth/fix-database
// @desc    TEMPORARY - Fix database with proper user/role data
// @access  Public (remove after fixing)
router.post('/fix-database', asyncHandler(async (req: Request, res: Response) => {
  console.log('🔧 Starting database fix...');
  
  try {
    const bcrypt = await import('bcrypt');
    
    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    await User.deleteMany({});
    await Role.deleteMany({});
    await Permission.deleteMany({});

    // Create permissions first
    console.log('🔐 Creating permissions...');
    const permissions = await Permission.create([
      {
        nombre: 'Gestión de Usuarios',
        descripcion: 'Crear, editar, eliminar y ver usuarios',
        modulo: 'usuarios',
        accion: 'MANAGE'
      },
      {
        nombre: 'Gestión de Roles',
        descripcion: 'Crear, editar, eliminar y ver roles',
        modulo: 'roles',
        accion: 'MANAGE'
      },
      {
        nombre: 'Gestión de Permisos',
        descripcion: 'Crear, editar, eliminar y ver permisos',
        modulo: 'permisos',
        accion: 'MANAGE'
      },
      {
        nombre: 'Dashboard',
        descripcion: 'Acceso al panel principal',
        modulo: 'dashboard',
        accion: 'READ'
      }
    ]);

    console.log(`✅ Created ${permissions.length} permissions`);

    // Create admin role
    console.log('🎭 Creating admin role...');
    const adminRole = await Role.create({
      nombre: 'Administrador',
      descripcion: 'Rol con acceso completo al sistema',
      permisos: permissions.map((p: any) => p._id),
      isActive: true
    });

    console.log(`✅ Admin role created with ID: ${adminRole._id}`);

    // Create admin user (let User model handle password hashing)
    console.log('👤 Creating admin user...');
    const adminUser = await User.create({
      nombre: 'Administrador',
      apellido: 'Sistema',
      correo: 'admin@morchis.com',
      numeroCelular: '+51999999999',
      password: 'admin123', // Raw password - let User model hash it
      role: adminRole._id,
      isActive: true,
      authProvider: 'local'
    });

    console.log(`✅ Admin user created with ID: ${adminUser._id}`);

    // Verify the data
    console.log('🔍 Verifying data...');
    const userWithRole = await User.findById(adminUser._id).populate('role');
    if (!userWithRole) {
      throw new Error('User verification failed');
    }

    console.log('✅ Database fix completed!');
    
    res.json({
      success: true,
      message: 'Database fixed successfully!',
      data: {
        userId: adminUser._id,
        roleId: adminRole._id,
        permissionsCount: permissions.length,
        credentials: {
          email: 'admin@morchis.com',
          password: 'admin123'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error fixing database:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix database',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

// @route   GET /api/auth/debug
// @desc    TEMPORARY - Debug database connection and data
// @access  Public (remove after fixing)
router.get('/debug', asyncHandler(async (req: Request, res: Response) => {
  console.log('🔧 Starting database debug...');
  
  try {
    // Get database connection info
    const dbUri = process.env.DATABASE_URL || process.env.MONGODB_URI || 'Not configured';
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Count documents
    const userCount = await User.countDocuments();
    const roleCount = await Role.countDocuments();
    const permissionCount = await Permission.countDocuments();
    
    // Find admin user
    const adminUser = await User.findOne({ correo: 'admin@morchis.com' })
      .populate('role')
      .select('-password');
    
    res.json({
      success: true,
      message: 'Database debug info',
      data: {
        environment: process.env.NODE_ENV,
        isProduction,
        dbConfigured: !!dbUri,
        dbUri: dbUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'),
        counts: {
          users: userCount,
          roles: roleCount,
          permissions: permissionCount
        },
        adminUser: adminUser ? {
          id: adminUser._id,
          email: adminUser.correo,
          name: `${adminUser.nombre} ${adminUser.apellido}`,
          isActive: adminUser.isActive,
          role: adminUser.role
        } : null,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error in debug:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to debug database',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;
