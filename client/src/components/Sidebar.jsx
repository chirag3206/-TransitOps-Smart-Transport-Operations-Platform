/**
 * TransitOps — Sidebar Navigation Component
 * Premium dark sidebar with icons, active state, collapse, and role-aware nav
 */
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const NAV_ITEMS = [
  { path: '/dashboard',   label: 'Dashboard',    icon: '▦',  roles: ['fleet_manager', 'driver'] },
  { path: '/vehicles',    label: 'Vehicles',     icon: '🚛', roles: ['fleet_manager', 'safety_officer'] },
  { path: '/drivers',     label: 'Drivers',      icon: '👤', roles: ['fleet_manager'] },
  { path: '/trips',       label: 'Trips',        icon: '🗺', roles: ['fleet_manager', 'driver'] },
  { path: '/maintenance', label: 'Maintenance',  icon: '🔧', roles: ['fleet_manager', 'safety_officer'] },
  { path: '/expenses',    label: 'Expenses',     icon: '💸', roles: ['fleet_manager'] },
  { path: '/analytics',  label: 'Analytics',    icon: '📊', roles: ['fleet_manager'] },
];

const ROLE_LABELS = {
  fleet_manager:  'Fleet Manager',
  driver:         'Driver',
  safety_officer: 'Safety Officer',
};

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout, isFleetManager } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleNav = NAV_ITEMS.filter((item) =>
    item.roles.includes(user?.role)
  );

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">🚛</div>
        {!collapsed && (
          <span className="logo-text">
            Transit<span className="logo-accent">Ops</span>
          </span>
        )}
        <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav Links */}
      <nav className="sidebar-nav">
        {visibleNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User Profile */}
      <div className="sidebar-footer">
        <div className="user-avatar">
          {user?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        {!collapsed && (
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">{ROLE_LABELS[user?.role] || user?.role}</span>
          </div>
        )}
        <button
          className="logout-btn"
          onClick={handleLogout}
          title="Logout"
        >
          ⏏
        </button>
      </div>
    </aside>
  );
}
