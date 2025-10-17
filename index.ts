import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import roleRoutes from './routes/roles.js';
import permissionRoutes from './routes/permissions.js';
import activityRoutes from './routes/activity.js';
import dashboardRoutes from './routes/dashboard.js';
import employeeRoutes from './routes/employees.js';
import payrollRoutes from './routes/payroll.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { auth } from './middleware/auth.js';
import { authLogger } from './middleware/authLogger.js';

// Import database configuration
import { connectDB, disconnectDB } from './config/database.js';
import seedDatabase from './scripts/seed.js';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// Rate limiting - Configuración más permisiva para producción
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutos por defecto
const RATE_LIMIT_GENERAL = parseInt(process.env.RATE_LIMIT_MAX_GENERAL || (process.env.NODE_ENV === 'development' ? '1000' : '500'));

const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW, 
  max: RATE_LIMIT_GENERAL,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Función personalizada para identificar clientes (por IP + User-Agent)
  keyGenerator: (req) => {
    return req.ip + ':' + (req.get('User-Agent') || 'unknown');
  },
  
  // Función para saltar rate limiting en ciertos casos
  skip: (req) => {
    // Saltar rate limiting para health checks
    if (req.path === '/health' || req.path === '/cors-test') {
      return true;
    }
    
    // Saltar para requests desde localhost en desarrollo
    if (process.env.NODE_ENV === 'development' && 
        (req.ip === '::1' || req.ip === '127.0.0.1' || req.ip?.startsWith('192.168.'))) {
      return true;
    }
    
    return false;
  },
  
  // Handler personalizado para cuando se excede el límite
  handler: (req, res) => {
    console.log(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}, User-Agent: ${req.get('User-Agent')}`);
    res.status(429).json({
      success: false,
      error: 'Demasiadas peticiones desde esta IP. Por favor, intenta de nuevo en 15 minutos.',
      retryAfter: RATE_LIMIT_WINDOW / 1000, // seconds
      limit: RATE_LIMIT_GENERAL
    });
  }
});

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(morgan('combined'));
// Rate limiters específicos por tipo de endpoint
const RATE_LIMIT_AUTH = parseInt(process.env.RATE_LIMIT_MAX_AUTH || (process.env.NODE_ENV === 'development' ? '100' : '50'));
const RATE_LIMIT_API = parseInt(process.env.RATE_LIMIT_MAX_API || (process.env.NODE_ENV === 'development' ? '2000' : '1000'));

const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_AUTH, // Más restrictivo para auth
  message: {
    error: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_API, // Muy permisivo para API general
  message: {
    error: 'Demasiadas peticiones a la API. Intenta de nuevo en 15 minutos.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Saltar para endpoints de solo lectura frecuentes
    const readOnlyPaths = ['/health', '/cors-test', '/api/dashboard', '/api/employees', '/api/payroll'];
    return readOnlyPaths.some(path => req.path.startsWith(path));
  }
});

// Aplicar rate limiting general (muy permisivo)
app.use(limiter);

// CORS configuration para Railway y Vercel
const allowedOrigins = [
  'https://nomina-morchis.vercel.app',
  'https://nomina-morchis-git-main-gabrielp16s-projects.vercel.app',
  process.env.FRONTEND_URL || 'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174'
];

// Configurar CORS de forma robusta
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  console.log(`CORS Request - Origin: ${origin}, Method: ${req.method}, Path: ${req.path}`);
  
  // Permitir todos los subdominios de Vercel para nomina-morchis
  const isAllowedOrigin = !origin || // Permitir requests sin origin
    origin === 'https://nomina-morchis.vercel.app' ||
    (origin.includes('nomina-morchis') && origin.includes('vercel.app')) ||
    allowedOrigins.includes(origin);
  
  if (isAllowedOrigin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    console.log(`CORS Allowed - Origin: ${origin}`);
  } else {
    console.log(`CORS Blocked - Origin: ${origin}`);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Max-Age', '86400'); // 24 horas
  
  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`CORS Preflight - Origin: ${origin}, Path: ${req.path}`);
    res.status(200).end();
    return;
  }
  
  next();
});

// Usar cors middleware como backup
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Verificar si el origin está en la lista permitida o es un subdominio de Vercel
    if (allowedOrigins.includes(origin) || 
        (origin.includes('nomina-morchis') && origin.includes('vercel.app'))) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control', 'Pragma'],
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logging de CORS y Rate Limiting en producción
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    console.log(`Request Debug - IP: ${req.ip}, Origin: ${req.headers.origin}, Method: ${req.method}, URL: ${req.url}`);
    
    // Logging de headers de rate limiting en respuesta
    res.on('finish', () => {
      const rateLimitHeaders = {
        limit: res.getHeader('RateLimit-Limit'),
        remaining: res.getHeader('RateLimit-Remaining'),
        reset: res.getHeader('RateLimit-Reset')
      };
      
      if (rateLimitHeaders.limit) {
        console.log(`Rate Limit Info - Path: ${req.path}, Remaining: ${rateLimitHeaders.remaining}/${rateLimitHeaders.limit}`);
      }
    });
    
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Sistema Nómina API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV || 'development',
    corsOrigins: allowedOrigins
  });
});

// CORS test endpoint
app.get('/cors-test', (req, res) => {
  res.json({
    origin: req.headers.origin,
    allowedOrigins: allowedOrigins,
    corsHeaders: {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials'),
      'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers')
    }
  });
});

// Rate limiting status endpoint
app.get('/rate-limit-status', (req, res) => {
  res.json({
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    rateLimitHeaders: {
      limit: res.getHeader('RateLimit-Limit'),
      remaining: res.getHeader('RateLimit-Remaining'),
      reset: res.getHeader('RateLimit-Reset')
    },
    configuration: {
      environment: process.env.NODE_ENV,
      generalLimit: RATE_LIMIT_GENERAL,
      authLimit: RATE_LIMIT_AUTH,
      apiLimit: RATE_LIMIT_API,
      windowMs: RATE_LIMIT_WINDOW
    },
    timestamp: new Date().toISOString()
  });
});

// API Routes con rate limiting específico
app.use('/api/auth', authLimiter, authRoutes); // Más restrictivo para auth
app.use('/api/users', apiLimiter, authLogger, userRoutes);
app.use('/api/roles', apiLimiter, authLogger, roleRoutes);
app.use('/api/permissions', apiLimiter, authLogger, permissionRoutes);
app.use('/api/activity', apiLimiter, authLogger, activityRoutes);
app.use('/api/dashboard', authLogger, dashboardRoutes); // Sin rate limiting adicional
app.use('/api/employees', authLogger, employeeRoutes); // Sin rate limiting adicional  
app.use('/api/payroll', authLogger, payrollRoutes); // Sin rate limiting adicional

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  disconnectDB().then(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  disconnectDB().then(() => {
    process.exit(0);
  });
});

// Start server
const startServer = async (): Promise<void> => {
  try {
    await connectDB();
    
    // Run seeder in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('🌱 Running database seeder...');
      try {
        await seedDatabase(false); // false = no standalone, no cierra proceso
        console.log('✅ Database seeded successfully\n');
      } catch (seedError) {
        console.log('⚠️  Seeder warning:', seedError instanceof Error ? seedError.message : 'Unknown error');
      }
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🎯 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5174'}`);
      console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
};

startServer();

// Export the app for Vercel
export default app;
