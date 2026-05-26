const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', authenticateToken, bookController.getAllBooks);
router.post('/', authenticateToken, requireRole('admin'), bookController.addBook);
router.put('/:id', authenticateToken, requireRole('admin'), bookController.updateBook);
router.delete('/:id', authenticateToken, requireRole('admin'), bookController.deleteBook);

module.exports = router;
