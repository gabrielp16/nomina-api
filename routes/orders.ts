import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order';
import Client from '../models/Client';
import Product from '../models/Product';
import { auth } from '../middleware/auth';
import { requirePermission } from '../middleware/auth';
import { activityLogger } from '../middleware/activityLogger';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

// GET /api/orders - Obtener todas las órdenes con filtros
router.get('/', auth, requirePermission('READ_USERS'), asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 10, 
    fecha,
    fechaDesde,
    fechaHasta,
    cliente,
    producto,
    lote,
    estado,
    isActive
  } = req.query;
  
  const filter: any = {};
  
  // Filtro por estado activo
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  } else {
    filter.isActive = true; // Por defecto solo mostrar activos
  }
  
  // Filtros por fecha
  if (fecha) {
    const fechaInicioDia = new Date(fecha as string);
    const fechaFinDia = new Date(fechaInicioDia);
    fechaFinDia.setDate(fechaFinDia.getDate() + 1);
    filter.fecha = { $gte: fechaInicioDia, $lt: fechaFinDia };
  } else if (fechaDesde || fechaHasta) {
    filter.fecha = {};
    if (fechaDesde) {
      filter.fecha.$gte = new Date(fechaDesde as string);
    }
    if (fechaHasta) {
      const fechaFinFinal = new Date(fechaHasta as string);
      fechaFinFinal.setDate(fechaFinFinal.getDate() + 1);
      filter.fecha.$lt = fechaFinFinal;
    }
  }
  
  // Filtros por cliente, producto, lote, estado
  if (cliente) filter.cliente = cliente;
  if (producto) filter.producto = producto;
  if (lote) filter.lote = new RegExp(lote as string, 'i');
  if (estado) filter.estado = estado;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('cliente', 'nombre apellido correo')
      .populate('producto', 'nombre descripcion unidad')
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean(),
    Order.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / parseInt(limit as string));

  res.json({
    success: true,
    data: orders.map(order => {
      const mappedOrder: any = {
        ...order,
        id: order._id.toString()
      };
      
      // Si cliente está populado, agregar id
      if (order.cliente && typeof order.cliente === 'object' && (order.cliente as any)._id) {
        mappedOrder.cliente = {
          ...order.cliente,
          id: (order.cliente as any)._id.toString()
        };
      }
      
      // Si producto está populado, agregar id
      if (order.producto && typeof order.producto === 'object' && (order.producto as any)._id) {
        mappedOrder.producto = {
          ...order.producto,
          id: (order.producto as any)._id.toString()
        };
      }
      
      return mappedOrder;
    }),
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages
    },
    message: 'Órdenes obtenidas exitosamente'
  });
}));

// POST /api/orders - Crear nueva orden
router.post('/', 
  auth, 
  requirePermission('CREATE_USERS'), 
  activityLogger('CREATE_ORDER', 'ORDER'),
  asyncHandler(async (req: Request, res: Response) => {
    const { 
      fecha, 
      cliente, 
      producto, 
      lote, 
      cantidad, 
      precio,
      total,
      estado 
    } = req.body;

    // Validaciones básicas
    if (!cliente || !producto || !lote || !cantidad || precio === undefined || total === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Cliente, producto, lote, cantidad, precio y total son obligatorios'
      });
    }

    // Verificar que el cliente existe
    const clienteExiste = await Client.findById(cliente);
    if (!clienteExiste) {
      return res.status(400).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }

    // Verificar que el producto existe
    const productoExiste = await Product.findById(producto);
    if (!productoExiste) {
      return res.status(400).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    // Crear la orden
    const newOrder = new Order({
      fecha: fecha || new Date(),
      cliente,
      producto,
      lote,
      cantidad: parseFloat(cantidad),
      precio: parseFloat(precio),
      total: parseFloat(total),
      estado: estado || 'POR PAGAR'
    });

    const savedOrder = await newOrder.save();

    // Poblar las referencias para la respuesta
    await savedOrder.populate('cliente', 'nombre apellido correo');
    await savedOrder.populate('producto', 'nombre descripcion unidad');

    res.status(201).json({
      success: true,
      message: 'Orden creada exitosamente',
      data: {
        ...savedOrder.toObject(),
        id: (savedOrder._id as any).toString()
      }
    });
  })
);

// GET /api/orders/:id - Obtener orden por ID
router.get('/:id', 
  auth, 
  requirePermission('READ_USERS'),
  activityLogger('READ', 'ORDER'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de orden inválido'
      });
    }

    const order = await Order.findById(id)
      .populate('cliente', 'nombre apellido correo telefono direccion')
      .populate('producto', 'nombre descripcion unidad categoria');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada'
      });
    }

    res.json({
      success: true,
      data: {
        ...order.toObject(),
        id: (order._id as any).toString()
      },
      message: 'Orden obtenida exitosamente'
    });
  })
);

// PUT /api/orders/:id - Actualizar orden
router.put('/:id', 
  auth, 
  requirePermission('UPDATE_USERS'), 
  activityLogger('UPDATE_ORDER', 'ORDER'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { 
      fecha, 
      cliente, 
      producto, 
      lote, 
      cantidad, 
      precio,
      total,
      estado 
    } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de orden inválido'
      });
    }

    // Verificar que la orden existe
    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada'
      });
    }

    // Si se está cambiando el cliente, verificar que existe
    if (cliente && cliente !== existingOrder.cliente.toString()) {
      const clienteExiste = await Client.findById(cliente);
      if (!clienteExiste) {
        return res.status(400).json({
          success: false,
          error: 'Cliente no encontrado'
        });
      }
    }

    // Si se está cambiando el producto, verificar que existe
    if (producto && producto !== existingOrder.producto.toString()) {
      const productoExiste = await Product.findById(producto);
      if (!productoExiste) {
        return res.status(400).json({
          success: false,
          error: 'Producto no encontrado'
        });
      }
    }

    // Actualizar campos
    const updateData: any = {};
    if (fecha) updateData.fecha = fecha;
    if (cliente) updateData.cliente = cliente;
    if (producto) updateData.producto = producto;
    if (lote) updateData.lote = lote;
    if (cantidad !== undefined) updateData.cantidad = parseFloat(cantidad);
    if (precio !== undefined) updateData.precio = parseFloat(precio);
    if (total !== undefined) updateData.total = parseFloat(total);
    if (estado) updateData.estado = estado;

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('cliente', 'nombre apellido correo telefono direccion')
    .populate('producto', 'nombre descripcion unidad categoria');

    res.json({
      success: true,
      message: 'Orden actualizada exitosamente',
      data: {
        ...updatedOrder!.toObject(),
        id: (updatedOrder!._id as any).toString()
      }
    });
  })
);

// DELETE /api/orders/:id - Eliminar orden (soft delete)
router.delete('/:id', 
  auth, 
  requirePermission('DELETE_USERS'), 
  activityLogger('DELETE_ORDER', 'ORDER'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de orden inválido'
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada'
      });
    }

    // Soft delete: marcar como inactivo
    order.isActive = false;
    await order.save();

    res.json({
      success: true,
      message: 'Orden eliminada exitosamente'
    });
  })
);

// GET /api/orders/stats/summary - Estadísticas de órdenes
router.get('/stats/summary', 
  auth, 
  requirePermission('READ_USERS'),
  activityLogger('READ', 'ORDERS'),
  asyncHandler(async (req: Request, res: Response) => {
    // Total de órdenes
    const totalOrders = await Order.countDocuments();

    // Órdenes por estado
    const ordersByStatus = await Order.aggregate([
      {
        $group: {
          _id: '$estado',
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' }
        }
      }
    ]);

    // Total en ventas
    const totalSales = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$total' },
          averageOrder: { $avg: '$total' }
        }
      }
    ]);

    // Órdenes por mes (últimos 12 meses)
    const ordersByMonth = await Order.aggregate([
      {
        $match: {
          fecha: { 
            $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Último año
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$fecha' },
            month: { $month: '$fecha' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Productos más vendidos
    const topProducts = await Order.aggregate([
      {
        $group: {
          _id: '$producto',
          totalQuantity: { $sum: '$cantidad' },
          totalAmount: { $sum: '$total' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'producto'
        }
      },
      { $unwind: '$producto' }
    ]);

    res.json({
      success: true,
      data: {
        total: totalOrders,
        byStatus: ordersByStatus,
        sales: totalSales[0] || { totalAmount: 0, averageOrder: 0 },
        monthlyTrend: ordersByMonth,
        topProducts
      },
      message: 'Estadísticas obtenidas exitosamente'
    });
  })
);

export default router;