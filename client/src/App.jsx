import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Spinner } from './components/Components';
import './App.css';

// Layout
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/vehicles/Vehicles';
import Drivers from './pages/drivers/Drivers';
import Trips from './pages/trips/Trips';
import Maintenance from './pages/maintenance/Maintenance';
import Expenses from './pages/expenses/Expenses';
import Analytics from './pages/reports/Analytics';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={user ? <Navigate to={user.role === 'driver' ? '/trips' : user.role === 'safety_officer' ? '/drivers' : '/dashboard'} replace /> : <Login />} />

      {/* Protected Routes with Layout */}
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/" element={<Navigate to={user?.role === 'driver' ? '/trips' : user?.role === 'safety_officer' ? '/drivers' : '/dashboard'} replace />} />
        
        {/* Role Specific Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['fleet_manager']}>
            <Dashboard />
          </ProtectedRoute>
        } />

        {/* Role Specific Routes */}
        <Route path="/vehicles" element={
          <ProtectedRoute allowedRoles={['fleet_manager']}>
            <Vehicles />
          </ProtectedRoute>
        } />
        
        <Route path="/drivers" element={
          <ProtectedRoute allowedRoles={['fleet_manager', 'safety_officer']}>
            <Drivers />
          </ProtectedRoute>
        } />
        
        <Route path="/trips" element={
          <ProtectedRoute allowedRoles={['fleet_manager', 'driver']}>
            <Trips />
          </ProtectedRoute>
        } />
        
        <Route path="/maintenance" element={
          <ProtectedRoute allowedRoles={['fleet_manager']}>
            <Maintenance />
          </ProtectedRoute>
        } />
        
        <Route path="/expenses" element={
          <ProtectedRoute allowedRoles={['fleet_manager']}>
            <Expenses />
          </ProtectedRoute>
        } />
        
        <Route path="/analytics" element={
          <ProtectedRoute allowedRoles={['fleet_manager']}>
            <Analytics />
          </ProtectedRoute>
        } />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
