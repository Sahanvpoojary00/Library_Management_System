const db = require('../db');

exports.reserveBook = async (req, res) => {
  try {
    const { bookId } = req.body;
    const userId = req.user.id;

    if (!bookId) {
      return res.status(400).json({ error: 'bookId is required' });
    }

    // 1. Check if the book exists
    const [books] = await db.query('SELECT available FROM books WHERE id = ?', [bookId]);
    if (books.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const book = books[0];
    // Enforce that reservations are only for books that have 0 availability
    if (book.available > 0) {
      return res.status(400).json({ error: 'Book is currently available. Please visit the library to borrow it directly.' });
    }

    // 2. Check if student already has a pending reservation for this book
    const [existingRes] = await db.query(
      'SELECT id FROM reservations WHERE user_id = ? AND book_id = ?',
      [userId, bookId]
    );
    if (existingRes.length > 0) {
      return res.status(409).json({ error: 'You have already reserved this book' });
    }

    // 3. Check if student currently has this book borrowed and unreturned
    const [activeBorrow] = await db.query(
      'SELECT id FROM transactions WHERE user_id = ? AND book_id = ? AND return_date IS NULL',
      [userId, bookId]
    );
    if (activeBorrow.length > 0) {
      return res.status(400).json({ error: 'You currently have this book borrowed. Return it before reserving it again.' });
    }

    // 4. Create reservation
    const reservationDateStr = new Date().toISOString().slice(0, 10);
    const [result] = await db.query(
      'INSERT INTO reservations (user_id, book_id, reservation_date) VALUES (?, ?, ?)',
      [userId, bookId, reservationDateStr]
    );

    res.status(201).json({
      message: 'Book reserved successfully',
      reservationId: result.insertId,
      reservationDate: reservationDateStr
    });
  } catch (error) {
    console.error('Error reserving book:', error);
    res.status(500).json({ error: 'Internal server error reserving book' });
  }
};

exports.getReservations = async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? null : req.user.id;

    let query = `
      SELECT r.id, r.reservation_date, 
             b.title as book_title, b.author as book_author, b.category as book_category, b.available as book_available,
             u.name as student_name, u.email as student_email
      FROM reservations r
      JOIN books b ON r.book_id = b.id
      JOIN users u ON r.user_id = u.id
    `;
    let params = [];

    if (userId) {
      query += ' WHERE r.user_id = ? ORDER BY r.reservation_date DESC';
      params = [userId];
    } else {
      query += ' ORDER BY r.reservation_date DESC';
    }

    const [reservations] = await db.query(query, params);
    res.json(reservations);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ error: 'Internal server error fetching reservations' });
  }
};

exports.cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch the reservation
    const [reservations] = await db.query('SELECT user_id FROM reservations WHERE id = ?', [id]);
    if (reservations.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const reservation = reservations[0];

    // Students can only cancel their own reservations. Admins can cancel any.
    if (userRole !== 'admin' && reservation.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: You can only cancel your own reservations' });
    }

    await db.query('DELETE FROM reservations WHERE id = ?', [id]);
    res.json({ message: 'Reservation cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    res.status(500).json({ error: 'Internal server error cancelling reservation' });
  }
};
