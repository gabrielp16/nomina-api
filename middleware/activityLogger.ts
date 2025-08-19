import type { Request, Response, NextFunction } from 'express';
import { Activity } from '../models/Activity.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    nombre: string;
    apellido: string;
    correo: string;
    name?: string;
    email?: string;
  };
}

// Middleware para registrar actividades automáticamente
export const activityLogger = (action: string, resource: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(body: any) {
      // Solo registrar actividades si la operación fue exitosa
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        setImmediate(async () => {
          try {
            let details = `${action} en ${resource}`;
            let status: 'success' | 'warning' | 'error' = 'success';
            
            // Extraer información adicional basada en el método y ruta
            if (req.method === 'POST' && body) {
              const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
              if (parsedBody.data && parsedBody.data.nombre && parsedBody.data.apellido) {
                details += `: ${parsedBody.data.nombre} ${parsedBody.data.apellido}`;
              } else if (parsedBody.data && parsedBody.data.correo) {
                details += `: ${parsedBody.data.correo}`;
              } else if (parsedBody.data && parsedBody.data.email) {
                details += `: ${parsedBody.data.email}`;
              } else if (parsedBody.data && parsedBody.data.name) {
                details += `: ${parsedBody.data.name}`;
              }
            }
            
            if (req.method === 'PUT' && req.params.id) {
              details += ` con ID: ${req.params.id}`;
            }
            
            if (req.method === 'PATCH' && req.params.id) {
              details += ` con ID: ${req.params.id}`;
            }
            
            if (req.method === 'DELETE') {
              details += ` con ID: ${req.params.id}`;
            }
            
            // Determinar estado basado en la acción
            if (action.includes('DELETE')) {
              status = 'warning';
            }
            
            // Solo registrar si hay usuario autenticado
            if (!req.user) return;
            
            await Activity.logActivity({
              userId: req.user.id,
              userName: req.user.name || `${req.user.nombre} ${req.user.apellido}`,
              userEmail: req.user.email || req.user.correo,
              action,
              resource,
              resourceId: req.params.id || undefined,
              details,
              ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
              userAgent: req.get('User-Agent') || 'unknown',
              status
            });
          } catch (error) {
            console.error('Error logging activity:', error);
          }
        });
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  };
};

// Función para registrar actividades de autenticación
export const logAuthActivity = async (
  userId: string,
  userName: string,
  userEmail: string,
  action:
    | 'LOGIN'
    | 'LOGOUT'
    | 'FAILED_LOGIN'
    | 'REGISTER'
    | 'CREATE_USERS'
    | 'UPDATE_USERS'
    | 'DELETE_USERS',
  req: Request,
  status: 'success' | 'warning' | 'error' = 'success'
) => {
  try {
    let details = '';
    switch (action) {
      case 'LOGIN':
        details = 'Usuario inició sesión correctamente';
        break;
      case 'LOGOUT':
        details = 'Usuario cerró sesión';
        break;
      case 'FAILED_LOGIN':
        details = 'Intento de login fallido - credenciales incorrectas';
        status = 'error';
        break;
      case 'REGISTER':
        details = 'Nuevo usuario registrado en el sistema';
        break;
      case 'CREATE_USERS':
        details = 'Nuevo usuario creado en el sistema';
        break;
      case 'UPDATE_USERS':
        details = 'Usuario actualizado en el sistema';
        break;
      case 'DELETE_USERS':
        details = 'Usuario eliminado del sistema';
        break;
    }
    
    await Activity.logActivity({
      userId,
      userName,
      userEmail,
      action,
      resource: 'AUTHENTICATION',
      details,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      status
    });
  } catch (error) {
    console.error('Error logging auth activity:', error);
  }
};
