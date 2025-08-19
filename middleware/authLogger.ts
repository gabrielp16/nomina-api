import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';

/**
 * Middleware para logging de peticiones autenticadas
 * Útil para debuggear problemas de autenticación
 */
export const authLogger = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const method = req.method;
  const url = req.originalUrl;
  const authHeader = req.header('Authorization');
  const timestamp = new Date().toISOString();

  // Log información básica de la petición
  console.log(`[${timestamp}] ${method} ${url}`);
  
  if (authHeader) {
    const hasBearer = authHeader.startsWith('Bearer ');
    const tokenLength = authHeader.replace('Bearer ', '').length;
    
    console.log(`  📋 Auth Header: ${hasBearer ? '✅ Bearer' : '❌ No Bearer'}`);
    console.log(`  🔑 Token Length: ${tokenLength} chars`);
    
    if (tokenLength > 0) {
      const tokenPreview = authHeader.replace('Bearer ', '').substring(0, 20) + '...';
      console.log(`  👀 Token Preview: ${tokenPreview}`);
    }
  } else {
    console.log(`  ❌ No Authorization header`);
  }

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(body: any) {
    if (body.success === false) {
      console.log(`  ❌ Auth Error: ${body.message || 'Unknown error'}`);
      if (body.code) {
        console.log(`  🏷️  Error Code: ${body.code}`);
      }
    } else if (req.user) {
      console.log(`  ✅ Auth Success: User ${req.user._id} (${req.user.correo})`);
      console.log(`  🎭 Permissions: [${req.permissions?.join(', ') || 'none'}]`);
    }
    
    return originalJson.call(this, body);
  };

  next();
};
