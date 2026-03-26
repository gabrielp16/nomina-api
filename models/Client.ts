import mongoose, { Document, Schema, Types } from 'mongoose';

export type ClientType = 'Persona Natural' | 'Persona Juridica';
export type ClientPaymentType =
  | '8 dias'
  | '10 dias'
  | '15 dias'
  | '30 dias'
  | '60 dias'
  | '90 dias'
  | 'Efectivo'
  | 'Transferencia';

export interface IClient extends Document {
  _id: Types.ObjectId;
  name: string;
  category: string;
  type: ClientType;
  paymentType: ClientPaymentType;
  documentNumber: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const clientSchema = new Schema<IClient>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    type: {
      type: String,
      required: true,
      enum: ['Persona Natural', 'Persona Juridica']
    },
    paymentType: {
      type: String,
      required: true,
      enum: [
        '8 dias',
        '10 dias',
        '15 dias',
        '30 dias',
        '60 dias',
        '90 dias',
        'Efectivo',
        'Transferencia'
      ],
      default: 'Efectivo'
    },
    documentNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 70
    },
    active: {
      type: Boolean,
      default: true
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

clientSchema.index({ name: 1 });
clientSchema.index({ category: 1 });
clientSchema.index({ paymentType: 1 });
clientSchema.index({ documentNumber: 1 });
clientSchema.index({ email: 1 });
clientSchema.index({ active: 1 });

export default mongoose.model<IClient>('Client', clientSchema);
