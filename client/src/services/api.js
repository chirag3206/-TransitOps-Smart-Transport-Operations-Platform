/**
 * TransitOps — Centralized Axios API Client
 * Handles JWT auth headers, token refresh, and error normalization
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true,
});

// ── Request interceptor: attach access token ─────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: normalize errors, refresh token on 401 ─────────────
let refreshing = false;
let queue = [];

const processQueue = (error, token = null) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (original.url.includes('/auth/login') || original.url.includes('/auth/refresh') || original.url.includes('/auth/register')) {
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && !original._retry) {
      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }
      original._retry = true;
      refreshing = true;
      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const newToken = data.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// ── Vehicles ─────────────────────────────────────────────────────────────────
export const vehicleAPI = {
  list: (params) => api.get('/vehicles', { params }),
  available: () => api.get('/vehicles/available'),
  summary: () => api.get('/vehicles/summary'),
  get: (id) => api.get(`/vehicles/${id}`),
  create: (data) => api.post('/vehicles', data),
  update: (id, data) => api.put(`/vehicles/${id}`, data),
  delete: (id) => api.delete(`/vehicles/${id}`),
  updateStatus: (id, data) => api.patch(`/vehicles/${id}/status`, data),
};

// ── Drivers ──────────────────────────────────────────────────────────────────
export const driverAPI = {
  list: (params) => api.get('/drivers', { params }),
  available: () => api.get('/drivers/available'),
  expiringLicenses: () => api.get('/drivers/expiring-licenses'),
  summary: () => api.get('/drivers/summary'),
  get: (id) => api.get(`/drivers/${id}`),
  create: (data) => api.post('/drivers', data),
  update: (id, data) => api.put(`/drivers/${id}`, data),
  delete: (id) => api.delete(`/drivers/${id}`),
  updateStatus: (id, data) => api.patch(`/drivers/${id}/status`, data),
  updateSafetyScore: (id, data) => api.patch(`/drivers/${id}/safety-score`, data),
};

// ── Trips ────────────────────────────────────────────────────────────────────
export const tripAPI = {
  list: (params) => api.get('/trips', { params }),
  active: () => api.get('/trips/active'),
  get: (id) => api.get(`/trips/${id}`),
  create: (data) => api.post('/trips', data),
  update: (id, data) => api.put(`/trips/${id}`, data),
  delete: (id) => api.delete(`/trips/${id}`),
  dispatch: (id, data) => api.post(`/trips/${id}/dispatch`, data || {}),
  complete: (id, data) => api.post(`/trips/${id}/complete`, data),
  cancel: (id, data) => api.post(`/trips/${id}/cancel`, data),
};

// ── Maintenance ───────────────────────────────────────────────────────────────
export const maintenanceAPI = {
  list: (params) => api.get('/maintenance', { params }),
  get: (id) => api.get(`/maintenance/${id}`),
  create: (data) => api.post('/maintenance', data),
  close: (id, data) => api.post(`/maintenance/${id}/close`, data),
  update: (id, data) => api.put(`/maintenance/${id}`, data),
  delete: (id) => api.delete(`/maintenance/${id}`),
};

// ── Fuel Logs ─────────────────────────────────────────────────────────────────
export const fuelAPI = {
  list: (params) => api.get('/fuel-logs', { params }),
  stats: (params) => api.get('/fuel-logs/stats', { params }),
  get: (id) => api.get(`/fuel-logs/${id}`),
  create: (data) => api.post('/fuel-logs', data),
  update: (id, data) => api.put(`/fuel-logs/${id}`, data),
  delete: (id) => api.delete(`/fuel-logs/${id}`),
};

// ── Expenses ──────────────────────────────────────────────────────────────────
export const expenseAPI = {
  list: (params) => api.get('/expenses', { params }),
  summary: (params) => api.get('/expenses/summary', { params }),
  get: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  dashboard: () => api.get('/analytics/dashboard'),
  fleetUtilization: (params) => api.get('/analytics/fleet-utilization', { params }),
  tripPerformance: (params) => api.get('/analytics/trip-performance', { params }),
  costBreakdown: (params) => api.get('/analytics/cost-breakdown', { params }),
  driverStats: (params) => api.get('/analytics/driver-stats', { params }),
  monthlyTrend: (params) => api.get('/analytics/monthly-trend', { params }),
};

export default api;
