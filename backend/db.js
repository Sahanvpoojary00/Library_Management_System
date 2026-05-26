const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

let pool;

async function initDB() {
  try {
    // 1. Connection without DB selected to ensure database exists
    const tempConnection = await mysql.createConnection(dbConfig);
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'library_management_system'}\``);
    await tempConnection.end();

    // 2. Initialize connection pool with DB selected
    pool = mysql.createPool({
      ...dbConfig,
      database: process.env.DB_NAME || 'library_management_system',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('Database pool initialized successfully.');

    // 3. Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS books (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        quantity INT NOT NULL,
        available INT NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        book_id INT NOT NULL,
        issue_date DATE NOT NULL,
        due_date DATE NOT NULL,
        return_date DATE NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        book_id INT NOT NULL,
        reservation_date DATE NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      )
    `);

    // 4. Seed default admin and student if users table is empty
    const [users] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (users[0].count === 0) {
      console.log('Seeding default users...');
      const adminPass = await bcrypt.hash('admin123', 10);
      const studentPass = await bcrypt.hash('student123', 10);

      await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['System Admin', 'admin@library.com', adminPass, 'admin']
      );
      await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Demo Student', 'student@library.com', studentPass, 'student']
      );
      console.log('Users seeded: admin@library.com / admin123 and student@library.com / student123');
    }

    // 5. Seed default books if books table is empty
    const [books] = await pool.query('SELECT COUNT(*) as count FROM books');
    if (books[0].count === 0) {
      console.log('Seeding default books...');
      const defaultBooks = [
        ['The Great Gatsby', 'F. Scott Fitzgerald', 'Fiction', 5, 5],
        ['To Kill a Mockingbird', 'Harper Lee', 'Fiction', 3, 3],
        ['1984', 'George Orwell', 'Dystopian', 4, 4],
        ['Clean Code', 'Robert C. Martin', 'Computer Science', 2, 2],
        ['Introduction to Algorithms', 'Thomas H. Cormen', 'Computer Science', 3, 3]
      ];
      for (const book of defaultBooks) {
        await pool.query(
          'INSERT INTO books (title, author, category, quantity, available) VALUES (?, ?, ?, ?, ?)',
          book
        );
      }
      console.log('Default books seeded successfully.');
    }
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

module.exports = {
  initDB,
  query: (sql, params) => pool.query(sql, params),
  getPool: () => pool
};
