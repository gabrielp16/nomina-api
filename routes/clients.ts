import { Router, Request, Response } from 'express';
import mongoose, { HydratedDocument } from 'mongoose';
import { body } from 'express-validator';
import Client, { IClient } from '../models/Client.js';
import { auth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// Helper para transformar documento a objeto con id
const transformClientDoc = (client: HydratedDocument<IClient>) => ({
  ...client.toObject(),
  id: String(client._id)
});

// GET /api/clients - Obtener todos los clientes
router.get('/', 
  auth, 
  requirePermission('READ_USERS'),
  activityLogger('LIST_CLIENTS', 'CLIENTS'),
  asyncHandler(async (req: Request, res: Response) => {
    const { 
      page = 1, 
      limit = 50,
      search,
      activo
    } = req.query;

    // Construir filtros
    const filters: any = {};
    
    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      filters.$or = [
        { nombre: searchRegex },
        { apellido: searchRegex },
        { correo: searchRegex },
        { empresa: searchRegex }
      ];
    }

    if (activo !== undefined) {
      filters.activo = activo === 'true';
    }

    // Ejecutar consulta con paginación
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [clients, total] = await Promise.all([
      Client.find(filters)
        .sort({ fechaCreacion: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Client.countDocuments(filters)
    ]);

    const totalPages = Math.ceil(total / parseInt(limit as string));

    res.json({
      success: true,
      data: clients.map(transformClientDoc),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages
      },
      message: 'Clientes obtenidos exitosamente'
    });
  })
);

// GET /api/clients/:id - Obtener cliente por ID
router.get('/:id', 
  auth, 
  requirePermission('READ_USERS'),
  activityLogger('READ', 'CLIENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de cliente inválido'
      });
    }

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        ...client.toObject(),
        id: (client._id as mongoose.Types.ObjectId).toString()
      },
      message: 'Cliente obtenido exitosamente'
    });
  })
);

// POST /api/clients - Crear nuevo cliente
router.post('/', 
  auth, 
  requirePermission('CREATE_USERS'),
  [
    body('nombre')
      .trim()
      .notEmpty()
      .withMessage('El nombre es obligatorio')
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
    body('apellido')
      .trim()
      .notEmpty()
      .withMessage('El apellido es obligatorio')
      .isLength({ min: 2, max: 50 })
      .withMessage('El apellido debe tener entre 2 y 50 caracteres'),
    body('correo')
      .optional()
      .isEmail()
      .withMessage('Correo electrónico inválido'),
    body('telefono')
      .optional()
      .isLength({ max: 20 })
      .withMessage('El teléfono no puede exceder 20 caracteres'),
    body('direccion')
      .optional()
      .isLength({ max: 200 })
      .withMessage('La dirección no puede exceder 200 caracteres'),
    body('empresa')
      .optional()
      .isLength({ max: 100 })
      .withMessage('La empresa no puede exceder 100 caracteres')
  ],
  activityLogger('CREATE_CLIENT', 'CLIENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { 
      nombre, 
      apellido, 
      correo, 
      telefono, 
      direccion, 
      empresa 
    } = req.body;

    // Verificar si el correo ya existe (si se proporcionó)
    if (correo) {
      const existingClient = await Client.findOne({ correo: correo.toLowerCase() });
      if (existingClient) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe un cliente con ese correo electrónico'
        });
      }
    }

    const newClient = new Client({
      nombre,
      apellido,
      correo,
      telefono,
      direccion,
      empresa
    });

    const savedClient = await newClient.save();

    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: {
        ...savedClient.toObject(),
        id: (savedClient._id as mongoose.Types.ObjectId).toString()
      }
    });
  })
);

// PUT /api/clients/:id - Actualizar cliente
router.put('/:id', 
  auth, 
  requirePermission('UPDATE_USERS'),
  [
    body('nombre')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
    body('apellido')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('El apellido debe tener entre 2 y 50 caracteres'),
    body('correo')
      .optional()
      .isEmail()
      .withMessage('Correo electrónico inválido'),
    body('telefono')
      .optional()
      .isLength({ max: 20 })
      .withMessage('El teléfono no puede exceder 20 caracteres'),
    body('direccion')
      .optional()
      .isLength({ max: 200 })
      .withMessage('La dirección no puede exceder 200 caracteres'),
    body('empresa')
      .optional()
      .isLength({ max: 100 })
      .withMessage('La empresa no puede exceder 100 caracteres')
  ],
  activityLogger('UPDATE_CLIENT', 'CLIENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de cliente inválido'
      });
    }

    const client = await Client.findById(id);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    // Verificar si el nuevo correo ya existe (si se está cambiando)
    if (req.body.correo && req.body.correo.toLowerCase() !== client.correo) {
      const existingClient = await Client.findOne({ correo: req.body.correo.toLowerCase() });
      if (existingClient) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe un cliente con ese correo electrónico'
        });
      }
    }

    const updatedClient = await Client.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedClient) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: {
        ...updatedClient.toObject(),
        id: (updatedClient._id as mongoose.Types.ObjectId).toString()
      }
    });
  })
);

// DELETE /api/clients/:id - Eliminar cliente
router.delete('/:id', 
  auth, 
  requirePermission('DELETE_USERS'),
  activityLogger('DELETE_CLIENT', 'CLIENT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de cliente inválido'
      });
    }

    const client = await Client.findById(id);
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    await Client.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Cliente eliminado exitosamente'
    });
  })
);

export default router;