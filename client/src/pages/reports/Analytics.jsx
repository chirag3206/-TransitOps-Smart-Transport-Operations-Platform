/**
 * TransitOps — Analytics Page
 * Charts using Chart.js: Monthly Trend (Line), Cost Breakdown (Doughnut), Driver Leaderboard
 */
import { useState, useEffect } from 'react';
import { analyticsAPI } from '../../services/api';
import { PageHeader, Spinner, Alert, KPICard } from '../../components/Components';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, BarElement, Title, Tooltip, Legend, Filler
);

const fmt  = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
const fmtK = (n) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
};

export default function Analytics() {
  const [dash, setDash]       = useState(null);
  const [trend, setTrend]     = useState(null);
  const [costs, setCosts]     = useState(null);
  const [tripPerf, setTrip]   = useState(null);
  const [drivers, setDrivers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [d, t, c, tp, dr] = await Promise.all([
          analyticsAPI.dashboard(),
          analyticsAPI.monthlyTrend({ months: 12 }),
          analyticsAPI.costBreakdown(),
          analyticsAPI.tripPerformance(),
          analyticsAPI.driverStats(),
        ]);
        setDash(d.data.data);
        setTrend(t.data.data);
        setCosts(c.data.data);
        setTrip(tp.data.data);
        setDrivers(dr.data.data);
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding: 80 }}><Spinner size="lg" /></div>;
  if (error)   return <Alert type="error">{error}</Alert>;

  // Monthly Revenue Line Chart
  const trendLabels = (trend?.trips || []).map((t) => MONTH_NAMES[(t._id.month - 1)]);
  const revenueData = (trend?.trips || []).map((t) => t.totalRevenue);
  const fuelData    = (trend?.fuel  || []).map((t) => t.totalCost);

  const lineData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Revenue',
        data: revenueData,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#6366f1',
      },
      {
        label: 'Fuel Cost',
        data: fuelData,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#f59e0b',
      },
    ],
  };

  // Cost Doughnut
  const expCats = (costs?.expenseByCategory || []).slice(0, 6);
  const doughnutData = {
    labels: expCats.map((c) => c._id),
    datasets: [{
      data: expCats.map((c) => c.total),
      backgroundColor: ['#6366f1','#f59e0b','#ef4444','#10b981','#0ea5e9','#8b5cf6'],
      borderWidth: 2,
      borderColor: 'var(--bg-card)',
    }],
  };

  // Driver Safety Bar Chart
  const driverPerf = (drivers?.performance || []).slice(0, 8);
  const barData = {
    labels: driverPerf.map((d) => d.name?.split(' ')[0] || 'Driver'),
    datasets: [{
      label: 'Safety Score',
      data: driverPerf.map((d) => d.safetyScore),
      backgroundColor: driverPerf.map((d) =>
        d.safetyScore >= 90 ? 'rgba(16,185,129,0.8)' :
        d.safetyScore >= 75 ? 'rgba(245,158,11,0.8)' :
        'rgba(239,68,68,0.8)'
      ),
      borderRadius: 8,
    }],
  };

  const f = dash?.financials || {};

  return (
    <div>
      <PageHeader title="Analytics & Reports" subtitle="Fleet performance insights at a glance" />

      {/* Top KPIs */}
      <div className="kpi-grid">
        <KPICard title="Total Revenue"     value={fmtK(f.totalRevenue)}  icon="💰" color="success" />
        <KPICard title="Net Profit"        value={fmtK(f.netProfit)}     icon="📈" color="success" />
        <KPICard title="Profit Margin"     value={`${f.profitMargin}%`} icon="📊" color="primary" />
        <KPICard title="Completion Rate"   value={`${tripPerf?.summary?.completionRate || 0}%`} icon="✅" color="info" />
        <KPICard title="Fleet Utilization" value={`${dash?.fleet?.utilizationRate || 0}%`} icon="🚛" color="purple" />
        <KPICard title="Total Trips"       value={tripPerf?.summary?.total || 0} icon="🗺" color="warning" />
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="section-card">
          <h3 className="section-card-title">📈 Revenue vs Fuel Cost (Monthly)</h3>
          {trendLabels.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>No trend data available yet</p>
          ) : (
            <div style={{ height: 240 }}>
              <Line data={lineData} options={{
                ...CHART_OPTS,
                plugins: {
                  legend: { display: true, position: 'bottom', labels: { color: 'var(--text-secondary)', boxWidth: 12 } },
                },
                scales: {
                  x: { ticks: { color: 'var(--text-tertiary)', font: { size: 11 } }, grid: { color: 'var(--border-light)' } },
                  y: { ticks: { color: 'var(--text-tertiary)', font: { size: 11 }, callback: (v) => fmtK(v) }, grid: { color: 'var(--border-light)' } },
                },
              }} />
            </div>
          )}
        </div>

        <div className="section-card">
          <h3 className="section-card-title">💸 Expense Breakdown</h3>
          {expCats.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>No expense data</p>
          ) : (
            <>
              <div style={{ height: 200 }}>
                <Doughnut data={doughnutData} options={{
                  ...CHART_OPTS,
                  plugins: {
                    legend: { display: true, position: 'bottom', labels: { color: 'var(--text-secondary)', boxWidth: 10, font: { size: 11 } } },
                  },
                  cutout: '65%',
                }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Driver Safety Scores */}
        <div className="section-card">
          <h3 className="section-card-title">🛡️ Driver Safety Scores</h3>
          {driverPerf.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>No driver data</p>
          ) : (
            <div style={{ height: 220 }}>
              <Bar data={barData} options={{
                ...CHART_OPTS,
                scales: {
                  x: { ticks: { color: 'var(--text-tertiary)', font: { size: 11 } }, grid: { display: false } },
                  y: { min: 0, max: 100, ticks: { color: 'var(--text-tertiary)', font: { size: 11 } }, grid: { color: 'var(--border-light)' } },
                },
              }} />
            </div>
          )}
        </div>

        {/* Top Routes */}
        <div className="section-card">
          <h3 className="section-card-title">🗺 Top Routes by Revenue</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {(tripPerf?.topRoutes || []).slice(0, 6).map((r, i) => {
              const maxRev = tripPerf?.topRoutes?.[0]?.totalRevenue || 1;
              const pct = (r.totalRevenue / maxRev) * 100;
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r._id?.source} → {r._id?.destination}</span>
                    <span style={{ fontWeight: 700, color: '#10b981' }}>₹{fmt(r.totalRevenue)}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill success" style={{ width: `${pct}%`, background: `hsl(${260 - i * 20}, 70%, 60%)` }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {r.trips} trips · {Math.round(r.totalDistance)} km
                  </div>
                </div>
              );
            })}
            {(tripPerf?.topRoutes || []).length === 0 && (
              <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>No route data available</p>
            )}
          </div>
        </div>
      </div>

      {/* License Alerts */}
      {(drivers?.licenseAlerts?.count || 0) > 0 && (
        <div className="section-card">
          <h3 className="section-card-title">⚠️ License Expiry Alerts ({drivers.licenseAlerts.count})</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {(drivers.licenseAlerts.drivers || []).map((d) => (
              <div key={d._id} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>
                <strong>{d.name}</strong>
                <span style={{ color: d.daysUntilExpiry <= 14 ? '#ef4444' : '#f59e0b', marginLeft: 8 }}>
                  {d.daysUntilExpiry}d remaining
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
