const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function formatDate(date) {
  return date ? dateFormatter.format(date) : '—'
}

function StatusBadge({ status }) {
  const active = status === 'active'
  return <span className={`store-status store-status-${active ? 'approved' : 'rejected'}`}>{active ? 'Active' : 'Inactive'}</span>
}

function Actions({ mapping, busy, onEdit, onToggleStatus }) {
  return (
    <div className="store-actions">
      <button className="store-btn" onClick={() => onEdit(mapping)} type="button">Edit</button>
      <button className="store-btn" disabled={busy} onClick={() => onToggleStatus(mapping)} type="button">
        {busy ? 'Saving...' : mapping.status === 'active' ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  )
}

export default function BusinessCategoryMappingTable({
  mappings,
  businessTypesById,
  categoriesByPair,
  productTypesById,
  busyId,
  onEdit,
  onToggleStatus,
}) {
  function productNames(mapping) {
    return mapping.productTypeIds.map((id) => productTypesById.get(id)?.name || id).join(', ') || '—'
  }

  function row(mapping) {
    const typeName = businessTypesById.get(mapping.businessTypeId)?.name || mapping.businessTypeId
    const categoryName = categoriesByPair.get(`${mapping.businessTypeId}:${mapping.businessCategoryId}`)?.name || mapping.businessCategoryId
    return (
      <tr key={mapping.id}>
        <td>{typeName}</td>
        <td>{categoryName}</td>
        <td className="category-mapping-product-names">{productNames(mapping)}</td>
        <td><StatusBadge status={mapping.status} /></td>
        <td>{mapping.sortOrder}</td>
        <td>{formatDate(mapping.createdAt)}</td>
        <td><Actions busy={busyId === mapping.id} mapping={mapping} onEdit={onEdit} onToggleStatus={onToggleStatus} /></td>
      </tr>
    )
  }

  return (
    <>
      <div className="category-mapping-table-wrap">
        <table className="business-type-table category-mapping-table">
          <thead>
            <tr>
              <th>Business Type</th>
              <th>Business Category</th>
              <th>Product Types</th>
              <th>Status</th>
              <th>Sort Order</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>{mappings.map(row)}</tbody>
        </table>
      </div>
      <ul className="business-type-cards category-mapping-cards">
        {mappings.map((mapping) => {
          const typeName = businessTypesById.get(mapping.businessTypeId)?.name || mapping.businessTypeId
          const categoryName = categoriesByPair.get(`${mapping.businessTypeId}:${mapping.businessCategoryId}`)?.name || mapping.businessCategoryId
          return (
            <li key={mapping.id}>
              <div className="business-type-card-head">
                <strong>{typeName} / {categoryName}</strong>
                <StatusBadge status={mapping.status} />
              </div>
              <p>Product Types: {productNames(mapping)}</p>
              <p>Sort Order: {mapping.sortOrder} · Created: {formatDate(mapping.createdAt)}</p>
              <Actions busy={busyId === mapping.id} mapping={mapping} onEdit={onEdit} onToggleStatus={onToggleStatus} />
            </li>
          )
        })}
      </ul>
    </>
  )
}
