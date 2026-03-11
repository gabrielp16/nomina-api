import mongoose, { Document, Schema, Types } from 'mongoose';

export type ClientType = 'Persona Natural' | 'Persona Juridica';

export interface IClient extends Document {
  _id: Types.ObjectId;
  name: string;
  type: ClientType;
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
    type: {
      type: String,
      required: true,
      enum: ['Persona Natural', 'Persona Juridica']
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
clientSchema.index({ documentNumber: 1 });
clientSchema.index({ email: 1 });
clientSchema.index({ active: 1 });

export default mongoose.model<IClient>('Client', clientSchema);
