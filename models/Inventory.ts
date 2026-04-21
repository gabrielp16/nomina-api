import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IInventory extends Document {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  quantity: number;
  reservedQuantity: number;
  lotNumber: string;
  expirationDate: string;
  transformationSources?: {
    inventoryId: Types.ObjectId;
    lotNumber: string;
    quantity: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const transformationSourceSchema = new Schema(
  {
    inventoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Inventory',
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

const inventorySchema = new Schema<IInventory>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    reservedQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lotNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
      unique: true
    },
    expirationDate: {
      type: String,
      required: true,
      trim: true
    },
    transformationSources: {
      type: [transformationSourceSchema],
      default: [],
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function(doc: any, ret: any) {
        ret.id = ret._id;
        ret.availableQuantity = Math.max(0, Number(ret.quantity || 0) - Number(ret.reservedQuantity || 0));
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

inventorySchema.index({ product: 1 });
inventorySchema.index({ lotNumber: 1 }, { unique: true });
inventorySchema.index({ createdAt: -1 });

export default mongoose.model<IInventory>('Inventory', inventorySchema);
