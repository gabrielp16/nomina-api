import mongoose, { Document, Schema } from 'mongoose';

export interface IClient extends Document {
  nombre: string;
  correo?: string;
  telefono?: string;
  direccion?: string;
  nit?: string;
  activo: boolean;
  fechaCreacion: Date;
  fechaActualizacion: Date;
}

const clientSchema = new Schema<IClient>({
  nombre: {
    type: String,
    required: [true, 'El nombre del cliente es obligatorio'],
    trim: true,
    minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  correo: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Correo electrónico inválido'],
    sparse: true
  },
  telefono: {
    type: String,
    trim: true,
    maxlength: [20, 'El teléfono no puede exceder 20 caracteres']
  },
  direccion: {
    type: String,
    trim: true,
    maxlength: [200, 'La dirección no puede exceder 200 caracteres']
  },
  nit: {
    type: String,
    trim: true,
    maxlength: [20, 'El NIT no puede exceder 20 caracteres']
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
      delete ret.__v;
      return ret;
    }
  }
});

clientSchema.index({ nombre: 1 });
clientSchema.index({ nit: 1 }, { sparse: true });
clientSchema.index({ correo: 1 }, { sparse: true });
clientSchema.index({ activo: 1 });

clientSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.fechaActualizacion = new Date();
  }
  next();
});

const Client = mongoose.model<IClient>('Client', clientSchema);

export default Client;