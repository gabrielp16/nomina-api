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

// CORS configuration - SIMPLIFICADA PARA RESOLVER URGENTE
app.use(cors({
  origin: [
    'https://nomina-morchis.vercel.app',
    'https://nomina-morchis-git-main-gabrielp16s-projects.vercel.app',
    process.env.FRONTEND_URL || 'http://localhost:5174',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

// Middleware adicional para headers CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://nomina-morchis.vercel.app',
    'https://nomina-morchis-git-main-gabrielp16s-projects.vercel.app'
  ];
  
  if (origin && (allowedOrigins.includes(origin) || 
      (origin.includes('nomina-morchis') && origin.includes('vercel.app')))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Sistema Nómina API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV || 'development'
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
