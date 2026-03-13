import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IInventory extends Document {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  quantity: number;
  lotNumber: string;
  expirationDate: string;
  createdAt: Date;
  updatedAt: Date;
}

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
      min: 1
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
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function(doc: any, ret: any) {
        ret.id = ret._id;
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
