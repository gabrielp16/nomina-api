import express from 'express';
import type { Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import type { SortOrder } from 'mongoose';
import Client from '../models/Client.js';
import type { IClient } from '../models/Client.js';
import { CLIENT_PAYMENT_FORMS, CLIENT_PAYMENT_METHODS } from '../models/Client.js';
import ClientCategory from '../models/ClientCategory.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auth, requirePermission } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';

const router = express.Router();

interface ContactInput {
  name?: unknown;
  area?: unknown;
  phone?: unknown;
}

const sanitizeContacts = (raw: unknown) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const contact = (item ?? {}) as ContactInput;
      return {
        name: typeof contact.name === 'string' ? contact.name.trim() : '',
        area: typeof contact.area === 'string' ? contact.area.trim() : '',
        phone: typeof contact.phone === 'string' ? contact.phone.trim() : ''
      };
    })
    .filter((contact) => contact.name && contact.phone);
};

const listValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('La pagina debe ser mayor a 0'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El limite debe estar entre 1 y 100'),
  query('search').optional().isString().withMessage('La busqueda debe ser un texto'),
  query('category').optional().isString().withMessage('La categoria debe ser un texto'),
  query('categorySort').optional().isIn(['asc', 'desc']).withMessage('El orden de categoria debe ser asc o desc')
];

const updateClientValidation = [
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('La razon social debe tener entre 1 y 100 caracteres'),
  body('category').optional().trim().isLength({ min: 1, max: 50 }).withMessage('La categoria debe tener entre 1 y 50 caracteres'),
  body('type').optional().isIn(['Persona Natural', 'Persona Juridica']).withMessage('El tipo debe ser Persona Natural o Persona Juridica'),
  body('paymentForm').optional().isIn(CLIENT_PAYMENT_FORMS).withMessage('La forma de pago no es valida'),
  body('paymentMethod').optional().isIn(CLIENT_PAYMENT_METHODS).withMessage('El medio de pago no es valido'),
  body('documentNumber').optional().trim().isLength({ min: 1, max: 20 }).withMessage('El NIT debe tener entre 1 y 20 caracteres'),
  body('address').optional().trim().isLength({ min: 1, max: 256 }).withMessage('La direccion debe tener entre 1 y 256 caracteres'),
  body('city').optional().trim().isLength({ min: 1, max: 50 }).withMessage('La ciudad debe tener entre 1 y 50 caracteres'),
  body('phone').optional({ nullable: true }).isString().withMessage('El telefono debe ser texto').isLength({ max: 20 }).withMessage('El telefono debe tener maximo 20 caracteres'),
  body('contacts').optional().isArray().withMessage('Los contactos deben ser un arreglo'),
  body('contacts.*.name').trim().isLength({ min: 1, max: 100 }).withMessage('El nombre del responsable debe tener entre 1 y 100 caracteres'),
  body('contacts.*.area').optional({ nullable: true }).isString().withMessage('El area debe ser texto').isLength({ max: 100 }).withMessage('El area debe tener maximo 100 caracteres'),
  body('contacts.*.phone').trim().isLength({ min: 1, max: 20 }).withMessage('El telefono del contacto debe tener entre 1 y 20 caracteres'),
  body('email').optional().isEmail().isLength({ max: 70 }).withMessage('El correo debe ser valido y maximo 70 caracteres'),
  body('deliveryHours').optional({ nullable: true }).isString().withMessage('El horario de atencion debe ser texto').isLength({ max: 100 }).withMessage('El horario de atencion debe tener maximo 100 caracteres'),
  body('active').optional().isBoolean().withMessage('El estado activo debe ser booleano')
];

const createClientValidation = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('La razon social debe tener entre 1 y 100 caracteres'),
  body('category').trim().isLength({ min: 1, max: 50 }).withMessage('La categoria debe tener entre 1 y 50 caracteres'),
  body('type').isIn(['Persona Natural', 'Persona Juridica']).withMessage('El tipo debe ser Persona Natural o Persona Juridica'),
  body('paymentForm').isIn(CLIENT_PAYMENT_FORMS).withMessage('La forma de pago no es valida'),
  body('paymentMethod').isIn(CLIENT_PAYMENT_METHODS).withMessage('El medio de pago no es valido'),
  body('documentNumber').trim().isLength({ min: 1, max: 20 }).withMessage('El NIT debe tener entre 1 y 20 caracteres'),
  body('address').trim().isLength({ min: 1, max: 256 }).withMessage('La direccion debe tener entre 1 y 256 caracteres'),
  body('city').trim().isLength({ min: 1, max: 50 }).withMessage('La ciudad debe tener entre 1 y 50 caracteres'),
  body('phone').optional({ nullable: true }).isString().withMessage('El telefono debe ser texto').isLength({ max: 20 }).withMessage('El telefono debe tener maximo 20 caracteres'),
  body('contacts').optional().isArray().withMessage('Los contactos deben ser un arreglo'),
  body('contacts.*.name').trim().isLength({ min: 1, max: 100 }).withMessage('El nombre del responsable debe tener entre 1 y 100 caracteres'),
  body('contacts.*.area').optional({ nullable: true }).isString().withMessage('El area debe ser texto').isLength({ max: 100 }).withMessage('El area debe tener maximo 100 caracteres'),
  body('contacts.*.phone').trim().isLength({ min: 1, max: 20 }).withMessage('El telefono del contacto debe tener entre 1 y 20 caracteres'),
  body('email').isEmail().isLength({ max: 70 }).withMessage('El correo debe ser valido y maximo 70 caracteres'),
  body('deliveryHours').optional({ nullable: true }).isString().withMessage('El horario de atencion debe ser texto').isLength({ max: 100 }).withMessage('El horario de atencion debe tener maximo 100 caracteres'),
  body('active').optional().isBoolean().withMessage('El estado activo debe ser booleano')
];

const createCategoryValidation = [
  body('name').trim().isLength({ min: 1, max: 50 }).withMessage('El nombre de categoria debe tener entre 1 y 50 caracteres')
];

const categoryIdValidation = [
  param('id').isMongoId().withMessage('El id de categoria no es valido')
];

// @route   POST /api/clients/categories
// @desc    Crear categoria de cliente
// @access  Private (CREATE_USERS permission)
router.post('/categories', auth, requirePermission('CREATE_USERS'), activityLogger('CREATE', 'CLIENT_CATEGORY'), createCategoryValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada invalidos',
      errors: errors.array()
    });
  }

  const name = (req.body.name as string).trim();
  const existingCategory = await ClientCategory.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });

  if (existingCategory) {
    return res.status(409).json({
      success: false,
      message: 'La categoria ya existe'
    });
  }

  const category = await ClientCategory.create({ name });

  res.status(201).json({
    success: true,
    message: 'Categoria creada exitosamente',
    data: category
  });
}));

// @route   GET /api/clients/categories
// @desc    Obtener categorias de clientes
// @access  Private (READ_USERS permission)
router.get('/categories', auth, requirePermission('READ_USERS'), asyncHandler(async (_req: AuthRequest, res: Response) => {
  const categories = await ClientCategory.find().sort({ name: 1 });

  res.json({
    success: true,
    data: categories
  });
}));

// @route   PUT /api/clients/categories/:id
// @desc    Actualizar categoria de cliente
// @access  Private (UPDATE_USERS permission)
router.put('/categories/:id', auth, requirePermission('UPDATE_USERS'), activityLogger('UPDATE', 'CLIENT_CATEGORY'), [...categoryIdValidation, ...createCategoryValidation], asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada invalidos',
      errors: errors.array()
    });
  }

  const category = await ClientCategory.findById(req.params.id);
  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Categoria no encontrada'
    });
  }

  const newName = (req.body.name as string).trim();
  const duplicate = await ClientCategory.findOne({
    _id: { $ne: category._id },
    name: { $regex: `^${newName}$`, $options: 'i' }
  });

  if (duplicate) {
    return res.status(409).json({
      success: false,
      message: 'Ya existe una categoria con ese nombre'
    });
  }

  const oldName = category.name;
  category.name = newName;
  await category.save();

  if (oldName !== newName) {
    await Client.updateMany({ category: oldName }, { $set: { category: newName } });
  }

  res.json({
    success: true,
    message: 'Categoria actualizada exitosamente',
    data: category
  });
}));

// @route   DELETE /api/clients/categories/:id
// @desc    Eliminar categoria de cliente
// @access  Private (DELETE_USERS permission)
router.delete('/categories/:id', auth, requirePermission('DELETE_USERS'), activityLogger('DELETE', 'CLIENT_CATEGORY'), categoryIdValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parametros invalidos',
      errors: errors.array()
    });
  }

  const category = await ClientCategory.findById(req.params.id);
  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Categoria no encontrada'
    });
  }

  const isUsed = await Client.exists({ category: category.name });
  if (isUsed) {
    return res.status(400).json({
      success: false,
      message: 'No se puede eliminar una categoria que esta asignada a clientes'
    });
  }

  await ClientCategory.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Categoria eliminada exitosamente'
  });
}));

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

  const { name, category, type, paymentForm, paymentMethod, documentNumber, address, city, phone, contacts, email, deliveryHours, active } = req.body;

  const clientCategory = await ClientCategory.findOne({ name: category });
  if (!clientCategory) {
    return res.status(400).json({
      success: false,
      message: 'La categoria seleccionada no existe'
    });
  }

  const sanitizedContacts = sanitizeContacts(contacts);

  const client = await Client.create({
    name,
    category,
    type,
    paymentForm,
    paymentMethod,
    documentNumber,
    address,
    city,
    phone: typeof phone === 'string' ? phone.trim() : '',
    contacts: sanitizedContacts,
    email,
    deliveryHours: deliveryHours ?? '',
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
  const category = (req.query.category as string || '').trim();
  const categorySort = req.query.categorySort as 'asc' | 'desc' | undefined;
  const skip = (page - 1) * limit;

  const filter: any = {};
  if (category) {
    filter.category = category;
  }

  if (search) {
    const searchConditions = [
      { name: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
      { type: { $regex: search, $options: 'i' } },
      { paymentForm: { $regex: search, $options: 'i' } },
      { paymentMethod: { $regex: search, $options: 'i' } },
      { documentNumber: { $regex: search, $options: 'i' } },
      { city: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];

    if (filter.category) {
      filter.$and = [{ category: filter.category }, { $or: searchConditions }];
      delete filter.category;
    } else {
      filter.$or = searchConditions;
    }
  }

  const sort: Record<string, SortOrder> = categorySort
    ? { category: categorySort === 'asc' ? 1 : -1, createdAt: -1 }
    : { createdAt: -1 };

  const [clients, total] = await Promise.all([
    Client.find(filter)
      .sort(sort)
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

  const { name, category, type, paymentForm, paymentMethod, documentNumber, address, city, phone, contacts, email, deliveryHours, active } = req.body;

  if (category !== undefined) {
    const clientCategory = await ClientCategory.findOne({ name: category });
    if (!clientCategory) {
      return res.status(400).json({
        success: false,
        message: 'La categoria seleccionada no existe'
      });
    }
  }

  if (name !== undefined) client.name = name;
  if (category !== undefined) client.category = category;
  if (type !== undefined) client.type = type;
  if (paymentForm !== undefined) client.paymentForm = paymentForm;
  if (paymentMethod !== undefined) client.paymentMethod = paymentMethod;
  if (documentNumber !== undefined) client.documentNumber = documentNumber;
  if (address !== undefined) client.address = address;
  if (city !== undefined) client.city = city;
  if (phone !== undefined) client.phone = typeof phone === 'string' ? phone.trim() : '';
  if (contacts !== undefined) client.contacts = sanitizeContacts(contacts) as IClient['contacts'];
  if (email !== undefined) client.email = email;
  if (deliveryHours !== undefined) client.deliveryHours = deliveryHours;
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
