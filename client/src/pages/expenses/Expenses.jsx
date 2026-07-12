/**
 * TransitOps — Expenses Page
 * Fuel Logs + Expense Logs with summary cards
 */
import { useState, useEffect, useCallback } from 'react';
import { expenseAPI, fuelAPI, vehicleAPI } from '../../services/api';
import { PageHeader, DataTable, Modal, EmptyState, Spinner, Alert, FormField, KPICard } from '../../components/Components';
import { useAuth } from '../../context/AuthContext';

const EXPENSE_CATEGORIES = ['Toll', 'Fuel', 'Maintenance', 'Parking', 'Fine', 'Insurance', 'Registration', 'Other'];
const FUEL_TYPES = ['Diesel', 'Petrol', 'CNG', 'Electric'];
const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';

const INIT_EXPENSE = { vehicle: '', category: 'Toll', amount: '', description: '', date: new Date().toISOString().substring(0, 10) };
const INIT_FUEL = { vehicle: '', liters: '', pricePerLiter: '', fuelType: 'Diesel', location: '', date: new Date().toISOString().substring(0, 10), odometerReading: '' };

export default function Expenses() {
  const { isFleetManager } = useAuth();
  const [tab, setTab]                   = useState('expenses');
  const [expenses, setExpenses]         = useState([]);
  const [fuelLogs, setFuelLogs]         = useState([]);
  const [summary, setSummary]           = useState(null);
  const [fuelStats, setFuelStats]       = useState(null);
  const [vehicles, setVehicles]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [catFilter, setCatFilter]       = useState('');
  const [showExpense, setShowExpense]   = useState(false);
  const [showFuel, setShowFuel]         = useState(false);
  const [expForm, setExpForm]           = useState(INIT_EXPENSE);
  const [fuelForm, setFuelForm]         = useState(INIT_FUEL);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = catFilter ? { category: catFilter } : {};
      const [eRes, fRes, sRes, fsRes, vRes] = await Promise.all([
        expenseAPI.list(params),
        fuelAPI.list({}),
        expenseAPI.summary({}),
        fuelAPI.stats({}),
        vehicleAPI.list({}),
      ]);
      setExpenses(eRes.data.data || []);
      setFuelLogs(fRes.data.data || []);
      setSummary(sRes.data.data);
      setFuelStats(fsRes.data.data);
      setVehicles(vRes.data.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load data');
    } finally { setLoading(false); }
  }, [catFilter]);

  useEffect(() => { load(); }, [load]);

  const handleExpense = async (e) => {
    e.preventDefault(); setSaving(true); setFormError('');
    try {
      await expenseAPI.create(expForm);
      setShowExpense(false); setExpForm(INIT_EXPENSE); load();
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to log expense');
    } finally { setSaving(false); }
  };

  const handleFuel = async (e) => {
    e.preventDefault(); setSaving(true); setFormError('');
    try {
      await fuelAPI.create(fuelForm);
      setShowFuel(false); setFuelForm(INIT_FUEL); load();
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to log fuel');
    } finally { setSaving(false); }
  };

  const expenseColumns = [
    { header: 'Vehicle', key: 'vehicle', render: (v) => <code style={{ fontSize: 12 }}>{v?.registrationNumber || '—'}</code> },
    { header: 'Category', key: 'category', render: (v) => <span className="badge badge-purple">{v}</span> },
    { header: 'Description', key: 'description', render: (v) => <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{v}</span> },
    { header: 'Amount', key: 'amount', render: (v) => <span style={{ fontWeight: 700 }}>₹{fmt(v)}</span> },
    { header: 'Date', key: 'date', render: (v) => fmtDate(v) },
  ];

  const fuelColumns = [
    { header: 'Vehicle', key: 'vehicle', render: (v) => <code style={{ fontSize: 12 }}>{v?.registrationNumber || '—'}</code> },
    { header: 'Liters', key: 'liters', render: (v) => `${v} L` },
    { header: 'Price/L', key: 'pricePerLiter', render: (v) => `₹${v}` },
    { header: 'Total Cost', key: 'totalCost', render: (v) => <span style={{ fontWeight: 700 }}>₹{fmt(v)}</span> },
    { header: 'Location', key: 'location', render: (v) => v || '—' },
    { header: 'Date', key: 'date', render: (v) => fmtDate(v) },
  ];

  return (
    <div>
      <PageHeader
        title="Expenses & Fuel"
        subtitle="Track all operational costs"
        action={isFleetManager && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => { setFuelForm(INIT_FUEL); setFormError(''); setShowFuel(true); }}>
              ⛽ Log Fuel
            </button>
            <button className="btn btn-primary" onClick={() => { setExpForm(INIT_EXPENSE); setFormError(''); setShowExpense(true); }}>
              + Log Expense
            </button>
          </div>
        )}
      />

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Summary KPIs */}
      {summary && (
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <KPICard title="Total Expenses" value={`₹${fmt(summary.grandTotal)}`} icon="💸" color="danger" />
          <KPICard title="Fuel Costs" value={`₹${fmt(fuelStats?.totalCost)}`} icon="⛽" color="warning" />
          <KPICard title="Total Fuel" value={`${fmt(fuelStats?.totalLiters)} L`} icon="🛢" color="info" />
          <KPICard title="Expense Records" value={expenses.length + fuelLogs.length} icon="📄" color="primary" />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--bg-tertiary)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        <button className={`btn ${tab === 'expenses' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('expenses')}>
          💸 Expenses ({expenses.length})
        </button>
        <button className={`btn ${tab === 'fuel' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('fuel')}>
          ⛽ Fuel Logs ({fuelLogs.length})
        </button>
        {summary?.byCategory && (
          <button className={`btn ${tab === 'breakdown' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('breakdown')}>
            📊 Breakdown
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size="lg" /></div>
      ) : tab === 'expenses' ? (
        <>
          <div className="filter-bar">
            <select className="input" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {expenses.length === 0 ? (
            <EmptyState icon="💸" title="No expenses logged" description="Log your first operational expense." />
          ) : (
            <DataTable columns={expenseColumns} data={expenses} loading={false} />
          )}
        </>
      ) : tab === 'fuel' ? (
        fuelLogs.length === 0 ? (
          <EmptyState icon="⛽" title="No fuel logs" description="Log your first fuel fill-up." />
        ) : (
          <DataTable columns={fuelColumns} data={fuelLogs} loading={false} />
        )
      ) : (
        /* Category Breakdown */
        <div className="section-card">
          <h3 className="section-card-title">📊 Expense by Category</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(summary?.byCategory || []).map((cat) => {
              const pct = summary?.grandTotal > 0 ? (cat.total / summary.grandTotal) * 100 : 0;
              return (
                <div key={cat._id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                    <span>{cat._id}</span>
                    <span style={{ fontWeight: 700 }}>₹{fmt(cat.total)} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill success" style={{ width: `${pct}%`, background: 'var(--primary-500)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expense Modal */}
      <Modal open={showExpense} onClose={() => setShowExpense(false)} title="Log Expense" size="md">
        <form onSubmit={handleExpense}>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="form-grid-2">
            <FormField label="Vehicle" required>
              <select className="input" value={expForm.vehicle} onChange={(e) => setExpForm({ ...expForm, vehicle: e.target.value })} required>
                <option value="">Select vehicle...</option>
                {vehicles.map((v) => <option key={v._id} value={v._id}>{v.registrationNumber} — {v.name}</option>)}
              </select>
            </FormField>
            <FormField label="Category" required>
              <select className="input" value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Amount (₹)" required>
              <input className="input" type="number" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: +e.target.value })} required min="0" />
            </FormField>
            <FormField label="Date" required>
              <input className="input" type="date" value={expForm.date} onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} required />
            </FormField>
            <FormField label="Description" required>
              <input className="input" value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} placeholder="Toll at NH48..." required />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowExpense(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Log Expense'}</button>
          </div>
        </form>
      </Modal>

      {/* Fuel Modal */}
      <Modal open={showFuel} onClose={() => setShowFuel(false)} title="Log Fuel Fill-up" size="md">
        <form onSubmit={handleFuel}>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="form-grid-2">
            <FormField label="Vehicle" required>
              <select className="input" value={fuelForm.vehicle} onChange={(e) => setFuelForm({ ...fuelForm, vehicle: e.target.value })} required>
                <option value="">Select vehicle...</option>
                {vehicles.map((v) => <option key={v._id} value={v._id}>{v.registrationNumber} — {v.name}</option>)}
              </select>
            </FormField>
            <FormField label="Fuel Type">
              <select className="input" value={fuelForm.fuelType} onChange={(e) => setFuelForm({ ...fuelForm, fuelType: e.target.value })}>
                {FUEL_TYPES.map((f) => <option key={f}>{f}</option>)}
              </select>
            </FormField>
            <FormField label="Liters" required>
              <input className="input" type="number" value={fuelForm.liters} onChange={(e) => setFuelForm({ ...fuelForm, liters: +e.target.value })} required min="0" step="0.1" />
            </FormField>
            <FormField label="Price Per Liter (₹)" required>
              <input className="input" type="number" value={fuelForm.pricePerLiter} onChange={(e) => setFuelForm({ ...fuelForm, pricePerLiter: +e.target.value })} required min="0" step="0.01" />
            </FormField>
            <FormField label="Location">
              <input className="input" value={fuelForm.location} onChange={(e) => setFuelForm({ ...fuelForm, location: e.target.value })} placeholder="HP Pump, NH48" />
            </FormField>
            <FormField label="Date" required>
              <input className="input" type="date" value={fuelForm.date} onChange={(e) => setFuelForm({ ...fuelForm, date: e.target.value })} required />
            </FormField>
            <FormField label="Odometer Reading (km)">
              <input className="input" type="number" value={fuelForm.odometerReading} onChange={(e) => setFuelForm({ ...fuelForm, odometerReading: +e.target.value })} min="0" />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowFuel(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Log Fuel'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
