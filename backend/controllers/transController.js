const db = require('../db');
const { checkAndCancelExpiredReservations } = require('./reserveController');

exports.issueBook = async (req, res) => {
  try {
    const { studentEmail, bookId, daysToReturn } = req.body;

    if (!studentEmail || !bookId) {
      return res.status(400).json({ error: 'studentEmail and bookId are required' });
    }

    // Run expiration check before issuing
    await checkAndCancelExpiredReservations();

    // 1. Find user by email
    const [users] = await db.query('SELECT id, role FROM users WHERE email = ?', [studentEmail]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Student with this email does not exist' });
    }

    const student = users[0];
    if (student.role !== 'student') {
      return res.status(400).json({ error: 'Cannot issue a book to an administrator' });
    }

    // 2. Check if student already has this book checked out
    const [active] = await db.query(
      'SELECT id FROM transactions WHERE user_id = ? AND book_id = ? AND return_date IS NULL',
      [student.id, bookId]
    );
    if (active.length > 0) {
      return res.status(409).json({ error: 'This student has already borrowed this book and not returned it yet' });
    }

    // 3. Calculate dates
    const issueDate = new Date();
    const durationDays = parseInt(daysToReturn, 10) || 14;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + durationDays);

    // Formats for MySQL: YYYY-MM-DD
    const issueDateStr = issueDate.toISOString().slice(0, 10);
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    // 4. Update book availability and insert transaction (atomic transaction)
    const conn = await db.getPool().getConnection();
    try {
      await conn.beginTransaction();

      // Check if student has a valid reservation for this book
      const [reserves] = await conn.query(
        'SELECT id FROM reservations WHERE user_id = ? AND book_id = ?',
        [student.id, bookId]
      );
      const hasReservation = reserves.length > 0;

      // Lock book row
      const [books] = await conn.query('SELECT available, quantity FROM books WHERE id = ? FOR UPDATE', [bookId]);
      if (books.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'Book not found' });
      }

      const book = books[0];

      // If student doesn't have reservation, check standard availability
      if (!hasReservation && book.available <= 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Book is currently out of stock (no available units)' });
      }

      // Decrement available units ONLY if the student did not reserve the book
      // (If they reserved it, the availability was already decremented during reservation)
      if (!hasReservation) {
        await conn.query('UPDATE books SET available = available - 1 WHERE id = ?', [bookId]);
      }

      // Create transaction record
      const [transResult] = await conn.query(
        'INSERT INTO transactions (user_id, book_id, issue_date, due_date) VALUES (?, ?, ?, ?)',
        [student.id, bookId, issueDateStr, dueDateStr]
      );

      // Delete user's reservation for this book if one exists (since they have now borrowed it)
      if (hasReservation) {
        await conn.query('DELETE FROM reservations WHERE user_id = ? AND book_id = ?', [student.id, bookId]);
      }

      await conn.commit();

      res.status(201).json({
        message: 'Book issued successfully',
        transactionId: transResult.insertId,
        issueDate: issueDateStr,
        dueDate: dueDateStr
      });
    } catch (txError) {
      await conn.rollback();
      throw txError;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error issuing book:', error);
    res.status(500).json({ error: 'Internal server error issuing book' });
  }
};

exports.returnBook = async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'transactionId is required' });
    }

    // 1. Find the transaction
    const [transactions] = await db.query('SELECT * FROM transactions WHERE id = ?', [transactionId]);
    if (transactions.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const transaction = transactions[0];
    if (transaction.return_date) {
      return res.status(400).json({ error: 'This book has already been returned' });
    }

    // 2. Perform Return operation
    const returnDateStr = new Date().toISOString().slice(0, 10);

    const conn = await db.getPool().getConnection();
    try {
      await conn.beginTransaction();

      // Set return date
      await conn.query('UPDATE transactions SET return_date = ? WHERE id = ?', [returnDateStr, transactionId]);

      // Increment availability of book
      await conn.query('UPDATE books SET available = available + 1 WHERE id = ?', [transaction.book_id]);

      await conn.commit();
      res.json({
        message: 'Book returned successfully',
        returnDate: returnDateStr
      });
    } catch (txError) {
      await conn.rollback();
      throw txError;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error returning book:', error);
    res.status(500).json({ error: 'Internal server error returning book' });
  }
};

exports.getBorrowHistory = async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? null : req.user.id;

    let query = `
      SELECT t.id, t.issue_date, t.due_date, t.return_date, 
             b.title as book_title, b.author as book_author, b.category as book_category,
             u.name as student_name, u.email as student_email
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      JOIN users u ON t.user_id = u.id
    `;
    let params = [];

    if (userId) {
      query += ' WHERE t.user_id = ? ORDER BY t.issue_date DESC';
      params = [userId];
    } else {
      query += ' ORDER BY t.issue_date DESC';
    }

    const [history] = await db.query(query, params);
    res.json(history);
  } catch (error) {
    console.error('Error fetching borrow history:', error);
    res.status(500).json({ error: 'Internal server error fetching history' });
  }
};

exports.getActiveTransactions = async (req, res) => {
  try {
    const query = `
      SELECT t.id, t.issue_date, t.due_date, 
             b.id as book_id, b.title as book_title, b.author as book_author,
             u.name as student_name, u.email as student_email
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      JOIN users u ON t.user_id = u.id
      WHERE t.return_date IS NULL
      ORDER BY t.due_date ASC
    `;
    const [active] = await db.query(query);
    res.json(active);
  } catch (error) {
    console.error('Error fetching active transactions:', error);
    res.status(500).json({ error: 'Internal server error fetching active transactions' });
  }
};
