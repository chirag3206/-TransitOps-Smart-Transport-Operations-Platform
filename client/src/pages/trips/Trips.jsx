/**
 * TransitOps — Trips Page
 * Full lifecycle: Draft → Dispatch → Complete/Cancel
 */
import { useState, useEffect, useCallback } from 'react';
import { tripAPI, vehicleAPI, driverAPI } from '../../services/api';
import {
  PageHeader, DataTable, StatusBadge, Modal, ConfirmDialog,
  EmptyState, Spinner, Alert, FormField,
} from '../../components/Components';
import { useAuth } from '../../context/AuthContext';

const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const INIT_FORM = {
  vehicle: '', driver: '', source: '', destination: '',
  plannedDistance: '', cargoWeight: '', revenue: '', notes: '',
};

export default function Trips() {
  const { isFleetManager, isDriver } = useAuth();
  const canWrite = isFleetManager;

  const [trips, setTrips]             = useState([]);
  const [vehicles, setVehicles]       = useState([]);
  const [drivers, setDrivers]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [statusFilter, setStatus]     = useState('');

  const [showCreate, setShowCreate]   = useState(false);
  const [showDispatch, setShowDispatch] = useState(null);
  const [showComplete, setShowComplete] = useState(null);
  const [showCancel, setShowCancel]   = useState(null);
  const [showDetail, setShowDetail]   = useState(null);

  const [form, setForm]               = useState(INIT_FORM);
  const [completeForm, setCompleteForm] = useState({ endOdometer: '', fuelConsumed: '' });
  const [cancelForm, setCancelForm]   = useState({ cancellationReason: '' });
  const [dispatchForm, setDispatchForm] = useState({ startOdometer: '' });
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const [tRes, vRes, dRes] = await Promise.all([
        tripAPI.list(params),
        vehicleAPI.available(),
        driverAPI.available(),
      ]);
      setTrips(tRes.data.data || []);
      setVehicles(vRes.data.data || []);
      setDrivers(dRes.data.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    try {
      await tripAPI.create(form);
      setShowCreate(false); setForm(INIT_FORM); load();
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to create trip');
    } finally { setSaving(false); }
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    try {
      await tripAPI.dispatch(showDispatch._id, dispatchForm);
      setShowDispatch(null); load();
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to dispatch trip');
    } finally { setSaving(false); }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    try {
      await tripAPI.complete(showComplete._id, completeForm);
      setShowComplete(null); load();
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to complete trip');
    } finally { setSaving(false); }
  };

  const handleCancel = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await tripAPI.cancel(showCancel._id, cancelForm);
      setShowCancel(null); load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to cancel trip');
    } finally { setSaving(false); }
  };

  const columns = [
    { header: 'Route', key: 'source', render: (v, row) => (
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{v} → {row.destination}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {row.plannedDistance} km · {fmt(row.cargoWeight)} kg cargo
        </div>
      </div>
    )},
    { header: 'Vehicle', key: 'vehicle', render: (v) => (
      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v?.registrationNumber || '—'}</span>
    )},
    { header: 'Driver', key: 'driver', render: (v) => v?.name || '—' },
    { header: 'Status', key: 'status', render: (v) => <StatusBadge status={v} /> },
    { header: 'Revenue', key: 'revenue', render: (v) => v ? `₹${fmt(v)}` : '—' },
    { header: 'Date', key: 'createdAt', render: (v) => fmtDate(v) },
    ...(canWrite ? [{
      header: 'Actions', key: '_id', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn-sm btn-ghost" onClick={() => setShowDetail(row)}>👁️</button>
          {row.status === 'Draft' && (
            <button className="btn btn-sm btn-primary" onClick={() => { setShowDispatch(row); setDispatchForm({ startOdometer: '' }); setFormError(''); }}>
              🚀 Dispatch
            </button>
          )}
          {row.status === 'Dispatched' && (
            <button className="btn btn-sm btn-ghost" style={{ color: '#10b981' }}
              onClick={() => { setShowComplete(row); setCompleteForm({ endOdometer: '', fuelConsumed: '' }); setFormError(''); }}>
              ✅ Complete
            </button>
          )}
          {(row.status === 'Draft' || row.status === 'Dispatched') && (
            <button className="btn btn-sm btn-ghost" style={{ color: '#ef4444' }}
              onClick={() => { setShowCancel(row); setCancelForm({ cancellationReason: '' }); }}>
              ✕ Cancel
            </button>
          )}
        </div>
      )
    }] : [{
      header: 'Actions', key: '_id', render: (_, row) => (
        <button className="btn btn-sm btn-ghost" onClick={() => setShowDetail(row)}>👁️ View</button>
      )
    }]),
  ];

  return (
    <div>
      <PageHeader
        title="Trips"
        subtitle={`${trips.length} trips`}
        action={canWrite && (
          <button className="btn btn-primary" onClick={() => { setForm(INIT_FORM); setFormError(''); setShowCreate(true); }}>
            + New Trip
          </button>
        )}
      />

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <div className="filter-bar">
        <select className="input" value={statusFilter} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {['Draft', 'Dispatched', 'Completed', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-ghost" onClick={load}>↺ Refresh</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size="lg" /></div>
      ) : trips.length === 0 ? (
        <EmptyState icon="🗺" title="No trips found" description="Create your first trip dispatch." />
      ) : (
        <DataTable columns={columns} data={trips} loading={false} />
      )}

      {/* Create Trip Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Trip" size="lg">
        <form onSubmit={handleCreate}>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="form-grid-2">
            <FormField label="Vehicle" required>
              <select className="input" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} required>
                <option value="">Select vehicle...</option>
                {vehicles.map((v) => (
                  <option key={v._id} value={v._id}>{v.registrationNumber} — {v.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Driver" required>
              <select className="input" value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })} required>
                <option value="">Select driver...</option>
                {drivers.map((d) => (
                  <option key={d._id} value={d._id}>{d.name} (score: {d.safetyScore})</option>
                ))}
              </select>
            </FormField>
            <FormField label="Source / Origin" required>
              <input className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="Delhi" required />
            </FormField>
            <FormField label="Destination" required>
              <input className="input" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}
                placeholder="Mumbai" required />
            </FormField>
            <FormField label="Planned Distance (km)" required>
              <input className="input" type="number" value={form.plannedDistance}
                onChange={(e) => setForm({ ...form, plannedDistance: +e.target.value })} required min="1" />
            </FormField>
            <FormField label="Cargo Weight (kg)" required>
              <input className="input" type="number" value={form.cargoWeight}
                onChange={(e) => setForm({ ...form, cargoWeight: +e.target.value })} required min="1" />
            </FormField>
            <FormField label="Expected Revenue (₹)">
              <input className="input" type="number" value={form.revenue}
                onChange={(e) => setForm({ ...form, revenue: +e.target.value })} min="0" />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Trip'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Dispatch Modal */}
      <Modal open={!!showDispatch} onClose={() => setShowDispatch(null)} title="Dispatch Trip" size="sm">
        <form onSubmit={handleDispatch}>
          {formError && <Alert type="error">{formError}</Alert>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
            Dispatching: <strong>{showDispatch?.source} → {showDispatch?.destination}</strong>
          </p>
          <FormField label="Starting Odometer (km)" required>
            <input className="input" type="number" value={dispatchForm.startOdometer}
              onChange={(e) => setDispatchForm({ ...dispatchForm, startOdometer: +e.target.value })} required min="0" />
          </FormField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowDispatch(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Dispatching...' : '🚀 Dispatch Now'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Complete Modal */}
      <Modal open={!!showComplete} onClose={() => setShowComplete(null)} title="Complete Trip" size="sm">
        <form onSubmit={handleComplete}>
          {formError && <Alert type="error">{formError}</Alert>}
          <FormField label="End Odometer (km)" required>
            <input className="input" type="number" value={completeForm.endOdometer}
              onChange={(e) => setCompleteForm({ ...completeForm, endOdometer: +e.target.value })} required />
          </FormField>
          <FormField label="Fuel Consumed (L)" required>
            <input className="input" type="number" value={completeForm.fuelConsumed}
              onChange={(e) => setCompleteForm({ ...completeForm, fuelConsumed: +e.target.value })} required />
          </FormField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowComplete(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Completing...' : '✅ Mark Completed'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Modal */}
      <Modal open={!!showCancel} onClose={() => setShowCancel(null)} title="Cancel Trip" size="sm">
        <form onSubmit={handleCancel}>
          <FormField label="Cancellation Reason" required>
            <textarea className="input" rows={3} value={cancelForm.cancellationReason}
              onChange={(e) => setCancelForm({ ...cancelForm, cancellationReason: e.target.value })}
              placeholder="Reason for cancellation..." required />
          </FormField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowCancel(null)}>Back</button>
            <button type="submit" className="btn btn-danger" disabled={saving}>
              {saving ? 'Cancelling...' : 'Cancel Trip'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title="Trip Details" size="md">
        {showDetail && (
          <div>
            <div className="detail-row"><span>Route</span><strong>{showDetail.source} → {showDetail.destination}</strong></div>
            <div className="detail-row"><span>Status</span><StatusBadge status={showDetail.status} /></div>
            <div className="detail-row"><span>Vehicle</span><code>{showDetail.vehicle?.registrationNumber}</code></div>
            <div className="detail-row"><span>Driver</span>{showDetail.driver?.name}</div>
            <div className="detail-row"><span>Planned Distance</span>{showDetail.plannedDistance} km</div>
            <div className="detail-row"><span>Cargo Weight</span>{fmt(showDetail.cargoWeight)} kg</div>
            {showDetail.revenue && <div className="detail-row"><span>Revenue</span>₹{fmt(showDetail.revenue)}</div>}
            {showDetail.fuelConsumed && <div className="detail-row"><span>Fuel Consumed</span>{showDetail.fuelConsumed} L</div>}
            {showDetail.computedDistance && <div className="detail-row"><span>Actual Distance</span>{showDetail.computedDistance} km</div>}
            {showDetail.cancellationReason && <div className="detail-row"><span>Cancellation</span>{showDetail.cancellationReason}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
