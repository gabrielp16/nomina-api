import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPermission extends Document {
  _id: Types.ObjectId;
  nombre: string;
  descripcion?: string;
  modulo: string;
  accion: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'MANAGE';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<IPermission>({
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
  modulo: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30
  },
  accion: {
    type: String,
    required: true,
    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE']
  },
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
// permissionSchema.index({ nombre: 1 }); // Removido: ya se crea automáticamente con unique: true
permissionSchema.index({ modulo: 1 });
permissionSchema.index({ accion: 1 });
permissionSchema.index({ isActive: 1 });

export default mongoose.model<IPermission>('Permission', permissionSchema);
