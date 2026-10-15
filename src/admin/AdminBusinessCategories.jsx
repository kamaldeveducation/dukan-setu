import { useEffect, useState } from 'react'
import { generateBusinessTypeCode, listBusinessTypes } from '../services/businessTypeService'
import {
  createBusinessCategory,
  listBusinessCategories,
  setBusinessCategoryActive,
  updateBusinessCategory,
} from '../services/businessCategoryService'

const emptyForm = { name: '', code: '', description: '', sortOrder: '1', active: true }
const statusFilters = ['all', 'active', 'inactive']

export default function AdminBusinessCategories() {
  const [businessTypes, setBusinessTypes] = useState([])
  const [typesLoading, setTypesLoading] = useState(true)
  const [typesError, setTypesError] = useState('')
  const [selectedTypeId, setSelectedTypeId] = useState('')

  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [dialogType, setDialogType] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [codeEdited, setCodeEdited] = useState(false)
  const [formError, setFormError] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    let active = true
    listBusinessTypes()
      .then((records) => {
        if (!active) return
        setBusinessTypes(records)
        setTypesLoading(false)
      })
      .catch((error) => {
        if (!active) return
        setTypesError(error.message || 'Could not load Business Types.')
        setTypesLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedTypeId) return undefined
    let active = true
    listBusinessCategories(selectedTypeId)
      .then((records) => {
        if (!active) return
        setCategories(records)
        setLoading(false)
      })
      .catch((error) => {
        if (!active) return
        setLoadError(error.message || 'Could not load Business Categories.')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedTypeId, reload])

  const selectedType = businessTypes.find((type) => type.id === selectedTypeId) || null

  const counts = {
    all: categories.length,
    active: categories.filter((category) => category.active === true).length,
    inactive: categories.filter((category) => category.active !== true).length,
  }
  const term = search.trim().toLocaleLowerCase()
  const visibleCategories = categories
    .filter((category) => statusFilter === 'all' || (statusFilter === 'active' ? category.active === true : category.active !== true))
    .filter((category) => !term || [category.name, category.code].some((value) => String(value || '').toLocaleLowerCase().includes(term)))

  function openCreate() {
    if (!selectedTypeId) return
    setForm({ ...emptyForm, sortOrder: String(categories.length + 1) })
    setCodeEdited(false)
    setFormError('')
    setDialogType({ mode: 'create' })
  }

  function openEdit(category) {
    setForm({
      name: category.name || '',
      code: category.code || category.id,
      description: category.description || '',
      sortOrder: String(category.sortOrder ?? 1),
      active: category.active === true,
    })
    setCodeEdited(true)
    setFormError('')
    setDialogType({ mode: 'edit', id: category.id })
  }

  async function submitForm(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setFormError('')
    try {
      const values = {
        name: form.name,
        code: form.code,
        description: form.description,
        sortOrder: Number(form.sortOrder),
        active: form.active,
      }
      if (dialogType.mode === 'edit') {
        await updateBusinessCategory(selectedTypeId, dialogType.id, values)
        setFeedback({ type: 'success', text: `${form.name.trim()} was updated.` })
      } else {
        await createBusinessCategory(selectedTypeId, values)
        setFeedback({ type: 'success', text: `${form.name.trim()} was added.` })
      }
      setDialogType(null)
      setLoading(true)
      setReload((current) => current + 1)
    } catch (error) {
      setFormError(error.message || 'The Business Category could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(category) {
    setBusyId(category.id)
    setFeedback(null)
    try {
      await setBusinessCategoryActive(selectedTypeId, category.id, category.active !== true)
      setFeedback({ type: 'success', text: `${category.name} was ${category.active === true ? 'deactivated' : 'activated'}.` })
      setLoading(true)
      setReload((current) => current + 1)
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'The status could not be changed.' })
    } finally {
      setBusyId('')
    }
  }

  function retryTypes() {
    setTypesError('')
    setTypesLoading(true)
    listBusinessTypes()
      .then((records) => {
        setBusinessTypes(records)
        setTypesLoading(false)
      })
      .catch((error) => {
        setTypesError(error.message || 'Could not load Business Types.')
        setTypesLoading(false)
      })
  }

  function retryLoad() {
    setLoadError('')
    setLoading(true)
    setReload((current) => current + 1)
  }

  return (
    <section className="admin-business-categories" aria-labelledby="business-categories-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">DUKAN SETU / BUSINESS CATEGORIES</p>
          <h1 id="business-categories-title">Business Categories</h1>
          <p className="dashboard-intro">Manage the categories available within each Business Type.</p>
        </div>
        <button className="store-btn store-btn-approve" disabled={!selectedTypeId} onClick={openCreate} type="button">Add Category</button>
      </div>

      {feedback && <p className={`store-feedback store-feedback-${feedback.type}`} role="status">{feedback.text}</p>}

      <div className="business-category-type-select">
        <label htmlFor="business-category-type">Business Type</label>
        {typesLoading ? (
          <p className="store-state" role="status">Loading Business Types...</p>
        ) : typesError ? (
          <div className="store-state store-state-error" role="alert">
            <p>Could not load Business Types: {typesError}</p>
            <button className="store-btn" onClick={retryTypes} type="button">Retry</button>
          </div>
        ) : businessTypes.length === 0 ? (
          <p className="store-state">No Business Types exist yet. Add one under Business Types first.</p>
        ) : (
          <select
            id="business-category-type"
            onChange={(event) => {
              const value = event.target.value
              setSelectedTypeId(value)
              setFeedback(null)
              setLoadError('')
              setLoading(Boolean(value))
            }}
            value={selectedTypeId}
          >
            <option value="">Select a Business Type…</option>
            {businessTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}{type.active !== true ? ' (Inactive)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {!selectedTypeId ? (
        <p className="store-state">Select a Business Type above to view and manage its categories.</p>
      ) : (
        <>
          {selectedType && selectedType.active !== true && (
            <p className="store-feedback store-feedback-error" role="status">
              This Business Type is inactive. Its categories can still be managed here, but the type is hidden from new store registrations.
            </p>
          )}

          <div className="business-type-toolbar">
            <div className="store-tabs" aria-label="Filter Business Categories by status">
              {statusFilters.map((item) => (
                <button
                  aria-pressed={statusFilter === item}
                  className={statusFilter === item ? 'active' : ''}
                  key={item}
                  onClick={() => setStatusFilter(item)}
                  type="button"
                >
                  {item === 'all' ? 'All' : item === 'active' ? 'Active' : 'Inactive'} ({counts[item]})
                </button>
              ))}
            </div>
            <input
              aria-label="Search Business Categories"
              className="store-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or code"
              type="search"
              value={search}
            />
          </div>

          {loading ? (
            <p className="store-state" role="status">Loading Business Categories...</p>
          ) : loadError ? (
            <div className="store-state store-state-error" role="alert">
              <p>Could not load Business Categories: {loadError}</p>
              <button className="store-btn" onClick={retryLoad} type="button">Retry</button>
            </div>
          ) : categories.length === 0 ? (
            <p className="store-state">No Business Categories have been added for {selectedType?.name || 'this Business Type'} yet.</p>
          ) : visibleCategories.length === 0 ? (
            <p className="store-state">No Business Categories match your search or filter.</p>
          ) : (
            <>
              <table className="business-type-table">
                <thead><tr><th>Name</th><th>Code</th><th>Business Type</th><th>Description</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {visibleCategories.map((category) => (
                    <tr key={category.id}>
                      <td><strong>{category.name}</strong></td>
                      <td><code>{category.code || category.id}</code></td>
                      <td>{selectedType?.name || '—'}</td>
                      <td>{category.description || '—'}</td>
                      <td>{category.sortOrder ?? '—'}</td>
                      <td><span className={`store-status store-status-${category.active === true ? 'approved' : 'rejected'}`}>{category.active === true ? 'Active' : 'Inactive'}</span></td>
                      <td><div className="store-actions"><button className="store-btn" onClick={() => openEdit(category)} type="button">Edit</button><button className="store-btn" disabled={busyId === category.id} onClick={() => toggleActive(category)} type="button">{busyId === category.id ? 'Saving...' : category.active === true ? 'Deactivate' : 'Activate'}</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="business-type-cards">
                {visibleCategories.map((category) => (
                  <li key={category.id}>
                    <div className="business-type-card-head"><strong>{category.name}</strong><span className={`store-status store-status-${category.active === true ? 'approved' : 'rejected'}`}>{category.active === true ? 'Active' : 'Inactive'}</span></div>
                    <p><code>{category.code || category.id}</code> <span>Order {category.sortOrder ?? '—'}</span></p>
                    <p>{selectedType?.name || '—'}</p>
                    {category.description && <p>{category.description}</p>}
                    <div className="store-actions"><button className="store-btn" onClick={() => openEdit(category)} type="button">Edit</button><button className="store-btn" disabled={busyId === category.id} onClick={() => toggleActive(category)} type="button">{busyId === category.id ? 'Saving...' : category.active === true ? 'Deactivate' : 'Activate'}</button></div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {dialogType && (
        <div className="business-type-modal-backdrop" onClick={() => !saving && setDialogType(null)} role="presentation">
          <form aria-labelledby="business-category-form-title" aria-modal="true" className="business-type-modal" onClick={(event) => event.stopPropagation()} onSubmit={submitForm} role="dialog">
            <h2 id="business-category-form-title">{dialogType.mode === 'edit' ? 'Edit Business Category' : 'Add Business Category'}</h2>
            {formError && <p className="store-feedback store-feedback-error" role="alert">{formError}</p>}
            <label htmlFor="business-category-business-type">Business Type</label>
            <input id="business-category-business-type" readOnly value={selectedType?.name || selectedTypeId} />
            <label htmlFor="business-category-name">Category name</label>
            <input
              autoFocus
              id="business-category-name"
              maxLength={80}
              onChange={(event) => {
                const name = event.target.value
                setForm((current) => ({
                  ...current,
                  name,
                  ...(dialogType.mode === 'create' && !codeEdited ? { code: generateBusinessTypeCode(name) } : {}),
                }))
              }}
              required
              value={form.name}
            />
            <label htmlFor="business-category-code">Category code</label>
            <input
              id="business-category-code"
              maxLength={50}
              onChange={(event) => {
                setCodeEdited(true)
                setForm((current) => ({ ...current, code: event.target.value }))
              }}
              pattern="[a-z0-9]+(_[a-z0-9]+)*"
              readOnly={dialogType.mode === 'edit'}
              required
              title="Use lowercase letters, numbers and underscores."
              value={form.code}
            />
            <label htmlFor="business-category-description">Description</label>
            <textarea id="business-category-description" maxLength={300} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} value={form.description} />
            <label htmlFor="business-category-sort-order">Sort order</label>
            <input id="business-category-sort-order" min="0" onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} required type="number" value={form.sortOrder} />
            {dialogType.mode === 'edit' && (
              <>
                <label htmlFor="business-category-status">Status</label>
                <select id="business-category-status" onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === 'active' }))} value={form.active ? 'active' : 'inactive'}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </>
            )}
            <div className="store-actions">
              <button className="store-btn" disabled={saving} onClick={() => setDialogType(null)} type="button">Cancel</button>
              <button className="store-btn store-btn-approve" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save Category'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
