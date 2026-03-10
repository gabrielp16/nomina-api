import express, { Request, Response } from 'express';
import ProductPrice from '../models/ProductPrice';
import Product from '../models/Product';
import Client from '../models/Client';
import { auth, requirePermission } from '../middleware/auth';
import { activityLogger } from '../middleware/activityLogger';
import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';

const router = express.Router();

// Middleware para validar ObjectId
const validateObjectId = (field: string) => {
  return param(field).custom((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error(`${field} inválido`);
    }
    return true;
  });
};

// Obtener todos los precios (con filtros opcionales)
router.get(
  '/',
  auth,
  requirePermission('READ_PAYROLL'),
  [
    query('producto').optional().custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID de producto inválido');
      }
      return true;
    }),
    query('cliente').optional().custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('ID de cliente inválido');
      }
      return true;
    }),
    query('activo').optional().isBoolean().toBoolean()
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { producto, cliente, activo } = req.query;
      const filter: any = {};

      if (producto) filter.producto = producto;
      if (cliente) filter.cliente = cliente;
      if (activo !== undefined) filter.activo = activo;

      const precios = await ProductPrice.find(filter)
        .populate('producto', 'nombre unidad')
        .populate('cliente', 'nombre nit')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: precios,
        total: precios.length
      });
    } catch (error: any) {
      console.error('Error al obtener precios:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener los precios',
        error: error.message
      });
    }
  }
);

// Obtener precios por producto con información de clientes
router.get(
  '/producto/:id',
  auth,
  requirePermission('READ_PAYROLL'),
  validateObjectId('id'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const producto = await Product.findById(req.params.id);
      if (!producto) {
        res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
        return;
      }

      const precios = await ProductPrice.find({ 
        producto: req.params.id,
        activo: true 
      })
        .populate('cliente', 'nombre nit correo telefono')
        .sort({ createdAt: -1 });

      const preciosPorCliente = precios.map(precio => ({
        cliente: (precio.cliente as any).nombre,
        valor: precio.precio,
        id_producto: (producto._id as any).toString(),
        producto: producto.nombre,
        clienteId: (precio.cliente as any)._id.toString(),
        nit: (precio.cliente as any).nit,
        precioId: (precio._id as any).toString()
      }));

      res.json({
        success: true,
        data: {
          producto: {
            _id: producto._id,
            nombre: producto.nombre,
            unidad: producto.unidad,
            descripcion: producto.descripcion
          },
          preciosPorCliente
        }
      });
    } catch (error: any) {
      console.error('Error al obtener precios del producto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener los precios del producto',
        error: error.message
      });
    }
  }
);

// Obtener precios por cliente
router.get(
  '/cliente/:id',
  auth,
  requirePermission('READ_PAYROLL'),
  validateObjectId('id'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const cliente = await Client.findById(req.params.id);
      if (!cliente) {
        res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
        return;
      }

      const precios = await ProductPrice.find({ 
        cliente: req.params.id,
        activo: true 
      })
        .populate('producto', 'nombre unidad descripcion')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: {
          cliente: {
            _id: cliente._id,
            nombre: cliente.nombre,
            nit: cliente.nit
          },
          precios: precios.map(p => ({
            _id: p._id,
            producto: (p.producto as any).nombre,
            productoId: (p.producto as any)._id,
            unidad: (p.producto as any).unidad,
            precio: p.precio,
            createdAt: p.createdAt
          }))
        }
      });
    } catch (error: any) {
      console.error('Error al obtener precios del cliente:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener los precios del cliente',
        error: error.message
      });
    }
  }
);

// Crear nuevo precio
router.post(
  '/',
  auth,
  requirePermission('MANAGE_PAYROLL'),
  activityLogger('CREATE', 'PRODUCT_PRICE'),
  [
    body('producto')
      .notEmpty().withMessage('El producto es obligatorio')
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new Error('ID de producto inválido');
        }
        return true;
      }),
    body('cliente')
      .notEmpty().withMessage('El cliente es obligatorio')
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new Error('ID de cliente inválido');
        }
        return true;
      }),
    body('precio')
      .notEmpty().withMessage('El precio es obligatorio')
      .isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo')
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { producto, cliente, precio } = req.body;

      // Verificar que el producto existe
      const productoExists = await Product.findById(producto);
      if (!productoExists) {
        res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
        return;
      }

      // Verificar que el cliente existe
      const clienteExists = await Client.findById(cliente);
      if (!clienteExists) {
        res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
        return;
      }

      // Verificar si ya existe un precio activo para este cliente-producto
      const precioExistente = await ProductPrice.findOne({
        producto,
        cliente,
        activo: true
      });

      if (precioExistente) {
        res.status(400).json({
          success: false,
          message: 'Ya existe un precio activo para este cliente y producto'
        });
        return;
      }

      const nuevoPrecio = await ProductPrice.create({
        producto,
        cliente,
        precio,
        activo: true
      });

      const precioPopulado = await ProductPrice.findById(nuevoPrecio._id)
        .populate('producto', 'nombre unidad')
        .populate('cliente', 'nombre nit');

      res.status(201).json({
        success: true,
        message: 'Precio creado exitosamente',
        data: precioPopulado
      });
    } catch (error: any) {
      console.error('Error al crear precio:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear el precio',
        error: error.message
      });
    }
  }
);

// Actualizar precio
router.put(
  '/:id',
  auth,
  requirePermission('MANAGE_PAYROLL'),
  activityLogger('UPDATE', 'PRODUCT_PRICE'),
  [
    validateObjectId('id'),
    body('precio')
      .notEmpty().withMessage('El precio es obligatorio')
      .isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo')
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { precio } = req.body;

      const precioActualizado = await ProductPrice.findByIdAndUpdate(
        req.params.id,
        { precio },
        { new: true, runValidators: true }
      )
        .populate('producto', 'nombre unidad')
        .populate('cliente', 'nombre nit');

      if (!precioActualizado) {
        res.status(404).json({
          success: false,
          message: 'Precio no encontrado'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Precio actualizado exitosamente',
        data: precioActualizado
      });
    } catch (error: any) {
      console.error('Error al actualizar precio:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar el precio',
        error: error.message
      });
    }
  }
);

// Desactivar precio (soft delete)
router.delete(
  '/:id',
  auth,
  requirePermission('MANAGE_PAYROLL'),
  activityLogger('DELETE', 'PRODUCT_PRICE'),
  validateObjectId('id'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const precio = await ProductPrice.findByIdAndUpdate(
        req.params.id,
        { activo: false },
        { new: true }
      );

      if (!precio) {
        res.status(404).json({
          success: false,
          message: 'Precio no encontrado'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Precio desactivado exitosamente'
      });
    } catch (error: any) {
      console.error('Error al desactivar precio:', error);
      res.status(500).json({
        success: false,
        message: 'Error al desactivar el precio',
        error: error.message
      });
    }
  }
);

export default router;
