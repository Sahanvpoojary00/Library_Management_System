const express = require('express');
const router = express.Router();
const transController = require('../controllers/transController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post('/issue', authenticateToken, requireRole('admin'), transController.issueBook);
router.post('/return', authenticateToken, requireRole('admin'), transController.returnBook);
router.get('/history', authenticateToken, transController.getBorrowHistory);
router.get('/active', authenticateToken, requireRole('admin'), transController.getActiveTransactions);

module.exports = router;
