const db = require('../db');

// Periodically check and cancel reservations older than 12 hours
const checkAndCancelExpiredReservations = async () => {
  const conn = await db.getPool().getConnection();
  try {
    await conn.beginTransaction();

    // Find reservations older than 12 hours
    const [expired] = await conn.query(
      'SELECT id, book_id FROM reservations WHERE reservation_date < DATE_SUB(NOW(), INTERVAL 12 HOUR)'
    );

    if (expired.length > 0) {
      console.log(`Found ${expired.length} expired reservations. Cancelling them...`);
      for (const res of expired) {
        // Increment book availability
        await conn.query('UPDATE books SET available = available + 1 WHERE id = ?', [res.book_id]);
        // Delete reservation
        await conn.query('DELETE FROM reservations WHERE id = ?', [res.id]);
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error('Error in checkAndCancelExpiredReservations:', err);
  } finally {
    conn.release();
  }
};

exports.checkAndCancelExpiredReservations = checkAndCancelExpiredReservations;

exports.reserveBook = async (req, res) => {
  try {
    const { bookId } = req.body;
    const userId = req.user.id;

    if (!bookId) {
      return res.status(400).json({ error: 'bookId is required' });
    }

    // Run expiration check before processing new reservation
    await checkAndCancelExpiredReservations();

    const conn = await db.getPool().getConnection();
    try {
      await conn.beginTransaction();

      // 1. Check if the book exists and lock row for update
      const [books] = await conn.query('SELECT available FROM books WHERE id = ? FOR UPDATE', [bookId]);
      if (books.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'Book not found' });
      }

      const book = books[0];
      
      // Enforce that reservations are only for books that are currently available (> 0)
      if (book.available <= 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Book is currently out of stock (no available units to reserve).' });
      }

      // 2. Check if student already has a pending reservation for this book
      const [existingRes] = await conn.query(
        'SELECT id FROM reservations WHERE user_id = ? AND book_id = ?',
        [userId, bookId]
      );
      if (existingRes.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'You have already reserved this book' });
      }

      // 3. Check if student currently has this book borrowed and unreturned
      const [activeBorrow] = await conn.query(
        'SELECT id FROM transactions WHERE user_id = ? AND book_id = ? AND return_date IS NULL',
        [userId, bookId]
      );
      if (activeBorrow.length > 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'You currently have this book borrowed. Return it before reserving it again.' });
      }

      // 4. Enforce max 3 active reservations limit
      const [userRes] = await conn.query(
        'SELECT COUNT(*) as count FROM reservations WHERE user_id = ?',
        [userId]
      );
      if (userRes[0].count >= 3) {
        await conn.rollback();
        return res.status(400).json({ error: 'You cannot have more than 3 active reservations at a time.' });
      }

      // 5. Create reservation using MySQL NOW() for precision
      const [result] = await conn.query(
        'INSERT INTO reservations (user_id, book_id, reservation_date) VALUES (?, ?, NOW())',
        [userId, bookId]
      );

      // 6. Lock the book: Decrement available units
      await conn.query('UPDATE books SET available = available - 1 WHERE id = ?', [bookId]);

      await conn.commit();

      res.status(201).json({
        message: 'Book reserved successfully',
        reservationId: result.insertId,
        reservationDate: new Date().toISOString()
      });
    } catch (txError) {
      await conn.rollback();
      throw txError;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error reserving book:', error);
    res.status(500).json({ error: 'Internal server error reserving book' });
  }
};

exports.getReservations = async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? null : req.user.id;

    // Run expiration check to ensure accurate view
    await checkAndCancelExpiredReservations();

    let query = `
      SELECT r.id, r.reservation_date, r.book_id,
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

    // Run expiration check first
    await checkAndCancelExpiredReservations();

    const conn = await db.getPool().getConnection();
    try {
      await conn.beginTransaction();

      // Fetch the reservation
      const [reservations] = await conn.query(
        'SELECT user_id, book_id FROM reservations WHERE id = ? FOR UPDATE',
        [id]
      );
      if (reservations.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'Reservation not found' });
      }

      const reservation = reservations[0];

      // Students can only cancel their own reservations. Admins can cancel any.
      if (userRole !== 'admin' && reservation.user_id !== userId) {
        await conn.rollback();
        return res.status(403).json({ error: 'Forbidden: You can only cancel your own reservations' });
      }

      // Delete reservation
      await conn.query('DELETE FROM reservations WHERE id = ?', [id]);

      // Release the lock: Increment available units
      await conn.query('UPDATE books SET available = available + 1 WHERE id = ?', [reservation.book_id]);

      await conn.commit();
      res.json({ message: 'Reservation cancelled successfully' });
    } catch (txError) {
      await conn.rollback();
      throw txError;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    res.status(500).json({ error: 'Internal server error cancelling reservation' });
  }
};
