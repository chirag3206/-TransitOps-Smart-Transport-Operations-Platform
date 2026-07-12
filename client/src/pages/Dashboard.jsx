/**
 * TransitOps — Dashboard Page
 * Live KPI cards, fleet health, active trips, license alerts, revenue trend
 */
import { useState, useEffect } from 'react';
import { analyticsAPI } from '../services/api';
import { KPICard, Spinner, StatusBadge, Alert } from '../components/Components';
import { PageHeader } from '../components/Components';
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
              <StatusRow label="Available" count={fleet.available} color="#10b981" total={fleet.total} />
              <StatusRow label="On Trip"   count={fleet.onTrip}   color="#0ea5e9" total={fleet.total} />
              <StatusRow label="In Shop"   count={fleet.inShop}   color="#f59e0b" total={fleet.total} />
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

        {/* Maintenance Alerts */}
        <div className="dash-card dash-full">
          <h3 className="dash-card-title">🔧 Active Maintenance ({d?.activeMaintenance || 0})</h3>
          {(d?.activeMaintenance || 0) === 0 ? (
            <div className="no-alerts">
              <span>✅</span>
              <span>No vehicles currently in maintenance</span>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
              {d?.activeMaintenance} vehicle{d?.activeMaintenance !== 1 ? 's are' : ' is'} currently in shop.
              <a href="/maintenance" style={{ color: 'var(--primary-500)', marginLeft: 8 }}>
                View maintenance →
              </a>
            </p>
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
