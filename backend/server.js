const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db');
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const transRoutes = require('./routes/transactions');
const reserveRoutes = require('./routes/reservations');
const ebookRoutes = require('./routes/ebooks');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded ebooks (PDF files) — must come before API routes
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api', transRoutes);
app.use('/api', reserveRoutes);
app.use('/api/ebooks', ebookRoutes);

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Initialize DB and start server
async function startServer() {
  try {
    await db.initDB();

    // Start periodic background cleanup of expired reservations (every 1 minute)
    const { checkAndCancelExpiredReservations } = require('./controllers/reserveController');
    setInterval(async () => {
      try {
        await checkAndCancelExpiredReservations();
      } catch (err) {
        console.error('Error running periodic reservation cleanup:', err);
      }
    }, 60000);

    app.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(`ScholarSync - Smart Library & Academic Assistant Server running!`);
      console.log(`Local Access: http://localhost:${PORT}`);
      console.log(`Gemini Model Configured: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}`);
      console.log(`==================================================`);
    });
  } catch (error) {
    console.error('Failed to start server due to database initialization failure:', error);
    process.exit(1);
  }
}

startServer();
