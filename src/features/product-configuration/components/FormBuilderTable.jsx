const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function formatDate(date) {
  return date ? dateFormatter.format(date) : '—'
}

function StatusBadge({ status }) {
  const active = status === 'active'
  return <span className={`store-status store-status-${active ? 'approved' : 'rejected'}`}>{active ? 'Active' : 'Inactive'}</span>
}

function Actions({ config, busy, onEdit, onToggleStatus, onDelete }) {
  return (
    <div className="store-actions">
      <button className="store-btn" onClick={() => onEdit(config)} type="button">Edit</button>
      <button className="store-btn" disabled={busy} onClick={() => onToggleStatus(config)} type="button">
        {busy ? 'Saving...' : config.status === 'active' ? 'Deactivate' : 'Activate'}
      </button>
      <button className="store-btn store-btn-reject" disabled={busy} onClick={() => onDelete(config)} type="button">Delete</button>
    </div>
  )
}

export default function FormBuilderTable({ configs, busyId, productTypeName, onEdit, onToggleStatus, onDelete }) {
  const fieldCount = (config) => config.groups.reduce((total, group) => total + group.fields.length, 0)
  return (
    <>
      <div className="product-type-config-table-wrap">
        <table className="business-type-table product-type-config-table">
          <thead>
            <tr>
              <th>Form Name</th>
              <th>Product Type</th>
              <th>Groups</th>
              <th>Fields</th>
              <th>Status</th>
              <th>Updated At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((config) => (
              <tr key={config.id}>
                <td><strong>{config.name}</strong></td>
                <td>{productTypeName(config)}</td>
                <td>{config.groups.length}</td>
                <td>{fieldCount(config)}</td>
                <td><StatusBadge status={config.status} /></td>
                <td>{formatDate(config.updatedAt)}</td>
                <td><Actions busy={busyId === config.id} config={config} onDelete={onDelete} onEdit={onEdit} onToggleStatus={onToggleStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="business-type-cards product-type-config-cards">
        {configs.map((config) => (
          <li key={config.id}>
            <div className="business-type-card-head">
              <strong>{config.name}</strong>
              <StatusBadge status={config.status} />
            </div>
            <p>Product Type: {productTypeName(config)}</p>
            <p>{config.groups.length} groups · {fieldCount(config)} fields · Updated: {formatDate(config.updatedAt)}</p>
            <Actions busy={busyId === config.id} config={config} onDelete={onDelete} onEdit={onEdit} onToggleStatus={onToggleStatus} />
          </li>
        ))}
      </ul>
    </>
  )
}
