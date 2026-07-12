import { Routes, Route, Navigate } from 'react-router-dom'
import './App.css'

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={
          <div className="app-welcome">
            <div className="welcome-card">
              <div className="welcome-icon">🚛</div>
              <h1 className="welcome-title">
                Transit<span className="text-gradient">Ops</span>
              </h1>
              <p className="welcome-subtitle">
                Smart Transport Operations Platform
              </p>
              <p className="welcome-description">
                Manage your fleet, drivers, trips, maintenance, and expenses — all in one place.
              </p>
              <div className="welcome-status">
                <span className="status-dot"></span>
                System Initializing...
              </div>
            </div>
          </div>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
