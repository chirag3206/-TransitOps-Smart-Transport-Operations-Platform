/**
 * TransitOps — Auth Context
 * Provides user state, login/logout, and role-based helpers to the entire app
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app load
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setLoading(false); return; }
    authAPI.getMe()
      .then(({ data }) => setUser(data.data))
      .catch(() => localStorage.removeItem('accessToken'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (credentials) => {
    const { data } = await authAPI.login(credentials);
    localStorage.setItem('accessToken', data.data.accessToken);
    setUser(data.data.user);
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch (_) {}
    localStorage.removeItem('accessToken');
    setUser(null);
  }, []);

  const isFleetManager   = user?.role === 'fleet_manager';
  const isDriver         = user?.role === 'driver';
  const isSafetyOfficer  = user?.role === 'safety_officer';
  const canWrite         = isFleetManager || isDriver;

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout,
      isFleetManager, isDriver, isSafetyOfficer, canWrite,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
