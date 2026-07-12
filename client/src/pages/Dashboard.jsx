/**
 * TransitOps — Dashboard Page
 * Live KPI cards, fleet health, active trips, license alerts, revenue trend
 */
import { useState, useEffect } from 'react';
import { analyticsAPI, tripAPI } from '../services/api';
import { KPICard, Spinner, StatusBadge, Alert, Modal, FormField, PageHeader } from '../components/Components';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
const fmtCur = (n) => `₹${fmt(n)}`;

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = async () => {
    try {
      const { data: res } = await analyticsAPI.dashboard();
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="dashboard-loading">
      <Spinner size="lg" />
      <span>Loading dashboard...</span>
    </div>
  );

  if (error) return <Alert type="error">{error}</Alert>;

  const d = data;
  if (d?.role === 'driver') {
    return <DriverDashboard data={d} user={user} refresh={load} />;
  }

  const fleet      = d?.fleet      || {};
  const drivers    = d?.drivers    || {};
  const trips      = d?.trips      || {};
  const financials = d?.financials || {};

  return (
    <div className="dashboard">
      <PageHeader
        title={`Good ${getTimeOfDay()}, ${user?.name?.split(' ')[0]} 👋`}
        subtitle="Here's what's happening across your fleet today."
      />

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          title="Total Vehicles"
          value={fleet.total || 0}
          sub={`${fleet.available || 0} available`}
          icon="🚛"
          color="primary"
        />
        <KPICard
          title="Active Drivers"
          value={drivers.total || 0}
          sub={`${drivers.available || 0} available`}
          icon="👤"
          color="info"
        />
        <KPICard
          title="Total Trips"
          value={trips.total || 0}
          sub={`${trips.completed || 0} completed`}
          icon="🗺"
          color="purple"
        />
        <KPICard
          title="Total Revenue"
          value={fmtCur(financials.totalRevenue)}
          sub={`${financials.profitMargin || 0}% margin`}
          icon="💰"
          color="success"
        />
        <KPICard
          title="Net Profit"
          value={fmtCur(financials.netProfit)}
          sub="After all costs"
          icon="📈"
          color="success"
        />
        <KPICard
          title="Vehicles On Trip"
          value={fleet.onTrip || 0}
          sub={`${fleet.inShop || 0} in maintenance`}
          icon="🔄"
          color={fleet.onTrip > 0 ? 'info' : 'warning'}
        />
      </div>

      {/* Content Grid */}
      <div className="dashboard-grid">
        {/* Fleet Status */}
        <div className="dash-card">
          <h3 className="dash-card-title">🚛 Fleet Status</h3>
          <div className="status-donut-wrap">
            <div className="status-rows">
              <StatusRow label="Available"           count={fleet.available}          color="#10b981" total={fleet.total} />
              <StatusRow label="On Trip"             count={fleet.onTrip}             color="#0ea5e9" total={fleet.total} />
              <StatusRow label="Pending Maintenance" count={fleet.pendingMaintenance}  color="#f97316" total={fleet.total} />
              <StatusRow label="In Shop"             count={fleet.inShop}             color="#f59e0b" total={fleet.total} />
            </div>
            <div className="utilization-ring">
              <svg viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="30" fill="none" stroke="#1e293b" strokeWidth="10" />
                <circle
                  cx="40" cy="40" r="30" fill="none"
                  stroke="#6366f1" strokeWidth="10"
                  strokeDasharray={`${(fleet.utilizationRate || 0) * 1.885} 188.5`}
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                  style={{ transition: 'stroke-dasharray 1s ease' }}
                />
              </svg>
              <div className="ring-label">
                <span className="ring-pct">{fleet.utilizationRate || 0}%</span>
                <span className="ring-sub">utilization</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trip Metrics */}
        <div className="dash-card">
          <h3 className="dash-card-title">🗺 Trip Metrics</h3>
          <div className="metric-rows">
            <MetricRow label="Completed"   value={trips.completed}  color="#10b981" />
            <MetricRow label="Active"      value={trips.dispatched} color="#0ea5e9" />
            <MetricRow label="Cancelled"   value={trips.cancelled}  color="#ef4444" />
            <MetricRow label="Draft"       value={trips.draft}      color="#64748b" />
          </div>
          {trips.total > 0 && (
            <div className="completion-bar">
              <div className="cb-label">
                <span>Completion Rate</span>
                <span className="cb-pct">
                  {Math.round((trips.completed / trips.total) * 100)}%
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill success"
                  style={{ width: `${Math.round((trips.completed / trips.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Financial Summary */}
        <div className="dash-card">
          <h3 className="dash-card-title">💰 Financial Summary</h3>
          <div className="finance-rows">
            <FinanceRow label="Total Revenue" value={fmtCur(financials.totalRevenue)} type="income" />
            <FinanceRow label="Fuel Costs"    value={fmtCur(financials.fuelCosts)}    type="cost" />
            <FinanceRow label="Maintenance"   value={fmtCur(financials.maintenanceCosts)} type="cost" />
            <FinanceRow label="Other Expenses" value={fmtCur(financials.otherExpenses)} type="cost" />
            <div className="finance-divider" />
            <FinanceRow
              label="Net Profit"
              value={fmtCur(financials.netProfit)}
              type={financials.netProfit >= 0 ? 'profit' : 'loss'}
              bold
            />
          </div>
        </div>

        {/* License Alerts */}
        <div className="dash-card">
          <h3 className="dash-card-title">⚠️ License Expiry Alerts</h3>
          {(d?.licenseAlerts || []).length === 0 ? (
            <div className="no-alerts">
              <span>✅</span>
              <span>All driver licenses are valid</span>
            </div>
          ) : (
            <div className="alert-list">
              {(d.licenseAlerts || []).map((a) => (
                <div key={a._id} className="license-alert-row">
                  <div className="la-avatar">{a.name?.charAt(0) || 'D'}</div>
                  <div className="la-info">
                    <span className="la-name">{a.name}</span>
                    <span className="la-expiry">Expires in {a.daysUntilExpiry} days</span>
                  </div>
                  <span className={`badge ${a.daysUntilExpiry <= 14 ? 'badge-danger' : 'badge-warning'}`}>
                    {a.daysUntilExpiry}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Maintenance Progress */}
        <div className="dash-card dash-full">
          <h3 className="dash-card-title">🔧 Maintenance Progress ({d?.activeMaintenance || 0} active)</h3>
          {(d?.activeMaintenance || 0) === 0 ? (
            <div className="no-alerts">
              <span>✅</span>
              <span>No vehicles currently in maintenance pipeline</span>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#f97316', width: 10, height: 10, borderRadius: '50%', display: 'inline-block' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{fleet.pendingMaintenance || 0}</strong> awaiting inspector approval
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#f59e0b', width: 10, height: 10, borderRadius: '50%', display: 'inline-block' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{fleet.inShop || 0}</strong> currently in workshop
                </span>
              </div>
              <a href="/maintenance" style={{ color: 'var(--primary-500)', fontSize: 14, marginLeft: 'auto' }}>
                View maintenance log →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, count = 0, color, total = 1 }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="status-row">
      <div className="status-row-left">
        <div className="status-dot" style={{ background: color }} />
        <span className="status-label">{label}</span>
      </div>
      <span className="status-count">{count}</span>
      <div className="status-bar-bg">
        <div className="status-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function MetricRow({ label, value = 0, color }) {
  return (
    <div className="metric-row">
      <div className="metric-dot" style={{ background: color }} />
      <span className="metric-label">{label}</span>
      <span className="metric-value" style={{ color }}>{value}</span>
    </div>
  );
}

function FinanceRow({ label, value, type, bold }) {
  const colors = { income: '#10b981', cost: '#ef4444', profit: '#10b981', loss: '#ef4444' };
  return (
    <div className="finance-row" style={bold ? { fontWeight: 700 } : {}}>
      <span className="finance-label">{label}</span>
      <span className="finance-value" style={{ color: colors[type] || 'var(--text-primary)' }}>
        {type === 'cost' ? `−${value}` : value}
      </span>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function DriverDashboard({ data, user, refresh }) {
  const { driver, stats, activeTrip, upcomingTrip, pendingTrip } = data;
  
  const [showStart, setShowStart] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [startForm, setStartForm] = useState({ startOdometer: '' });
  const [finishForm, setFinishForm] = useState({ endOdometer: '', fuelConsumed: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleStartTrip = async (e) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    try {
      await tripAPI.driverStart(activeTrip._id, startForm);
      setShowStart(false); refresh();
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to start trip');
    } finally { setSaving(false); }
  };

  const handleFinishTrip = async (e) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    try {
      await tripAPI.driverFinish(activeTrip._id, finishForm);
      setShowFinish(false); refresh();
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to finish trip');
    } finally { setSaving(false); }
  };

  // Determine vehicle info from activeTrip, pendingTrip, or upcomingTrip
  const currentVehicle = (activeTrip || pendingTrip || upcomingTrip)?.vehicle;

  return (
    <div className="dashboard driver-dashboard">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0]} 🚛`}
        subtitle="Here's your current assignment and driving stats."
      />

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard title="Trips Completed" value={stats.completedTrips} icon="🏁" color="primary" />
        <KPICard title="Distance Driven" value={`${stats.totalDistance} km`} icon="🛣️" color="info" />
        <KPICard title="Vehicle Issued" value={currentVehicle?.registrationNumber || 'None'} sub={currentVehicle?.name || 'Off-duty'} icon="🚛" color={currentVehicle ? 'purple' : 'warning'} />
        <KPICard title="Safety Score" value={`${stats.safetyScore}/100`} sub={stats.safetyScore >= 80 ? "Excellent!" : "Keep it up"} icon="🛡️" color={stats.safetyScore >= 80 ? 'success' : 'warning'} />
      </div>

      <div className="dashboard-grid" style={{ marginTop: 24 }}>

        {/* Active Trip — Dispatched (driver needs to START) */}
        {activeTrip && activeTrip.status === 'Dispatched' && (
          <div className="dash-card dash-full" style={{ borderLeft: '4px solid #3b82f6' }}>
            <h3 className="dash-card-title">📩 New Trip Dispatched by Manager</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{activeTrip.source} → {activeTrip.destination}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                  Vehicle: <strong>{activeTrip.vehicle?.registrationNumber}</strong> · 
                  Distance: <strong>{activeTrip.plannedDistance} km</strong> · 
                  Cargo: <strong>{activeTrip.cargoWeight} kg</strong>
                </div>
              </div>
              <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 16 }}
                onClick={() => { setShowStart(true); setStartForm({ startOdometer: activeTrip.vehicle?.odometer || '' }); setFormError(''); }}>
                🚀 Start Trip
              </button>
            </div>
          </div>
        )}

        {/* Active Trip — In Progress (driver needs to FINISH) */}
        {activeTrip && activeTrip.status === 'In Progress' && (
          <div className="dash-card dash-full" style={{ borderLeft: '4px solid #10b981' }}>
            <h3 className="dash-card-title">🚨 Trip In Progress</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{activeTrip.source} → {activeTrip.destination}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                  Vehicle: <strong>{activeTrip.vehicle?.registrationNumber}</strong> · 
                  Start Odometer: <strong>{activeTrip.startOdometer} km</strong> · 
                  Cargo: <strong>{activeTrip.cargoWeight} kg</strong>
                </div>
              </div>
              <button className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981', padding: '12px 24px', fontSize: 16 }}
                onClick={() => { setShowFinish(true); setFinishForm({ endOdometer: '', fuelConsumed: '' }); setFormError(''); }}>
                🏁 Finish Trip
              </button>
            </div>
          </div>
        )}

        {/* Pending Completion — Waiting for Manager Approval */}
        {pendingTrip && (
          <div className="dash-card dash-full" style={{ borderLeft: '4px solid #f59e0b' }}>
            <h3 className="dash-card-title">⏳ Awaiting Manager Approval</h3>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{pendingTrip.source} → {pendingTrip.destination}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                Vehicle: <strong>{pendingTrip.vehicle?.registrationNumber}</strong> · 
                Distance: <strong>{pendingTrip.actualDistance || pendingTrip.plannedDistance} km</strong> · 
                Fuel Used: <strong>{pendingTrip.fuelConsumed} L</strong>
              </div>
              <div style={{ marginTop: 12, padding: '10px 16px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, color: '#f59e0b', fontSize: 14 }}>
                ⏳ Your trip data has been submitted. Waiting for the fleet manager to review and approve.
              </div>
            </div>
          </div>
        )}

        {/* No active trip and no pending — show upcoming or off-duty */}
        {!activeTrip && !pendingTrip && (
          <div className="dash-card dash-full" style={{ borderLeft: '4px solid #64748b' }}>
            <h3 className="dash-card-title">🚛 Trip Status</h3>
            {upcomingTrip ? (
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{upcomingTrip.source} → {upcomingTrip.destination}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                  Vehicle: <strong>{upcomingTrip.vehicle?.registrationNumber}</strong> · 
                  Distance: <strong>{upcomingTrip.plannedDistance} km</strong>
                </div>
                <div style={{ marginTop: 12, padding: '10px 16px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 8, color: '#818cf8', fontSize: 14 }}>
                  📋 This trip is drafted but not yet dispatched by the manager. You'll be notified when it's dispatched.
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>You're off-duty. No trips currently assigned.</div>
            )}
          </div>
        )}
      </div>

      {/* Start Trip Modal */}
      <Modal open={showStart} onClose={() => setShowStart(false)} title="Start Trip" size="sm">
        <form onSubmit={handleStartTrip}>
          {formError && <Alert type="error">{formError}</Alert>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
            Ready to start <strong>{activeTrip?.source} → {activeTrip?.destination}</strong>?
          </p>
          <FormField label="Current Odometer Reading (km)" required>
            <input className="input" type="number" value={startForm.startOdometer}
              onChange={(e) => setStartForm({ ...startForm, startOdometer: +e.target.value })} required min="0" />
          </FormField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowStart(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Starting...' : '🚀 Start Trip'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Finish Trip Modal */}
      <Modal open={showFinish} onClose={() => setShowFinish(false)} title="Finish Trip" size="sm">
        <form onSubmit={handleFinishTrip}>
          {formError && <Alert type="error">{formError}</Alert>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
            Finishing <strong>{activeTrip?.source} → {activeTrip?.destination}</strong>.
            Enter your final readings below.
          </p>
          <FormField label="End Odometer Reading (km)" required>
            <input className="input" type="number" value={finishForm.endOdometer}
              onChange={(e) => setFinishForm({ ...finishForm, endOdometer: +e.target.value })} required min="0" />
          </FormField>
          <FormField label="Fuel Consumed (Litres)" required>
            <input className="input" type="number" step="0.1" value={finishForm.fuelConsumed}
              onChange={(e) => setFinishForm({ ...finishForm, fuelConsumed: +e.target.value })} required min="0" />
          </FormField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowFinish(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Submitting...' : '🏁 Submit & Finish'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
