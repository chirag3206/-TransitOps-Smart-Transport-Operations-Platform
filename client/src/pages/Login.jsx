/**
 * TransitOps — Login Page
 * Premium glassmorphism login with JWT + Google OAuth button
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form);
      navigate(user.role === 'driver' ? '/trips' : user.role === 'safety_officer' ? '/vehicles' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    const demos = {
      admin:  { email: 'admin@transitops.com',  password: 'Admin1234'   },
      driver: { email: 'alex@transitops.com',   password: 'Driver1234'  },
      safety: { email: 'safety@transitops.com', password: 'Safety1234'  },
    };
    setForm(demos[role]);
  };

  return (
    <div className="login-page">
      {/* Animated background orbs */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <div className="login-container">
        {/* Brand */}
        <div className="login-brand">
          <div className="brand-icon">🚛</div>
          <h1 className="brand-name">
            Transit<span className="brand-accent">Ops</span>
          </h1>
          <p className="brand-tagline">Smart Transport Operations Platform</p>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <h2 className="login-title">Welcome back</h2>
          <p className="login-subtitle">Sign in to your account</p>

          {error && (
            <div className="login-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label>Email address</label>
              <input
                id="login-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@transitops.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="login-field">
              <label>Password</label>
              <input
                id="login-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="btn-spinner" />
                  Signing in...
                </>
              ) : 'Sign in →'}
            </button>
          </form>

          {/* Quick demo fill */}
          <div className="demo-section">
            <span className="demo-label">Quick demo →</span>
            <div className="demo-btns">
              <button className="demo-btn" onClick={() => fillDemo('admin')}>
                Fleet Manager
              </button>
              <button className="demo-btn" onClick={() => fillDemo('driver')}>
                Driver
              </button>
              <button className="demo-btn" onClick={() => fillDemo('safety')}>
                Safety Officer
              </button>
            </div>
          </div>
        </div>

        {/* Stats footer */}
        <div className="login-stats">
          <div className="login-stat">
            <span className="stat-num">10</span>
            <span className="stat-lbl">Vehicles</span>
          </div>
          <div className="stat-divider" />
          <div className="login-stat">
            <span className="stat-num">8</span>
            <span className="stat-lbl">Drivers</span>
          </div>
          <div className="stat-divider" />
          <div className="login-stat">
            <span className="stat-num">48</span>
            <span className="stat-lbl">Trips</span>
          </div>
        </div>
      </div>
    </div>
  );
}
