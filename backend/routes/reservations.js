const express = require('express');
const router = express.Router();
const reserveController = require('../controllers/reserveController');
const { authenticateToken } = require('../middleware/auth');

router.post('/reserve', authenticateToken, reserveController.reserveBook);
router.get('/reservations', authenticateToken, reserveController.getReservations);
router.delete('/reservations/:id', authenticateToken, reserveController.cancelReservation);

module.exports = router;
