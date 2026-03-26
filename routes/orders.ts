import express from 'express';
import type { Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import Order from '../models/Order.js';
import Client from '../models/Client.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auth, requirePermission } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';

const router = express.Router();

const lotNumberRegex = /^\d{8}-[A-Za-z0-9]{6}$/;

type IncomingOrderItem = {
  product: string;
  billNumber: string;
  lotNumber: string;
  quantity: number;
};

type InventoryAdjustment = {
  productId: string;
  lotNumber: string;
  quantity: number;
};

const listValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('La pagina debe ser mayor a 0'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El limite debe estar entre 1 y 100'),
  query('search').optional().isString().withMessage('La busqueda debe ser un texto'),
];

const orderItemValidation = [
  body('date').trim().isISO8601().withMessage('La fecha es invalida'),
  body('client').isMongoId().withMessage('Cliente invalido'),
  body('status').isIn(['PAGADO', 'POR_PAGAR']).withMessage('Estado invalido'),
  body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un producto en la orden'),
  body('items.*.product').isMongoId().withMessage('Producto invalido'),
  body('items.*.billNumber')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('El numero de factura debe tener entre 1 y 50 caracteres'),
  body('items.*.lotNumber')
    .trim()
    .matches(lotNumberRegex)
    .withMessage('El lote debe tener formato YYYYMMDD-TTTTNN'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 9999999 })
    .withMessage('La cantidad debe ser un entero positivo de maximo 7 digitos'),
];

const mapAdjustments = (items: IncomingOrderItem[]): InventoryAdjustment[] => {
  const grouped = new Map<string, InventoryAdjustment>();

  for (const item of items) {
    const productId = item.product.toString();
    const lotNumber = item.lotNumber.trim().toUpperCase();
    const key = `${productId}:${lotNumber}`;

    const current = grouped.get(key);
    if (current) {
      current.quantity += Number(item.quantity);
    } else {
      grouped.set(key, {
        productId,
        lotNumber,
        quantity: Number(item.quantity),
      });
    }
  }

  return Array.from(grouped.values());
};

const applyInventoryAdjustment = async (
  adjustments: InventoryAdjustment[],
  operation: 'decrease' | 'increase',
): Promise<{ success: true } | { success: false; message: string }> => {
  for (const adjustment of adjustments) {
    const inventoryRecord = await Inventory.findOne({
      product: adjustment.productId,
      lotNumber: adjustment.lotNumber,
    });

    if (!inventoryRecord) {
      return {
        success: false,
        message: `No existe inventario para el lote ${adjustment.lotNumber}`,
      };
    }

    if (operation === 'decrease') {
      if (inventoryRecord.quantity < adjustment.quantity) {
        return {
          success: false,
          message: `Inventario insuficiente para el lote ${adjustment.lotNumber}. Disponible: ${inventoryRecord.quantity}, solicitado: ${adjustment.quantity}`,
        };
      }
      inventoryRecord.quantity -= adjustment.quantity;
    } else {
      inventoryRecord.quantity += adjustment.quantity;
    }

    await inventoryRecord.save();
  }

  return { success: true };
};

const buildOrderItems = async (
  incomingItems: IncomingOrderItem[],
): Promise<{ success: true; items: any[]; total: number } | { success: false; message: string }> => {
  const productIds = Array.from(new Set(incomingItems.map((item) => item.product.toString())));
  const products = await Product.find({ _id: { $in: productIds } }).select('price name productCode active');
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));

  for (const productId of productIds) {
    const product = productMap.get(productId);
    if (!product) {
      return { success: false, message: 'Uno de los productos seleccionados no existe' };
    }
  }

  const normalizedItems = incomingItems.map((item) => {
    const product = productMap.get(item.product.toString())!;
    const quantity = Number(item.quantity);
    const price = Number(product.price ?? 0);
    const lotNumber = item.lotNumber.trim().toUpperCase();

    return {
      product: product._id,
      billNumber: item.billNumber.trim(),
      lotNumber,
      quantity,
      price,
      subtotal: quantity * price,
    };
  });

  const total = normalizedItems.reduce((acc, item) => acc + item.subtotal, 0);

  return {
    success: true,
    items: normalizedItems,
    total,
  };
};

router.get('/options', auth, requirePermission('READ_PAYROLL'), asyncHandler(async (_req: AuthRequest, res: Response) => {
  const [clients, products, inventory] = await Promise.all([
    Client.find({ active: true }).select('name').sort({ name: 1 }),
    Product.find({ active: true }).select('name productCode price').sort({ name: 1 }),
    Inventory.find({ quantity: { $gte: 0 } })
      .select('product lotNumber quantity expirationDate')
      .sort({ createdAt: -1 }),
  ]);

  res.json({
    success: true,
    data: {
      clients,
      products,
      inventory,
    },
  });
}));

router.get('/', auth, requirePermission('READ_PAYROLL'), listValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parametros invalidos',
      errors: errors.array(),
    });
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string || '').trim();
  const skip = (page - 1) * limit;

  const filter: any = {};

  if (search) {
    const [matchingClients, matchingProducts] = await Promise.all([
      Client.find({ name: { $regex: search, $options: 'i' } }).select('_id'),
      Product.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { productCode: { $regex: search, $options: 'i' } },
        ],
      }).select('_id'),
    ]);

    const clientIds = matchingClients.map((client) => client._id);
    const productIds = matchingProducts.map((product) => product._id);

    filter.$or = [
      { date: { $regex: search, $options: 'i' } },
      { status: { $regex: search, $options: 'i' } },
      { 'items.billNumber': { $regex: search, $options: 'i' } },
      { 'items.lotNumber': { $regex: search, $options: 'i' } },
      ...(clientIds.length > 0 ? [{ client: { $in: clientIds } }] : []),
      ...(productIds.length > 0 ? [{ 'items.product': { $in: productIds } }] : []),
    ];
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate({ path: 'client', select: 'name type documentNumber active' })
      .populate({ path: 'items.product', select: 'name productCode price active' })
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

router.post('/', auth, requirePermission('CREATE_PAYROLL'), activityLogger('CREATE', 'ORDER'), orderItemValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada invalidos',
      errors: errors.array(),
    });
  }

  const { date, client, status, items } = req.body as {
    date: string;
    client: string;
    status: 'PAGADO' | 'POR_PAGAR';
    items: IncomingOrderItem[];
  };

  const clientExists = await Client.findById(client);
  if (!clientExists) {
    return res.status(400).json({
      success: false,
      message: 'El cliente seleccionado no existe',
    });
  }

  const mappedOrder = await buildOrderItems(items);
  if (!mappedOrder.success) {
    return res.status(400).json({
      success: false,
      message: mappedOrder.message,
    });
  }

  const deductions = mapAdjustments(items);
  const deductionResult = await applyInventoryAdjustment(deductions, 'decrease');
  if (!deductionResult.success) {
    return res.status(400).json({
      success: false,
      message: deductionResult.message,
    });
  }

  const order = await Order.create({
    date,
    client,
    status,
    items: mappedOrder.items,
    total: mappedOrder.total,
  });

  const created = await Order.findById(order._id)
    .populate({ path: 'client', select: 'name type documentNumber active' })
    .populate({ path: 'items.product', select: 'name productCode price active' });

  res.status(201).json({
    success: true,
    message: 'Orden de compra creada exitosamente',
    data: created,
  });
}));

router.put('/:id', auth, requirePermission('UPDATE_PAYROLL'), activityLogger('UPDATE', 'ORDER'), orderItemValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada invalidos',
      errors: errors.array(),
    });
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Orden no encontrada',
    });
  }

  const { date, client, status, items } = req.body as {
    date: string;
    client: string;
    status: 'PAGADO' | 'POR_PAGAR';
    items: IncomingOrderItem[];
  };

  const clientExists = await Client.findById(client);
  if (!clientExists) {
    return res.status(400).json({
      success: false,
      message: 'El cliente seleccionado no existe',
    });
  }

  const restoreAdjustments = mapAdjustments(
    order.items.map((item) => ({
      product: item.product.toString(),
      billNumber: item.billNumber,
      lotNumber: item.lotNumber,
      quantity: item.quantity,
    })),
  );

  const restoreResult = await applyInventoryAdjustment(restoreAdjustments, 'increase');
  if (!restoreResult.success) {
    return res.status(400).json({
      success: false,
      message: restoreResult.message,
    });
  }

  const mappedOrder = await buildOrderItems(items);
  if (!mappedOrder.success) {
    await applyInventoryAdjustment(restoreAdjustments, 'decrease');
    return res.status(400).json({
      success: false,
      message: mappedOrder.message,
    });
  }

  const newDeductions = mapAdjustments(items);
  const deductionResult = await applyInventoryAdjustment(newDeductions, 'decrease');

  if (!deductionResult.success) {
    await applyInventoryAdjustment(restoreAdjustments, 'decrease');
    return res.status(400).json({
      success: false,
      message: deductionResult.message,
    });
  }

  order.date = date;
  order.client = client as any;
  order.status = status;
  order.items = mappedOrder.items as any;
  order.total = mappedOrder.total;

  await order.save();

  const updated = await Order.findById(order._id)
    .populate({ path: 'client', select: 'name type documentNumber active' })
    .populate({ path: 'items.product', select: 'name productCode price active' });

  res.json({
    success: true,
    message: 'Orden de compra actualizada exitosamente',
    data: updated,
  });
}));

router.delete('/:id', auth, requirePermission('DELETE_PAYROLL'), activityLogger('DELETE', 'ORDER'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Orden no encontrada',
    });
  }

  const restoreAdjustments = mapAdjustments(
    order.items.map((item) => ({
      product: item.product.toString(),
      billNumber: item.billNumber,
      lotNumber: item.lotNumber,
      quantity: item.quantity,
    })),
  );

  const restoreResult = await applyInventoryAdjustment(restoreAdjustments, 'increase');
  if (!restoreResult.success) {
    return res.status(400).json({
      success: false,
      message: restoreResult.message,
    });
  }

  await Order.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Orden eliminada exitosamente',
  });
}));

export default router;
