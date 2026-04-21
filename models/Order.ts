import mongoose, { Document, Schema, Types } from 'mongoose';

export type OrderStatus = 'BORRADOR' | 'RESERVADA' | 'DESPACHADA' | 'PAGADA' | 'CERRADA' | 'CANCELADA';

export interface IOrderItem {
  product: Types.ObjectId;
  billNumber: string;
  lotNumber: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  date: string;
  client: Types.ObjectId;
  items: IOrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    billNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
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
      max: 9999999,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    date: {
      type: String,
      required: true,
      trim: true,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (value: IOrderItem[]) => Array.isArray(value) && value.length > 0,
        message: 'La orden debe tener al menos un producto',
      },
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['BORRADOR', 'RESERVADA', 'DESPACHADA', 'PAGADA', 'CERRADA', 'CANCELADA'],
      default: 'BORRADOR',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function(doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

orderSchema.index({ date: -1 });
orderSchema.index({ client: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model<IOrder>('Order', orderSchema);
