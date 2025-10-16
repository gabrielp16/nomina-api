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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Higher limit in development
  message: 'Too many requests from this IP, please try again later.',
});

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(morgan('combined'));
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

// Middleware para logging de CORS en producción
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    console.log(`CORS Debug - Origin: ${req.headers.origin}, Method: ${req.method}, URL: ${req.url}`);
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authLogger, userRoutes);
app.use('/api/roles', authLogger, roleRoutes);
app.use('/api/permissions', authLogger, permissionRoutes);
app.use('/api/activity', authLogger, activityRoutes);
app.use('/api/dashboard', authLogger, dashboardRoutes);
app.use('/api/employees', authLogger, employeeRoutes);
app.use('/api/payroll', authLogger, payrollRoutes);

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
