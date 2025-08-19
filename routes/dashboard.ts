import express from 'express';
import User from '../models/User.js';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import { Activity } from '../models/Activity.js';
import { auth, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/dashboard/stats - Obtener estadísticas del dashboard
router.get('/stats', auth, requirePermission('READ_DASHBOARD'), async (req, res) => {
  try {
    // Ejecutar todas las consultas en paralelo para mejor rendimiento
    const [
      totalUsers,
      activeUsers,
      totalRoles,
      totalPermissions,
      totalActivities,
      recentActivities
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ activo: true }),
      Role.countDocuments(),
      Permission.countDocuments(),
      Activity.countDocuments(),
      Activity.countDocuments({
        timestamp: {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers
        },
        roles: {
          total: totalRoles
        },
        permissions: {
          total: totalPermissions
        },
        activities: {
          total: totalActivities,
          recent: recentActivities
        }
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/dashboard/recent-activities - Obtener actividades recientes
router.get('/recent-activities', auth, requirePermission('READ_AUDIT'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    const activities = await Activity.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('userName action resource details timestamp status')
      .lean();

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

export default router;
