# Smart Library Management System 🎓📚

A modern, production-ready, full-stack **Smart Library Management System** designed for academic institutions. Built using a three-tier architecture with a Node.js/Express backend, MariaDB database, and a premium glassmorphic frontend utilizing GSAP, AOS, and Lenis.

---

## 🌟 Key Features

### 👤 Role-Based Portals
*   **Librarian (Admin) Console**: Full CRUD operations for books inventory, checkout dispatcher (issuing books to student emails), manual return processing, and real-time reservation queue monitoring.
*   **Student Hub**: Searchable book catalog with debounced filtering, return deadline status tracking, active checkouts indicators, and pre-booking/reservation waitlist requests.

### ⚙️ Automation & Business Logic
*   **Auto-Database Schema Builder**: Automatic creation of database schemas, foreign keys, index references, and admin/student demo seeding on startup.
*   **Transaction Queue Management**: Automated waitlists when books go out of stock. Returning a book updates stock availability and tracks queue positions.

### 🎨 Visual & Motion Design
*   **Glassmorphic Aesthetic**: Modern SaaS design incorporating card blur filters, magnetic hovering selectors, and clean Outfit typography.
*   **GSAP Logo Intro**: Timed logo dot sliding, scaling, and rotation transitions on load.
*   **Mouse Parallax Mockups**: Floating dashboard cards, widgets, and toast alerts shifting at varying speed ratios.
*   **Lenis & AOS Scroll**: Smooth inertial scrolling paired with clean fade-in scroll reveals.

---

## 🛠️ Tech Stack

*   **Frontend**: HTML5, Vanilla CSS3 (Custom Variables), JavaScript (ES6+), GSAP (Animations), AOS (Scroll Reveals), Lenis (Smooth Scroll)
*   **Backend**: Node.js, Express.js, JWT (Authentication), bcryptjs (Hashing)
*   **Database**: MariaDB / MySQL (via `mysql2` client pool)

---

## 🚀 Quick Start Guide

### 1. Database Setup
1.  Launch **XAMPP Control Panel** (or equivalent database engine).
2.  Start the **MySQL** module (port `3306` by default).

### 2. Environment Configurations
Create a `.env` file in the root directory:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=library_management_system
JWT_SECRET=your_super_secret_key_change_me
```

### 3. Installation
Install all Node modules dependencies:
```bash
npm install
```

### 4. Run the Application
Start the server (on first launch, the database, tables, and seed records will be created automatically):
```bash
npm start
```
For hot-reloading development server:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🔑 Demo Access Credentials

*   **Librarian Account (Admin)**:
    *   **Email**: `admin@library.com`
    *   **Password**: `admin123`
*   **Student Account**:
    *   **Email**: `student@library.com`
    *   **Password**: `student123` *(or register a new student account)*

---

## 📂 Project Architecture

```text
├── backend/
│   ├── controllers/      # Route controllers (Auth, Books, Trans, Reserve)
│   ├── middleware/       # JWT Auth & role validator middleware
│   ├── routes/           # REST API endpoints mapping
│   ├── db.js             # Connection pool & DB schema seed builder
│   └── server.js         # Entry point & express setup
├── frontend/
│   ├── css/
│   │   └── style.css     # Glassmorphic UI stylesheet
│   ├── js/
│   │   ├── api.js        # Central API fetch client
│   │   ├── auth.js       # Auth page actions & route guards
│   │   ├── admin.js      # Admin dashboard actions
│   │   ├── student.js    # Student catalog & reservation actions
│   │   └── main.js       # Motion animations, cursor & counters
│   ├── index.html        # Main landing page
│   ├── login.html        # Authentication forms
│   ├── admin.html        # Admin console
│   └── student.html      # Student hub
├── schema.sql            # Core database schema reference
└── package.json          # Dependency logs
```
