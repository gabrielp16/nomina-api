import express from 'express';
import type { Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import Product from '../models/Product.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auth, requirePermission } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';

const router = express.Router();

const listValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('La pagina debe ser mayor a 0'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('El limite debe estar entre 1 y 1000'),
  query('search').optional().isString().withMessage('La busqueda debe ser un texto')
];

const updateProductValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  body('productCode')
    .optional()
    .trim()
    .matches(/^[A-Za-z0-9]{4}$/)
    .withMessage('El codigo de producto debe tener 4 caracteres (letras o numeros)'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 256 })
    .withMessage('La descripcion debe tener entre 1 y 256 caracteres'),
  body('active')
    .optional()
    .isBoolean()
    .withMessage('El estado activo debe ser booleano'),
  body('price')
    .optional({ nullable: true })
    .custom((value) => value === null || (typeof value === 'number' && value >= 0))
    .withMessage('El precio debe ser un numero mayor o igual a 0 o null')
];

const createProductValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  body('productCode')
    .trim()
    .matches(/^[A-Za-z0-9]{4}$/)
    .withMessage('El codigo de producto debe tener 4 caracteres (letras o numeros)'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 256 })
    .withMessage('La descripcion debe tener entre 1 y 256 caracteres'),
  body('active')
    .optional()
    .isBoolean()
    .withMessage('El estado activo debe ser booleano'),
  body('price')
    .optional({ nullable: true })
    .custom((value) => value === null || (typeof value === 'number' && value >= 0))
    .withMessage('El precio debe ser un numero mayor o igual a 0 o null')
];

// @route   POST /api/products
// @desc    Crear producto
// @access  Private (CREATE_USERS permission)
router.post('/', auth, requirePermission('CREATE_USERS'), activityLogger('CREATE', 'PRODUCT'), createProductValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada invalidos',
      errors: errors.array()
    });
  }

  const { name, productCode, description, active, price } = req.body;

  const product = await Product.create({
    name,
    productCode,
    description,
    active: active ?? true,
    price: price === null || price === undefined || price === '' ? undefined : Number(price)
  });

  res.status(201).json({
    success: true,
    message: 'Producto creado exitosamente',
    data: product
  });
}));

// @route   GET /api/products
// @desc    Obtener listado de productos con paginacion
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
      { productCode: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      data: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

// @route   PUT /api/products/:id
// @desc    Actualizar producto
// @access  Private (UPDATE_USERS permission)
router.put('/:id', auth, requirePermission('UPDATE_USERS'), activityLogger('UPDATE', 'PRODUCT'), updateProductValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada invalidos',
      errors: errors.array()
    });
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Producto no encontrado'
    });
  }

  const { name, productCode, description, active, price } = req.body;

  if (name !== undefined) {
    product.name = name;
  }

  if (productCode !== undefined) {
    product.productCode = productCode;
  }

  if (description !== undefined) {
    product.description = description;
  }

  if (active !== undefined) {
    product.active = active;
  }

  if (price !== undefined) {
    product.price = price === null || price === '' ? undefined : Number(price);
  }

  await product.save();

  res.json({
    success: true,
    message: 'Producto actualizado exitosamente',
    data: product
  });
}));

// @route   DELETE /api/products/:id
// @desc    Eliminar producto
// @access  Private (DELETE_USERS permission)
router.delete('/:id', auth, requirePermission('DELETE_USERS'), activityLogger('DELETE', 'PRODUCT'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Producto no encontrado'
    });
  }

  await Product.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Producto eliminado exitosamente'
  });
}));

export default router;
