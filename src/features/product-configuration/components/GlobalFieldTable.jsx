const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function formatDate(date) {
  return date ? dateFormatter.format(date) : '—'
}

function StatusBadge({ status }) {
  const active = status === 'active'
  return <span className={`store-status store-status-${active ? 'approved' : 'rejected'}`}>{active ? 'Active' : 'Inactive'}</span>
}

function Actions({ field, busy, onEdit, onStatusChange, onDelete }) {
  return (
    <div className="store-actions">
      <button className="store-btn" onClick={() => onEdit(field)} type="button">Edit</button>
      <button className="store-btn" disabled={busy} onClick={() => onStatusChange(field)} type="button">
        {busy ? 'Saving...' : field.status === 'active' ? 'Deactivate' : 'Activate'}
      </button>
      <button className="store-btn store-btn-reject" onClick={() => onDelete(field)} type="button">Delete</button>
    </div>
  )
}

export default function GlobalFieldTable({ fields, groupsById, onEdit, onStatusChange, onDelete, busyId, typeLabels }) {
  return (
    <>
      <div className="global-field-table-wrap">
        <table className="business-type-table global-field-table">
          <thead>
            <tr>
              <th>Field Name</th>
              <th>Field Key</th>
              <th>Field Type</th>
              <th>Field Group</th>
              <th>Status</th>
              <th>Updated At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.id}>
                <td><strong>{field.name}</strong><small className="global-field-label">{field.label}</small></td>
                <td><code>{field.key}</code></td>
                <td>{typeLabels[field.fieldType] || field.fieldType}</td>
                <td>{groupsById.get(field.groupId)?.name || field.groupKey || 'Unavailable'}</td>
                <td><StatusBadge status={field.status} /></td>
                <td>{formatDate(field.updatedAt)}</td>
                <td><Actions busy={busyId === field.id} field={field} onDelete={onDelete} onEdit={onEdit} onStatusChange={onStatusChange} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="business-type-cards global-field-cards">
        {fields.map((field) => (
          <li key={field.id}>
            <div className="business-type-card-head"><strong>{field.name}</strong><StatusBadge status={field.status} /></div>
            <p><code>{field.key}</code></p>
            <p>{field.label} · {typeLabels[field.fieldType] || field.fieldType}</p>
            <p>Group: {groupsById.get(field.groupId)?.name || field.groupKey || 'Unavailable'}</p>
            <p>Updated: {formatDate(field.updatedAt)}</p>
            <Actions busy={busyId === field.id} field={field} onDelete={onDelete} onEdit={onEdit} onStatusChange={onStatusChange} />
          </li>
        ))}
      </ul>
    </>
  )
}
