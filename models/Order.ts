import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IOrder extends Document {
  fecha: Date;
  cliente: Types.ObjectId;
  producto: Types.ObjectId;
  lote: string;
  cantidad: number;
  precio: number;
  total: number;
  estado: 'POR PAGAR' | 'PAGADO' | 'CANCELADO' | 'ENTREGADO';
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

const OrderSchema: Schema = new Schema({
  fecha: {
    type: Date,
    required: [true, 'La fecha es obligatoria'],
    default: Date.now
  },
  cliente: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'El cliente es obligatorio']
  },
  producto: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'El producto es obligatorio']
  },
  lote: {
    type: String,
    required: [true, 'El número de lote es obligatorio'],
    trim: true,
    maxlength: [50, 'El número de lote no puede exceder 50 caracteres']
  },
  cantidad: {
    type: Number,
    required: [true, 'La cantidad es obligatoria'],
    min: [0.01, 'La cantidad debe ser mayor a 0']
  },
  precio: {
    type: Number,
    required: [true, 'El precio es obligatorio'],
    min: [0, 'El precio debe ser mayor o igual a 0']
  },
  total: {
    type: Number,
    required: [true, 'El total es obligatorio'],
    min: [0, 'El total debe ser mayor o igual a 0']
  },
  estado: {
    type: String,
    required: [true, 'El estado es obligatorio'],
    enum: {
      values: ['POR PAGAR', 'PAGADO', 'CANCELADO', 'ENTREGADO'],
      message: 'El estado debe ser POR PAGAR, PAGADO, CANCELADO o ENTREGADO'
    },
    default: 'POR PAGAR'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Índices para optimizar búsquedas
OrderSchema.index({ fecha: 1 });
OrderSchema.index({ cliente: 1 });
OrderSchema.index({ producto: 1 });
OrderSchema.index({ lote: 1 });
OrderSchema.index({ estado: 1 });
OrderSchema.index({ isActive: 1 });

// Middleware para calcular el total automáticamente
OrderSchema.pre('save', function(this: IOrder, next) {
  if (this.isModified('cantidad') || this.isModified('precio')) {
    this.total = this.cantidad * this.precio;
  }
  next();
});

// Virtual para populate las referencias
OrderSchema.virtual('clienteData', {
  ref: 'Client',
  localField: 'cliente',
  foreignField: '_id',
  justOne: true
});

OrderSchema.virtual('productoData', {
  ref: 'Product', 
  localField: 'producto',
  foreignField: '_id',
  justOne: true
});

// Asegurar que los virtuals se incluyan en JSON
OrderSchema.set('toJSON', { virtuals: true });
OrderSchema.set('toObject', { virtuals: true });

export default mongoose.model<IOrder>('Order', OrderSchema);