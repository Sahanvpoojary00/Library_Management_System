-- ============================================
-- Smart Library Management System
-- PlanetScale-Compatible Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS library_management_system;
USE library_management_system;

-- Users table (admin & student accounts)
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL
);

-- Books inventory catalog
CREATE TABLE IF NOT EXISTS books (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  quantity INT NOT NULL,
  available INT NOT NULL
);

-- Borrow/return transaction log
-- Uses INDEX instead of FOREIGN KEY for PlanetScale compatibility
CREATE TABLE IF NOT EXISTS transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  return_date DATE NULL,
  INDEX idx_trans_user (user_id),
  INDEX idx_trans_book (book_id)
);

-- Pre-booking reservation queue
CREATE TABLE IF NOT EXISTS reservations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  reservation_date DATE NOT NULL,
  INDEX idx_res_user (user_id),
  INDEX idx_res_book (book_id)
);
