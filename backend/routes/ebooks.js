const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  uploadEbook,
  listEbooks,
  deleteEbook,
  updateEbook,
  askQuestion,
  getAnswerHistory,
  deleteHistoryEntry,
  clearAllHistory,
  getHistoryAnalytics,
  viewEbookPdf,
  downloadEbookPdf
} = require('../controllers/ebookController');

// ── Multer Storage Config ────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads/ebooks');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${ts}_${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'), false);
    }
  }
});

// ── Routes ───────────────────────────────────────────────────────────────────

// Admin: Upload a PDF textbook
router.post('/upload', authenticateToken, requireRole('admin'), upload.single('pdf'), uploadEbook);

// All authenticated: List ebooks
router.get('/', authenticateToken, listEbooks);

// All authenticated: View PDF file inline
router.get('/:id/view', authenticateToken, viewEbookPdf);

// All authenticated: Download PDF file (if permitted)
router.get('/:id/download', authenticateToken, downloadEbookPdf);

// Admin: Delete an ebook
router.delete('/:id', authenticateToken, requireRole('admin'), deleteEbook);

// Admin: Update ebook metadata
router.patch('/:id', authenticateToken, requireRole('admin'), updateEbook);

// Student: Generate answer
router.post('/ask', authenticateToken, askQuestion);

// Student: Get answer history analytics
router.get('/analytics', authenticateToken, getHistoryAnalytics);

// Student: Get/Filter answer history
router.get('/history', authenticateToken, getAnswerHistory);

// Student: Delete a history entry
router.delete('/history/:id', authenticateToken, deleteHistoryEntry);

// Student: Clear entire history
router.delete('/history', authenticateToken, clearAllHistory);

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
