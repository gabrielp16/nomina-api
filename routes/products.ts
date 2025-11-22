import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { body } from 'express-validator';
import Product from '../models/Product.js';
import { auth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/auth.js';
import { activityLogger } from '../middleware/activityLogger.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/products - Obtener todos los productos
router.get('/', 
  auth, 
  requirePermission('READ_USERS'),
  activityLogger('LIST_PRODUCTS', 'PRODUCTS'),
  asyncHandler(async (req: Request, res: Response) => {
    const { 
      page = 1, 
      limit = 50,
      search,
      categoria,
      activo
    } = req.query;

    // Construir filtros
    const filters: any = {};
    
    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      filters.$or = [
        { nombre: searchRegex },
        { descripcion: searchRegex },
        { categoria: searchRegex }
      ];
    }

    if (categoria) {
      filters.categoria = new RegExp(categoria as string, 'i');
    }

    if (activo !== undefined) {
      filters.activo = activo === 'true';
    }

    // Ejecutar consulta con paginación
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [products, total] = await Promise.all([
      Product.find(filters)
        .sort({ fechaCreacion: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Product.countDocuments(filters)
    ]);

    const totalPages = Math.ceil(total / parseInt(limit as string));

    res.json({
      success: true,
      data: products.map(product => ({
        ...product.toObject(),
        id: product._id.toString()
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages
      },
      message: 'Productos obtenidos exitosamente'
    });
  })
);

// GET /api/products/:id - Obtener producto por ID
router.get('/:id', 
  auth, 
  requirePermission('READ_USERS'),
  activityLogger('READ', 'PRODUCT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de producto inválido'
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        ...product.toObject(),
        id: product._id.toString()
      },
      message: 'Producto obtenido exitosamente'
    });
  })
);

// POST /api/products - Crear nuevo producto
router.post('/', 
  auth, 
  requirePermission('CREATE_USERS'),
  [
    body('nombre')
      .trim()
      .notEmpty()
      .withMessage('El nombre del producto es obligatorio')
      .isLength({ min: 2, max: 100 })
      .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('descripcion')
      .optional()
      .isLength({ max: 500 })
      .withMessage('La descripción no puede exceder 500 caracteres'),
    body('unidad')
      .notEmpty()
      .withMessage('La unidad de medida es obligatoria')
      .isIn(['KG', 'LT', 'UN', 'MT', 'M2', 'M3', 'LB', 'GAL', 'OZ', 'TON'])
      .withMessage('Unidad de medida inválida'),
    body('categoria')
      .optional()
      .isLength({ max: 50 })
      .withMessage('La categoría no puede exceder 50 caracteres'),
    body('precio')
      .optional()
      .isNumeric()
      .withMessage('El precio debe ser un número')
      .custom((value) => {
        if (value < 0) {
          throw new Error('El precio no puede ser negativo');
        }
        return true;
      }),
    body('stock')
      .optional()
      .isNumeric()
      .withMessage('El stock debe ser un número')
      .custom((value) => {
        if (value < 0) {
          throw new Error('El stock no puede ser negativo');
        }
        return true;
      })
  ],
  activityLogger('CREATE_PRODUCT', 'PRODUCT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { 
      nombre, 
      descripcion, 
      unidad,
      categoria, 
      precio, 
      stock 
    } = req.body;

    // Verificar si el producto ya existe
    const existingProduct = await Product.findOne({ 
      nombre: new RegExp(`^${nombre}$`, 'i')
    });
    
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un producto con ese nombre'
      });
    }

    const newProduct = new Product({
      nombre,
      descripcion,
      unidad,
      categoria,
      precio,
      stock
    });

    const savedProduct = await newProduct.save();

    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      data: {
        ...savedProduct.toObject(),
        id: savedProduct._id.toString()
      }
    });
  })
);

// PUT /api/products/:id - Actualizar producto
router.put('/:id', 
  auth, 
  requirePermission('UPDATE_USERS'),
  [
    body('nombre')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('descripcion')
      .optional()
      .isLength({ max: 500 })
      .withMessage('La descripción no puede exceder 500 caracteres'),
    body('unidad')
      .optional()
      .isIn(['KG', 'LT', 'UN', 'MT', 'M2', 'M3', 'LB', 'GAL', 'OZ', 'TON'])
      .withMessage('Unidad de medida inválida'),
    body('categoria')
      .optional()
      .isLength({ max: 50 })
      .withMessage('La categoría no puede exceder 50 caracteres'),
    body('precio')
      .optional()
      .isNumeric()
      .withMessage('El precio debe ser un número')
      .custom((value) => {
        if (value < 0) {
          throw new Error('El precio no puede ser negativo');
        }
        return true;
      }),
    body('stock')
      .optional()
      .isNumeric()
      .withMessage('El stock debe ser un número')
      .custom((value) => {
        if (value < 0) {
          throw new Error('El stock no puede ser negativo');
        }
        return true;
      })
  ],
  activityLogger('UPDATE_PRODUCT', 'PRODUCT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de producto inválido'
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    // Verificar si el nuevo nombre ya existe (si se está cambiando)
    if (req.body.nombre && req.body.nombre.toLowerCase() !== product.nombre.toLowerCase()) {
      const existingProduct = await Product.findOne({ 
        nombre: new RegExp(`^${req.body.nombre}$`, 'i')
      });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe un producto con ese nombre'
        });
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Producto actualizado exitosamente',
      data: {
        ...updatedProduct!.toObject(),
        id: updatedProduct!._id.toString()
      }
    });
  })
);

// DELETE /api/products/:id - Eliminar producto
router.delete('/:id', 
  auth, 
  requirePermission('DELETE_USERS'),
  activityLogger('DELETE_PRODUCT', 'PRODUCT'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de producto inválido'
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    await Product.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Producto eliminado exitosamente'
    });
  })
);

export default router;