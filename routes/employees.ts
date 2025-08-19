import express from 'express';
import type { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auth, requirePermission } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';

const router = express.Router();

// Validaciones
const employeeValidation = [
  body('userId')
    .isMongoId()
    .withMessage('ID de usuario inválido'),
  body('salarioPorHora')
    .isFloat({ min: 0 })
    .withMessage('El salario por hora debe ser un número positivo')
];

const updateEmployeeValidation = [
  body('salarioPorHora')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El salario por hora debe ser un número positivo')
];

// @route   GET /api/employees
// @desc    Obtener todos los empleados con paginación
// @access  Private (READ_USERS permission)
router.get('/', auth, requirePermission('READ_USERS'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string || '';
  const skip = (page - 1) * limit;

  // Construir query de búsqueda
  let userQuery: any = {};
  if (search) {
    userQuery = {
      $or: [
        { nombre: { $regex: search, $options: 'i' } },
        { apellido: { $regex: search, $options: 'i' } },
        { correo: { $regex: search, $options: 'i' } }
      ]
    };
  }

  // Obtener usuarios que coincidan con la búsqueda
  const matchingUsers = await User.find(userQuery).select('_id');
  const userIds = matchingUsers.map(user => user._id);

  // Construir query de empleados
  let employeeQuery: any = { isActive: true };
  if (userIds.length > 0) {
    employeeQuery.user = { $in: userIds };
  } else if (search) {
    // Si hay búsqueda pero no coincidencias, no mostrar resultados
    employeeQuery._id = { $exists: false };
  }

  const [employees, total] = await Promise.all([
    Employee.find(employeeQuery)
      .populate({
        path: 'user',
        select: 'nombre apellido correo numeroCelular'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Employee.countDocuments(employeeQuery)
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: {
      data: employees,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit
      }
    }
  });
}));

// @route   GET /api/employees/:id
// @desc    Obtener empleado por ID
// @access  Private (READ_USERS permission)
router.get('/:id', auth, requirePermission('READ_USERS'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const employee = await Employee.findById(req.params.id)
    .populate({
      path: 'user',
      select: 'nombre apellido correo numeroCelular'
    });

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Empleado no encontrado'
    });
  }

  res.json({
    success: true,
    data: employee
  });
}));

// @route   POST /api/employees
// @desc    Crear nuevo empleado
// @access  Private (CREATE_USERS permission)
router.post('/', auth, requirePermission('CREATE_USERS'), activityLogger('CREATE', 'EMPLOYEE'), employeeValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const { userId, salarioPorHora } = req.body;

  // Verificar que el usuario existe
  const user = await User.findById(userId);
  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Usuario no encontrado'
    });
  }

  // Verificar si ya existe un empleado para este usuario
  const existingEmployee = await Employee.findOne({ user: userId });
  if (existingEmployee) {
    return res.status(400).json({
      success: false,
      message: 'Ya existe un empleado para este usuario'
    });
  }

  // Crear empleado
  const employee = new Employee({
    user: userId,
    salarioPorHora: salarioPorHora || 6500
  });

  await employee.save();

  // Obtener empleado con datos del usuario poblados
  const employeeWithUser = await Employee.findById(employee._id)
    .populate({
      path: 'user',
      select: 'nombre apellido correo numeroCelular'
    });

  res.status(201).json({
    success: true,
    message: 'Empleado creado exitosamente',
    data: employeeWithUser
  });
}));

// @route   PUT /api/employees/:id
// @desc    Actualizar empleado
// @access  Private (UPDATE_USERS permission)
router.put('/:id', auth, requirePermission('UPDATE_USERS'), activityLogger('UPDATE', 'EMPLOYEE'), updateEmployeeValidation, asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Empleado no encontrado'
    });
  }

  const { salarioPorHora } = req.body;

  // Actualizar campos
  if (salarioPorHora !== undefined) {
    employee.salarioPorHora = salarioPorHora;
  }

  await employee.save();

  // Obtener empleado actualizado con datos del usuario
  const updatedEmployee = await Employee.findById(employee._id)
    .populate({
      path: 'user',
      select: 'nombre apellido correo numeroCelular'
    });

  res.json({
    success: true,
    message: 'Empleado actualizado exitosamente',
    data: updatedEmployee
  });
}));

// @route   DELETE /api/employees/:id
// @desc    Desactivar empleado
// @access  Private (DELETE_USERS permission)
router.delete('/:id', auth, requirePermission('DELETE_USERS'), activityLogger('DELETE', 'EMPLOYEE'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Empleado no encontrado'
    });
  }

  employee.isActive = false;
  await employee.save();

  const updatedEmployee = await Employee.findById(employee._id)
    .populate({
      path: 'user',
      select: 'nombre apellido correo numeroCelular'
    });

  res.json({
    success: true,
    message: 'Empleado desactivado exitosamente',
    data: updatedEmployee
  });
}));

// @route   GET /api/employees/users/available
// @desc    Obtener usuarios disponibles para ser empleados (que no sean empleados aún)
// @access  Private (READ_USERS permission)
router.get('/users/available', auth, requirePermission('READ_USERS'), asyncHandler(async (req: AuthRequest, res: Response) => {
  // Obtener IDs de usuarios que ya son empleados
  const existingEmployees = await Employee.find({ isActive: true }).select('user');
  const employeeUserIds = existingEmployees.map(emp => emp.user);

  // Obtener usuarios que no son empleados
  const availableUsers = await User.find({
    _id: { $nin: employeeUserIds },
    isActive: true
  }).select('nombre apellido correo');

  res.json({
    success: true,
    data: availableUsers
  });
}));

export default router;
