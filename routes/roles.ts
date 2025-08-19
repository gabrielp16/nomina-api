import express from 'express';
import type { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auth, requirePermission } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';

const router = express.Router();

// Validaciones
const roleValidation = [
  body('nombre')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La descripción no puede exceder 200 caracteres'),
  body('permisoIds')
    .isArray({ min: 1 })
    .withMessage('Debe seleccionar al menos un permiso'),
  body('permisoIds.*')
    .isMongoId()
    .withMessage('ID de permiso inválido')
];

const updateRoleValidation = [
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La descripción no puede exceder 200 caracteres'),
  body('permisoIds')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Debe seleccionar al menos un permiso'),
  body('permisoIds.*')
    .optional()
    .isMongoId()
    .withMessage('ID de permiso inválido')
];

// @route   GET /api/roles
// @desc    Obtener todos los roles con paginación
// @access  Private (READ_ROLES permission)
router.get('/', auth, requirePermission('READ_ROLES'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string || '';
  const skip = (page - 1) * limit;

  // Construir filtro de búsqueda
  const searchFilter = search ? {
    $or: [
      { nombre: { $regex: search, $options: 'i' } },
      { descripcion: { $regex: search, $options: 'i' } }
    ]
  } : {};

  // Obtener roles con paginación
  const [roles, total] = await Promise.all([
    Role.find(searchFilter)
      .populate({
        path: 'permisos',
        select: 'nombre descripcion modulo accion'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Role.countDocuments(searchFilter)
  ]);

  res.json({
    success: true,
    data: {
      data: roles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

// @route   GET /api/roles/:id
// @desc    Obtener rol por ID
// @access  Private (READ_ROLES permission)
router.get('/:id', auth, requirePermission('READ_ROLES'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const role = await Role.findById(req.params.id)
    .populate({
      path: 'permisos',
      select: 'nombre descripcion modulo accion'
    });

  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Rol no encontrado'
    });
  }

  res.json({
    success: true,
    data: role
  });
}));

// @route   POST /api/roles
// @desc    Crear nuevo rol
// @access  Private (CREATE_ROLES permission)
router.post('/', auth, requirePermission('CREATE_ROLES'), activityLogger('CREATE', 'ROLE'), roleValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const { nombre, descripcion, permisoIds } = req.body;

  // Verificar si el rol ya existe
  const existingRole = await Role.findOne({ nombre });
  if (existingRole) {
    return res.status(400).json({
      success: false,
      message: 'Ya existe un rol con este nombre'
    });
  }

  // Verificar que todos los permisos existen
  const permissions = await Permission.find({ _id: { $in: permisoIds } });
  if (permissions.length !== permisoIds.length) {
    return res.status(400).json({
      success: false,
      message: 'Uno o más permisos no existen'
    });
  }

  // Crear rol
  const role = new Role({
    nombre,
    descripcion,
    permisos: permisoIds
  });

  await role.save();

  // Obtener rol con permisos poblados
  const roleWithPermissions = await Role.findById(role._id)
    .populate({
      path: 'permisos',
      select: 'nombre descripcion modulo accion'
    });

  res.status(201).json({
    success: true,
    message: 'Rol creado exitosamente',
    data: roleWithPermissions
  });
}));

// @route   PUT /api/roles/:id
// @desc    Actualizar rol
// @access  Private (UPDATE_ROLES permission)
router.put('/:id', auth, requirePermission('UPDATE_ROLES'), activityLogger('UPDATE', 'ROLE'), updateRoleValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const role = await Role.findById(req.params.id);
  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Rol no encontrado'
    });
  }

  const { nombre, descripcion, permisoIds } = req.body;

  // Si se está actualizando el nombre, verificar que no exista
  if (nombre && nombre !== role.nombre) {
    const existingRole = await Role.findOne({ nombre });
    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un rol con este nombre'
      });
    }
  }

  // Si se están actualizando los permisos, verificar que existen
  if (permisoIds) {
    const permissions = await Permission.find({ _id: { $in: permisoIds } });
    if (permissions.length !== permisoIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Uno o más permisos no existen'
      });
    }
  }

  // Actualizar campos
  if (nombre) role.nombre = nombre;
  if (descripcion !== undefined) role.descripcion = descripcion;
  if (permisoIds) role.permisos = permisoIds;

  await role.save();

  // Obtener rol actualizado con permisos poblados
  const updatedRole = await Role.findById(role._id)
    .populate({
      path: 'permisos',
      select: 'nombre descripcion modulo accion'
    });

  res.json({
    success: true,
    message: 'Rol actualizado exitosamente',
    data: updatedRole
  });
}));

// @route   DELETE /api/roles/:id
// @desc    Eliminar rol
// @access  Private (DELETE_ROLES permission)
router.delete('/:id', auth, requirePermission('DELETE_ROLES'), activityLogger('DELETE', 'ROLE'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const role = await Role.findById(req.params.id);
  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Rol no encontrado'
    });
  }

  // Verificar si hay usuarios asignados a este rol
  const usersWithRole = await User.countDocuments({ role: req.params.id });
  if (usersWithRole > 0) {
    return res.status(400).json({
      success: false,
      message: `No se puede eliminar el rol. Hay ${usersWithRole} usuario(s) asignado(s) a este rol.`
    });
  }

  await Role.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Rol eliminado exitosamente'
  });
}));

// @route   PATCH /api/roles/:id/activate
// @desc    Activar rol
// @access  Private (UPDATE_ROLES permission)
router.patch('/:id/activate', auth, requirePermission('UPDATE_ROLES'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const role = await Role.findByIdAndUpdate(
    req.params.id,
    { isActive: true },
    { new: true }
  ).populate({
    path: 'permisos',
    select: 'nombre descripcion modulo accion'
  });

  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Rol no encontrado'
    });
  }

  res.json({
    success: true,
    message: 'Rol activado exitosamente',
    data: role
  });
}));

// @route   PATCH /api/roles/:id/deactivate
// @desc    Desactivar rol
// @access  Private (UPDATE_ROLES permission)
router.patch('/:id/deactivate', auth, requirePermission('UPDATE_ROLES'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const role = await Role.findById(req.params.id);
  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Rol no encontrado'
    });
  }

  // Verificar si hay usuarios activos asignados a este rol
  const activeUsersWithRole = await User.countDocuments({ 
    role: req.params.id, 
    isActive: true 
  });
  
  if (activeUsersWithRole > 0) {
    return res.status(400).json({
      success: false,
      message: `No se puede desactivar el rol. Hay ${activeUsersWithRole} usuario(s) activo(s) asignado(s) a este rol.`
    });
  }

  role.isActive = false;
  await role.save();

  const updatedRole = await Role.findById(role._id)
    .populate({
      path: 'permisos',
      select: 'nombre descripcion modulo accion'
    });

  res.json({
    success: true,
    message: 'Rol desactivado exitosamente',
    data: updatedRole
  });
}));

export default router;
