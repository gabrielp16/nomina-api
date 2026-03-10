import mongoose, { Document, Schema } from 'mongoose';

export interface IProductPrice extends Document {
  producto: mongoose.Types.ObjectId;
  cliente: mongoose.Types.ObjectId;
  precio: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductPriceSchema = new Schema<IProductPrice>(
  {
    producto: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'El producto es obligatorio']
    },
    cliente: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'El cliente es obligatorio']
    },
    precio: {
      type: Number,
      required: [true, 'El precio es obligatorio'],
      min: [0, 'El precio no puede ser negativo']
    },
    activo: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Índice compuesto para garantizar que no haya duplicados cliente-producto activos
ProductPriceSchema.index({ producto: 1, cliente: 1, activo: 1 }, { unique: true });

// Índice para búsquedas por producto
ProductPriceSchema.index({ producto: 1 });

// Índice para búsquedas por cliente
ProductPriceSchema.index({ cliente: 1 });

export default mongoose.model<IProductPrice>('ProductPrice', ProductPriceSchema);
