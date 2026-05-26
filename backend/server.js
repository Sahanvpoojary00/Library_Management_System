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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api', transRoutes);
app.use('/api', reserveRoutes);

// Fallback to index.html for single-page style routing if accessed directly
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

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
