import { FIELD_GROUP_STATUS, FIELD_GROUP_STATUS_LABELS } from '../types/fieldGroup.types'

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function formatDate(date) {
  return date ? dateFormatter.format(date) : '—'
}

function StatusBadge({ status }) {
  const approved = status === FIELD_GROUP_STATUS.active
  return <span className={`store-status store-status-${approved ? 'approved' : 'rejected'}`}>{FIELD_GROUP_STATUS_LABELS[status]}</span>
}

function RowActions({ group, onEdit, onDelete }) {
  return (
    <div className="store-actions">
      <button className="store-btn" onClick={() => onEdit(group)} type="button">Edit</button>
      <button className="store-btn store-btn-reject" onClick={() => onDelete(group)} type="button">Delete</button>
    </div>
  )
}

export default function FieldGroupTable({ groups, onEdit, onDelete }) {
  return (
    <>
      <table className="business-type-table field-group-table">
        <thead>
          <tr>
            <th>Group Name</th>
            <th>Group Key</th>
            <th>Description</th>
            <th>Status</th>
            <th>Sort Order</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.id}>
              <td><strong>{group.name}</strong></td>
              <td><code>{group.key}</code></td>
              <td className="field-group-description">{group.description || '—'}</td>
              <td><StatusBadge status={group.status} /></td>
              <td>{group.sortOrder}</td>
              <td>{formatDate(group.createdAt)}</td>
              <td><RowActions group={group} onDelete={onDelete} onEdit={onEdit} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="business-type-cards">
        {groups.map((group) => (
          <li key={group.id}>
            <div className="business-type-card-head"><strong>{group.name}</strong><StatusBadge status={group.status} /></div>
            <p><code>{group.key}</code> <span>Sort {group.sortOrder}</span></p>
            {group.description && <p>{group.description}</p>}
            <p>Created: {formatDate(group.createdAt)}</p>
            <RowActions group={group} onDelete={onDelete} onEdit={onEdit} />
          </li>
        ))}
      </ul>
    </>
  )
}
