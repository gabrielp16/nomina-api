import express from 'express';
import type { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Permission from '../models/Permission.js';
import Role from '../models/Role.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auth, requirePermission } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';

const router = express.Router();

// Validaciones
const permissionValidation = [
  body('nombre')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La descripción no puede exceder 200 caracteres'),
  body('modulo')
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('El módulo debe tener entre 2 y 30 caracteres'),
  body('accion')
    .isIn(['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE'])
    .withMessage('Acción inválida')
];

const updatePermissionValidation = [
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
  body('modulo')
    .optional()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('El módulo debe tener entre 2 y 30 caracteres'),
  body('accion')
    .optional()
    .isIn(['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE'])
    .withMessage('Acción inválida')
];

// @route   GET /api/permissions
// @desc    Obtener todos los permisos con paginación
// @access  Private (READ_PERMISSIONS permission)
router.get('/', auth, requirePermission('READ_PERMISSIONS'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string || '';
  const modulo = req.query.modulo as string || '';
  const accion = req.query.accion as string || '';
  const skip = (page - 1) * limit;

  // Construir filtro de búsqueda
  const searchFilter: any = {};
  
  if (search) {
    searchFilter.$or = [
      { nombre: { $regex: search, $options: 'i' } },
      { descripcion: { $regex: search, $options: 'i' } },
      { modulo: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (modulo) {
    searchFilter.modulo = { $regex: modulo, $options: 'i' };
  }
  
  if (accion) {
    searchFilter.accion = accion;
  }

  // Obtener permisos con paginación
  const [permissions, total] = await Promise.all([
    Permission.find(searchFilter)
      .sort({ modulo: 1, accion: 1, nombre: 1 })
      .skip(skip)
      .limit(limit),
    Permission.countDocuments(searchFilter)
  ]);

  res.json({
    success: true,
    data: {
      data: permissions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

// @route   GET /api/permissions/:id
// @desc    Obtener permiso por ID
// @access  Private (READ_PERMISSIONS permission)
router.get('/:id', auth, requirePermission('READ_PERMISSIONS'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const permission = await Permission.findById(req.params.id);

  if (!permission) {
    return res.status(404).json({
      success: false,
      message: 'Permiso no encontrado'
    });
  }

  res.json({
    success: true,
    data: permission
  });
}));

// @route   POST /api/permissions
// @desc    Crear nuevo permiso
// @access  Private (CREATE_PERMISSIONS permission)
router.post('/', auth, requirePermission('CREATE_PERMISSIONS'), activityLogger('CREATE', 'PERMISSION'), permissionValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const { nombre, descripcion, modulo, accion } = req.body;

  // Verificar si el permiso ya existe
  const existingPermission = await Permission.findOne({ nombre });
  if (existingPermission) {
    return res.status(400).json({
      success: false,
      message: 'Ya existe un permiso con este nombre'
    });
  }

  // Crear permiso
  const permission = new Permission({
    nombre,
    descripcion,
    modulo: modulo.toUpperCase(),
    accion
  });

  await permission.save();

  res.status(201).json({
    success: true,
    message: 'Permiso creado exitosamente',
    data: permission
  });
}));

// @route   PUT /api/permissions/:id
// @desc    Actualizar permiso
// @access  Private (UPDATE_PERMISSIONS permission)
router.put('/:id', auth, requirePermission('UPDATE_PERMISSIONS'), activityLogger('UPDATE', 'PERMISSION'), updatePermissionValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const permission = await Permission.findById(req.params.id);
  if (!permission) {
    return res.status(404).json({
      success: false,
      message: 'Permiso no encontrado'
    });
  }

  const { nombre, descripcion, modulo, accion } = req.body;

  // Si se está actualizando el nombre, verificar que no exista
  if (nombre && nombre !== permission.nombre) {
    const existingPermission = await Permission.findOne({ nombre });
    if (existingPermission) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un permiso con este nombre'
      });
    }
  }

  // Actualizar campos
  if (nombre) permission.nombre = nombre;
  if (descripcion !== undefined) permission.descripcion = descripcion;
  if (modulo) permission.modulo = modulo.toUpperCase();
  if (accion) permission.accion = accion;

  await permission.save();

  res.json({
    success: true,
    message: 'Permiso actualizado exitosamente',
    data: permission
  });
}));

// @route   DELETE /api/permissions/:id
// @desc    Eliminar permiso
// @access  Private (DELETE_PERMISSIONS permission)
router.delete('/:id', auth, requirePermission('DELETE_PERMISSIONS'), activityLogger('DELETE', 'PERMISSION'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const permission = await Permission.findById(req.params.id);
  if (!permission) {
    return res.status(404).json({
      success: false,
      message: 'Permiso no encontrado'
    });
  }

  // Verificar si hay roles que usan este permiso
  const rolesWithPermission = await Role.countDocuments({ 
    permisos: req.params.id 
  });
  
  if (rolesWithPermission > 0) {
    return res.status(400).json({
      success: false,
      message: `No se puede eliminar el permiso. Hay ${rolesWithPermission} rol(es) que lo utilizan.`
    });
  }

  await Permission.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Permiso eliminado exitosamente'
  });
}));

// @route   PATCH /api/permissions/:id/activate
// @desc    Activar permiso
// @access  Private (UPDATE_PERMISSIONS permission)
router.patch('/:id/activate', auth, requirePermission('UPDATE_PERMISSIONS'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const permission = await Permission.findByIdAndUpdate(
    req.params.id,
    { isActive: true },
    { new: true }
  );

  if (!permission) {
    return res.status(404).json({
      success: false,
      message: 'Permiso no encontrado'
    });
  }

  res.json({
    success: true,
    message: 'Permiso activado exitosamente',
    data: permission
  });
}));

// @route   PATCH /api/permissions/:id/deactivate
// @desc    Desactivar permiso
// @access  Private (UPDATE_PERMISSIONS permission)
router.patch('/:id/deactivate', auth, requirePermission('UPDATE_PERMISSIONS'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const permission = await Permission.findById(req.params.id);
  if (!permission) {
    return res.status(404).json({
      success: false,
      message: 'Permiso no encontrado'
    });
  }

  // Verificar si hay roles activos que usan este permiso
  const activeRolesWithPermission = await Role.countDocuments({ 
    permisos: req.params.id,
    isActive: true
  });
  
  if (activeRolesWithPermission > 0) {
    return res.status(400).json({
      success: false,
      message: `No se puede desactivar el permiso. Hay ${activeRolesWithPermission} rol(es) activo(s) que lo utilizan.`
    });
  }

  permission.isActive = false;
  await permission.save();

  res.json({
    success: true,
    message: 'Permiso desactivado exitosamente',
    data: permission
  });
}));

// @route   GET /api/permissions/modules
// @desc    Obtener lista de módulos únicos
// @access  Private (READ_PERMISSIONS permission)
router.get('/modules/list', auth, requirePermission('READ_PERMISSIONS'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const modules = await Permission.distinct('modulo');

  res.json({
    success: true,
    data: modules.sort()
  });
}));

// @route   GET /api/permissions/actions
// @desc    Obtener lista de acciones disponibles
// @access  Private (READ_PERMISSIONS permission)
router.get('/actions/list', auth, requirePermission('READ_PERMISSIONS'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const actions = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE'];

  res.json({
    success: true,
    data: actions
  });
}));

export default router;
