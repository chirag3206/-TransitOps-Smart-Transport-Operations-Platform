/**
 * TransitOps — Drivers Page
 * List, create, update, safety score, license alert
 */
import { useState, useEffect, useCallback } from 'react';
import { driverAPI } from '../../services/api';
import {
  PageHeader, DataTable, StatusBadge, Modal, ConfirmDialog,
  EmptyState, Spinner, Alert, FormField, KPICard,
} from '../../components/Components';
import { useAuth } from '../../context/AuthContext';

const LICENSE_CATS = ['A', 'B', 'C', 'D', 'E', 'LMV', 'HMV'];
const INIT_FORM = {
  name: '', contactNumber: '', email: '', address: '',
  licenseNumber: '', licenseCategory: 'HMV',
  licenseExpiryDate: '', safetyScore: 80,
};

const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

function LicenseStatusBadge({ driver }) {
  if (!driver.licenseExpiryDate) return <span className="badge badge-gray">Unknown</span>;
  const days = Math.round((new Date(driver.licenseExpiryDate) - Date.now()) / 86400_000);
  if (days < 0)  return <span className="badge badge-danger">Expired</span>;
  if (days <= 30) return <span className="badge badge-warning">{days}d left</span>;
  return <span className="badge badge-success">Valid</span>;
}

export default function Drivers() {
  const { isFleetManager, isSafetyOfficer } = useAuth();
  const canManage = isFleetManager || isSafetyOfficer;

  const [drivers, setDrivers]       = useState([]);
  const [alerts, setAlerts]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit]     = useState(null);
  const [showDelete, setShowDelete] = useState(null);
  const [showScore, setShowScore]   = useState(null);
  const [form, setForm]             = useState(INIT_FORM);
  const [scoreForm, setScoreForm]   = useState({ safetyScore: 80, reason: '' });
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      const [dRes, aRes] = await Promise.all([
        driverAPI.list(params),
        driverAPI.expiringLicenses(),
      ]);
      setDrivers(dRes.data.data || []);
      setAlerts(aRes.data.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load drivers');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (d) => {
    setForm({
      name: d.name, contactNumber: d.contactNumber || '', email: d.email || '',
      address: d.address || '', licenseNumber: d.licenseNumber,
      licenseCategory: d.licenseCategory || 'HMV',
      licenseExpiryDate: d.licenseExpiryDate ? d.licenseExpiryDate.substring(0, 10) : '',
      safetyScore: d.safetyScore || 80,
    });
    setFormError('');
    setShowEdit(d);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (showEdit) {
        await driverAPI.update(showEdit._id, form);
      } else {
        await driverAPI.create(form);
      }
      setShowCreate(false);
      setShowEdit(null);
      setForm(INIT_FORM);
      load();
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to save driver');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await driverAPI.delete(showDelete._id);
      setShowDelete(null);
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete driver');
    }
  };

  const handleSafetyScore = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await driverAPI.updateSafetyScore(showScore._id, scoreForm);
      setShowScore(null);
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update score');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { header: 'Driver', key: 'name', render: (v, row) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="user-avatar" style={{ width: 34, height: 34, fontSize: 13, borderRadius: 10 }}>
          {v?.charAt(0) || 'D'}
        </div>
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{row.contactNumber}</div>
        </div>
      </div>
    )},
    { header: 'License #', key: 'licenseNumber', render: (v) => <code style={{ fontSize: 12 }}>{v}</code> },
    { header: 'Category', key: 'licenseCategory' },
    { header: 'License Status', key: '_id', render: (_, row) => <LicenseStatusBadge driver={row} /> },
    { header: 'Status', key: 'status', render: (v) => <StatusBadge status={v} /> },
    { header: 'Safety Score', key: 'safetyScore', render: (v) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', border: '2.5px solid',
          borderColor: v >= 90 ? '#10b981' : v >= 75 ? '#f59e0b' : '#ef4444',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700,
          color: v >= 90 ? '#10b981' : v >= 75 ? '#f59e0b' : '#ef4444',
        }}>{v}</div>
      </div>
    )},
    { header: 'Trips', key: 'totalTrips', render: (v) => v || 0 },
    ...(canManage ? [{
      header: 'Actions', key: '_id', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn-sm btn-ghost" onClick={() => openEdit(row)}>✏️</button>
          {isFleetManager && <button className="btn btn-sm btn-ghost" onClick={() => { setShowScore(row); setScoreForm({ safetyScore: row.safetyScore || 80, reason: '' }); }}>🛡️</button>}
          {isFleetManager && <button className="btn btn-sm btn-ghost" style={{ color: '#ef4444' }} onClick={() => setShowDelete(row)}>🗑️</button>}
        </div>
      )
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle={`${drivers.length} drivers registered`}
        action={isFleetManager && (
          <button className="btn btn-primary" onClick={() => { setForm(INIT_FORM); setFormError(''); setShowCreate(true); }}>
            + Add Driver
          </button>
        )}
      />

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* License Alerts */}
      {alerts.length > 0 && (
        <Alert type="warning">
          ⚠️ {alerts.length} driver{alerts.length > 1 ? 's have' : ' has'} a license expiring within 30 days:{' '}
          {alerts.map((a) => a.name).join(', ')}
        </Alert>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <input className="search-input" placeholder="Search by name or license..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={statusFilter} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {['Available', 'On Trip', 'Off Duty', 'Suspended'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-ghost" onClick={load}>↺ Refresh</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size="lg" /></div>
      ) : drivers.length === 0 ? (
        <EmptyState icon="👤" title="No drivers found" description="Add your first driver to get started." />
      ) : (
        <DataTable columns={columns} data={drivers} loading={false} />
      )}

      {/* Create / Edit Modal */}
      <Modal open={showCreate || !!showEdit} onClose={() => { setShowCreate(false); setShowEdit(null); }}
        title={showEdit ? 'Edit Driver' : 'Add Driver'} size="lg">
        <form onSubmit={handleSave}>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="form-grid-2">
            <FormField label="Full Name" required>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ravi Kumar" required />
            </FormField>
            <FormField label="Contact Number" required>
              <input className="input" value={form.contactNumber}
                onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} placeholder="9876543210" required />
            </FormField>
            <FormField label="Email">
              <input className="input" type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ravi@email.com" />
            </FormField>
            <FormField label="License Number" required>
              <input className="input" value={form.licenseNumber}
                onChange={(e) => setForm({ ...form, licenseNumber: e.target.value.toUpperCase() })} required
                disabled={!!showEdit} placeholder="DL-2020-1234567" />
            </FormField>
            <FormField label="License Category" required>
              <select className="input" value={form.licenseCategory}
                onChange={(e) => setForm({ ...form, licenseCategory: e.target.value })}>
                {LICENSE_CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="License Expiry Date" required>
              <input className="input" type="date" value={form.licenseExpiryDate}
                onChange={(e) => setForm({ ...form, licenseExpiryDate: e.target.value })} required />
            </FormField>
            <FormField label="Safety Score (0-100)">
              <input className="input" type="number" value={form.safetyScore}
                onChange={(e) => setForm({ ...form, safetyScore: +e.target.value })} min="0" max="100" />
            </FormField>
            <FormField label="Address">
              <input className="input" value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="12 Main St, Delhi" />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={() => { setShowCreate(false); setShowEdit(null); }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : showEdit ? 'Update Driver' : 'Add Driver'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Safety Score Modal */}
      <Modal open={!!showScore} onClose={() => setShowScore(null)} title="Update Safety Score" size="sm">
        <form onSubmit={handleSafetyScore}>
          <FormField label="New Safety Score (0-100)">
            <input className="input" type="number" value={scoreForm.safetyScore}
              onChange={(e) => setScoreForm({ ...scoreForm, safetyScore: +e.target.value })} min="0" max="100" required />
          </FormField>
          <FormField label="Reason for Change">
            <textarea className="input" rows={3} value={scoreForm.reason}
              onChange={(e) => setScoreForm({ ...scoreForm, reason: e.target.value })}
              placeholder="Safety audit results, incident report, etc." />
          </FormField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowScore(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Updating...' : 'Update Score'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!showDelete} onClose={() => setShowDelete(null)} onConfirm={handleDelete}
        title="Remove Driver" message={`Remove ${showDelete?.name}? This cannot be undone.`} danger />
    </div>
  );
}
