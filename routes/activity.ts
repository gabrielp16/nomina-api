import express from 'express';
import { Activity } from '../models/Activity.js';
import { auth, requirePermission } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/activity - Obtener todas las actividades con paginación
router.get('/', auth, requirePermission('READ_ACTIVITY'), async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    // Construir query de búsqueda
    let query: any = {};
    if (search) {
      query = {
        $or: [
          { userName: { $regex: search, $options: 'i' } },
          { userEmail: { $regex: search, $options: 'i' } },
          { action: { $regex: search, $options: 'i' } },
          { resource: { $regex: search, $options: 'i' } },
          { details: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Obtener actividades con paginación
    const [activities, total] = await Promise.all([
      Activity.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      Activity.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        data: activities,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// GET /api/activity/:id - Obtener una actividad específica
router.get('/:id', auth, requirePermission('READ_ACTIVITY'), async (req: AuthRequest, res) => {
  try {
    const activity = await Activity.findById(req.params.id);
    
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Actividad no encontrada'
      });
    }

    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// GET /api/activity/user/:userId - Obtener actividades de un usuario específico
router.get('/user/:userId', auth, requirePermission('READ_ACTIVITY'), async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      Activity.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      Activity.countDocuments({ userId })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        data: activities,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user activities:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// POST /api/activity - Crear una nueva actividad (solo para el sistema)
router.post('/', auth, requirePermission('MANAGE_ALL'), async (req: AuthRequest, res) => {
  try {
    const activityData = req.body;
    const activity = await Activity.logActivity(activityData);

    res.status(201).json({
      success: true,
      data: activity,
      message: 'Actividad registrada correctamente'
    });
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// DELETE /api/activity/:id - Eliminar una actividad (solo administradores)
router.delete('/:id', auth, requirePermission('MANAGE_ALL'), async (req: AuthRequest, res) => {
  try {
    const activity = await Activity.findByIdAndDelete(req.params.id);
    
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Actividad no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Actividad eliminada correctamente'
    });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

export default router;
