import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import User from '../models/User.js';

export interface AuthRequest extends Request {
  user?: any;
  permissions?: string[];
}

export const auth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
      return;
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.',
        code: 'INVALID_TOKEN_FORMAT'
      });
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.',
          code: 'TOKEN_EXPIRED'
        });
        return;
      } else if (jwtError.name === 'JsonWebTokenError') {
        res.status(401).json({
          success: false,
          message: 'Invalid token. Please login again.',
          code: 'INVALID_TOKEN'
        });
        return;
      } else {
        res.status(401).json({
          success: false,
          message: 'Token verification failed.',
          code: 'TOKEN_ERROR'
        });
        return;
      }
    }
    
    const user = await User.findById(decoded.userId)
      .populate({
        path: 'role',
        populate: {
          path: 'permisos',
          model: 'Permission'
        }
      });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found. Please login again.',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        message: 'User account is deactivated.',
        code: 'USER_DEACTIVATED'
      });
      return;
    }

    // Extraer permisos del rol
    const role = user.role as any;
    const permissions = role?.permisos?.map((p: any) => p.nombre) || [];

    // Agregar permisos al objeto user para fácil acceso
    (user as any).permissions = permissions;

    req.user = user;
    req.permissions = permissions;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
      code: 'AUTH_SERVER_ERROR'
    });
  }
};

export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    if (!req.permissions?.includes(permission)) {
      res.status(403).json({
        success: false,
        message: `Permission '${permission}' required to access this resource.`,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredPermission: permission,
        userPermissions: req.permissions || []
      });
      return;
    }

    next();
  };
};

export const requireRole = (roleName: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    const user = await User.findById(req.user._id).populate('role');
    const role = user?.role as any;

    if (!role || role.nombre !== roleName) {
      res.status(403).json({
        success: false,
        message: `Role '${roleName}' required to access this resource.`,
        code: 'INSUFFICIENT_ROLE',
        requiredRole: roleName,
        userRole: role?.nombre || 'UNKNOWN'
      });
      return;
    }

    next();
  };
};
