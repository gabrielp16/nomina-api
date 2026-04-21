import mongoose, { Types } from 'mongoose';
import Inventory, { type IInventory } from '../models/Inventory.js';
import InventoryMovement from '../models/InventoryMovement.js';
import Product from '../models/Product.js';
import { getProductionPackagingRule } from '../lib/productionInventoryRules.js';

class InventoryTransformationError extends Error {}

type OptionalSession = mongoose.ClientSession | null;

type SourceLotUsage = {
  inventoryId: Types.ObjectId;
  productId: Types.ObjectId;
  lotNumber: string;
  quantity: number;
};

type CreatePackagedInventoryInput = {
  productId: string;
  quantity: number;
  lotNumber: string;
  expirationDate: string;
  userId?: string;
};

type CreatePackagedInventoryResult = {
  inventoryRecord: IInventory;
  transformed: boolean;
  consumedUnits: number;
  baseProductName?: string;
};

type RevertInput = {
  inventoryId: string;
  userId?: string;
};

const isTransactionUnsupportedError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  return /Transaction numbers are only allowed on a replica set member or mongos/i.test(error.message);
};

const saveWithOptionalSession = async (
  document: { save: (options?: { session?: mongoose.ClientSession }) => Promise<unknown> },
  session: OptionalSession,
) => {
  if (session) {
    await document.save({ session });
    return;
  }

  await document.save();
};

const findBaseProductForRule = async (packagedProductId: Types.ObjectId) => {
  const packagedProduct = await Product.findById(packagedProductId).select('name productCode');

  if (!packagedProduct) {
    throw new InventoryTransformationError('El producto seleccionado no existe');
  }

  const packagingRule = getProductionPackagingRule(
    packagedProduct.productCode || packagedProduct.name,
  );

  if (!packagingRule) {
    return {
      packagedProduct,
      packagingRule: null,
      baseProduct: null,
    };
  }

  const baseProduct = await Product.findOne({
    $or: [
      { name: packagingRule.baseProductName },
      ...(packagingRule.baseProductCode ? [{ productCode: packagingRule.baseProductCode }] : []),
    ],
  }).select('name productCode');

  if (!baseProduct) {
    throw new InventoryTransformationError(
      `No se encontro el producto base ${packagingRule.baseProductCode || packagingRule.baseProductName}`,
    );
  }

  return {
    packagedProduct,
    packagingRule,
    baseProduct,
  };
};

const getSourceLotsForFifo = async (baseProductId: Types.ObjectId, session: OptionalSession) => {
  const query = Inventory.find({
    product: baseProductId,
    quantity: { $gt: 0 },
  }).sort({ createdAt: 1, _id: 1 });

  if (session) {
    query.session(session);
  }

  return query;
};

const getAvailableInventoryUnits = (lot: { quantity: number; reservedQuantity?: number }) => {
  return Math.max(0, lot.quantity - (lot.reservedQuantity || 0));
};

const allocateFifoLots = async (
  baseProductId: Types.ObjectId,
  requiredUnits: number,
  session: OptionalSession,
): Promise<SourceLotUsage[]> => {
  const sourceLots = await getSourceLotsForFifo(baseProductId, session);

  const availableUnits = sourceLots.reduce((sum, lot) => sum + getAvailableInventoryUnits(lot), 0);

  if (availableUnits < requiredUnits) {
    throw new InventoryTransformationError(
      `Inventario insuficiente. Requerido: ${requiredUnits}, disponible: ${availableUnits}`,
    );
  }

  const usages: SourceLotUsage[] = [];
  let pendingUnits = requiredUnits;

  for (const lot of sourceLots) {
    if (pendingUnits <= 0) {
      break;
    }

    const unitsToConsume = Math.min(getAvailableInventoryUnits(lot), pendingUnits);

    if (unitsToConsume <= 0) {
      continue;
    }

    lot.quantity -= unitsToConsume;
    await saveWithOptionalSession(lot, session);

    usages.push({
      inventoryId: lot._id,
      productId: lot.product as Types.ObjectId,
      lotNumber: lot.lotNumber,
      quantity: unitsToConsume,
    });

    pendingUnits -= unitsToConsume;
  }

  return usages;
};

const createInventoryRecord = async (
  payload: {
    product: Types.ObjectId;
    quantity: number;
    lotNumber: string;
    expirationDate: string;
  },
  session: OptionalSession,
) => {
  if (session) {
    const created = await Inventory.create([payload], { session });
    return created[0];
  }

  return Inventory.create(payload);
};

const createMovementRecord = async (payload: Record<string, unknown>, session: OptionalSession) => {
  if (session) {
    const created = await InventoryMovement.create([payload], { session });
    return created[0];
  }

  return InventoryMovement.create(payload);
};

const runCreateWithSession = async (
  input: CreatePackagedInventoryInput,
  session: mongoose.ClientSession,
): Promise<CreatePackagedInventoryResult> => {
  const productId = new Types.ObjectId(input.productId);
  const { packagingRule, baseProduct } = await findBaseProductForRule(productId);

  const inventoryRecord = await createInventoryRecord(
    {
      product: productId,
      quantity: input.quantity,
      lotNumber: input.lotNumber,
      expirationDate: input.expirationDate,
    },
    session,
  );

  if (!packagingRule || !baseProduct) {
    await createMovementRecord(
      {
        movementType: 'IN',
        reason: 'MANUAL_STOCK_ENTRY',
        product: productId,
        lotNumber: input.lotNumber,
        quantity: input.quantity,
        sourceLots: [],
        targetLots: [
          {
            inventoryId: inventoryRecord._id,
            productId,
            lotNumber: inventoryRecord.lotNumber,
            quantity: input.quantity,
          },
        ],
        referenceInventory: inventoryRecord._id,
        metadata: {
          createdBy: input.userId || null,
        },
      },
      session,
    );

    return {
      inventoryRecord,
      transformed: false,
      consumedUnits: 0,
    };
  }

  const requiredUnits = input.quantity * packagingRule.unitsPerPackage;
  const consumedLots = await allocateFifoLots(baseProduct._id, requiredUnits, session);

  inventoryRecord.transformationSources = consumedLots.map((lot) => ({
    inventoryId: lot.inventoryId,
    lotNumber: lot.lotNumber,
    quantity: lot.quantity,
  }));
  await saveWithOptionalSession(inventoryRecord, session);

  await createMovementRecord(
    {
      movementType: 'TRANSFORMATION',
      reason: 'PACKAGED_PRODUCT_CREATED',
      product: productId,
      lotNumber: input.lotNumber,
      quantity: input.quantity,
      sourceLots: consumedLots,
      targetLots: [
        {
          inventoryId: inventoryRecord._id,
          productId,
          lotNumber: inventoryRecord.lotNumber,
          quantity: input.quantity,
        },
      ],
      referenceInventory: inventoryRecord._id,
      metadata: {
        unitsPerPackage: packagingRule.unitsPerPackage,
        requiredUnits,
        baseProductId: baseProduct._id,
        baseProductName: baseProduct.name,
        createdBy: input.userId || null,
      },
    },
    session,
  );

  return {
    inventoryRecord,
    transformed: true,
    consumedUnits: requiredUnits,
    baseProductName: baseProduct.name,
  };
};

const runCreateWithoutTransaction = async (
  input: CreatePackagedInventoryInput,
): Promise<CreatePackagedInventoryResult> => {
  const productId = new Types.ObjectId(input.productId);
  const { packagingRule, baseProduct } = await findBaseProductForRule(productId);

  const rollbackSourceLots: Array<{ id: Types.ObjectId; previousQuantity: number }> = [];
  let createdInventoryId: Types.ObjectId | null = null;
  let createdMovementId: Types.ObjectId | null = null;

  try {
    const inventoryRecord = await createInventoryRecord(
      {
        product: productId,
        quantity: input.quantity,
        lotNumber: input.lotNumber,
        expirationDate: input.expirationDate,
      },
      null,
    );
    createdInventoryId = inventoryRecord._id;

    if (!packagingRule || !baseProduct) {
      const movement = await createMovementRecord(
        {
          movementType: 'IN',
          reason: 'MANUAL_STOCK_ENTRY',
          product: productId,
          lotNumber: input.lotNumber,
          quantity: input.quantity,
          sourceLots: [],
          targetLots: [
            {
              inventoryId: inventoryRecord._id,
              productId,
              lotNumber: inventoryRecord.lotNumber,
              quantity: input.quantity,
            },
          ],
          referenceInventory: inventoryRecord._id,
          metadata: {
            createdBy: input.userId || null,
          },
        },
        null,
      );

      createdMovementId = movement._id;

      return {
        inventoryRecord,
        transformed: false,
        consumedUnits: 0,
      };
    }

    const requiredUnits = input.quantity * packagingRule.unitsPerPackage;
    const sourceLots = await getSourceLotsForFifo(baseProduct._id, null);
    const availableUnits = sourceLots.reduce((sum, lot) => sum + getAvailableInventoryUnits(lot), 0);

    if (availableUnits < requiredUnits) {
      throw new InventoryTransformationError(
        `Inventario insuficiente. Requerido: ${requiredUnits}, disponible: ${availableUnits}`,
      );
    }

    const consumedLots: SourceLotUsage[] = [];
    let pendingUnits = requiredUnits;

    for (const lot of sourceLots) {
      if (pendingUnits <= 0) {
        break;
      }

      const unitsToConsume = Math.min(getAvailableInventoryUnits(lot), pendingUnits);
      if (unitsToConsume <= 0) {
        continue;
      }

      rollbackSourceLots.push({
        id: lot._id,
        previousQuantity: lot.quantity,
      });

      lot.quantity -= unitsToConsume;
      await saveWithOptionalSession(lot, null);

      consumedLots.push({
        inventoryId: lot._id,
        productId: lot.product as Types.ObjectId,
        lotNumber: lot.lotNumber,
        quantity: unitsToConsume,
      });

      pendingUnits -= unitsToConsume;
    }

    inventoryRecord.transformationSources = consumedLots.map((lot) => ({
      inventoryId: lot.inventoryId,
      lotNumber: lot.lotNumber,
      quantity: lot.quantity,
    }));
    await saveWithOptionalSession(inventoryRecord, null);

    const movement = await createMovementRecord(
      {
        movementType: 'TRANSFORMATION',
        reason: 'PACKAGED_PRODUCT_CREATED',
        product: productId,
        lotNumber: input.lotNumber,
        quantity: input.quantity,
        sourceLots: consumedLots,
        targetLots: [
          {
            inventoryId: inventoryRecord._id,
            productId,
            lotNumber: inventoryRecord.lotNumber,
            quantity: input.quantity,
          },
        ],
        referenceInventory: inventoryRecord._id,
        metadata: {
          unitsPerPackage: packagingRule.unitsPerPackage,
          requiredUnits,
          baseProductId: baseProduct._id,
          baseProductName: baseProduct.name,
          createdBy: input.userId || null,
        },
      },
      null,
    );

    createdMovementId = movement._id;

    return {
      inventoryRecord,
      transformed: true,
      consumedUnits: requiredUnits,
      baseProductName: baseProduct.name,
    };
  } catch (error) {
    if (createdMovementId) {
      await InventoryMovement.findByIdAndDelete(createdMovementId);
    }

    if (createdInventoryId) {
      await Inventory.findByIdAndDelete(createdInventoryId);
    }

    for (const snapshot of rollbackSourceLots.reverse()) {
      const lot = await Inventory.findById(snapshot.id);
      if (lot) {
        lot.quantity = snapshot.previousQuantity;
        await saveWithOptionalSession(lot, null);
      }
    }

    throw error;
  }
};

export const createPackagedInventoryWithTraceability = async (
  input: CreatePackagedInventoryInput,
): Promise<CreatePackagedInventoryResult> => {
  const session = await mongoose.startSession();

  try {
    let response: CreatePackagedInventoryResult | null = null;

    try {
      response = await session.withTransaction(async () => runCreateWithSession(input, session));
    } catch (error) {
      if (!isTransactionUnsupportedError(error)) {
        throw error;
      }

      response = await runCreateWithoutTransaction(input);
    }

    if (!response) {
      throw new InventoryTransformationError('No se pudo crear el registro de inventario');
    }

    const hydratedRecord = await Inventory.findById(response.inventoryRecord._id).populate({
      path: 'product',
      select: 'name productCode active',
    });

    return {
      ...response,
      inventoryRecord: hydratedRecord || response.inventoryRecord,
    };
  } finally {
    await session.endSession();
  }
};

const runRevertWithSession = async (input: RevertInput, session: mongoose.ClientSession) => {
  let resultMessage = 'Registro eliminado exitosamente';

  const packagedRecord = await Inventory.findById(input.inventoryId).session(session);

  if (!packagedRecord) {
    throw new InventoryTransformationError('Registro no encontrado');
  }

  const packagedProduct = await Product.findById(packagedRecord.product)
    .select('name productCode')
    .session(session);

  if (!packagedProduct) {
    throw new InventoryTransformationError('El producto del registro no existe');
  }

  const packagingRule = getProductionPackagingRule(
    packagedProduct.productCode || packagedProduct.name,
  );

  if (!packagingRule) {
    if (packagedRecord.quantity > 0) {
      await createMovementRecord(
        {
          movementType: 'OUT',
          reason: 'MANUAL_STOCK_REMOVAL',
          product: packagedProduct._id,
          lotNumber: packagedRecord.lotNumber,
          quantity: packagedRecord.quantity,
          sourceLots: [
            {
              inventoryId: packagedRecord._id,
              productId: packagedProduct._id,
              lotNumber: packagedRecord.lotNumber,
              quantity: packagedRecord.quantity,
            },
          ],
          targetLots: [],
          referenceInventory: packagedRecord._id,
          metadata: {
            removedBy: input.userId || null,
            preservedLotReference: true,
          },
        },
        session,
      );
    }

    packagedRecord.quantity = 0;
    await saveWithOptionalSession(packagedRecord, session);

    return {
      success: true as const,
      message: resultMessage,
    };
  }

  if (!packagedRecord.transformationSources || packagedRecord.transformationSources.length === 0) {
    throw new InventoryTransformationError(
      'No hay trazabilidad por lote para revertir este producto empaquetado',
    );
  }

  const restoredLots: SourceLotUsage[] = [];
  const currentSources = [...(packagedRecord.transformationSources || [])];
  const unitsToRestore = packagedRecord.quantity * packagingRule.unitsPerPackage;
  let pendingUnitsToRestore = unitsToRestore;

  for (let index = currentSources.length - 1; index >= 0 && pendingUnitsToRestore > 0; index -= 1) {
    const source = currentSources[index];
    const sourceLot = await Inventory.findById(source.inventoryId).session(session);

    if (!sourceLot) {
      throw new InventoryTransformationError(
        `No se encontro el lote origen ${source.lotNumber} para revertir la transformacion`,
      );
    }

    const unitsForSource = Math.min(source.quantity, pendingUnitsToRestore);

    if (unitsForSource <= 0) {
      continue;
    }

    sourceLot.quantity += unitsForSource;
    await saveWithOptionalSession(sourceLot, session);

    restoredLots.push({
      inventoryId: sourceLot._id,
      productId: sourceLot.product as Types.ObjectId,
      lotNumber: source.lotNumber,
      quantity: unitsForSource,
    });

    source.quantity -= unitsForSource;
    pendingUnitsToRestore -= unitsForSource;
  }

  if (pendingUnitsToRestore > 0) {
    throw new InventoryTransformationError(
      'No hay trazabilidad suficiente para revertir las unidades empaquetadas disponibles',
    );
  }

  const restoredUnits = restoredLots.reduce((acc, lot) => acc + lot.quantity, 0);

  if (packagedRecord.quantity > 0) {
    await createMovementRecord(
      {
        movementType: 'TRANSFORMATION',
        reason: 'PACKAGED_PRODUCT_REVERTED',
        product: packagedProduct._id,
        lotNumber: packagedRecord.lotNumber,
        quantity: packagedRecord.quantity,
        sourceLots: [
          {
            inventoryId: packagedRecord._id,
            productId: packagedProduct._id,
            lotNumber: packagedRecord.lotNumber,
            quantity: packagedRecord.quantity,
          },
        ],
        targetLots: restoredLots,
        referenceInventory: packagedRecord._id,
        metadata: {
          revertedBy: input.userId || null,
          unitsPerPackage: packagingRule.unitsPerPackage,
          restoredUnits,
          preservedLotReference: true,
        },
      },
      session,
    );
  }

  packagedRecord.quantity = 0;
  packagedRecord.transformationSources = currentSources.filter((source) => source.quantity > 0);
  await saveWithOptionalSession(packagedRecord, session);

  resultMessage = restoredUnits > 0
    ? `Registro eliminado exitosamente. Se restauraron ${restoredUnits} unidad(es) a los mismos lotes origen.`
    : 'Registro eliminado exitosamente';

  return {
    success: true as const,
    message: resultMessage,
  };
};

const runRevertWithoutTransaction = async (input: RevertInput) => {
  let createdMovementId: Types.ObjectId | null = null;
  const rollbackLots: Array<{ id: Types.ObjectId; previousQuantity: number }> = [];
  let packagedSnapshot: { previousQuantity: number; previousSources: IInventory['transformationSources'] } | null = null;

  try {
    const packagedRecord = await Inventory.findById(input.inventoryId);

    if (!packagedRecord) {
      throw new InventoryTransformationError('Registro no encontrado');
    }

    const packagedProduct = await Product.findById(packagedRecord.product).select('name productCode');

    if (!packagedProduct) {
      throw new InventoryTransformationError('El producto del registro no existe');
    }

    const packagingRule = getProductionPackagingRule(
      packagedProduct.productCode || packagedProduct.name,
    );

    if (!packagingRule) {
      packagedSnapshot = {
        previousQuantity: packagedRecord.quantity,
        previousSources: (packagedRecord.transformationSources || []).map((source) => ({
          inventoryId: source.inventoryId,
          lotNumber: source.lotNumber,
          quantity: source.quantity,
        })),
      };

      if (packagedRecord.quantity > 0) {
        const movement = await createMovementRecord(
          {
            movementType: 'OUT',
            reason: 'MANUAL_STOCK_REMOVAL',
            product: packagedProduct._id,
            lotNumber: packagedRecord.lotNumber,
            quantity: packagedRecord.quantity,
            sourceLots: [
              {
                inventoryId: packagedRecord._id,
                productId: packagedProduct._id,
                lotNumber: packagedRecord.lotNumber,
                quantity: packagedRecord.quantity,
              },
            ],
            targetLots: [],
            referenceInventory: packagedRecord._id,
            metadata: {
              removedBy: input.userId || null,
              preservedLotReference: true,
            },
          },
          null,
        );

        createdMovementId = movement._id;
      }

      packagedRecord.quantity = 0;
      await saveWithOptionalSession(packagedRecord, null);

      return {
        success: true as const,
        message: 'Registro eliminado exitosamente',
      };
    }

    if (!packagedRecord.transformationSources || packagedRecord.transformationSources.length === 0) {
      throw new InventoryTransformationError(
        'No hay trazabilidad por lote para revertir este producto empaquetado',
      );
    }

    const restoredLots: SourceLotUsage[] = [];
    const currentSources = [...(packagedRecord.transformationSources || [])];
    const unitsToRestore = packagedRecord.quantity * packagingRule.unitsPerPackage;
    let pendingUnitsToRestore = unitsToRestore;

    packagedSnapshot = {
      previousQuantity: packagedRecord.quantity,
      previousSources: currentSources.map((source) => ({
        inventoryId: source.inventoryId,
        lotNumber: source.lotNumber,
        quantity: source.quantity,
      })),
    };

    for (let index = currentSources.length - 1; index >= 0 && pendingUnitsToRestore > 0; index -= 1) {
      const source = currentSources[index];
      const sourceLot = await Inventory.findById(source.inventoryId);

      if (!sourceLot) {
        throw new InventoryTransformationError(
          `No se encontro el lote origen ${source.lotNumber} para revertir la transformacion`,
        );
      }

      const unitsForSource = Math.min(source.quantity, pendingUnitsToRestore);
      if (unitsForSource <= 0) {
        continue;
      }

      rollbackLots.push({
        id: sourceLot._id,
        previousQuantity: sourceLot.quantity,
      });

      sourceLot.quantity += unitsForSource;
      await saveWithOptionalSession(sourceLot, null);

      restoredLots.push({
        inventoryId: sourceLot._id,
        productId: sourceLot.product as Types.ObjectId,
        lotNumber: source.lotNumber,
        quantity: unitsForSource,
      });

      source.quantity -= unitsForSource;
      pendingUnitsToRestore -= unitsForSource;
    }

    if (pendingUnitsToRestore > 0) {
      throw new InventoryTransformationError(
        'No hay trazabilidad suficiente para revertir las unidades empaquetadas disponibles',
      );
    }

    const restoredUnits = restoredLots.reduce((acc, lot) => acc + lot.quantity, 0);

    if (packagedRecord.quantity > 0) {
      const movement = await createMovementRecord(
        {
          movementType: 'TRANSFORMATION',
          reason: 'PACKAGED_PRODUCT_REVERTED',
          product: packagedProduct._id,
          lotNumber: packagedRecord.lotNumber,
          quantity: packagedRecord.quantity,
          sourceLots: [
            {
              inventoryId: packagedRecord._id,
              productId: packagedProduct._id,
              lotNumber: packagedRecord.lotNumber,
              quantity: packagedRecord.quantity,
            },
          ],
          targetLots: restoredLots,
          referenceInventory: packagedRecord._id,
          metadata: {
            revertedBy: input.userId || null,
            unitsPerPackage: packagingRule.unitsPerPackage,
            restoredUnits,
            preservedLotReference: true,
          },
        },
        null,
      );

      createdMovementId = movement._id;
    }

    packagedRecord.quantity = 0;
    packagedRecord.transformationSources = currentSources.filter((source) => source.quantity > 0);
    await saveWithOptionalSession(packagedRecord, null);

    return {
      success: true as const,
      message: restoredUnits > 0
        ? `Registro eliminado exitosamente. Se restauraron ${restoredUnits} unidad(es) a los mismos lotes origen.`
        : 'Registro eliminado exitosamente',
    };
  } catch (error) {
    if (createdMovementId) {
      await InventoryMovement.findByIdAndDelete(createdMovementId);
    }

    for (const snapshot of rollbackLots.reverse()) {
      const lot = await Inventory.findById(snapshot.id);
      if (lot) {
        lot.quantity = snapshot.previousQuantity;
        await saveWithOptionalSession(lot, null);
      }
    }

    if (packagedSnapshot) {
      const packagedRecord = await Inventory.findById(input.inventoryId);
      if (packagedRecord) {
        packagedRecord.quantity = packagedSnapshot.previousQuantity;
        packagedRecord.transformationSources = packagedSnapshot.previousSources || [];
        await saveWithOptionalSession(packagedRecord, null);
      }
    }

    throw error;
  }
};

export const revertPackagedInventoryTransformation = async (input: RevertInput) => {
  const session = await mongoose.startSession();

  try {
    try {
      const result = await session.withTransaction(async () => runRevertWithSession(input, session));

      if (!result) {
        throw new InventoryTransformationError('No se pudo revertir el registro empaquetado');
      }

      return result;
    } catch (error) {
      if (!isTransactionUnsupportedError(error)) {
        throw error;
      }

      return runRevertWithoutTransaction(input);
    }
  } finally {
    await session.endSession();
  }
};

export { InventoryTransformationError };
