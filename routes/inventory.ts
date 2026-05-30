import express from 'express';
import type { Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';
import { getProductionPackagingRule } from '../lib/productionInventoryRules.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auth, requirePermission } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';
import {
  createPackagedInventoryWithTraceability,
  InventoryTransformationError,
  revertPackagedInventoryTransformation,
} from '../services/inventoryTransformationService.js';

const router = express.Router();

const lotNumberRegex = /^\d{8}-[A-Za-z0-9]{6}$/;
const expirationDateRegex = /^\d{4}\/\d{2}\/\d{2}$/;

const listValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('La pagina debe ser mayor a 0'),
  query('limit').optional().isInt({ min: 1 }).withMessage('El limite debe ser mayor a 0'),
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

router.get('/summary', auth, requirePermission('READ_INVENTORY'), asyncHandler(async (_req: AuthRequest, res: Response) => {
  const summary = await Inventory.aggregate([
    {
      $group: {
        _id: '$product',
        totalQuantity: { $sum: '$quantity' },
        totalReservedQuantity: { $sum: '$reservedQuantity' },
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
        totalQuantity: item.totalQuantity,
        totalReservedQuantity: item.totalReservedQuantity || 0,
        totalAvailableQuantity: Math.max(0, item.totalQuantity - (item.totalReservedQuantity || 0)),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.productName.localeCompare(b.productName));

  res.json({ success: true, data });
}));

router.get('/', auth, requirePermission('READ_INVENTORY'), listValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parametros invalidos',
      errors: errors.array()
    });
  }

  const page = parseInt(req.query.page as string) || 1;
  const rawLimit = req.query.limit as string | undefined;
  const limit = rawLimit ? parseInt(rawLimit) : null;
  const search = (req.query.search as string || '').trim();
  const skip = limit ? (page - 1) * limit : 0;

  const filter: any = {};

  if (search) {
    const matchingProducts = await Product.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { productCode: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ]
    }).select('_id');

    const productIds = matchingProducts.map((product) => product._id);

    filter.$or = [
      { lotNumber: { $regex: search, $options: 'i' } },
      { expirationDate: { $regex: search, $options: 'i' } },
      ...(productIds.length > 0 ? [{ product: { $in: productIds } }] : [])
    ];
  }

  const recordsQuery = Inventory.find(filter)
    .populate({ path: 'product', select: 'name productCode active' })
    .sort({ createdAt: -1 });

  if (limit) {
    recordsQuery.skip(skip).limit(limit);
  }

  const [records, total] = await Promise.all([
    recordsQuery,
    Inventory.countDocuments(filter)
  ]);

  const resolvedLimit = limit ?? total;
  const totalPages = limit ? Math.ceil(total / limit) : 1;

  res.json({
    success: true,
    data: {
      data: records,
      total,
      page,
      limit: resolvedLimit,
      totalPages
    }
  });
}));

router.post('/', auth, requirePermission('CREATE_INVENTORY'), activityLogger('CREATE', 'INVENTORY'), createInventoryValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
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

  const normalizedLotNumber = lotNumber.trim().toUpperCase();
  const existingLot = await Inventory.findOne({ lotNumber: normalizedLotNumber });
  if (existingLot) {
    return res.status(400).json({
      success: false,
      message: 'Ya existe un registro de inventario con ese numero de lote'
    });
  }

  try {
    const result = await createPackagedInventoryWithTraceability({
      productId: product,
      quantity: Number(quantity),
      lotNumber: normalizedLotNumber,
      expirationDate,
      userId: req.user?._id?.toString(),
    });

    const message = result.transformed
      ? `Registro de inventario creado exitosamente. Se descontaron ${result.consumedUnits} unidad(es) de ${result.baseProductName}.`
      : 'Registro de inventario creado exitosamente';

    res.status(201).json({
      success: true,
      message,
      data: result.inventoryRecord,
    });
  } catch (error) {
    if (error instanceof InventoryTransformationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    throw error;
  }
}));

router.put('/:id', auth, requirePermission('UPDATE_INVENTORY'), activityLogger('UPDATE', 'INVENTORY'), updateInventoryValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
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

  const originalProduct = await Product.findById(record.product);
  if (!originalProduct) {
    return res.status(400).json({
      success: false,
      message: 'El producto original del registro no existe'
    });
  }

  const originalQuantity = record.quantity;

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
    record.quantity = Number(quantity);
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

  const originalRule = getProductionPackagingRule(
    originalProduct.productCode || originalProduct.name,
  );
  const finalRule = getProductionPackagingRule(
    finalProduct?.productCode || finalProduct?.name,
  );

  const isSamePackagedRule =
    !!originalRule &&
    !!finalRule &&
    originalRule.packagedProductName === finalRule.packagedProductName;

  const sourceRollbackMap = new Map<string, number>();
  const rememberSourceSnapshot = (sourceId: string, previousQuantity: number) => {
    if (!sourceRollbackMap.has(sourceId)) {
      sourceRollbackMap.set(sourceId, previousQuantity);
    }
  };

  const originalTransformationSources = (record.transformationSources || []).map((source) => ({
    inventoryId: source.inventoryId,
    lotNumber: source.lotNumber,
    quantity: source.quantity,
  }));

  try {
    let restorationUnits = 0;

    if (originalRule) {
      if (isSamePackagedRule) {
        restorationUnits = Math.max(0, originalQuantity - record.quantity) * originalRule.unitsPerPackage;
      } else {
        restorationUnits = originalQuantity * originalRule.unitsPerPackage;
      }
    }

    if (restorationUnits > 0) {
      const currentSources = [...(record.transformationSources || [])];
      let pendingRestoreUnits = restorationUnits;

      for (let index = currentSources.length - 1; index >= 0 && pendingRestoreUnits > 0; index -= 1) {
        const source = currentSources[index];
        const sourceLot = await Inventory.findById(source.inventoryId);

        if (!sourceLot) {
          throw new InventoryTransformationError(
            `No se encontro el lote origen ${source.lotNumber} para restaurar la transformacion`,
          );
        }

        rememberSourceSnapshot(sourceLot._id.toString(), sourceLot.quantity);

        const unitsToRestore = Math.min(source.quantity, pendingRestoreUnits);
        sourceLot.quantity += unitsToRestore;
        await sourceLot.save();

        source.quantity -= unitsToRestore;
        pendingRestoreUnits -= unitsToRestore;
      }

      if (pendingRestoreUnits > 0) {
        throw new InventoryTransformationError(
          'No existe trazabilidad suficiente para restaurar la reduccion del producto empaquetado',
        );
      }

      record.transformationSources = currentSources.filter((source) => source.quantity > 0);
    }

    let packagedUnitsToConsume = 0;
    if (finalRule) {
      if (isSamePackagedRule) {
        packagedUnitsToConsume = Math.max(0, record.quantity - originalQuantity);
      } else {
        packagedUnitsToConsume = record.quantity;
      }
    }

    if (finalRule && packagedUnitsToConsume > 0) {
      const baseProduct = await Product.findOne({
        $or: [
          { name: finalRule.baseProductName },
          ...(finalRule.baseProductCode
            ? [{ productCode: finalRule.baseProductCode }]
            : []),
        ],
      });

      if (!baseProduct) {
        throw new InventoryTransformationError(
          `No se encontro el producto base ${finalRule.baseProductCode || finalRule.baseProductName} para actualizar ${finalRule.packagedProductName}`,
        );
      }

      const sourceRecords = await Inventory.find({
        product: baseProduct._id,
        quantity: { $gt: 0 },
      }).sort({ createdAt: 1, _id: 1 });

      const availableUnits = sourceRecords.reduce(
        (total, sourceRecord) => total + Math.max(0, sourceRecord.quantity - (sourceRecord.reservedQuantity || 0)),
        0,
      );
      const requiredUnits = packagedUnitsToConsume * finalRule.unitsPerPackage;

      if (availableUnits < requiredUnits) {
        throw new InventoryTransformationError(
          `No hay existencias suficientes para actualizar a ${record.quantity} unidad(es) de ${finalRule.packagedProductName}. Se requieren ${requiredUnits} unidad(es) adicionales de ${finalRule.baseProductName} y solo hay ${availableUnits} disponibles.`,
        );
      }

      let pendingUnits = requiredUnits;
      const sourceUsageMap = new Map<string, { inventoryId: any; lotNumber: string; quantity: number }>();

      for (const source of record.transformationSources || []) {
        sourceUsageMap.set(source.inventoryId.toString(), {
          inventoryId: source.inventoryId,
          lotNumber: source.lotNumber,
          quantity: source.quantity,
        });
      }

      for (const sourceRecord of sourceRecords) {
        if (pendingUnits <= 0) {
          break;
        }

        const unitsToDiscount = Math.min(
          Math.max(0, sourceRecord.quantity - (sourceRecord.reservedQuantity || 0)),
          pendingUnits,
        );
        if (unitsToDiscount <= 0) {
          continue;
        }

        rememberSourceSnapshot(sourceRecord._id.toString(), sourceRecord.quantity);

        sourceRecord.quantity -= unitsToDiscount;
        await sourceRecord.save();

        const existingUsage = sourceUsageMap.get(sourceRecord._id.toString());
        if (existingUsage) {
          existingUsage.quantity += unitsToDiscount;
        } else {
          sourceUsageMap.set(sourceRecord._id.toString(), {
            inventoryId: sourceRecord._id,
            lotNumber: sourceRecord.lotNumber,
            quantity: unitsToDiscount,
          });
        }

        pendingUnits -= unitsToDiscount;
      }

      record.transformationSources = Array.from(sourceUsageMap.values()).filter((source) => source.quantity > 0);
    }

    await record.save();
  } catch (error) {
    for (const [sourceId, previousQuantity] of Array.from(sourceRollbackMap.entries()).reverse()) {
      const sourceRecord = await Inventory.findById(sourceId);
      if (sourceRecord) {
        sourceRecord.quantity = previousQuantity;
        await sourceRecord.save();
      }
    }

    record.transformationSources = originalTransformationSources;

    if (error instanceof InventoryTransformationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    throw error;
  }

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

router.delete('/:id', auth, requirePermission('DELETE_INVENTORY'), activityLogger('DELETE', 'INVENTORY'), asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const result = await revertPackagedInventoryTransformation({
      inventoryId: req.params.id,
      userId: req.user?._id?.toString(),
    });

    res.json(result);
  } catch (error) {
    if (error instanceof InventoryTransformationError) {
      const isNotFoundError = /no encontrado/i.test(error.message);
      return res.status(isNotFoundError ? 404 : 400).json({
        success: false,
        message: error.message,
      });
    }

    throw error;
  }
}));

export default router;
