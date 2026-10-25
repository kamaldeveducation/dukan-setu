import { useState } from 'react'
import { generateProductTypeKey } from '../services/productTypeConfigService'

export default function ProductTypeConfigForm({ productType, error, onCancel, onSubmit, saving, suggestedSortOrder }) {
  const editing = Boolean(productType)
  const [values, setValues] = useState({
    name: productType?.name ?? '',
    key: productType?.key ?? '',
    description: productType?.description ?? '',
    status: productType?.status ?? 'active',
    sortOrder: String(productType?.sortOrder ?? suggestedSortOrder),
  })
  const [keyEdited, setKeyEdited] = useState(editing)

  function setValue(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!saving) onSubmit(values)
  }

  return (
    <div className="business-type-modal-backdrop" onClick={() => !saving && onCancel()} role="presentation">
      <form
        aria-labelledby="product-type-config-form-title"
        aria-modal="true"
        className="business-type-modal product-type-config-form"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
      >
        <h2 id="product-type-config-form-title">{editing ? 'Edit Product Type' : 'Add Product Type'}</h2>
        {error && <p className="store-feedback store-feedback-error" role="alert">{error}</p>}

        <label htmlFor="product-type-config-name">Product Type Name *</label>
        <input
          autoFocus
          id="product-type-config-name"
          maxLength={80}
          onChange={(event) => {
            const name = event.target.value
            setValues((current) => ({
              ...current,
              name,
              ...(!keyEdited ? { key: generateProductTypeKey(name) } : {}),
            }))
          }}
          required
          value={values.name}
        />

        <label htmlFor="product-type-config-key">Product Type Key *</label>
        <input
          autoComplete="off"
          id="product-type-config-key"
          maxLength={50}
          onChange={(event) => {
            setKeyEdited(true)
            setValue('key', event.target.value)
          }}
          pattern="[a-z0-9]+(_[a-z0-9]+)*"
          required
          title="Use lowercase letters, numbers, and single underscores."
          value={values.key}
        />
        <small className="product-type-config-hint">Generated from the name. Use lowercase snake_case; the key must be unique.</small>

        <label htmlFor="product-type-config-description">Description</label>
        <textarea
          id="product-type-config-description"
          maxLength={300}
          onChange={(event) => setValue('description', event.target.value)}
          rows={3}
          value={values.description}
        />

        <label htmlFor="product-type-config-status">Status</label>
        <select id="product-type-config-status" onChange={(event) => setValue('status', event.target.value)} value={values.status}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <label htmlFor="product-type-config-sort-order">Sort Order</label>
        <input
          id="product-type-config-sort-order"
          min="0"
          onChange={(event) => setValue('sortOrder', event.target.value)}
          required
          step="1"
          type="number"
          value={values.sortOrder}
        />

        <div className="store-actions">
          <button className="store-btn" disabled={saving} onClick={onCancel} type="button">Cancel</button>
          <button className="store-btn store-btn-approve" disabled={saving} type="submit">
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Product Type'}
          </button>
        </div>
      </form>
    </div>
  )
}
