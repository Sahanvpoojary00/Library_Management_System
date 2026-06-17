const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'library_management';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || ''
};

let pool;

async function initDB() {
  try {
    // 1. Create database if it doesn't exist
    try {
      const tempConnection = await mysql.createConnection(dbConfig);
      await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
      await tempConnection.end();
      console.log(`Database "${DB_NAME}" ready.`);
    } catch (err) {
      console.error('Could not create database. Is XAMPP MySQL running?', err.message);
      throw err;
    }

    // 2. Initialize connection pool
    pool = mysql.createPool({
      ...dbConfig,
      database: DB_NAME,
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
        INDEX idx_trans_user (user_id),
        INDEX idx_trans_book (book_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        book_id INT NOT NULL,
        reservation_date DATETIME NOT NULL,
        INDEX idx_res_user (user_id),
        INDEX idx_res_book (book_id)
      )
    `);

    // Ensure reservation_date is DATETIME in case table already existed with DATE type
    try {
      await pool.query('ALTER TABLE reservations MODIFY COLUMN reservation_date DATETIME NOT NULL');
    } catch (err) {
      console.log('Skipping column alteration or failed:', err.message);
    }

    // Ensure allow_download exists in ebooks and academic_resources
    try {
      await pool.query('ALTER TABLE ebooks ADD COLUMN allow_download TINYINT(1) NOT NULL DEFAULT 1');
    } catch (err) {
      // ignore
    }
    try {
      await pool.query('ALTER TABLE academic_resources ADD COLUMN allow_download TINYINT(1) NOT NULL DEFAULT 1');
    } catch (err) {
      // ignore
    }

    // ── Smart Library & Academic Assistant Tables ─────────────────────────────

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ebooks (
        id             INT PRIMARY KEY AUTO_INCREMENT,
        title          VARCHAR(255) NOT NULL,
        subject        VARCHAR(150) NOT NULL,
        file_path      VARCHAR(500) NOT NULL,
        allow_download TINYINT(1) NOT NULL DEFAULT 1,
        uploaded_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS academic_resources (
        id             INT PRIMARY KEY AUTO_INCREMENT,
        title          VARCHAR(255) NOT NULL,
        subject        VARCHAR(150) NOT NULL,
        file_path      VARCHAR(500) NOT NULL,
        allow_download TINYINT(1) NOT NULL DEFAULT 1,
        uploaded_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ebook_chunks (
        id         INT PRIMARY KEY AUTO_INCREMENT,
        ebook_id   INT NOT NULL,
        chunk_text MEDIUMTEXT NOT NULL,
        chunk_index INT NOT NULL DEFAULT 0,
        INDEX idx_chunk_ebook (ebook_id),
        FULLTEXT INDEX ft_chunk_text (chunk_text)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS generated_answers (
        id             INT PRIMARY KEY AUTO_INCREMENT,
        user_id        INT NOT NULL,
        question       TEXT NOT NULL,
        answer         LONGTEXT NOT NULL,
        marks          INT NOT NULL,
        source_book    VARCHAR(255),
        source_chapter VARCHAR(255),
        created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ga_user (user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS academic_assistant_history (
        id              INT PRIMARY KEY AUTO_INCREMENT,
        user_id         INT NOT NULL,
        question        TEXT NOT NULL,
        answer          LONGTEXT NOT NULL,
        marks_requested INT NOT NULL,
        source_type     ENUM('PDF', 'GEMINI') NOT NULL,
        source_pdf      VARCHAR(255) NULL,
        created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_aah_user (user_id),
        INDEX idx_aah_source_type (source_type)
      )
    `);

    console.log('Smart Library & Academic Assistant tables ready.');

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
