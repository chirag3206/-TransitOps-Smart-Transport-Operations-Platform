/**
 * TransitOps — Maintenance Page
 */
import { useState, useEffect, useCallback } from 'react';
import { maintenanceAPI, vehicleAPI } from '../../services/api';
import { PageHeader, DataTable, StatusBadge, Modal, ConfirmDialog, EmptyState, Spinner, Alert, FormField } from '../../components/Components';
import { useAuth } from '../../context/AuthContext';

const MAINT_TYPES = ['Oil Change', 'Tire Replacement', 'Brake Service', 'Engine Repair', 'Annual Inspection', 'Electrical Repair', 'Battery Replacement', 'Body Work', 'Other'];
const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';

const INIT_FORM = { vehicle: '', type: 'Oil Change', description: '', estimatedCost: '', workshopName: '', startDate: '', odometerReading: '' };

export default function Maintenance() {
  const { isFleetManager, isSafetyOfficer } = useAuth();
  const [records, setRecords]       = useState([]);
  const [vehicles, setVehicles]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showApprove, setShowApprove] = useState(null);
  const [showClose, setShowClose]   = useState(null);
  const [showDelete, setShowDelete] = useState(null);
  const [form, setForm]             = useState(INIT_FORM);
  const [approveForm, setApproveForm] = useState(INIT_FORM);
  const [closeForm, setCloseForm]   = useState({ actualCost: '', notes: '' });
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const [mRes, vRes] = await Promise.all([maintenanceAPI.list(params), vehicleAPI.list({})]);
      setRecords(mRes.data.data || []);
      setVehicles(vRes.data.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load maintenance records');
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true); setFormError('');
    try {
      await maintenanceAPI.create(form);
      setShowCreate(false); setForm(INIT_FORM); load();
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to create record');
    } finally { setSaving(false); }
  };

  const handleApprove = async (e) => {
    e.preventDefault(); setSaving(true); setFormError('');
    try {
      await maintenanceAPI.approve(showApprove._id, approveForm);
      setShowApprove(null); load();
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to approve record');
    } finally { setSaving(false); }
  };

  const handleClose = async (e) => {
    e.preventDefault(); setSaving(true); setFormError('');
    try {
      await maintenanceAPI.close(showClose._id, closeForm);
      setShowClose(null); load();
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to close record');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await maintenanceAPI.delete(showDelete._id); setShowDelete(null); load(); }
    catch (e) { setError(e.response?.data?.message || 'Failed to delete'); }
  };

  const columns = [
    { header: 'Vehicle', key: 'vehicle', render: (v) => (
      <div>
        <code style={{ fontSize: 12 }}>{v?.registrationNumber || '—'}</code>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{v?.make} {v?.model}</div>
      </div>
    )},
    { header: 'Type', key: 'type' },
    { header: 'Description', key: 'description', render: (v) => <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{v}</span> },
    { header: 'Status', key: 'status', render: (v) => <StatusBadge status={v} /> },
    { header: 'Workshop', key: 'workshopName', render: (v) => v || '—' },
    { header: 'Est. Cost', key: 'estimatedCost', render: (v) => v ? `₹${fmt(v)}` : '—' },
    { header: 'Actual Cost', key: 'actualCost', render: (v) => v ? `₹${fmt(v)}` : '—' },
    { header: 'Started', key: 'startDate', render: (v) => fmtDate(v) },
    ...((isFleetManager || isSafetyOfficer) ? [{
      header: 'Actions', key: '_id', render: (_, row) => (
        <div className="table-actions">
          {isSafetyOfficer && row.status === 'Pending Approval' && (
            <button className="btn btn-sm btn-primary" onClick={() => {
              setShowApprove(row);
              setApproveForm({
                type: row.type,
                description: row.description || '',
                estimatedCost: row.estimatedCost || '',
                workshopName: row.workshopName || '',
                startDate: row.startDate ? new Date(row.startDate).toISOString().split('T')[0] : '',
                odometerReading: row.odometerReading || '',
                notes: row.notes || ''
              });
              setFormError('');
            }}>
              👁️ Verify & Approve
            </button>
          )}
          {isSafetyOfficer && row.status === 'In Workshop' && (
            <button className="btn btn-sm btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }}
              onClick={() => { setShowClose(row); setCloseForm({ actualCost: row.estimatedCost || '', notes: '' }); setFormError(''); }}>
              🏁 Mark Ready
            </button>
          )}
          {isFleetManager && row.status === 'Closed' && (
            <button className="btn btn-sm btn-ghost" style={{ color: '#ef4444' }} onClick={() => setShowDelete(row)}>🗑️</button>
          )}
        </div>
      )
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle={`${records.length} maintenance records`}
        action={isFleetManager && (
          <button className="btn btn-primary" onClick={() => { setForm(INIT_FORM); setFormError(''); setShowCreate(true); }}>
            + Schedule Maintenance
          </button>
        )}
      />
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      <div className="filter-bar">
        <select className="input" value={statusFilter} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Records</option>
          <option value="Pending Approval">Pending Approval</option>
          <option value="In Workshop">In Workshop</option>
          <option value="Closed">Closed Only</option>
        </select>
        <button className="btn btn-ghost" onClick={load}>↺ Refresh</button>
      </div>

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size="lg" /></div>
        : records.length === 0 ? <EmptyState icon="🔧" title="No maintenance records" description="Schedule your first maintenance." />
        : <DataTable columns={columns} data={records} loading={false} />}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Schedule Maintenance" size="lg">
        <form onSubmit={handleCreate}>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="form-grid-2">
            <FormField label="Vehicle" required>
              <select className="input" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} required>
                <option value="">Select vehicle...</option>
                {vehicles.filter((v) => v.status === 'Available').map((v) => (
                  <option key={v._id} value={v._id}>{v.registrationNumber} — {v.name} ({v.status})</option>
                ))}
              </select>
            </FormField>
            <FormField label="Maintenance Type" required>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {MAINT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Description">
              <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Details about the issue..." />
            </FormField>
            <FormField label="Workshop Name">
              <input className="input" value={form.workshopName} onChange={(e) => setForm({ ...form, workshopName: e.target.value })} placeholder="Tata Service Centre" />
            </FormField>
            <FormField label="Estimated Cost (₹)">
              <input className="input" type="number" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: +e.target.value })} min="0" />
            </FormField>
            <FormField label="Start Date">
              <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </FormField>
            <FormField label="Odometer Reading (km)">
              <input className="input" type="number" value={form.odometerReading} onChange={(e) => setForm({ ...form, odometerReading: +e.target.value })} min="0" />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Scheduling...' : 'Schedule'}</button>
          </div>
        </form>
      </Modal>

      {/* Approve / Verify Modal */}
      <Modal open={!!showApprove} onClose={() => setShowApprove(null)} title="Verify & Approve Maintenance" size="lg">
        <form onSubmit={handleApprove}>
          {formError && <Alert type="error">{formError}</Alert>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
            Reviewing details for vehicle: <strong>{showApprove?.vehicle?.registrationNumber}</strong>. You may update any field before approving.
          </p>
          <div className="form-grid-2">
            <FormField label="Maintenance Type" required>
              <select className="input" value={approveForm.type} onChange={(e) => setApproveForm({ ...approveForm, type: e.target.value })} required>
                {MAINT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Description" required>
              <input className="input" value={approveForm.description} onChange={(e) => setApproveForm({ ...approveForm, description: e.target.value })} required />
            </FormField>
            <FormField label="Workshop Name">
              <input className="input" value={approveForm.workshopName} onChange={(e) => setApproveForm({ ...approveForm, workshopName: e.target.value })} />
            </FormField>
            <FormField label="Estimated Cost (₹)">
              <input className="input" type="number" value={approveForm.estimatedCost} onChange={(e) => setApproveForm({ ...approveForm, estimatedCost: +e.target.value })} min="0" />
            </FormField>
            <FormField label="Start Date">
              <input className="input" type="date" value={approveForm.startDate} onChange={(e) => setApproveForm({ ...approveForm, startDate: e.target.value })} />
            </FormField>
            <FormField label="Odometer Reading (km)">
              <input className="input" type="number" value={approveForm.odometerReading} onChange={(e) => setApproveForm({ ...approveForm, odometerReading: +e.target.value })} min="0" />
            </FormField>
            <FormField label="Verification / Inspection Notes" style={{ gridColumn: 'span 2' }}>
              <textarea className="input" rows={2} value={approveForm.notes} onChange={(e) => setApproveForm({ ...approveForm, notes: e.target.value })} placeholder="Internal comments..." />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowApprove(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Approving...' : '✓ Approve & Send to Workshop'}</button>
          </div>
        </form>
      </Modal>

      {/* Close Modal (inspector marking ready) */}
      <Modal open={!!showClose} onClose={() => setShowClose(null)} title="Mark Vehicle Ready (On Road)" size="sm">
        <form onSubmit={handleClose}>
          {formError && <Alert type="error">{formError}</Alert>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
            Confirm completion of maintenance work for <strong>{showClose?.vehicle?.registrationNumber}</strong>.
          </p>
          <FormField label="Actual Cost (₹)" required>
            <input className="input" type="number" value={closeForm.actualCost}
              onChange={(e) => setCloseForm({ ...closeForm, actualCost: +e.target.value })} required min="0" />
          </FormField>
          <FormField label="Completion Notes">
            <textarea className="input" rows={3} value={closeForm.notes}
              onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })} placeholder="Work completed successfully..." />
          </FormField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowClose(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Marking Ready...' : '🏁 Mark Ready & Release'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!showDelete} onClose={() => setShowDelete(null)} onConfirm={handleDelete}
        title="Delete Record" message="Delete this maintenance record? This cannot be undone." danger />
    </div>
  );
}
