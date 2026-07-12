/**
 * TransitOps — Vehicles Page
 * Full CRUD: list, create, update, status change, delete
 */
import { useState, useEffect, useCallback } from 'react';
import { vehicleAPI } from '../../services/api';
import {
  PageHeader, DataTable, StatusBadge, Modal, ConfirmDialog,
  EmptyState, Spinner, Alert, FormField,
} from '../../components/Components';
import { useAuth } from '../../context/AuthContext';

const VEHICLE_TYPES  = ['Truck', 'Van', 'Pickup', 'Flatbed', 'Tanker', 'Refrigerated', 'Bus', 'Motorcycle'];
const FUEL_TYPES     = ['Diesel', 'Petrol', 'CNG', 'Electric', 'Hybrid'];
const STATUS_OPTIONS = ['Available', 'In Shop', 'Retired'];

const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

const INIT_FORM = {
  registrationNumber: '', name: '', type: 'Truck', make: '', model: '',
  year: new Date().getFullYear(), fuelType: 'Diesel', maxLoadCapacity: '',
  acquisitionCost: '', odometer: 0,
};

export default function Vehicles() {
  const { isFleetManager } = useAuth();
  const [vehicles, setVehicles]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [typeFilter, setType]     = useState('');
  const [statusFilter, setStatus] = useState('');

  const [showCreate, setShowCreate]   = useState(false);
  const [showEdit, setShowEdit]       = useState(null); // vehicle object
  const [showDelete, setShowDelete]   = useState(null);
  const [showStatus, setShowStatus]   = useState(null);
  const [form, setForm]               = useState(INIT_FORM);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (typeFilter)   params.type   = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const { data } = await vehicleAPI.list(params);
      setVehicles(data.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (v) => {
    setForm({
      registrationNumber: v.registrationNumber,
      name: v.name, type: v.type, make: v.make || '', model: v.model || '',
      year: v.year || new Date().getFullYear(), fuelType: v.fuelType || 'Diesel',
      maxLoadCapacity: v.maxLoadCapacity, acquisitionCost: v.acquisitionCost,
      odometer: v.odometer || 0,
    });
    setFormError('');
    setShowEdit(v);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (showEdit) {
        await vehicleAPI.update(showEdit._id, form);
      } else {
        await vehicleAPI.create(form);
      }
      setShowCreate(false);
      setShowEdit(null);
      setForm(INIT_FORM);
      load();
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to save vehicle');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await vehicleAPI.delete(showDelete._id);
      setShowDelete(null);
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete vehicle');
    }
  };

  const handleStatusChange = async (v, newStatus) => {
    try {
      await vehicleAPI.updateStatus(v._id, { status: newStatus });
      load();
      setShowStatus(null);
    } catch (e) {
      setError(e.response?.data?.message || 'Cannot change status');
    }
  };

  const columns = [
    { header: 'Registration', key: 'registrationNumber', render: (v) => <code style={{ fontFamily: 'monospace', fontSize: 13 }}>{v}</code> },
    { header: 'Name / Model', key: 'name', render: (v, row) => (
      <div>
        <div style={{ fontWeight: 600 }}>{v}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{row.make} {row.model} {row.year}</div>
      </div>
    )},
    { header: 'Type', key: 'type' },
    { header: 'Status', key: 'status', render: (v) => <StatusBadge status={v} /> },
    { header: 'Capacity', key: 'maxLoadCapacity', render: (v) => `${fmt(v)} kg` },
    { header: 'Odometer', key: 'odometer', render: (v) => `${fmt(v)} km` },
    { header: 'Revenue', key: 'totalRevenue', render: (v) => `₹${fmt(v)}` },
    ...(isFleetManager ? [{
      header: 'Actions', key: '_id', render: (_, row) => (
        <div className="table-actions">
          <button className="btn btn-sm btn-ghost" onClick={() => openEdit(row)}>✏️</button>
          {row.status !== 'On Trip' && (
            <button className="btn btn-sm btn-ghost" onClick={() => setShowStatus(row)}>⚙️</button>
          )}
          <button className="btn btn-sm btn-ghost" style={{ color: '#ef4444' }} onClick={() => setShowDelete(row)}>🗑️</button>
        </div>
      )
    }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle={`${vehicles.length} vehicles in your fleet`}
        action={isFleetManager && (
          <button className="btn btn-primary" onClick={() => { setForm(INIT_FORM); setFormError(''); setShowCreate(true); }}>
            + Add Vehicle
          </button>
        )}
      />

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Filters */}
      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="Search by name or registration..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" value={typeFilter} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="input" value={statusFilter} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {['Available', 'On Trip', 'In Shop', 'Retired'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-ghost" onClick={load}>↺ Refresh</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size="lg" /></div>
      ) : vehicles.length === 0 ? (
        <EmptyState icon="🚛" title="No vehicles found" description="Add your first vehicle to get started." />
      ) : (
        <DataTable columns={columns} data={vehicles} loading={false} />
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={showCreate || !!showEdit}
        onClose={() => { setShowCreate(false); setShowEdit(null); }}
        title={showEdit ? 'Edit Vehicle' : 'Add Vehicle'}
        size="lg"
      >
        <form onSubmit={handleSave}>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="form-grid-2">
            <FormField label="Registration Number" required>
              <input className="input" value={form.registrationNumber}
                onChange={(e) => setForm({ ...form, registrationNumber: e.target.value.toUpperCase() })}
                placeholder="MH-01-AB-1234" required disabled={!!showEdit} />
            </FormField>
            <FormField label="Vehicle Name" required>
              <input className="input" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mumbai Express" required />
            </FormField>
            <FormField label="Type" required>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Fuel Type">
              <select className="input" value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })}>
                {FUEL_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Make">
              <input className="input" value={form.make}
                onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Tata" />
            </FormField>
            <FormField label="Model">
              <input className="input" value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Prima 4930.S" />
            </FormField>
            <FormField label="Year">
              <input className="input" type="number" value={form.year}
                onChange={(e) => setForm({ ...form, year: +e.target.value })} min="2000" max="2030" />
            </FormField>
            <FormField label="Max Load Capacity (kg)" required>
              <input className="input" type="number" value={form.maxLoadCapacity}
                onChange={(e) => setForm({ ...form, maxLoadCapacity: +e.target.value })} required min="1" />
            </FormField>
            <FormField label="Acquisition Cost (₹)" required>
              <input className="input" type="number" value={form.acquisitionCost}
                onChange={(e) => setForm({ ...form, acquisitionCost: +e.target.value })} required min="0" />
            </FormField>
            <FormField label="Current Odometer (km)">
              <input className="input" type="number" value={form.odometer}
                onChange={(e) => setForm({ ...form, odometer: +e.target.value })} min="0" />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={() => { setShowCreate(false); setShowEdit(null); }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : showEdit ? 'Update Vehicle' : 'Create Vehicle'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Status Change Modal */}
      <Modal open={!!showStatus} onClose={() => setShowStatus(null)} title="Change Vehicle Status" size="sm">
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
          Change status for <strong>{showStatus?.name}</strong>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STATUS_OPTIONS.map((s) => (
            <button key={s} className="btn btn-ghost" style={{ justifyContent: 'flex-start' }}
              onClick={() => handleStatusChange(showStatus, s)}
              disabled={showStatus?.status === s}>
              {showStatus?.status === s ? '✓ ' : ''}{s}
            </button>
          ))}
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!showDelete}
        onClose={() => setShowDelete(null)}
        onConfirm={handleDelete}
        title="Delete Vehicle"
        message={`Are you sure you want to remove ${showDelete?.name}? This cannot be undone.`}
        danger
      />
    </div>
  );
}
