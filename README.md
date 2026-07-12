# 🚛 TransitOps — Smart Transport Operations Platform

> A centralized platform to manage the complete lifecycle of transport operations — from vehicle registration and driver management to dispatching, maintenance, fuel logging, and analytics.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue)

---

## ✨ Features

- **🔐 Authentication** — Secure login with email/password and Google OAuth, JWT-based sessions, RBAC (4 roles)
- **📊 Dashboard** — Real-time KPIs: Active Vehicles, Fleet Utilization, Active Trips, Drivers On Duty
- **🚗 Vehicle Registry** — Full CRUD with unique registration, status management, lifecycle tracking
- **👤 Driver Management** — License tracking, safety scores, expiry warnings, compliance monitoring
- **🗺️ Trip Management** — Draft → Dispatch → Complete lifecycle with automatic status transitions
- **🔧 Maintenance** — Maintenance logs with automatic vehicle status changes (In Shop ↔ Available)
- **⛽ Fuel & Expenses** — Fuel logs, toll tracking, per-vehicle operational cost computation
- **📈 Reports & Analytics** — Fuel Efficiency, Fleet Utilization, Operational Cost, Vehicle ROI with CSV/PDF export
- **🌙 Dark Mode** — Full dark/light theme support with system preference detection
- **🔍 Global Search** — Search across vehicles, drivers, and trips instantly

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Vanilla CSS (Glassmorphism, Animations) |
| Charts | Chart.js |
| Backend | Node.js + Express.js |
| Database | MongoDB Atlas (Free Tier) |
| Auth | Passport.js + JWT + Google OAuth 2.0 |
| Caching | node-cache (In-Memory) |
| Rate Limiting | express-rate-limit |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- MongoDB Atlas account (free tier)

### 1. Clone & Install

```bash
git clone <repo-url>
cd transitops
npm run install:all
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, Google OAuth credentials
```

### 3. Seed Demo Data (Optional)

```bash
npm run seed
```

### 4. Run Development Server

```bash
npm run dev
```

This starts both the backend (port 5000) and frontend (port 5173) concurrently.

---

## 📁 Project Structure

```
transitops/
├── client/          # React + Vite Frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # Auth, Theme contexts
│   │   ├── hooks/        # Custom React hooks
│   │   ├── pages/        # Page-level components
│   │   ├── services/     # API service layer
│   │   ├── styles/       # CSS design system
│   │   └── utils/        # Helpers & formatters
│   └── ...
├── server/          # Node.js + Express Backend
│   ├── config/      # DB, Passport, env config
│   ├── controllers/ # Request handlers
│   ├── middleware/   # Auth, RBAC, rate-limit, cache
│   ├── models/      # Mongoose schemas
│   ├── routes/      # Express routes
│   ├── services/    # Business logic layer
│   ├── validators/  # Request validators
│   └── seed/        # Demo data seeder
└── ...
```

---

## 👥 User Roles

| Role | Access |
|------|--------|
| **Fleet Manager** | Full access — vehicles, maintenance, lifecycle |
| **Driver** | Trips, vehicle/driver assignment, deliveries |
| **Safety Officer** | Driver compliance, license validity, safety scores |
| **Financial Analyst** | Expenses, fuel, maintenance costs, profitability |

---

## 📜 License

ISC
