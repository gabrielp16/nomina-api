const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Backend server is running!',
    timestamp: new Date().toISOString()
  });
});

// Test auth routes
app.post('/api/auth/login', (req, res) => {
  console.log('Login request received:', req.body);
  res.json({
    success: true,
    message: 'Login endpoint working',
    data: {
      user: {
        id: '1',
        email: req.body.correo || req.body.email,
        name: 'Test User',
        permissions: ['READ_USERS'],
        role: 'USER'
      },
      token: 'test-jwt-token-123'
    }
  });
});

app.post('/api/auth/register', (req, res) => {
  console.log('Register request received:', req.body);
  res.json({
    success: true,
    message: 'Register endpoint working',
    data: {
      user: {
        id: '2',
        email: req.body.correo,
        name: `${req.body.nombre} ${req.body.apellido}`,
        permissions: ['READ_USERS'],
        role: 'USER'
      },
      token: 'test-jwt-token-456'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📋 API endpoints available:`);
  console.log(`   GET  / - Health check`);
  console.log(`   POST /api/auth/login - Login test`);
  console.log(`   POST /api/auth/register - Register test`);
});
