# ScholarSync 🎓📚

A full-stack **ScholarSync** (Smart Library & Academic Assistant) built for academic institutions as a college project. Features a Node.js/Express backend, MySQL database via XAMPP, and a glassmorphic frontend with smooth animations.

---

## ✨ Features

### 👤 Role-Based Access
- **Admin (Librarian) Console** — Manage books inventory, issue/return books, monitor reservations, cancel any reservation.
- **Student Hub** — Browse catalog, reserve books, track active checkouts, view borrow history.

### 📚 Book Reservation Policy
- Students can reserve any **available** book (locks one unit for them).
- Each reservation is active for **12 hours** — after which it auto-expires and releases the book.
- Students can have a maximum of **3 active reservations** at a time.
- Students can manually cancel a reservation early.
- Admins can view and cancel any student's reservation.

### ⚙️ Automation
- **Auto Database Setup** — All tables are auto-created on first run. No manual SQL required.
- **Seeded Demo Data** — Default admin, student, and sample books are auto-seeded.
- **Expiry Cleanup** — Background task checks and auto-cancels stale reservations every minute.

### 🎨 UI/UX
- Glassmorphic dark-mode design with GSAP animations, AOS scroll reveals, and Lenis smooth scroll.
- Responsive layout with micro-interactions and hover effects.

---

## 🛠️ Tech Stack

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Frontend   | HTML5, CSS3, JavaScript (ES6+), GSAP, AOS, Lenis  |
| Backend    | Node.js, Express.js, JWT, bcryptjs                |
| Database   | MySQL (via XAMPP)                                 |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js v18+](https://nodejs.org/)
- [XAMPP](https://www.apachefriends.org/) (for MySQL)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/Sahanvpoojary00/Library_Management_System.git
cd Library_Management_System

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# .env is pre-configured for XAMPP defaults — no changes needed unless your setup differs

# 4. Start XAMPP and ensure MySQL is running

# 5. Start the server
npm start
```

Open **http://localhost:3000** in your browser.

> The database `library_management` and all tables are created automatically on first run.

---

## 🔑 Demo Credentials

| Role    | Email                   | Password    |
|---------|-------------------------|-------------|
| Admin   | `admin@library.com`     | `admin123`  |
| Student | `student@library.com`   | `student123`|

> You can also register new student accounts via the signup form.

---

## 📂 Project Structure

```
Library_Management_System/
├── backend/
│   ├── controllers/
│   │   ├── authController.js       # Register & login
│   │   ├── bookController.js       # Catalog management
│   │   ├── transController.js      # Issue & return books
│   │   └── reserveController.js    # Reservations + expiry logic
│   ├── middleware/
│   │   └── auth.js                 # JWT auth & role guards
│   ├── routes/                     # REST API route definitions
│   ├── db.js                       # MySQL pool + auto-schema setup
│   └── server.js                   # Express server + background tasks
├── frontend/
│   ├── css/style.css               # Glassmorphic UI design system
│   ├── js/
│   │   ├── api.js                  # Centralised API fetch client
│   │   ├── auth.js                 # Auth flows & route guards
│   │   ├── admin.js                # Admin dashboard logic
│   │   ├── student.js              # Student catalog & reservations
│   │   └── main.js                 # GSAP / AOS / Lenis animations
│   ├── index.html                  # Landing page
│   ├── login.html                  # Login / signup
│   ├── admin.html                  # Admin console
│   └── student.html                # Student hub
├── schema.sql                      # Database schema reference
├── .env.example                    # Environment variable template
├── .gitignore
└── package.json
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env`. Default values work out-of-the-box with XAMPP.

| Variable      | Default                 | Description                       |
|---------------|-------------------------|-----------------------------------|
| `PORT`        | `3000`                  | Port the server listens on        |
| `DB_HOST`     | `localhost`             | MySQL host                        |
| `DB_PORT`     | `3306`                  | MySQL port                        |
| `DB_USER`     | `root`                  | MySQL username                    |
| `DB_PASSWORD` | *(empty)*               | MySQL password (empty for XAMPP)  |
| `DB_NAME`     | `library_management`    | Database name (auto-created)      |
| `JWT_SECRET`  | *(see .env.example)*    | Secret key for JWT tokens         |

---

## 🗄️ Database Schema

| Table          | Description                                      |
|----------------|--------------------------------------------------|
| `users`        | Admin and student accounts                       |
| `books`        | Book inventory with quantity and availability    |
| `transactions` | Borrow and return records                        |
| `reservations` | Active 12-hour book reservation locks            |

See [`schema.sql`](./schema.sql) for the full schema reference.
