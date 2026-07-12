# 🚛 TransitOps — Smart Transport Operations Platform

> A centralized, modern web platform to manage the complete lifecycle of transport operations — from vehicle registration and driver management to dispatching trips, scheduling maintenance, logging fuel, and generating business analytics.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue)

---

## ✨ Key Features

- **🔐 Robust Authentication** — JWT-based sessions with automatic background token refreshes and Role-Based Access Control (RBAC).
- **📊 Interactive Dashboard** — Real-time KPIs, SVG charts, and operational alerts.
- **🚗 Vehicle Registry** — Full CRUD with unique registration, status management (Available, In Shop, On Trip), and financial history tracking.
- **👤 Driver Management** — License expiry warnings, safety score auditing, and assignment tracking.
- **🗺️ Trip Dispatch Engine** — Full trip lifecycle (Draft → Dispatch → Complete/Cancel) automatically tracking distance, cargo, and fuel consumption.
- **🔧 Maintenance & Expenses** — Log vehicle repairs (which auto-updates vehicle status) and track operational expenses (Tolls, Fines, Fuel) with category breakdowns.
- **📈 Advanced Analytics** — Visual business intelligence leveraging `Chart.js` for monthly revenue trends, expense doughnuts, and driver performance charts.
- **💅 Premium UI/UX** — Modern Dark-Mode "Glassmorphism" design system with smooth animations, custom components, and responsive layouts.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, React Router v6, Vite |
| **Styling** | Vanilla CSS (Glassmorphism, Custom Tokens, Modules) |
| **Charts** | Chart.js (`react-chartjs-2`) |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB & Mongoose |
| **Security & Auth** | bcryptjs, JSON Web Tokens (Access + Refresh tokens) |
| **Performance** | `express-rate-limit`, `node-cache` (In-Memory response caching) |

---

## 🚀 Quick Start & Installation

### Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (v9+)
- A **MongoDB** database (Local instance or MongoDB Atlas free tier)

### 1. Clone & Install Dependencies

Clone the repository and run the setup script which will install dependencies for both the root, server, and client directories simultaneously.

```bash
git clone https://github.com/chirag3206/-TransitOps-Smart-Transport-Operations-Platform.git
cd transitops
npm run install:all
```

### 2. Configure Environment Variables

Duplicate the example environment file and add your MongoDB connection string.

```bash
cp .env.example .env
```

Open `.env` and configure your variables:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.../transitops
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d
RATE_LIMIT_MAX_REQUESTS=10000
```

### 3. Seed the Database with Demo Data (Important)

To instantly populate the platform with 12 months of historical data (Trips, Expenses, Vehicles, Drivers), run the seeder script. **This will also generate your demo login credentials.**

```bash
npm run seed:reset
```

### 4. Run the Development Servers

Start both the backend API and the React frontend concurrently:

```bash
npm run dev
```

The application will be live at: **[http://localhost:5173/](http://localhost:5173/)**

---

## 🔑 Demo Credentials

If you ran the seeder script (`npm run seed:reset`), the following accounts have been generated for you to test Role-Based Access Control (RBAC):

### Fleet Managers

| Email | Password | Access |
|-------|----------|--------|
| `admin@transitops.com` | `Admin1234` | Full System Access — Vehicles, Drivers, Trips, Maintenance, Fuel, Expenses, Analytics |
| `rahul@transitops.com` | `Manager1234` | Full System Access |

### Safety Officer

| Email | Password | Access |
|-------|----------|--------|
| `safety@transitops.com` | `Safety1234` | Vehicles, Maintenance (Approve / Mark Ready) |

### Drivers

| Name | Email | Password |
|------|-------|----------|
| Alex Driver | `alex@transitops.com` | `Driver1234` |
| Priya Patel | `priya@transitops.com` | `Driver1234` |
| Ravi Kumar | `ravi@transitops.com` | `Driver1234` |
| Sunita Singh | `sunita@transitops.com` | `Driver1234` |
| Manoj Verma | `manoj@transitops.com` | `Driver1234` |
| Anjali Sharma | `anjali@transitops.com` | `Driver1234` |
| Amit Patel | `amit@transitops.com` | `Driver1234` |

> **Tip:** The login page includes "Quick Demo" buttons that automatically fill in credentials for fast testing.

---

## 📁 Project Structure

```text
transitops/
├── client/          # React + Vite Frontend
│   ├── src/
│   │   ├── components/   # UI Library (KPICards, Modals, StatusBadges)
│   │   ├── context/      # AuthContext (Session & RBAC state)
│   │   ├── pages/        # Dashboard, Vehicles, Drivers, Trips, Expenses, Analytics
│   │   └── services/     # Centralized Axios API with automatic token refresh
├── server/          # Node.js + Express Backend
│   ├── config/      # DB connection, Env validation, Logger
│   ├── controllers/ # Route handlers & Business logic
│   ├── middleware/   # JWT Auth, RBAC Role guards, Rate Limiter, Cache
│   ├── models/      # Mongoose Database Schemas
│   ├── routes/      # Express API Router definitions
│   └── seed/        # Database population scripts
├── .env             # Environment configuration (ignored in git)
└── package.json     # Root workspace scripts (dev, build, install)
```

---

## 📜 License

ISC License
