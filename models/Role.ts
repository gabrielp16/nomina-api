import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRole extends Document {
  _id: Types.ObjectId;
  nombre: string;
  descripcion?: string;
  permisos: Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>({
  nombre: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: 200
  },
  permisos: [{
    type: Schema.Types.ObjectId,
    ref: 'Permission',
    required: true
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Índices
// roleSchema.index({ nombre: 1 }); // Removido: ya se crea automáticamente con unique: true
roleSchema.index({ isActive: 1 });

export default mongoose.model<IRole>('Role', roleSchema);
