# Smart Library Management System 🎓📚

A modern, production-ready, full-stack **Smart Library Management System** designed for academic institutions. Built using a three-tier architecture with a Node.js/Express backend, MariaDB/MySQL database, and a premium glassmorphic frontend utilizing GSAP, AOS, and Lenis.

---

## 🌟 Key Features

### 👤 Role-Based Portals
- **Librarian (Admin) Console**: Full CRUD operations for books inventory, checkout dispatcher, manual return processing, and real-time reservation queue monitoring.
- **Student Hub**: Searchable book catalog with debounced filtering, return deadline tracking, active checkouts, and pre-booking/reservation waitlist requests.

### ⚙️ Automation & Business Logic
- **Auto-Database Schema Builder**: Automatic creation of schemas, indexes, and demo seeding on startup.
- **Transaction Queue Management**: Automated waitlists when books go out of stock.

### 🎨 Visual & Motion Design
- **Glassmorphic Aesthetic**: Modern SaaS design with blur filters, magnetic hovering, and Outfit typography.
- **GSAP Logo Intro**: Timed logo dot sliding, scaling, and rotation transitions.
- **Mouse Parallax Mockups**: Floating dashboard cards shifting at varying speed ratios.
- **Lenis & AOS Scroll**: Smooth inertial scrolling paired with fade-in scroll reveals.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, JavaScript (ES6+), GSAP, AOS, Lenis |
| Backend | Node.js, Express.js, JWT, bcryptjs |
| Database | MariaDB / MySQL / PlanetScale |
| Deployment | Vercel (Frontend), Render (Backend), PlanetScale (DB) |

---

## 🚀 Local Development

### Prerequisites
- Node.js v18+
- XAMPP (or any MySQL/MariaDB server)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/Sahanvpoojary00/Library_Management_System.git
cd Library_Management_System

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env
# Edit .env with your local database credentials

# 4. Start MySQL via XAMPP Control Panel

# 5. Run the server
npm start
# or for development with auto-reload:
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin (Librarian) | `admin@library.com` | `admin123` |
| Student | `student@library.com` | `student123` |

You can also register new student accounts via the signup form.

---

## ☁️ Production Deployment

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Vercel     │────▸│   Render     │────▸│ PlanetScale  │
│  (Frontend)  │ API │  (Backend)   │ SSL │  (MySQL DB)  │
│  Static HTML │     │  Express.js  │     │  Serverless  │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

### Step 1: PlanetScale Database

1. Create an account at [planetscale.com](https://planetscale.com)
2. Create a new database named `library_management_system`
3. Go to **Connect** → select **Node.js** driver
4. Copy the connection credentials (`host`, `username`, `password`)
5. The backend auto-creates all tables on first connection

---

### Step 2: Render Backend

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `node backend/server.js`
4. Add environment variables:

| Key | Value |
|-----|-------|
| `PORT` | `10000` |
| `NODE_ENV` | `production` |
| `DB_HOST` | *(from PlanetScale)* |
| `DB_USER` | *(from PlanetScale)* |
| `DB_PASSWORD` | *(from PlanetScale)* |
| `DB_NAME` | `library_management_system` |
| `DB_SSL` | `true` |
| `JWT_SECRET` | *(strong random string)* |
| `FRONTEND_URL` | `https://your-app.vercel.app` |

5. Deploy and note your Render URL (e.g. `https://library-management-system-backend.onrender.com`)

---

### Step 3: Vercel Frontend

1. Go to [vercel.com](https://vercel.com) → **Import Project**
2. Connect your GitHub repository
3. **Important**: Update `vercel.json` — replace the Render URL in the API rewrite rule with your actual Render deployment URL:

```json
{
  "source": "/api/:path*",
  "destination": "https://YOUR-RENDER-URL.onrender.com/api/:path*"
}
```

4. Deploy — Vercel auto-detects `vercel.json`
5. Copy your Vercel URL and update the `FRONTEND_URL` variable on Render

---

### Step 4: Final Verification

After both services are deployed:
1. Update `FRONTEND_URL` on Render with your Vercel URL
2. Update the API proxy URL in `vercel.json` with your Render URL
3. Redeploy both if needed
4. Test: Landing page → Login → Admin Dashboard → Student Dashboard

---

## 📂 Project Architecture

```
├── backend/
│   ├── controllers/       # Auth, Books, Transactions, Reservations
│   ├── middleware/         # JWT auth & role validation
│   ├── routes/            # REST API endpoint mapping
│   ├── db.js              # Connection pool, SSL, schema seeding
│   └── server.js          # Express server, CORS, health check
├── frontend/
│   ├── css/style.css      # Glassmorphic UI design system
│   ├── js/
│   │   ├── api.js         # Central API fetch client
│   │   ├── auth.js        # Auth flows & route guards
│   │   ├── admin.js       # Admin dashboard logic
│   │   ├── student.js     # Student catalog & reservations
│   │   └── main.js        # GSAP, AOS, Lenis animations
│   ├── index.html         # Landing page
│   ├── login.html         # Authentication forms
│   ├── admin.html         # Admin console
│   └── student.html       # Student hub
├── vercel.json            # Vercel routing & API proxy config
├── render.yaml            # Render deployment blueprint
├── schema.sql             # Database schema reference
├── .env.example           # Environment variable template
└── package.json           # Dependencies & scripts
```

---

## 📋 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (default: 3000) |
| `NODE_ENV` | No | `development` or `production` |
| `DB_HOST` | Yes | Database hostname |
| `DB_PORT` | No | Database port (default: 3306) |
| `DB_USER` | Yes | Database username |
| `DB_PASSWORD` | Yes | Database password |
| `DB_NAME` | Yes | Database name |
| `DB_SSL` | No | Set to `true` for PlanetScale |
| `JWT_SECRET` | Yes | Secret key for JWT tokens |
| `FRONTEND_URL` | No | Comma-separated allowed CORS origins |
