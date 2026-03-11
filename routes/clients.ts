import express from 'express';
import type { Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import Client from '../models/Client.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auth, requirePermission } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';

const router = express.Router();

const listValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('La pagina debe ser mayor a 0'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El limite debe estar entre 1 y 100'),
  query('search').optional().isString().withMessage('La busqueda debe ser un texto')
];

const updateClientValidation = [
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('La razon social debe tener entre 1 y 100 caracteres'),
  body('type').optional().isIn(['Persona Natural', 'Persona Juridica']).withMessage('El tipo debe ser Persona Natural o Persona Juridica'),
  body('documentNumber').optional().trim().isLength({ min: 1, max: 20 }).withMessage('El NIT debe tener entre 1 y 20 caracteres'),
  body('address').optional().trim().isLength({ min: 1, max: 256 }).withMessage('La direccion debe tener entre 1 y 256 caracteres'),
  body('city').optional().trim().isLength({ min: 1, max: 50 }).withMessage('La ciudad debe tener entre 1 y 50 caracteres'),
  body('phone').optional().trim().isLength({ min: 1, max: 10 }).withMessage('El telefono debe tener entre 1 y 10 caracteres'),
  body('email').optional().isEmail().isLength({ max: 70 }).withMessage('El correo debe ser valido y maximo 70 caracteres'),
  body('active').optional().isBoolean().withMessage('El estado activo debe ser booleano')
];

const createClientValidation = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('La razon social debe tener entre 1 y 100 caracteres'),
  body('type').isIn(['Persona Natural', 'Persona Juridica']).withMessage('El tipo debe ser Persona Natural o Persona Juridica'),
  body('documentNumber').trim().isLength({ min: 1, max: 20 }).withMessage('El NIT debe tener entre 1 y 20 caracteres'),
  body('address').trim().isLength({ min: 1, max: 256 }).withMessage('La direccion debe tener entre 1 y 256 caracteres'),
  body('city').trim().isLength({ min: 1, max: 50 }).withMessage('La ciudad debe tener entre 1 y 50 caracteres'),
  body('phone').trim().isLength({ min: 1, max: 10 }).withMessage('El telefono debe tener entre 1 y 10 caracteres'),
  body('email').isEmail().isLength({ max: 70 }).withMessage('El correo debe ser valido y maximo 70 caracteres'),
  body('active').optional().isBoolean().withMessage('El estado activo debe ser booleano')
];

// @route   POST /api/clients
// @desc    Crear cliente
// @access  Private (CREATE_USERS permission)
router.post('/', auth, requirePermission('CREATE_USERS'), activityLogger('CREATE', 'CLIENT'), createClientValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada invalidos',
      errors: errors.array()
    });
  }

  const { name, type, documentNumber, address, city, phone, email, active } = req.body;

  const client = await Client.create({
    name,
    type,
    documentNumber,
    address,
    city,
    phone,
    email,
    active: active ?? true
  });

  res.status(201).json({
    success: true,
    message: 'Cliente creado exitosamente',
    data: client
  });
}));

// @route   GET /api/clients
// @desc    Obtener listado de clientes con paginacion
// @access  Private (READ_USERS permission)
router.get('/', auth, requirePermission('READ_USERS'), listValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parametros invalidos',
      errors: errors.array()
    });
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string || '').trim();
  const skip = (page - 1) * limit;

  const filter: any = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { type: { $regex: search, $options: 'i' } },
      { documentNumber: { $regex: search, $options: 'i' } },
      { city: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const [clients, total] = await Promise.all([
    Client.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Client.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      data: clients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

// @route   PUT /api/clients/:id
// @desc    Actualizar cliente
// @access  Private (UPDATE_USERS permission)
router.put('/:id', auth, requirePermission('UPDATE_USERS'), activityLogger('UPDATE', 'CLIENT'), updateClientValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada invalidos',
      errors: errors.array()
    });
  }

  const client = await Client.findById(req.params.id);
  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Cliente no encontrado'
    });
  }

  const { name, type, documentNumber, address, city, phone, email, active } = req.body;

  if (name !== undefined) client.name = name;
  if (type !== undefined) client.type = type;
  if (documentNumber !== undefined) client.documentNumber = documentNumber;
  if (address !== undefined) client.address = address;
  if (city !== undefined) client.city = city;
  if (phone !== undefined) client.phone = phone;
  if (email !== undefined) client.email = email;
  if (active !== undefined) client.active = active;

  await client.save();

  res.json({
    success: true,
    message: 'Cliente actualizado exitosamente',
    data: client
  });
}));

// @route   DELETE /api/clients/:id
// @desc    Eliminar cliente
// @access  Private (DELETE_USERS permission)
router.delete('/:id', auth, requirePermission('DELETE_USERS'), activityLogger('DELETE', 'CLIENT'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const client = await Client.findById(req.params.id);

  if (!client) {
    return res.status(404).json({
      success: false,
      message: 'Cliente no encontrado'
    });
  }

  await Client.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Cliente eliminado exitosamente'
  });
}));

export default router;
