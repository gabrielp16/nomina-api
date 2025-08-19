import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IConsumption {
  valor: number;
  descripcion: string;
}

export interface IPayroll extends Document {
  _id: Types.ObjectId;
  employee: Types.ObjectId; // Referencia al empleado
  fecha: Date;
  horaInicio: string; // Formato: "HH:mm"
  horaFin: string; // Formato: "HH:mm"
  horasTrabajadas: number; // Calculado automáticamente
  minutosTrabajados: number; // Calculado automáticamente
  salarioBruto: number; // Calculado: (horas + minutos/60) * salarioPorHora
  consumos: IConsumption[];
  totalConsumos: number; // Suma de todos los consumos
  deudaMorchis: number; // Lo que Morchis le debe al empleado
  adelantoNomina: number; // Adelanto solicitado
  totalDescuentos: number; // consumos + adelantos
  salarioNeto: number; // salarioBruto - totalDescuentos + deudaMorchis
  procesadoPor: Types.ObjectId; // Usuario que procesó la nómina
  estado: 'PENDIENTE' | 'PROCESADA' | 'PAGADA';
  observaciones?: string;
  createdAt: Date;
  updatedAt: Date;
}

const consumptionSchema = new Schema<IConsumption>({
  valor: {
    type: Number,
    required: true,
    min: 0
  },
  descripcion: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  }
}, { _id: false });

const payrollSchema = new Schema<IPayroll>({
  employee: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  fecha: {
    type: Date,
    required: true,
    default: Date.now
  },
  horaInicio: {
    type: String,
    required: true,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:mm)']
  },
  horaFin: {
    type: String,
    required: true,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:mm)']
  },
  horasTrabajadas: {
    type: Number,
    required: true,
    min: 0
  },
  minutosTrabajados: {
    type: Number,
    required: true,
    min: 0,
    max: 59
  },
  salarioBruto: {
    type: Number,
    required: true,
    min: 0
  },
  consumos: [consumptionSchema],
  totalConsumos: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  deudaMorchis: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  adelantoNomina: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  totalDescuentos: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  salarioNeto: {
    type: Number,
    required: true
  },
  procesadoPor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  estado: {
    type: String,
    enum: ['PENDIENTE', 'PROCESADA', 'PAGADA'],
    default: 'PENDIENTE'
  },
  observaciones: {
    type: String,
    trim: true,
    maxlength: 500
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
payrollSchema.index({ employee: 1 });
payrollSchema.index({ fecha: 1 });
payrollSchema.index({ estado: 1 });
payrollSchema.index({ procesadoPor: 1 });
payrollSchema.index({ fecha: -1, employee: 1 });

// Método estático para calcular horas trabajadas
payrollSchema.statics.calculateWorkTime = function(horaInicio: string, horaFin: string) {
  const [inicioHora, inicioMinuto] = horaInicio.split(':').map(Number);
  const [finHora, finMinuto] = horaFin.split(':').map(Number);
  
  const inicioEnMinutos = inicioHora * 60 + inicioMinuto;
  let finEnMinutos = finHora * 60 + finMinuto;
  
  // Si la hora de fin es menor, asumimos que es al día siguiente
  if (finEnMinutos < inicioEnMinutos) {
    finEnMinutos += 24 * 60;
  }
  
  const totalMinutos = finEnMinutos - inicioEnMinutos;
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  
  return { horas, minutos };
};

export default mongoose.model<IPayroll>('Payroll', payrollSchema);
