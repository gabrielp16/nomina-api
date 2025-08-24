import express from 'express';
import type { Request, Response } from 'express';
import { body, validationResult, query } from 'express-validator';
import User from '../models/User.js';
import Role from '../models/Role.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auth, requirePermission } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';

const router = express.Router();

// Validaciones
const userValidation = [
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
  body('role')
    .isMongoId()
    .withMessage('ID de rol inválido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
];

const updateUserValidation = [
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  body('apellido')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres'),
  body('correo')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Por favor ingresa un correo válido'),
  body('numeroCelular')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]{10,}$/)
    .withMessage('Por favor ingresa un número celular válido'),
  body('role')
    .optional()
    .isMongoId()
    .withMessage('ID de rol inválido')
];

// @route   GET /api/users
// @desc    Obtener todos los usuarios con paginación
// @access  Private (READ_USERS permission)
router.get('/', auth, requirePermission('READ_USERS'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string || '';
  const skip = (page - 1) * limit;

  // Construir filtro de búsqueda
  const searchFilter = search ? {
    $or: [
      { nombre: { $regex: search, $options: 'i' } },
      { apellido: { $regex: search, $options: 'i' } },
      { correo: { $regex: search, $options: 'i' } },
      { numeroCelular: { $regex: search, $options: 'i' } }
    ]
  } : {};

  // Obtener usuarios con paginación
  const [users, total] = await Promise.all([
    User.find(searchFilter)
      .populate({
        path: 'role',
        select: 'nombre descripcion'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(searchFilter)
  ]);

  res.json({
    success: true,
    data: {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

// Validación específica para actualización de perfil propio (sin rol)
const updateProfileValidation = [
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  body('apellido')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres'),
  body('correo')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Por favor ingresa un correo válido'),
  body('numeroCelular')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]{10,}$/)
    .withMessage('Por favor ingresa un número celular válido')
];

// @route   PUT /api/users/profile
// @desc    Actualizar perfil propio del usuario autenticado
// @access  Private (solo requiere autenticación)
router.put('/profile', auth, updateProfileValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const userId = req.user!.id;
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Usuario no encontrado'
    });
  }

  const { nombre, apellido, correo, numeroCelular } = req.body;

  // Si se está actualizando el correo, verificar que no exista
  if (correo && correo !== user.correo) {
    const existingUser = await User.findOne({ correo });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con este correo'
      });
    }
  }

  // Actualizar campos permitidos (sin rol)
  if (nombre !== undefined) user.nombre = nombre;
  if (apellido !== undefined) user.apellido = apellido;
  if (correo !== undefined) user.correo = correo;
  if (numeroCelular !== undefined) user.numeroCelular = numeroCelular;

  await user.save();

  // Retornar usuario actualizado con rol populado
  const updatedUser = await User.findById(user._id)
    .populate('role', 'nombre descripcion')
    .select('-password');

  res.json({
    success: true,
    message: 'Perfil actualizado exitosamente',
    data: updatedUser
  });
}));

// @route   GET /api/users/:id
// @desc    Obtener usuario por ID
// @access  Private (READ_USERS permission)
router.get('/:id', auth, requirePermission('READ_USERS'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.params.id)
    .populate({
      path: 'role',
      populate: {
        path: 'permisos',
        select: 'nombre descripcion modulo accion'
      }
    });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Usuario no encontrado'
    });
  }

  res.json({
    success: true,
    data: user
  });
}));

// @route   POST /api/users
// @desc    Crear nuevo usuario
// @access  Private (CREATE_USERS permission)
router.post('/', auth, requirePermission('CREATE_USERS'), activityLogger('CREATE', 'USER'), userValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const { nombre, apellido, correo, numeroCelular, role, password } = req.body;

  // Verificar si el usuario ya existe
  const existingUser = await User.findOne({ correo });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'Ya existe un usuario con este correo'
    });
  }

  // Verificar que el rol existe
  const roleDoc = await Role.findById(role);
  if (!roleDoc) {
    return res.status(400).json({
      success: false,
      message: 'Rol no encontrado'
    });
  }

  // Crear usuario
  const user = new User({
    nombre,
    apellido,
    correo,
    numeroCelular,
    role,
    password, // Usar la contraseña del formulario
    authProvider: 'local'
  });

  await user.save();

  // Obtener usuario con rol poblado
  const userWithRole = await User.findById(user._id)
    .populate({
      path: 'role',
      select: 'nombre descripcion'
    });

  res.status(201).json({
    success: true,
    message: 'Usuario creado exitosamente',
    data: userWithRole
  });
}));

// @route   PUT /api/users/:id
// @desc    Actualizar usuario
// @access  Private (UPDATE_USERS permission)
router.put('/:id', auth, requirePermission('UPDATE_USERS'), activityLogger('UPDATE', 'USER'), updateUserValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Usuario no encontrado'
    });
  }

  const { nombre, apellido, correo, numeroCelular, role } = req.body;

  // Si se está actualizando el correo, verificar que no exista
  if (correo && correo !== user.correo) {
    const existingUser = await User.findOne({ correo });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con este correo'
      });
    }
  }

  // Si se está actualizando el rol, verificar que existe
  if (role) {
    const roleDoc = await Role.findById(role);
    if (!roleDoc) {
      return res.status(400).json({
        success: false,
        message: 'Rol no encontrado'
      });
    }
  }

  // Actualizar campos
  if (nombre) user.nombre = nombre;
  if (apellido) user.apellido = apellido;
  if (correo) user.correo = correo;
  if (numeroCelular) user.numeroCelular = numeroCelular;
  if (role) user.role = role;

  await user.save();

  // Obtener usuario actualizado con rol poblado
  const updatedUser = await User.findById(user._id)
    .populate({
      path: 'role',
      select: 'nombre descripcion'
    });

  res.json({
    success: true,
    message: 'Usuario actualizado exitosamente',
    data: updatedUser
  });
}));

// @route   DELETE /api/users/:id
// @desc    Eliminar usuario
// @access  Private (DELETE_USERS permission)
router.delete('/:id', auth, requirePermission('DELETE_USERS'), activityLogger('DELETE', 'USER'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Usuario no encontrado'
    });
  }

  // No permitir eliminar el propio usuario
  if (user._id.toString() === req.user?._id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'No puedes eliminar tu propio usuario'
    });
  }

  await User.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Usuario eliminado exitosamente'
  });
}));

// @route   PATCH /api/users/:id/activate
// @desc    Activar usuario
// @access  Private (UPDATE_USERS permission)
router.patch('/:id/activate', auth, requirePermission('UPDATE_USERS'), activityLogger('ACTIVATE', 'USER'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: true },
    { new: true }
  ).populate({
    path: 'role',
    select: 'nombre descripcion'
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Usuario no encontrado'
    });
  }

  res.json({
    success: true,
    message: 'Usuario activado exitosamente',
    data: user
  });
}));

// @route   PATCH /api/users/:id/deactivate
// @desc    Desactivar usuario
// @access  Private (UPDATE_USERS permission)
router.patch('/:id/deactivate', auth, requirePermission('UPDATE_USERS'), activityLogger('DEACTIVATE', 'USER'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Usuario no encontrado'
    });
  }

  // No permitir desactivar el propio usuario
  if (user._id.toString() === req.user?._id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'No puedes desactivar tu propio usuario'
    });
  }

  user.isActive = false;
  await user.save();

  const updatedUser = await User.findById(user._id)
    .populate({
      path: 'role',
      select: 'nombre descripcion'
    });

  res.json({
    success: true,
    message: 'Usuario desactivado exitosamente',
    data: updatedUser
  });
}));

export default router;
