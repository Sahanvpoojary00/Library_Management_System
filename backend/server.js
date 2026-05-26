const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db');
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const transRoutes = require('./routes/transactions');
const reserveRoutes = require('./routes/reservations');

const app = express();
const PORT = process.env.PORT || 3000;

// Dynamic CORS configurations supporting Vercel domain list
const corsOptions = {
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*',
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api', transRoutes);
app.use('/api', reserveRoutes);

// Conditional Static Files Serving (Local vs Production Health Check)
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '../frontend')));
  
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });
} else {
  // Service health check route for Render deploys
  app.get('/', (req, res) => {
    res.status(200).json({ 
      status: 'healthy', 
      message: 'Smart Library System Backend API is online.',
      timestamp: new Date()
    });
  });
}

// Initialize DB and start server
async function startServer() {
  try {
    await db.initDB();
    app.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(`Smart Library Management System Server running!`);
      console.log(`Local Access: http://localhost:${PORT}`);
      console.log(`==================================================`);
    });
  } catch (error) {
    console.error('Failed to start server due to database initialization failure:', error);
    process.exit(1);
  }
}

startServer();
