import express from 'express';
import type { Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import Order from '../models/Order.js';
import Client from '../models/Client.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import InventoryMovement from '../models/InventoryMovement.js';
import type { OrderStatus } from '../models/Order.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auth, requirePermission } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';

const router = express.Router();

const lotNumberRegex = /^\d{8}-[A-Za-z0-9]{6}$/;
const orderStatuses: OrderStatus[] = ['BORRADOR', 'RESERVADA', 'DESPACHADA', 'PAGADA', 'CERRADA', 'CANCELADA'];
const reservationAppliedStatuses = new Set<OrderStatus>(['RESERVADA']);
const inventoryAppliedStatuses = new Set<OrderStatus>(['DESPACHADA', 'PAGADA', 'CERRADA']);
const immutableStatuses = new Set<OrderStatus>(['CERRADA', 'CANCELADA']);
const statusTransitions: Record<OrderStatus, OrderStatus[]> = {
  BORRADOR: ['BORRADOR', 'RESERVADA', 'DESPACHADA', 'PAGADA', 'CANCELADA'],
  RESERVADA: ['RESERVADA', 'DESPACHADA', 'PAGADA', 'CANCELADA'],
  DESPACHADA: ['DESPACHADA', 'PAGADA', 'CERRADA', 'CANCELADA'],
  PAGADA: ['PAGADA', 'CERRADA', 'CANCELADA'],
  CERRADA: ['CERRADA'],
  CANCELADA: ['CANCELADA'],
};

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

type InventoryReservationConsumptionPlan = {
  releaseAdjustments: InventoryAdjustment[];
  reservedCreditMap: Map<string, number>;
};

type InventorySnapshot = {
  inventoryId: string;
  previousQuantity: number;
  previousReservedQuantity: number;
};

type InventoryMovementDraft = {
  movementType: 'IN' | 'OUT';
  reason: string;
  product: string;
  lotNumber: string;
  quantity: number;
  sourceLots: Array<{
    inventoryId: string;
    productId: string;
    lotNumber: string;
    quantity: number;
  }>;
  targetLots: Array<{
    inventoryId: string;
    productId: string;
    lotNumber: string;
    quantity: number;
  }>;
  referenceInventory: string;
};

type InventoryAdjustmentResult =
  | {
      success: true;
      snapshots: InventorySnapshot[];
      movements: InventoryMovementDraft[];
    }
  | { success: false; message: string };

const statusReservesInventory = (status: OrderStatus) => reservationAppliedStatuses.has(status);
const statusAffectsInventory = (status: OrderStatus) => inventoryAppliedStatuses.has(status);

const canTransitionStatus = (from: OrderStatus, to: OrderStatus) => {
  return statusTransitions[from]?.includes(to) ?? false;
};

const getAvailableQuantity = (inventoryRecord: { quantity: number; reservedQuantity?: number }) => {
  return Math.max(0, inventoryRecord.quantity - (inventoryRecord.reservedQuantity || 0));
};

const getAdjustmentKey = (productId: string, lotNumber: string) => {
  return `${productId}:${lotNumber.trim().toUpperCase()}`;
};

const buildAdjustmentQuantityMap = (adjustments: InventoryAdjustment[]) => {
  const quantityMap = new Map<string, number>();

  for (const adjustment of adjustments) {
    const key = getAdjustmentKey(adjustment.productId, adjustment.lotNumber);
    quantityMap.set(key, (quantityMap.get(key) || 0) + Number(adjustment.quantity || 0));
  }

  return quantityMap;
};

const buildReservationConsumptionPlan = (
  originalReservations: InventoryAdjustment[],
  nextDeductions: InventoryAdjustment[],
): InventoryReservationConsumptionPlan => {
  const nextDeductionMap = buildAdjustmentQuantityMap(nextDeductions);
  const reservedCreditMap = new Map<string, number>();
  const releaseAdjustments: InventoryAdjustment[] = [];

  for (const reservation of originalReservations) {
    const key = getAdjustmentKey(reservation.productId, reservation.lotNumber);
    const reservedQuantity = Number(reservation.quantity || 0);
    const nextDeductionQuantity = nextDeductionMap.get(key) || 0;
    const consumedReservation = Math.min(reservedQuantity, nextDeductionQuantity);
    const releasableReservation = reservedQuantity - consumedReservation;

    if (consumedReservation > 0) {
      reservedCreditMap.set(key, consumedReservation);
    }

    if (releasableReservation > 0) {
      releaseAdjustments.push({
        productId: reservation.productId,
        lotNumber: reservation.lotNumber,
        quantity: releasableReservation,
      });
    }
  }

  return {
    releaseAdjustments,
    reservedCreditMap,
  };
};

const listValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('La pagina debe ser mayor a 0'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El limite debe estar entre 1 y 100'),
  query('search').optional().isString().withMessage('La busqueda debe ser un texto'),
];

const orderItemValidation = [
  body('date').trim().isISO8601().withMessage('La fecha es invalida'),
  body('client').isMongoId().withMessage('Cliente invalido'),
  body('status').isIn(orderStatuses).withMessage('Estado invalido'),
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
  reason: string,
  options?: {
    reservedCreditMap?: Map<string, number>;
  },
): Promise<InventoryAdjustmentResult> => {
  const snapshotMap = new Map<string, InventorySnapshot>();
  const movements: InventoryMovementDraft[] = [];

  for (const adjustment of adjustments) {
    const normalizedLotNumber = adjustment.lotNumber.trim().toUpperCase();

    const inventoryRecord = await Inventory.findOne({
      product: adjustment.productId,
      lotNumber: normalizedLotNumber,
    });

    if (!inventoryRecord) {
      return {
        success: false,
        message: `No existe inventario para el lote ${adjustment.lotNumber}`,
      };
    }

    if (!snapshotMap.has(inventoryRecord._id.toString())) {
      snapshotMap.set(inventoryRecord._id.toString(), {
        inventoryId: inventoryRecord._id.toString(),
        previousQuantity: inventoryRecord.quantity,
        previousReservedQuantity: inventoryRecord.reservedQuantity || 0,
      });
    }

    if (operation === 'decrease') {
      const adjustmentKey = getAdjustmentKey(adjustment.productId, normalizedLotNumber);
      const reservedCredit = Math.min(
        options?.reservedCreditMap?.get(adjustmentKey) || 0,
        inventoryRecord.reservedQuantity || 0,
      );
      const availableQuantity = getAvailableQuantity(inventoryRecord) + reservedCredit;

      if (availableQuantity < adjustment.quantity) {
        return {
          success: false,
          message: `Inventario insuficiente para el lote ${adjustment.lotNumber}. Disponible: ${availableQuantity}, solicitado: ${adjustment.quantity}`,
        };
      }

      inventoryRecord.quantity -= adjustment.quantity;

      if (reservedCredit > 0) {
        inventoryRecord.reservedQuantity = Math.max(
          0,
          (inventoryRecord.reservedQuantity || 0) - Math.min(adjustment.quantity, reservedCredit),
        );
      }

      movements.push({
        movementType: 'OUT',
        reason,
        product: adjustment.productId,
        lotNumber: normalizedLotNumber,
        quantity: adjustment.quantity,
        sourceLots: [
          {
            inventoryId: inventoryRecord._id.toString(),
            productId: adjustment.productId,
            lotNumber: normalizedLotNumber,
            quantity: adjustment.quantity,
          },
        ],
        targetLots: [],
        referenceInventory: inventoryRecord._id.toString(),
      });
    } else {
      inventoryRecord.quantity += adjustment.quantity;

      movements.push({
        movementType: 'IN',
        reason,
        product: adjustment.productId,
        lotNumber: normalizedLotNumber,
        quantity: adjustment.quantity,
        sourceLots: [],
        targetLots: [
          {
            inventoryId: inventoryRecord._id.toString(),
            productId: adjustment.productId,
            lotNumber: normalizedLotNumber,
            quantity: adjustment.quantity,
          },
        ],
        referenceInventory: inventoryRecord._id.toString(),
      });
    }

    await inventoryRecord.save();
  }

  return {
    success: true,
    snapshots: Array.from(snapshotMap.values()),
    movements,
  };
};

const applyInventoryReservationAdjustment = async (
  adjustments: InventoryAdjustment[],
  operation: 'reserve' | 'release',
): Promise<InventoryAdjustmentResult> => {
  const snapshotMap = new Map<string, InventorySnapshot>();

  for (const adjustment of adjustments) {
    const normalizedLotNumber = adjustment.lotNumber.trim().toUpperCase();

    const inventoryRecord = await Inventory.findOne({
      product: adjustment.productId,
      lotNumber: normalizedLotNumber,
    });

    if (!inventoryRecord) {
      return {
        success: false,
        message: `No existe inventario para el lote ${adjustment.lotNumber}`,
      };
    }

    if (!snapshotMap.has(inventoryRecord._id.toString())) {
      snapshotMap.set(inventoryRecord._id.toString(), {
        inventoryId: inventoryRecord._id.toString(),
        previousQuantity: inventoryRecord.quantity,
        previousReservedQuantity: inventoryRecord.reservedQuantity || 0,
      });
    }

    if (operation === 'reserve') {
      const availableQuantity = getAvailableQuantity(inventoryRecord);

      if (availableQuantity < adjustment.quantity) {
        return {
          success: false,
          message: `No hay existencias disponibles para reservar el lote ${adjustment.lotNumber}. Disponible: ${availableQuantity}, solicitado: ${adjustment.quantity}`,
        };
      }

      inventoryRecord.reservedQuantity += adjustment.quantity;
    } else {
      if ((inventoryRecord.reservedQuantity || 0) < adjustment.quantity) {
        return {
          success: false,
          message: `La reserva del lote ${adjustment.lotNumber} es insuficiente para liberar ${adjustment.quantity} unidad(es)`,
        };
      }

      inventoryRecord.reservedQuantity -= adjustment.quantity;
    }

    await inventoryRecord.save();
  }

  return {
    success: true,
    snapshots: Array.from(snapshotMap.values()),
    movements: [],
  };
};

const rollbackInventorySnapshots = async (snapshots: InventorySnapshot[]) => {
  for (const snapshot of [...snapshots].reverse()) {
    const inventoryRecord = await Inventory.findById(snapshot.inventoryId);
    if (inventoryRecord) {
      inventoryRecord.quantity = snapshot.previousQuantity;
      inventoryRecord.reservedQuantity = snapshot.previousReservedQuantity;
      await inventoryRecord.save();
    }
  }
};

const createInventoryMovements = async (
  drafts: InventoryMovementDraft[],
  metadata: Record<string, unknown>,
) => {
  const createdMovementIds: string[] = [];

  try {
    for (const draft of drafts) {
      const movement = await InventoryMovement.create({
        ...draft,
        metadata: {
          ...metadata,
        },
      });

      createdMovementIds.push(movement._id.toString());
    }

    return createdMovementIds;
  } catch (error) {
    for (const movementId of createdMovementIds.reverse()) {
      await InventoryMovement.findByIdAndDelete(movementId);
    }

    throw error;
  }
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

router.get('/options', auth, requirePermission('READ_ORDERS'), asyncHandler(async (_req: AuthRequest, res: Response) => {
  const [clients, products, inventory] = await Promise.all([
    Client.find({ active: true }).select('name').sort({ name: 1 }),
    Product.find({ active: true }).select('name productCode barcode price').sort({ name: 1 }),
    Inventory.find({ quantity: { $gt: 0 } })
      .select('product lotNumber quantity reservedQuantity expirationDate')
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

router.get('/', auth, requirePermission('READ_ORDERS'), listValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
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
          { barcode: { $regex: search, $options: 'i' } },
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

router.post('/', auth, requirePermission('CREATE_ORDERS'), activityLogger('CREATE', 'ORDER'), orderItemValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
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
    status: OrderStatus;
    items: IncomingOrderItem[];
  };

  if (status === 'CANCELADA' || status === 'CERRADA') {
    return res.status(400).json({
      success: false,
      message: 'No puedes crear una orden directamente en estado cancelada o cerrada',
    });
  }

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

  const shouldReserveInventory = statusReservesInventory(status);
  const reservationAdjustments = shouldReserveInventory ? mapAdjustments(items) : [];
  const reservationResult = shouldReserveInventory
    ? await applyInventoryReservationAdjustment(reservationAdjustments, 'reserve')
    : { success: true as const, snapshots: [], movements: [] };

  if (!reservationResult.success) {
    return res.status(400).json({
      success: false,
      message: reservationResult.message,
    });
  }

  const shouldApplyInventory = statusAffectsInventory(status);
  const deductions = shouldApplyInventory ? mapAdjustments(items) : [];
  const deductionResult = shouldApplyInventory
    ? await applyInventoryAdjustment(
        deductions,
        'decrease',
        'ORDER_CREATED_OUT',
      )
    : { success: true as const, snapshots: [], movements: [] };

  if (!deductionResult.success) {
    return res.status(400).json({
      success: false,
      message: deductionResult.message,
    });
  }

  let createdOrderId: string | null = null;

  try {
    const order = await Order.create({
      date,
      client,
      status,
      items: mappedOrder.items,
      total: mappedOrder.total,
    });
    createdOrderId = order._id.toString();

    if (deductionResult.movements.length > 0) {
      await createInventoryMovements(deductionResult.movements, {
        orderId: createdOrderId,
        action: 'CREATE_ORDER',
        createdBy: req.user?._id?.toString() || null,
        orderStatus: status,
      });
    }

    const created = await Order.findById(order._id)
      .populate({ path: 'client', select: 'name type documentNumber active' })
      .populate({ path: 'items.product', select: 'name productCode price active' });

    res.status(201).json({
      success: true,
      message: 'Orden de compra creada exitosamente',
      data: created,
    });
  } catch (error) {
    await rollbackInventorySnapshots(reservationResult.snapshots);
    await rollbackInventorySnapshots(deductionResult.snapshots);

    if (createdOrderId) {
      await Order.findByIdAndDelete(createdOrderId);
    }

    throw error;
  }
}));

router.put('/:id', auth, requirePermission('UPDATE_ORDERS'), activityLogger('UPDATE', 'ORDER'), orderItemValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
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
    status: OrderStatus;
    items: IncomingOrderItem[];
  };

  const originalStatus = order.status as OrderStatus;

  if (immutableStatuses.has(originalStatus)) {
    return res.status(400).json({
      success: false,
      message: 'Las ordenes cerradas o canceladas no se pueden editar',
    });
  }

  if (!canTransitionStatus(originalStatus, status)) {
    return res.status(400).json({
      success: false,
      message: `No se permite cambiar una orden de ${originalStatus} a ${status}`,
    });
  }

  const clientExists = await Client.findById(client);
  if (!clientExists) {
    return res.status(400).json({
      success: false,
      message: 'El cliente seleccionado no existe',
    });
  }

  const originalReservesInventory = statusReservesInventory(originalStatus);
  const originalAffectsInventory = statusAffectsInventory(originalStatus);
  const nextReservesInventory = statusReservesInventory(status);
  const nextAffectsInventory = statusAffectsInventory(status);

  const originalAdjustments = mapAdjustments(
    order.items.map((item) => ({
      product: item.product.toString(),
      billNumber: item.billNumber,
      lotNumber: item.lotNumber,
      quantity: item.quantity,
    })),
  );

  const mappedOrder = await buildOrderItems(items);
  if (!mappedOrder.success) {
    return res.status(400).json({
      success: false,
      message: mappedOrder.message,
    });
  }

  const nextAdjustments = mapAdjustments(items);
  const reservationConsumptionPlan = originalReservesInventory && nextAffectsInventory
    ? buildReservationConsumptionPlan(originalAdjustments, nextAdjustments)
    : { releaseAdjustments: originalAdjustments, reservedCreditMap: new Map<string, number>() };

  const restoreReservationAdjustments = originalReservesInventory
    ? reservationConsumptionPlan.releaseAdjustments
    : [];

  const releaseReservationResult = originalReservesInventory
    ? await applyInventoryReservationAdjustment(
        restoreReservationAdjustments,
        'release',
      )
    : { success: true as const, snapshots: [], movements: [] };

  if (!releaseReservationResult.success) {
    return res.status(400).json({
      success: false,
      message: releaseReservationResult.message,
    });
  }

  const restoreAdjustments = originalAffectsInventory
    ? originalAdjustments
    : [];

  const restoreResult = originalAffectsInventory
    ? await applyInventoryAdjustment(
        restoreAdjustments,
        'increase',
        'ORDER_UPDATED_RESTORE_PREVIOUS',
      )
    : { success: true as const, snapshots: [], movements: [] };

  if (!restoreResult.success) {
    return res.status(400).json({
      success: false,
      message: restoreResult.message,
    });
  }

  const newReservations = nextReservesInventory ? nextAdjustments : [];
  const reservationResult = nextReservesInventory
    ? await applyInventoryReservationAdjustment(newReservations, 'reserve')
    : { success: true as const, snapshots: [], movements: [] };

  if (!reservationResult.success) {
    await rollbackInventorySnapshots(releaseReservationResult.snapshots);
    await rollbackInventorySnapshots(restoreResult.snapshots);
    return res.status(400).json({
      success: false,
      message: reservationResult.message,
    });
  }

  const newDeductions = nextAffectsInventory ? nextAdjustments : [];
  const deductionResult = nextAffectsInventory
    ? await applyInventoryAdjustment(
        newDeductions,
        'decrease',
        'ORDER_UPDATED_OUT',
        {
          reservedCreditMap: reservationConsumptionPlan.reservedCreditMap,
        },
      )
    : { success: true as const, snapshots: [], movements: [] };

  if (!deductionResult.success) {
    await rollbackInventorySnapshots(reservationResult.snapshots);
    await rollbackInventorySnapshots(releaseReservationResult.snapshots);
    await rollbackInventorySnapshots(restoreResult.snapshots);
    return res.status(400).json({
      success: false,
      message: deductionResult.message,
    });
  }

  const originalDate = order.date;
  const originalClient = order.client;
  const originalItems = order.items.map((item) => ({
    product: item.product,
    billNumber: item.billNumber,
    lotNumber: item.lotNumber,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal,
  }));
  const originalTotal = order.total;

  order.date = date;
  order.client = client as any;
  order.status = status;
  order.items = mappedOrder.items as any;
  order.total = mappedOrder.total;

  try {
    await order.save();

    const movementDrafts = [...restoreResult.movements, ...deductionResult.movements];

    if (movementDrafts.length > 0) {
      await createInventoryMovements(
        movementDrafts,
        {
          orderId: order._id.toString(),
          action: 'UPDATE_ORDER',
          updatedBy: req.user?._id?.toString() || null,
          previousStatus: originalStatus,
          nextStatus: status,
        },
      );
    }

    const updated = await Order.findById(order._id)
      .populate({ path: 'client', select: 'name type documentNumber active' })
      .populate({ path: 'items.product', select: 'name productCode price active' });

    res.json({
      success: true,
      message: 'Orden de compra actualizada exitosamente',
      data: updated,
    });
  } catch (error) {
    await rollbackInventorySnapshots([
      ...releaseReservationResult.snapshots,
      ...reservationResult.snapshots,
      ...restoreResult.snapshots,
      ...deductionResult.snapshots,
    ]);

    order.date = originalDate;
    order.client = originalClient as any;
    order.status = originalStatus;
    order.items = originalItems as any;
    order.total = originalTotal;
    await order.save();

    throw error;
  }
}));

router.delete('/:id', auth, requirePermission('DELETE_ORDERS'), activityLogger('DELETE', 'ORDER'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Orden no encontrada',
    });
  }

  const originalStatus = order.status as OrderStatus;

  if (immutableStatuses.has(originalStatus)) {
    return res.status(400).json({
      success: false,
      message: 'Las ordenes cerradas o canceladas no se pueden eliminar',
    });
  }

  const releaseReservationAdjustments = statusReservesInventory(originalStatus)
    ? mapAdjustments(
        order.items.map((item) => ({
          product: item.product.toString(),
          billNumber: item.billNumber,
          lotNumber: item.lotNumber,
          quantity: item.quantity,
        })),
      )
    : [];

  const releaseReservationResult = statusReservesInventory(originalStatus)
    ? await applyInventoryReservationAdjustment(
        releaseReservationAdjustments,
        'release',
      )
    : { success: true as const, snapshots: [], movements: [] };

  if (!releaseReservationResult.success) {
    return res.status(400).json({
      success: false,
      message: releaseReservationResult.message,
    });
  }

  const restoreAdjustments = statusAffectsInventory(originalStatus)
    ? mapAdjustments(
        order.items.map((item) => ({
          product: item.product.toString(),
          billNumber: item.billNumber,
          lotNumber: item.lotNumber,
          quantity: item.quantity,
        })),
      )
    : [];

  const restoreResult = statusAffectsInventory(originalStatus)
    ? await applyInventoryAdjustment(
        restoreAdjustments,
        'increase',
        'ORDER_DELETED_RESTORE',
      )
    : { success: true as const, snapshots: [], movements: [] };

  if (!restoreResult.success) {
    return res.status(400).json({
      success: false,
      message: restoreResult.message,
    });
  }

  try {
    if (restoreResult.movements.length > 0) {
      await createInventoryMovements(restoreResult.movements, {
        orderId: order._id.toString(),
        action: 'DELETE_ORDER',
        deletedBy: req.user?._id?.toString() || null,
        previousStatus: originalStatus,
      });
    }

    await Order.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Orden eliminada exitosamente',
    });
  } catch (error) {
    await rollbackInventorySnapshots(releaseReservationResult.snapshots);
    await rollbackInventorySnapshots(restoreResult.snapshots);
    throw error;
  }
}));

export default router;
