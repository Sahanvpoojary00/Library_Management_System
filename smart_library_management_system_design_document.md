# ScholarSync
# Software Design Document (SDD)

---

# 1. Introduction

## 1.1 Purpose
This Software Design Document describes the architecture, components, database structure, workflows, and technical implementation details of ScholarSync.

The document serves as a technical blueprint for development and implementation.

---

# 1.2 Project Overview

ScholarSync is a web-based application developed to simplify and digitize library operations.

The system provides:
- Admin login and management features
- Student login and book reservation features
- Book issue and return tracking
- Borrow history management
- Deadline monitoring

The application follows a client-server architecture using:
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js and Express.js
- Database: MySQL

---

# 2. System Architecture

## 2.1 Architecture Type
The application follows a 3-tier architecture:

### Presentation Layer
Handles:
- User interface
- Forms
- Dashboard
- Book listing

### Application Layer
Handles:
- Authentication
- Business logic
- API handling
- Validation

### Database Layer
Handles:
- Data storage
- Queries
- Relationships
- Transactions

---

# 2.2 Architecture Diagram

```text
User Browser
     |
Frontend (HTML/CSS/JS)
     |
REST API (Express.js)
     |
Business Logic
     |
MySQL Database
```

---

# 3. Functional Modules

## 3.1 Authentication Module

### Description
Provides secure login access for admins and students.

### Features
- Admin login
- Student login
- JWT authentication
- Password hashing

### Input
- Email
- Password

### Output
- Login success/failure
- Authentication token

---

## 3.2 Admin Module

### Description
Allows the administrator to manage library operations.

### Features
- Add books
- Delete books
- Issue books
- Return books
- View all books
- Track issued books

### Workflow
1. Admin logs in
2. Admin accesses dashboard
3. Admin performs book operations
4. Database updates automatically

---

## 3.3 Student Module

### Description
Allows students to access library services.

### Features
- View all books
- Search books
- Reserve/pre-book books
- View borrowed books
- View return deadlines
- View borrowing history

### Workflow
1. Student logs in
2. Student views dashboard
3. Student searches/reserves books
4. Student monitors deadlines and history

---

## 3.4 Book Management Module

### Description
Manages all book-related operations.

### Features
- Add new books
- Update availability
- Delete books
- Search books
- Categorize books

### Book Information
- Book ID
- Title
- Author
- Category
- Quantity
- Availability

---

## 3.5 Reservation Module

### Description
Allows students to reserve unavailable books.

### Features
- Pre-book books
- Track reservation requests
- Maintain reservation records

### Workflow
1. Student selects unavailable book
2. Reservation request is created
3. Reservation stored in database
4. Admin can view reservations

---

## 3.6 Borrowing Module

### Description
Tracks issued and returned books.

### Features
- Issue books
- Return books
- Due date tracking
- Borrow history

### Workflow
1. Admin issues book
2. System stores transaction
3. Due date generated
4. Student views deadline
5. Admin processes return

---

# 4. Database Design

## 4.1 Database Name
library_management_system

---

## 4.2 Users Table

```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    role VARCHAR(20)
);
```

### Purpose
Stores:
- Student details
- Admin details
- Authentication information

---

## 4.3 Books Table

```sql
CREATE TABLE books (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255),
    author VARCHAR(255),
    category VARCHAR(100),
    quantity INT,
    available INT
);
```

### Purpose
Stores:
- Book information
- Quantity tracking
- Availability status

---

## 4.4 Transactions Table

```sql
CREATE TABLE transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    book_id INT,
    issue_date DATE,
    due_date DATE,
    return_date DATE,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
);
```

### Purpose
Stores:
- Borrow history
- Issue records
- Return records
- Due dates

---

## 4.5 Reservations Table

```sql
CREATE TABLE reservations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    book_id INT,
    reservation_date DATE,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
);
```

### Purpose
Stores:
- Pre-booking records
- Reservation details

---

# 5. API Design

## 5.1 Authentication APIs

### Register
```http
POST /api/auth/register
```

### Login
```http
POST /api/auth/login
```

---

## 5.2 Book APIs

### Get All Books
```http
GET /api/books
```

### Add Book
```http
POST /api/books
```

### Delete Book
```http
DELETE /api/books/:id
```

---

## 5.3 Borrow APIs

### Issue Book
```http
POST /api/issue
```

### Return Book
```http
POST /api/return
```

### Borrow History
```http
GET /api/history
```

---

## 5.4 Reservation APIs

### Reserve Book
```http
POST /api/reserve
```

### Get Reservations
```http
GET /api/reservations
```

---

# 6. Frontend Design

## 6.0 UI/UX Design Guidelines

### Design Theme
The application should follow a modern, professional, and minimal college-oriented UI design.

### Color Scheme
Use light and clean colors:
- White
- Light blue
- Soft purple
- Light gray
- Pastel gradients

### UI Style
- Modern dashboard layout
- Glassmorphism/light cards
- Rounded corners
- Soft shadows
- Smooth transitions
- Minimal clutter

### Animation Requirements
The frontend should include smooth and lightweight animations to improve user experience.

#### Cursor Animations
- Interactive animated cursor
- Hover scaling effects
- Smooth pointer transitions
- Magnetic button hover effect

#### Scrolling Animations
- Dynamic scroll reveal animations
- Fade-in sections on scroll
- Smooth parallax scrolling
- Animated counters/statistics
- Smooth page transitions

#### UI Hover Effects
- Card hover elevation
- Animated buttons
- Smooth navbar transitions
- Interactive dashboard cards

### Recommended Libraries
- AOS (Animate On Scroll)
- GSAP
- Lenis smooth scrolling
- Framer Motion (optional)

### User Experience Goals
- Professional college-project appearance
- Smooth and modern interactions
- Lightweight performance
- Responsive design for all devices

---

## 6.1 Pages

### Landing Page
Displays:
- System introduction
- Login buttons

### Login Page
Contains:
- Email field
- Password field
- Login button

### Student Dashboard
Displays:
- Borrowed books
- Deadlines
- Borrow history
- Available books

### Admin Dashboard
Displays:
- Book management options
- Issued books
- Reservation requests

### Book Listing Page
Displays:
- Book cards/table
- Search functionality
- Availability status

---

# 7. Backend Design

## 7.1 Server Structure

```text
backend/
│
├── server.js
├── db.js
├── routes/
├── controllers/
├── middleware/
└── models/
```

---

## 7.2 Responsibilities

### server.js
- Starts Express server
- Configures middleware
- Connects routes

### db.js
- MySQL connection setup

### routes/
- API route definitions

### controllers/
- Business logic

### middleware/
- Authentication middleware
- Authorization checks

---

# 8. Security Design

## Authentication Security
- JWT authentication
- bcrypt password hashing
- Protected routes

## Database Security
- Parameterized SQL queries
- Input validation
- SQL injection prevention

## General Security
- Error handling
- Secure session management
- Access control

---

# 9. User Flow

## Admin Flow

```text
Login
  ↓
Admin Dashboard
  ↓
Manage Books
  ↓
Issue/Return Books
  ↓
Database Updated
```

---

## Student Flow

```text
Login
  ↓
Student Dashboard
  ↓
View/Search Books
  ↓
Reserve Book
  ↓
View Borrow History & Deadlines
```

---

# 10. Non-Functional Requirements

## Performance
- Fast search functionality
- Efficient database queries

## Scalability
- Support growing number of books/users

## Reliability
- Stable APIs
- Consistent database operations

## Maintainability
- Modular folder structure
- Reusable code components

---

# 11. Testing Strategy

## Unit Testing
Test:
- API functions
- Authentication logic
- Database queries

## Integration Testing
Test:
- Frontend-backend communication
- Database integration

## User Testing
Test:
- Login system
- Book issue/return workflow
- Reservation workflow

---

# 12. Deployment Design

## Frontend Deployment
Platform:
- Vercel

## Backend Deployment
Platform:
- Render

## Database Hosting
Platform:
- MySQL Server

---

# 13. Future Scope

Potential future improvements:
- QR code integration
- Mobile application
- RFID-based tracking
- Notification system
- Analytics dashboard

---

# 14. Conclusion

ScholarSync is designed as a scalable and efficient web application for modern library management. The system simplifies library operations through role-based access, centralized data management, and automated workflows.

The project demonstrates full-stack development concepts including frontend design, backend API development, authentication, database integration, and modular software architecture.

