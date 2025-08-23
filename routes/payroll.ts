import express from 'express';
import type { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Payroll from '../models/Payroll.js';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auth, requirePermission } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';

const router = express.Router();

// Función auxiliar para calcular horas trabajadas
const calculateWorkTime = (horaInicio: string, horaFin: string) => {
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

// Función auxiliar para verificar si el usuario es empleado y obtener su ID de empleado
const getEmployeeIdForUser = async (userId: string): Promise<string | null> => {
  const employee = await Employee.findOne({ user: userId, isActive: true });
  return employee ? employee._id.toString() : null;
};

// Función auxiliar para verificar si el usuario puede acceder a la nómina
const canAccessPayroll = async (req: AuthRequest, payrollId?: string): Promise<boolean> => {
  const user = req.user!;
  
  // Si el usuario tiene MANAGE_PAYROLL puede acceder a todo
  if (user.permissions && user.permissions.includes('MANAGE_PAYROLL')) {
    return true;
  }
  
  // Si no es empleado, no puede acceder
  const employeeId = await getEmployeeIdForUser(user.id);
  if (!employeeId) {
    return false;
  }
  
  // Si se está verificando un payroll específico, verificar que sea del empleado
  if (payrollId) {
    const payroll = await Payroll.findById(payrollId);
    if (!payroll || payroll.employee.toString() !== employeeId) {
      return false;
    }
  }
  
  return true;
};

// Validaciones
const payrollValidation = [
  body('employeeId')
    .isMongoId()
    .withMessage('ID de empleado inválido'),
  body('fecha')
    .isISO8601()
    .withMessage('Fecha inválida'),
  body('horaInicio')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Formato de hora de inicio inválido (HH:mm)'),
  body('horaFin')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Formato de hora de fin inválido (HH:mm)'),
  body('consumos')
    .isArray()
    .withMessage('Los consumos deben ser un array'),
  body('consumos.*.valor')
    .isFloat({ min: 0 })
    .withMessage('El valor del consumo debe ser un número positivo'),
  body('consumos.*.descripcion')
    .isLength({ min: 1, max: 200 })
    .withMessage('La descripción del consumo es requerida y no puede exceder 200 caracteres'),
  body('deudaMorchis')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('La deuda de Morchis debe ser un número positivo'),
  body('adelantoNomina')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El adelanto de nómina debe ser un número positivo'),
  body('descuadre')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El descuadre debe ser un número positivo'),
  body('observaciones')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Las observaciones no pueden exceder 500 caracteres')
];

const updatePayrollValidation = [
  body('fecha')
    .optional()
    .isISO8601()
    .withMessage('Fecha inválida'),
  body('horaInicio')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Formato de hora de inicio inválido (HH:mm)'),
  body('horaFin')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Formato de hora de fin inválido (HH:mm)'),
  body('consumos')
    .optional()
    .isArray()
    .withMessage('Los consumos deben ser un array'),
  body('consumos.*.valor')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El valor del consumo debe ser un número positivo'),
  body('consumos.*.descripcion')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('La descripción del consumo es requerida y no puede exceder 200 caracteres'),
  body('deudaMorchis')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('La deuda de Morchis debe ser un número positivo'),
  body('adelantoNomina')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El adelanto de nómina debe ser un número positivo'),
  body('descuadre')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El descuadre debe ser un número positivo'),
  body('estado')
    .optional()
    .isIn(['PENDIENTE', 'PROCESADA', 'PAGADA'])
    .withMessage('Estado inválido'),
  body('observaciones')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Las observaciones no pueden exceder 500 caracteres')
];

// Función helper para calcular valores de nómina
function calculatePayrollValues(employee: any, horaInicio: string, horaFin: string, consumos: any[], deudaMorchis: number = 0, adelantoNomina: number = 0, descuadre: number = 0) {
  // Calcular horas trabajadas
  const timeResult = calculateWorkTime(horaInicio, horaFin);
  const { horas, minutos } = timeResult;
  
  // Calcular salario bruto
  const totalHoras = horas + (minutos / 60);
  const salarioBruto = totalHoras * employee.salarioPorHora;
  
  // Calcular total de consumos
  const totalConsumos = consumos.reduce((sum, consumo) => sum + consumo.valor, 0);
  
  // Calcular descuentos totales
  const totalDescuentos = totalConsumos + adelantoNomina + descuadre;
  
  // Calcular salario neto
  const salarioNeto = salarioBruto - totalDescuentos + deudaMorchis;
  
  return {
    horasTrabajadas: horas,
    minutosTrabajados: minutos,
    salarioBruto,
    totalConsumos,
    totalDescuentos,
    salarioNeto
  };
}

// @route   GET /api/payroll
// @desc    Obtener todas las nóminas con paginación (filtradas por empleado si no es admin)
// @access  Private (READ_PAYROLL permission)
router.get('/', auth, requirePermission('READ_PAYROLL'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string || '';
  const estado = req.query.estado as string || '';
  const empleadoId = req.query.empleadoId as string || '';
  const fechaInicio = req.query.fechaInicio as string || '';
  const fechaFin = req.query.fechaFin as string || '';
  const skip = (page - 1) * limit;

  const user = req.user!;
  
  // Construir query
  let query: any = {};

  // Si el usuario no tiene MANAGE_PAYROLL, solo puede ver sus propios registros
  if (!user.permissions || !user.permissions.includes('MANAGE_PAYROLL')) {
    const userEmployeeId = await getEmployeeIdForUser(user.id);
    if (!userEmployeeId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes acceso a registros de nómina'
      });
    }
    query.employee = userEmployeeId;
  } else {
    // Si es admin y especifica un empleado, filtrar por ese empleado
    if (empleadoId) {
      query.employee = empleadoId;
    }
  }

  // Filtro por estado
  if (estado) {
    query.estado = estado;
  }

  // Filtro por rango de fechas
  if (fechaInicio || fechaFin) {
    query.fecha = {};
    if (fechaInicio) {
      query.fecha.$gte = new Date(fechaInicio);
    }
    if (fechaFin) {
      query.fecha.$lte = new Date(fechaFin);
    }
  }

  // Obtener nóminas
  let payrollQuery = Payroll.find(query)
    .populate({
      path: 'employee',
      populate: {
        path: 'user',
        select: 'nombre apellido correo'
      }
    })
    .populate({
      path: 'procesadoPor',
      select: 'nombre apellido'
    })
    .sort({ fecha: -1, createdAt: -1 });

  // Aplicar búsqueda si existe
  if (search) {
    const employeesWithUsers = await Employee.find().populate('user');
    const matchingEmployeeIds = employeesWithUsers
      .filter(emp => {
        const user = emp.user as any;
        return user.nombre.toLowerCase().includes(search.toLowerCase()) ||
               user.apellido.toLowerCase().includes(search.toLowerCase()) ||
               user.correo.toLowerCase().includes(search.toLowerCase());
      })
      .map(emp => emp._id);

    if (matchingEmployeeIds.length > 0) {
      query.employee = { ...query.employee, $in: matchingEmployeeIds };
    } else {
      // Si no hay coincidencias, no mostrar resultados
      query._id = { $exists: false };
    }

    payrollQuery = Payroll.find(query)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'nombre apellido correo'
        }
      })
      .populate({
        path: 'procesadoPor',
        select: 'nombre apellido'
      })
      .sort({ fecha: -1, createdAt: -1 });
  }

  const [payrolls, total] = await Promise.all([
    payrollQuery.skip(skip).limit(limit),
    Payroll.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: {
      data: payrolls,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit
      }
    }
  });
}));

// @route   GET /api/payroll/my-employee
// @desc    Obtener información del empleado del usuario actual
// @access  Private (READ_PAYROLL permission)
router.get('/my-employee', auth, requirePermission('READ_PAYROLL'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  
  const employee = await Employee.findOne({ user: user.id, isActive: true })
    .populate({
      path: 'user',
      select: 'nombre apellido correo numeroCelular'
    });
  
  if (!employee) {
    return res.status(404).json({
      success: false,
      error: 'No se encontró información de empleado para este usuario'
    });
  }
  
  res.json({
    success: true,
    data: employee
  });
}));

// @route   GET /api/payroll/:id
// @desc    Obtener nómina por ID (verificando permisos de empleado)
// @access  Private (READ_PAYROLL permission)
router.get('/:id', auth, requirePermission('READ_PAYROLL'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  
  // Verificar si puede acceder a este payroll específico
  if (!user.permissions || !user.permissions.includes('MANAGE_PAYROLL')) {
    const canAccess = await canAccessPayroll(req, req.params.id);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: 'No tienes acceso a este registro de nómina'
      });
    }
  }

  const payroll = await Payroll.findById(req.params.id)
    .populate({
      path: 'employee',
      populate: {
        path: 'user',
        select: 'nombre apellido correo numeroCelular'
      }
    })
    .populate({
      path: 'procesadoPor',
      select: 'nombre apellido correo'
    });

  if (!payroll) {
    return res.status(404).json({
      success: false,
      message: 'Nómina no encontrada'
    });
  }

  res.json({
    success: true,
    data: payroll
  });
}));

// @route   POST /api/payroll
// @desc    Crear nueva nómina (empleados solo pueden crear para sí mismos)
// @access  Private (CREATE_PAYROLL permission)
router.post('/', auth, requirePermission('CREATE_PAYROLL'), activityLogger('CREATE', 'PAYROLL'), payrollValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const { employeeId, fecha, horaInicio, horaFin, consumos, deudaMorchis = 0, adelantoNomina = 0, descuadre = 0, observaciones } = req.body;
  const user = req.user!;

  // Si el usuario no tiene MANAGE_PAYROLL, solo puede crear registros para sí mismo
  if (!user.permissions || !user.permissions.includes('MANAGE_PAYROLL')) {
    const userEmployeeId = await getEmployeeIdForUser(user.id);
    if (!userEmployeeId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes acceso para crear registros de nómina'
      });
    }
    if (employeeId !== userEmployeeId) {
      return res.status(403).json({
        success: false,
        error: 'Solo puedes crear registros de nómina para ti mismo'
      });
    }
  }

  // Verificar que el empleado existe
  const employee = await Employee.findById(employeeId);
  if (!employee) {
    return res.status(400).json({
      success: false,
      message: 'Empleado no encontrado'
    });
  }

  // Validar que la hora de fin sea posterior a la de inicio (considerando cambio de día)
  const [inicioHora, inicioMinuto] = horaInicio.split(':').map(Number);
  const [finHora, finMinuto] = horaFin.split(':').map(Number);
  const inicioEnMinutos = inicioHora * 60 + inicioMinuto;
  const finEnMinutos = finHora * 60 + finMinuto;
  
  if (finEnMinutos <= inicioEnMinutos && finEnMinutos !== 0) {
    // Permitir cuando la hora de fin es 00:00 (medianoche)
    if (!(finHora === 0 && finMinuto === 0)) {
      return res.status(400).json({
        success: false,
        message: 'La hora de fin debe ser posterior a la hora de inicio'
      });
    }
  }

  // Calcular valores de la nómina
  const calculatedValues = calculatePayrollValues(employee, horaInicio, horaFin, consumos, deudaMorchis, adelantoNomina, descuadre);

  // Crear nómina
  const payroll = new Payroll({
    employee: employeeId,
    fecha: new Date(fecha),
    horaInicio,
    horaFin,
    ...calculatedValues,
    consumos,
    deudaMorchis,
    adelantoNomina,
    descuadre,
    procesadoPor: req.user!._id,
    observaciones
  });

  await payroll.save();

  // Obtener nómina con datos poblados
  const payrollWithData = await Payroll.findById(payroll._id)
    .populate({
      path: 'employee',
      populate: {
        path: 'user',
        select: 'nombre apellido correo'
      }
    })
    .populate({
      path: 'procesadoPor',
      select: 'nombre apellido'
    });

  res.status(201).json({
    success: true,
    message: 'Nómina creada exitosamente',
    data: payrollWithData
  });
}));

// @route   PUT /api/payroll/:id
// @desc    Actualizar nómina (empleados solo pueden actualizar sus propios registros)
// @access  Private (UPDATE_PAYROLL permission)
router.put('/:id', auth, requirePermission('UPDATE_PAYROLL'), activityLogger('UPDATE', 'PAYROLL'), updatePayrollValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const user = req.user!;
  
  // Verificar si puede acceder a este payroll específico
  if (!user.permissions || !user.permissions.includes('MANAGE_PAYROLL')) {
    const canAccess = await canAccessPayroll(req, req.params.id);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: 'No tienes acceso a este registro de nómina'
      });
    }
  }

  const payroll = await Payroll.findById(req.params.id).populate('employee');
  if (!payroll) {
    return res.status(404).json({
      success: false,
      message: 'Nómina no encontrada'
    });
  }

  const { fecha, horaInicio, horaFin, consumos, deudaMorchis, adelantoNomina, descuadre, estado, observaciones } = req.body;

  // Actualizar campos básicos
  if (fecha !== undefined) payroll.fecha = new Date(fecha);
  if (estado !== undefined) payroll.estado = estado;
  if (observaciones !== undefined) payroll.observaciones = observaciones;

  // Si se actualizan horas o consumos, recalcular valores
  const needsRecalculation = horaInicio !== undefined || horaFin !== undefined || 
                            consumos !== undefined || deudaMorchis !== undefined || adelantoNomina !== undefined ||
                            descuadre !== undefined;

  if (needsRecalculation) {
    const newHoraInicio = horaInicio || payroll.horaInicio;
    const newHoraFin = horaFin || payroll.horaFin;
    const newConsumos = consumos || payroll.consumos;
    const newDeudaMorchis = deudaMorchis !== undefined ? deudaMorchis : payroll.deudaMorchis;
    const newAdelantoNomina = adelantoNomina !== undefined ? adelantoNomina : payroll.adelantoNomina;
    const newDescuadre = descuadre !== undefined ? descuadre : payroll.descuadre;

    const calculatedValues = calculatePayrollValues(
      payroll.employee, 
      newHoraInicio, 
      newHoraFin, 
      newConsumos, 
      newDeudaMorchis, 
      newAdelantoNomina,
      newDescuadre
    );

    // Actualizar valores calculados
    Object.assign(payroll, {
      horaInicio: newHoraInicio,
      horaFin: newHoraFin,
      consumos: newConsumos,
      deudaMorchis: newDeudaMorchis,
      adelantoNomina: newAdelantoNomina,
      descuadre: newDescuadre,
      ...calculatedValues
    });
  }

  await payroll.save();

  // Obtener nómina actualizada con datos poblados
  const updatedPayroll = await Payroll.findById(payroll._id)
    .populate({
      path: 'employee',
      populate: {
        path: 'user',
        select: 'nombre apellido correo'
      }
    })
    .populate({
      path: 'procesadoPor',
      select: 'nombre apellido'
    });

  res.json({
    success: true,
    message: 'Nómina actualizada exitosamente',
    data: updatedPayroll
  });
}));

// @route   DELETE /api/payroll/:id
// @desc    Eliminar nómina (empleados solo pueden eliminar sus propios registros)
// @access  Private (DELETE_PAYROLL permission)
router.delete('/:id', auth, requirePermission('DELETE_PAYROLL'), activityLogger('DELETE', 'PAYROLL'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  
  // Verificar si puede acceder a este payroll específico
  if (!user.permissions || !user.permissions.includes('MANAGE_PAYROLL')) {
    const canAccess = await canAccessPayroll(req, req.params.id);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: 'No tienes acceso a este registro de nómina'
      });
    }
  }

  const payroll = await Payroll.findById(req.params.id);
  if (!payroll) {
    return res.status(404).json({
      success: false,
      message: 'Nómina no encontrada'
    });
  }

  // Solo permitir eliminar nóminas en estado PENDIENTE
  if (payroll.estado !== 'PENDIENTE') {
    return res.status(400).json({
      success: false,
      message: 'Solo se pueden eliminar nóminas en estado PENDIENTE'
    });
  }

  await Payroll.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Nómina eliminada exitosamente'
  });
}));

// @route   GET /api/payroll/stats/summary
// @desc    Obtener estadísticas de nóminas (filtradas por empleado si no es admin)
// @access  Private (READ_PAYROLL permission)
router.get('/stats/summary', auth, requirePermission('READ_PAYROLL'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  
  // Construir filtro base
  let baseFilter: any = {};
  
  // Si el usuario no tiene MANAGE_PAYROLL, solo puede ver sus propias estadísticas
  if (!user.permissions || !user.permissions.includes('MANAGE_PAYROLL')) {
    const userEmployeeId = await getEmployeeIdForUser(user.id);
    if (!userEmployeeId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes acceso a estadísticas de nómina'
      });
    }
    baseFilter.employee = userEmployeeId;
  }

  const mesActual = new Date();
  mesActual.setDate(1);
  mesActual.setHours(0, 0, 0, 0);

  const mesAnterior = new Date(mesActual);
  mesAnterior.setMonth(mesAnterior.getMonth() - 1);

  const [
    totalNominas,
    nominasPendientes,
    nominasProcesadas,
    nominasPagadas,
    nominasMesActual,
    totalPagadoMesActual
  ] = await Promise.all([
    Payroll.countDocuments(baseFilter),
    Payroll.countDocuments({ ...baseFilter, estado: 'PENDIENTE' }),
    Payroll.countDocuments({ ...baseFilter, estado: 'PROCESADA' }),
    Payroll.countDocuments({ ...baseFilter, estado: 'PAGADA' }),
    Payroll.countDocuments({ ...baseFilter, fecha: { $gte: mesActual } }),
    Payroll.aggregate([
      {
        $match: {
          ...baseFilter,
          fecha: { $gte: mesActual },
          estado: 'PAGADA'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$salarioNeto' }
        }
      }
    ])
  ]);

  res.json({
    success: true,
    data: {
      totalNominas,
      nominasPendientes,
      nominasProcesadas,
      nominasPagadas,
      nominasMesActual,
      totalPagadoMesActual: totalPagadoMesActual[0]?.total || 0
    }
  });
}));

export default router;
