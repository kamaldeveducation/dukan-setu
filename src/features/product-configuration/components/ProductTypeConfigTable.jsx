const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function formatDate(date) {
  return date ? dateFormatter.format(date) : '—'
}

function StatusBadge({ status }) {
  const active = status === 'active'
  return <span className={`store-status store-status-${active ? 'approved' : 'rejected'}`}>{active ? 'Active' : 'Inactive'}</span>
}

function Actions({ productType, busy, onEdit, onToggleStatus }) {
  return (
    <div className="store-actions">
      <button className="store-btn" onClick={() => onEdit(productType)} type="button">Edit</button>
      <button className="store-btn" disabled={busy} onClick={() => onToggleStatus(productType)} type="button">
        {busy ? 'Saving...' : productType.status === 'active' ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  )
}

export default function ProductTypeConfigTable({ productTypes, busyId, onEdit, onToggleStatus }) {
  return (
    <>
      <div className="product-type-config-table-wrap">
        <table className="business-type-table product-type-config-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Description</th>
              <th>Status</th>
              <th>Sort Order</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {productTypes.map((productType) => (
              <tr key={productType.id}>
                <td><strong>{productType.name}</strong></td>
                <td><code>{productType.key}</code></td>
                <td className="product-type-config-description">{productType.description || '—'}</td>
                <td><StatusBadge status={productType.status} /></td>
                <td>{productType.sortOrder}</td>
                <td>{formatDate(productType.createdAt)}</td>
                <td><Actions busy={busyId === productType.id} onEdit={onEdit} onToggleStatus={onToggleStatus} productType={productType} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="business-type-cards product-type-config-cards">
        {productTypes.map((productType) => (
          <li key={productType.id}>
            <div className="business-type-card-head">
              <strong>{productType.name}</strong>
              <StatusBadge status={productType.status} />
            </div>
            <p><code>{productType.key}</code></p>
            <p>{productType.description || 'No description'}</p>
            <p>Sort Order: {productType.sortOrder} · Created: {formatDate(productType.createdAt)}</p>
            <Actions busy={busyId === productType.id} onEdit={onEdit} onToggleStatus={onToggleStatus} productType={productType} />
          </li>
        ))}
      </ul>
    </>
  )
}
