const db = require('../db');

exports.getAllBooks = async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM books';
    let params = [];

    if (search) {
      query += ' WHERE title LIKE ? OR author LIKE ? OR category LIKE ?';
      const searchWildcard = `%${search}%`;
      params = [searchWildcard, searchWildcard, searchWildcard];
    }

    const [books] = await db.query(query, params);
    res.json(books);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Internal server error fetching books' });
  }
};

exports.addBook = async (req, res) => {
  try {
    const { title, author, category, quantity } = req.body;

    if (!title || !author || !category || quantity === undefined) {
      return res.status(400).json({ error: 'All fields (title, author, category, quantity) are required' });
    }

    const numQty = parseInt(quantity, 10);
    if (isNaN(numQty) || numQty < 0) {
      return res.status(400).json({ error: 'Quantity must be a non-negative number' });
    }

    const [result] = await db.query(
      'INSERT INTO books (title, author, category, quantity, available) VALUES (?, ?, ?, ?, ?)',
      [title, author, category, numQty, numQty]
    );

    res.status(201).json({
      message: 'Book added successfully',
      bookId: result.insertId,
      book: { id: result.insertId, title, author, category, quantity: numQty, available: numQty }
    });
  } catch (error) {
    console.error('Error adding book:', error);
    res.status(500).json({ error: 'Internal server error adding book' });
  }
};

exports.updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, category, quantity, available } = req.body;

    if (!title || !author || !category || quantity === undefined || available === undefined) {
      return res.status(400).json({ error: 'All fields (title, author, category, quantity, available) are required' });
    }

    const numQty = parseInt(quantity, 10);
    const numAvail = parseInt(available, 10);

    if (isNaN(numQty) || numQty < 0 || isNaN(numAvail) || numAvail < 0) {
      return res.status(400).json({ error: 'Quantity and Availability must be non-negative numbers' });
    }

    if (numAvail > numQty) {
      return res.status(400).json({ error: 'Available count cannot exceed total quantity' });
    }

    const [existing] = await db.query('SELECT id FROM books WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    await db.query(
      'UPDATE books SET title = ?, author = ?, category = ?, quantity = ?, available = ? WHERE id = ?',
      [title, author, category, numQty, numAvail, id]
    );

    res.json({
      message: 'Book updated successfully',
      book: { id, title, author, category, quantity: numQty, available: numAvail }
    });
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).json({ error: 'Internal server error updating book' });
  }
};

exports.deleteBook = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query('SELECT id FROM books WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    await db.query('DELETE FROM books WHERE id = ?', [id]);
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ error: 'Internal server error deleting book' });
  }
};
