import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IEmployee extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId; // Referencia al usuario
  salarioPorHora: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new Schema<IEmployee>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  salarioPorHora: {
    type: Number,
    required: true,
    default: 6500,
    min: 0
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
employeeSchema.index({ user: 1 });
employeeSchema.index({ isActive: 1 });

export default mongoose.model<IEmployee>('Employee', employeeSchema);
