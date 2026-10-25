import { useMemo, useState } from 'react'

export default function BusinessCategoryMappingForm({
  mapping,
  businessTypes,
  categories,
  productTypes,
  error,
  onCancel,
  onSubmit,
  saving,
  suggestedSortOrder,
}) {
  const [values, setValues] = useState({
    businessTypeId: mapping?.businessTypeId ?? '',
    businessCategoryId: mapping?.businessCategoryId ?? '',
    productTypeIds: mapping?.productTypeIds ?? [],
    status: mapping?.status ?? 'active',
    sortOrder: String(mapping?.sortOrder ?? suggestedSortOrder),
  })
  const [productSearch, setProductSearch] = useState('')

  const availableCategories = useMemo(() => categories.filter((category) => (
    category.businessTypeId === values.businessTypeId
      && (category.active === true || category.id === mapping?.businessCategoryId)
  )), [categories, mapping?.businessCategoryId, values.businessTypeId])

  const filteredProductTypes = useMemo(() => {
    const term = productSearch.trim().toLocaleLowerCase()
    return productTypes.filter((productType) => (
      productType.status === 'active' || (mapping?.productTypeIds ?? []).includes(productType.id)
    )).filter((productType) => !term || [productType.name, productType.key]
      .some((value) => String(value || '').toLocaleLowerCase().includes(term)))
  }, [mapping?.productTypeIds, productSearch, productTypes])

  function changeBusinessType(businessTypeId) {
    setValues((current) => ({ ...current, businessTypeId, businessCategoryId: '' }))
  }

  function toggleProductType(id) {
    setValues((current) => ({
      ...current,
      productTypeIds: current.productTypeIds.includes(id)
        ? current.productTypeIds.filter((selectedId) => selectedId !== id)
        : [...current.productTypeIds, id],
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!saving) onSubmit(values)
  }

  return (
    <div className="business-type-modal-backdrop" onClick={() => !saving && onCancel()} role="presentation">
      <form
        aria-labelledby="business-category-mapping-form-title"
        aria-modal="true"
        className="business-type-modal category-mapping-form"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
      >
        <h2 id="business-category-mapping-form-title">
          {mapping ? 'Edit Business Category Mapping' : 'Create Business Category Mapping'}
        </h2>
        {error && <p className="store-feedback store-feedback-error" role="alert">{error}</p>}

        <label htmlFor="mapping-business-type">Business Type *</label>
        <select
          id="mapping-business-type"
          onChange={(event) => changeBusinessType(event.target.value)}
          required
          value={values.businessTypeId}
        >
          <option value="">Select a Business Type</option>
          {businessTypes.filter((type) => type.active === true || type.id === mapping?.businessTypeId).map((type) => (
            <option key={type.id} value={type.id}>{type.name || type.id}</option>
          ))}
        </select>

        <label htmlFor="mapping-business-category">Business Category *</label>
        <select
          disabled={!values.businessTypeId}
          id="mapping-business-category"
          onChange={(event) => setValues((current) => ({ ...current, businessCategoryId: event.target.value }))}
          required
          value={values.businessCategoryId}
        >
          <option value="">Select a Business Category</option>
          {availableCategories.map((category) => (
            <option key={category.id} value={category.id}>{category.name || category.id}</option>
          ))}
        </select>
        {values.businessTypeId && availableCategories.length === 0 && (
          <small className="category-mapping-hint">No active Business Categories are available for this Business Type.</small>
        )}

        <fieldset className="category-mapping-products">
          <legend>Active Product Types</legend>
          <input
            aria-label="Search Product Types"
            className="store-search"
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Search Product Types"
            type="search"
            value={productSearch}
          />
          {filteredProductTypes.length === 0 ? (
            <p className="category-mapping-hint">No active Product Types found.</p>
          ) : (
            <div className="category-mapping-product-list">
              {filteredProductTypes.map((productType) => (
                <label className="category-mapping-product-option" key={productType.id}>
                  <input
                    checked={values.productTypeIds.includes(productType.id)}
                    onChange={() => toggleProductType(productType.id)}
                    type="checkbox"
                  />
                  <span>{productType.name}</span>
                  <code>{productType.key}</code>
                  {productType.status !== 'active' && <small>Inactive (existing)</small>}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <small className="category-mapping-hint">Selected Product Type document IDs are saved with this mapping.</small>

        <label htmlFor="mapping-sort-order">Sort Order</label>
        <input
          id="mapping-sort-order"
          min="0"
          onChange={(event) => setValues((current) => ({ ...current, sortOrder: event.target.value }))}
          required
          step="1"
          type="number"
          value={values.sortOrder}
        />

        <label htmlFor="mapping-status">Status</label>
        <select
          id="mapping-status"
          onChange={(event) => setValues((current) => ({ ...current, status: event.target.value }))}
          value={values.status}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <div className="store-actions">
          <button className="store-btn" disabled={saving} onClick={onCancel} type="button">Cancel</button>
          <button className="store-btn store-btn-approve" disabled={saving} type="submit">
            {saving ? 'Saving...' : mapping ? 'Save Changes' : 'Save Mapping'}
          </button>
        </div>
      </form>
    </div>
  )
}
