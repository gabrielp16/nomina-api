import express from 'express';
import type { Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auth, requirePermission } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';

const router = express.Router();

const lotNumberRegex = /^\d{8}-[A-Za-z0-9]{6}$/;
const expirationDateRegex = /^\d{4}\/\d{2}\/\d{2}$/;

const listValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('La pagina debe ser mayor a 0'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El limite debe estar entre 1 y 100'),
  query('search').optional().isString().withMessage('La busqueda debe ser un texto')
];

const createInventoryValidation = [
  body('product').isMongoId().withMessage('Producto invalido'),
  body('quantity').isInt({ min: 1 }).withMessage('La cantidad debe ser un entero positivo'),
  body('lotNumber').trim().matches(lotNumberRegex).withMessage('El lote debe seguir el formato YYYYMMDD-TTTTNN'),
  body('expirationDate').trim().matches(expirationDateRegex).withMessage('La fecha de vencimiento debe seguir el formato YYYY/MM/DD')
];

const updateInventoryValidation = [
  body('product').optional().isMongoId().withMessage('Producto invalido'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('La cantidad debe ser un entero positivo'),
  body('lotNumber').optional().trim().matches(lotNumberRegex).withMessage('El lote debe seguir el formato YYYYMMDD-TTTTNN'),
  body('expirationDate').optional().trim().matches(expirationDateRegex).withMessage('La fecha de vencimiento debe seguir el formato YYYY/MM/DD')
];

router.get('/summary', auth, requirePermission('READ_PAYROLL'), asyncHandler(async (_req: AuthRequest, res: Response) => {
  const summary = await Inventory.aggregate([
    {
      $group: {
        _id: '$product',
        totalQuantity: { $sum: '$quantity' }
      }
    }
  ]);

  const productIds = summary.map((item) => item._id);
  const products = await Product.find({ _id: { $in: productIds } }).select('name productCode');

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const data = summary
    .map((item) => {
      const product = productMap.get(item._id.toString());
      if (!product) return null;
      return {
        productId: item._id.toString(),
        productName: product.name,
        productCode: product.productCode,
        totalQuantity: item.totalQuantity
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.productName.localeCompare(b.productName));

  res.json({ success: true, data });
}));

router.get('/', auth, requirePermission('READ_PAYROLL'), listValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
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
    const matchingProducts = await Product.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { productCode: { $regex: search, $options: 'i' } }
      ]
    }).select('_id');

    const productIds = matchingProducts.map((product) => product._id);

    filter.$or = [
      { lotNumber: { $regex: search, $options: 'i' } },
      { expirationDate: { $regex: search, $options: 'i' } },
      ...(productIds.length > 0 ? [{ product: { $in: productIds } }] : [])
    ];
  }

  const [records, total] = await Promise.all([
    Inventory.find(filter)
      .populate({ path: 'product', select: 'name productCode active' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Inventory.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      data: records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

router.post('/', auth, requirePermission('CREATE_PAYROLL'), activityLogger('CREATE', 'INVENTORY'), createInventoryValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada invalidos',
      errors: errors.array()
    });
  }

  const { product, quantity, lotNumber, expirationDate } = req.body;

  const productExists = await Product.findById(product);
  if (!productExists) {
    return res.status(400).json({
      success: false,
      message: 'El producto seleccionado no existe'
    });
  }

  const lotProductCode = lotNumber.substring(9, 13);
  if (lotProductCode.toUpperCase() !== productExists.productCode.toUpperCase()) {
    return res.status(400).json({
      success: false,
      message: `El codigo de producto en el lote (${lotProductCode}) no coincide con el codigo del producto seleccionado (${productExists.productCode})`
    });
  }

  const record = await Inventory.create({
    product,
    quantity,
    lotNumber,
    expirationDate
  });

  const created = await Inventory.findById(record._id).populate({
    path: 'product',
    select: 'name productCode active'
  });

  res.status(201).json({
    success: true,
    message: 'Registro de inventario creado exitosamente',
    data: created
  });
}));

router.put('/:id', auth, requirePermission('UPDATE_PAYROLL'), activityLogger('UPDATE', 'INVENTORY'), updateInventoryValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada invalidos',
      errors: errors.array()
    });
  }

  const record = await Inventory.findById(req.params.id);
  if (!record) {
    return res.status(404).json({
      success: false,
      message: 'Registro no encontrado'
    });
  }

  const { product, quantity, lotNumber, expirationDate } = req.body;

  let resolvedProduct: any = null;

  if (product !== undefined) {
    resolvedProduct = await Product.findById(product);
    if (!resolvedProduct) {
      return res.status(400).json({
        success: false,
        message: 'El producto seleccionado no existe'
      });
    }
    record.product = product;
  }

  if (quantity !== undefined) {
    record.quantity = quantity;
  }

  if (lotNumber !== undefined) {
    record.lotNumber = lotNumber;
  }

  if (expirationDate !== undefined) {
    record.expirationDate = expirationDate;
  }

  const finalProduct = resolvedProduct || await Product.findById(record.product);
  if (finalProduct && record.lotNumber) {
    const lotProductCode = record.lotNumber.substring(9, 13);
    if (lotProductCode.toUpperCase() !== finalProduct.productCode.toUpperCase()) {
      return res.status(400).json({
        success: false,
        message: `El codigo de producto en el lote (${lotProductCode}) no coincide con el codigo del producto seleccionado (${finalProduct.productCode})`
      });
    }
  }

  await record.save();

  const updated = await Inventory.findById(record._id).populate({
    path: 'product',
    select: 'name productCode active'
  });

  res.json({
    success: true,
    message: 'Registro de inventario actualizado exitosamente',
    data: updated
  });
}));

router.delete('/:id', auth, requirePermission('DELETE_PAYROLL'), activityLogger('DELETE', 'INVENTORY'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const record = await Inventory.findById(req.params.id);

  if (!record) {
    return res.status(404).json({
      success: false,
      message: 'Registro no encontrado'
    });
  }

  await Inventory.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Registro eliminado exitosamente'
  });
}));

export default router;
