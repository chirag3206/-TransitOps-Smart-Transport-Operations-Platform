/**
 * TransitOps — Shared UI Components
 * KPICard, StatusBadge, Table, Modal, EmptyState, Spinner, PageHeader
 */
import './Components.css';

// ── KPI Card ───────────────────────────────────────────────────────────────
export function KPICard({ title, value, sub, icon, color = 'primary', trend }) {
  return (
    <div className={`kpi-card kpi-${color}`}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-body">
        <span className="kpi-value">{value ?? '—'}</span>
        <span className="kpi-title">{title}</span>
        {sub && <span className="kpi-sub">{sub}</span>}
        {trend !== undefined && (
          <span className={`kpi-trend ${trend >= 0 ? 'up' : 'down'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────
const STATUS_MAP = {
  Available:    'badge-success',
  'On Trip':    'badge-info',
  'In Shop':    'badge-warning',
  Suspended:    'badge-danger',
  'Off Duty':   'badge-gray',
  Completed:    'badge-success',
  Dispatched:   'badge-info',
  Cancelled:    'badge-danger',
  Draft:        'badge-gray',
  Active:       'badge-warning',
  Closed:       'badge-success',
  valid:        'badge-success',
  expiring_soon:'badge-warning',
  expired:      'badge-danger',
};

export function StatusBadge({ status }) {
  const cls = STATUS_MAP[status] || 'badge-gray';
  return <span className={`badge ${cls}`}>{status}</span>;
}

// ── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md' }) {
  return <div className={`spinner spinner-${size}`} />;
}

// ── Page Header ────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="page-action">{action}</div>}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────
export function EmptyState({ icon = '📭', title = 'No data', description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3 className="empty-title">{title}</h3>
      {description && <p className="empty-desc">{description}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal modal-${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{message}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Data Table ─────────────────────────────────────────────────────────────
export function DataTable({ columns, data, loading, rowKey = '_id', onRowClick }) {
  if (loading) return (
    <div className="table-loading">
      <Spinner size="lg" />
      <span>Loading...</span>
    </div>
  );

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key || col.header} style={col.width ? { width: col.width } : {}}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="table-empty">
                No records found
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={row[rowKey]}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'clickable' : ''}
              >
                {columns.map((col) => (
                  <td key={col.key || col.header}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Alert Banner ───────────────────────────────────────────────────────────
export function Alert({ type = 'info', children, onClose }) {
  const types = {
    info:    '🔵',
    success: '✅',
    warning: '⚠️',
    error:   '❌',
  };
  return (
    <div className={`alert alert-${type}`}>
      <span>{types[type]}</span>
      <span className="alert-text">{children}</span>
      {onClose && <button className="alert-close" onClick={onClose}>✕</button>}
    </div>
  );
}

// ── Form Input ─────────────────────────────────────────────────────────────
export function FormField({ label, error, required, children }) {
  return (
    <div className="form-field">
      {label && (
        <label className="form-label">
          {label} {required && <span className="required-mark">*</span>}
        </label>
      )}
      {children}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
