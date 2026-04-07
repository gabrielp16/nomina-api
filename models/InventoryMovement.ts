import mongoose, { Document, Schema, Types } from 'mongoose';

export type InventoryMovementType = 'IN' | 'OUT' | 'TRANSFORMATION';

export interface IInventoryMovementLot extends Types.Subdocument {
  inventoryId: Types.ObjectId;
  productId: Types.ObjectId;
  lotNumber: string;
  quantity: number;
}

export interface IInventoryMovement extends Document {
  _id: Types.ObjectId;
  movementType: InventoryMovementType;
  reason: string;
  product: Types.ObjectId;
  lotNumber: string;
  quantity: number;
  sourceLots: Types.DocumentArray<IInventoryMovementLot>;
  targetLots: Types.DocumentArray<IInventoryMovementLot>;
  referenceInventory?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryMovementLotSchema = new Schema<IInventoryMovementLot>(
  {
    inventoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    lotNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    _id: false,
  },
);

const inventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    movementType: {
      type: String,
      enum: ['IN', 'OUT', 'TRANSFORMATION'],
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    lotNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    sourceLots: {
      type: [inventoryMovementLotSchema],
      default: [],
    },
    targetLots: {
      type: [inventoryMovementLotSchema],
      default: [],
    },
    referenceInventory: {
      type: Schema.Types.ObjectId,
      ref: 'Inventory',
      required: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function(_doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

inventoryMovementSchema.index({ movementType: 1, createdAt: -1 });
inventoryMovementSchema.index({ product: 1, createdAt: -1 });
inventoryMovementSchema.index({ referenceInventory: 1 });
inventoryMovementSchema.index({ 'sourceLots.inventoryId': 1 });
inventoryMovementSchema.index({ 'targetLots.inventoryId': 1 });

export default mongoose.model<IInventoryMovement>('InventoryMovement', inventoryMovementSchema);
