import mongoose, { Document, Schema } from 'mongoose';

export interface IProductWithPrices extends Document {
  nombre: string;
  descripcion?: string;
  numeroLote: string;
  fechaVencimiento: Date;
  precio: number;
  activo: boolean;
  fechaCreacion: Date;
  fechaActualizacion: Date;
  unidad?: string;
  preciosPorCliente?: Array<{
    cliente: string;
    valor: number;
    id_producto: string;
    producto: string;
  }>;
}

export interface IProduct extends Document {
  nombre: string;
  descripcion?: string;
  numeroLote: string;
  fechaVencimiento: Date;
  precio: number;
  activo: boolean;
  fechaCreacion: Date;
  fechaActualizacion: Date;
  unidad?: string;
}

const productSchema = new Schema<IProduct>({
  nombre: {
    type: String,
    required: [true, 'El nombre del producto es obligatorio'],
    trim: true,
    minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: [500, 'La descripción no puede exceder 500 caracteres']
  },
  numeroLote: {
    type: String,
    required: [true, 'El número de lote es obligatorio'],
    trim: true,
    maxlength: [50, 'El número de lote no puede exceder 50 caracteres']
  },
  fechaVencimiento: {
    type: Date,
    required: [true, 'La fecha de vencimiento es obligatoria']
  },
  precio: {
    type: Number,
    required: [true, 'El precio es obligatorio'],
    min: [0, 'El precio no puede ser negativo']
  },
  unidad: {
    type: String,
    trim: true,
    enum: ['KG', 'LT', 'UN', 'MT', 'M2', 'M3', 'LB', 'GAL', 'OZ', 'TON']
  },
  activo: {
    type: Boolean,
    default: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaActualizacion: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { 
    createdAt: 'fechaCreacion', 
    updatedAt: 'fechaActualizacion' 
  },
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete (ret as any).__v;
      return ret;
    }
  }
});

productSchema.index({ nombre: 1 });
productSchema.index({ numeroLote: 1 });
productSchema.index({ activo: 1 });

productSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.fechaActualizacion = new Date();
  }
  next();
});

const Product = mongoose.model<IProduct>('Product', productSchema);

export default Product;