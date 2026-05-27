import mongoose, { Document, Schema, Types } from 'mongoose';

export type ClientType = 'Persona Natural' | 'Persona Juridica';

export type ClientPaymentForm = 'Contado' | 'Pago a 8 dias' | 'Pago a 30 dias';
export type ClientPaymentMethod = 'Efectivo' | 'Transferencia';

export const CLIENT_PAYMENT_FORMS: ClientPaymentForm[] = [
  'Contado',
  'Pago a 8 dias',
  'Pago a 30 dias'
];

export const CLIENT_PAYMENT_METHODS: ClientPaymentMethod[] = [
  'Efectivo',
  'Transferencia'
];

export interface IClientContact {
  name: string;
  area?: string;
  phone: string;
}

export interface IClient extends Document {
  _id: Types.ObjectId;
  name: string;
  alias?: string;
  category: string;
  type: ClientType;
  paymentForm: ClientPaymentForm;
  paymentMethod: ClientPaymentMethod;
  documentNumber: string;
  address: string;
  city: string;
  phone?: string;
  contacts: IClientContact[];
  email: string;
  deliveryHours?: string;
  notes?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const clientContactSchema = new Schema<IClientContact>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    area: {
      type: String,
      trim: true,
      default: '',
      maxlength: 100
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
    }
  },
  { _id: false }
);

const clientSchema = new Schema<IClient>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    alias: {
      type: String,
      trim: true,
      default: '',
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
    paymentForm: {
      type: String,
      required: true,
      enum: CLIENT_PAYMENT_FORMS,
      default: 'Contado'
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: CLIENT_PAYMENT_METHODS,
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
      required: false,
      trim: true,
      default: '',
      maxlength: 20
    },
    contacts: {
      type: [clientContactSchema],
      default: []
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 70
    },
    deliveryHours: {
      type: String,
      trim: true,
      default: '',
      maxlength: 100
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000
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
clientSchema.index({ alias: 1 });
clientSchema.index({ category: 1 });
clientSchema.index({ paymentForm: 1 });
clientSchema.index({ paymentMethod: 1 });
clientSchema.index({ documentNumber: 1 });
clientSchema.index({ email: 1 });
clientSchema.index({ active: 1 });

export default mongoose.model<IClient>('Client', clientSchema);
