import { useEffect, useState } from 'react'
import {
  createBusinessType,
  generateBusinessTypeCode,
  listBusinessTypes,
  seedInitialBusinessTypes,
  setBusinessTypeActive,
  updateBusinessType,
} from '../services/businessTypeService'

const emptyForm = { code: '', name: '', description: '', sortOrder: '1' }
const filters = ['all', 'active', 'inactive']

export default function AdminBusinessTypes() {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
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
        setTypes(records)
        setLoading(false)
      })
      .catch((error) => {
        if (!active) return
        setLoadError(error.message || 'Could not load Business Types.')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reload])

  const counts = {
    all: types.length,
    active: types.filter((type) => type.active === true).length,
    inactive: types.filter((type) => type.active !== true).length,
  }
  const term = search.trim().toLocaleLowerCase()
  const visibleTypes = types
    .filter((type) => filter === 'all' || (filter === 'active' ? type.active === true : type.active !== true))
    .filter((type) => !term || [type.name, type.code, type.description]
      .some((value) => String(value || '').toLocaleLowerCase().includes(term)))

  function openCreate() {
    setDialogType(null)
    setForm({ ...emptyForm, sortOrder: String(types.length + 1) })
    setCodeEdited(false)
    setFormError('')
    setDialogType({ mode: 'create' })
  }

  function openEdit(type) {
    setForm({
      code: type.code || type.id,
      name: type.name || '',
      description: type.description || '',
      sortOrder: String(type.sortOrder ?? 1),
    })
    setCodeEdited(true)
    setFormError('')
    setDialogType({ mode: 'edit', id: type.id })
  }

  async function submitForm(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setFormError('')
    try {
      const values = {
        code: form.code,
        name: form.name,
        description: form.description,
        sortOrder: Number(form.sortOrder),
      }
      if (dialogType.mode === 'edit') {
        await updateBusinessType(dialogType.id, values)
        setFeedback({ type: 'success', text: `${form.name.trim()} was updated.` })
      } else {
        await createBusinessType(values)
        setFeedback({ type: 'success', text: `${form.name.trim()} was added.` })
      }
      setDialogType(null)
      setLoading(true)
      setReload((current) => current + 1)
    } catch (error) {
      setFormError(error.message || 'The Business Type could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(type) {
    setBusyId(type.id)
    setFeedback(null)
    try {
      await setBusinessTypeActive(type.id, type.active !== true)
      setFeedback({ type: 'success', text: `${type.name} was ${type.active === true ? 'deactivated' : 'activated'}.` })
      setLoading(true)
      setReload((current) => current + 1)
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'The status could not be changed.' })
    } finally {
      setBusyId('')
    }
  }

  async function seedDefaults() {
    setBusyId('seed')
    setFeedback(null)
    try {
      await seedInitialBusinessTypes()
      setFeedback({ type: 'success', text: 'The eight existing Business Types were added.' })
      setLoading(true)
      setReload((current) => current + 1)
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'The initial Business Types could not be loaded.' })
    } finally {
      setBusyId('')
    }
  }

  function retryLoad() {
    setLoadError('')
    setLoading(true)
    setReload((current) => current + 1)
  }

  return (
    <section className="admin-business-types" aria-labelledby="business-types-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">DUKAN SETU / BUSINESS TYPES</p>
          <h1 id="business-types-title">Business Types</h1>
          <p className="dashboard-intro">Manage the options available to new store registrations.</p>
        </div>
        <button className="store-btn store-btn-approve" onClick={openCreate} type="button">Add Business Type</button>
      </div>

      {feedback && <p className={`store-feedback store-feedback-${feedback.type}`} role="status">{feedback.text}</p>}

      <div className="business-type-toolbar">
        <div className="store-tabs" aria-label="Filter Business Types">
          {filters.map((item) => (
            <button
              aria-pressed={filter === item}
              className={filter === item ? 'active' : ''}
              key={item}
              onClick={() => setFilter(item)}
              type="button"
            >
              {item === 'all' ? 'All' : item === 'active' ? 'Active' : 'Inactive'} ({counts[item]})
            </button>
          ))}
        </div>
        <input
          aria-label="Search Business Types"
          className="store-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, code or description"
          type="search"
          value={search}
        />
      </div>

      {loading ? (
        <p className="store-state" role="status">Loading Business Types...</p>
      ) : loadError ? (
        <div className="store-state store-state-error" role="alert">
          <p>Could not load Business Types: {loadError}</p>
          <button className="store-btn" onClick={retryLoad} type="button">Retry</button>
        </div>
      ) : types.length === 0 ? (
        <div className="store-state">
          <p>No Business Types have been added.</p>
          <button className="store-btn" disabled={busyId === 'seed'} onClick={seedDefaults} type="button">
            {busyId === 'seed' ? 'Loading options...' : 'Load existing registration options'}
          </button>
        </div>
      ) : visibleTypes.length === 0 ? (
        <p className="store-state">No Business Types match your search or filter.</p>
      ) : (
        <>
          <table className="business-type-table">
            <thead><tr><th>Name</th><th>Code</th><th>Description</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleTypes.map((type) => (
                <tr key={type.id}>
                  <td><strong>{type.name}</strong></td>
                  <td><code>{type.code || type.id}</code></td>
                  <td>{type.description || '—'}</td>
                  <td>{type.sortOrder ?? '—'}</td>
                  <td><span className={`store-status store-status-${type.active === true ? 'approved' : 'rejected'}`}>{type.active === true ? 'Active' : 'Inactive'}</span></td>
                  <td><div className="store-actions"><button className="store-btn" onClick={() => openEdit(type)} type="button">Edit</button><button className="store-btn" disabled={busyId === type.id} onClick={() => toggleActive(type)} type="button">{busyId === type.id ? 'Saving...' : type.active === true ? 'Deactivate' : 'Activate'}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="business-type-cards">
            {visibleTypes.map((type) => (
              <li key={type.id}>
                <div className="business-type-card-head"><strong>{type.name}</strong><span className={`store-status store-status-${type.active === true ? 'approved' : 'rejected'}`}>{type.active === true ? 'Active' : 'Inactive'}</span></div>
                <p><code>{type.code || type.id}</code> <span>Order {type.sortOrder ?? '—'}</span></p>
                {type.description && <p>{type.description}</p>}
                <div className="store-actions"><button className="store-btn" onClick={() => openEdit(type)} type="button">Edit</button><button className="store-btn" disabled={busyId === type.id} onClick={() => toggleActive(type)} type="button">{busyId === type.id ? 'Saving...' : type.active === true ? 'Deactivate' : 'Activate'}</button></div>
              </li>
            ))}
          </ul>
        </>
      )}

      {dialogType && (
        <div className="business-type-modal-backdrop" onClick={() => !saving && setDialogType(null)} role="presentation">
          <form aria-labelledby="business-type-form-title" aria-modal="true" className="business-type-modal" onClick={(event) => event.stopPropagation()} onSubmit={submitForm} role="dialog">
            <h2 id="business-type-form-title">{dialogType.mode === 'edit' ? 'Edit Business Type' : 'Add Business Type'}</h2>
            {formError && <p className="store-feedback store-feedback-error" role="alert">{formError}</p>}
            <label htmlFor="business-type-name">Name</label>
            <input
              autoFocus
              id="business-type-name"
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
            <label htmlFor="business-type-code">Code</label>
            <input
              id="business-type-code"
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
            <label htmlFor="business-type-description">Description</label>
            <textarea id="business-type-description" maxLength={300} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} value={form.description} />
            <label htmlFor="business-type-sort-order">Sort order</label>
            <input id="business-type-sort-order" min="0" onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} required type="number" value={form.sortOrder} />
            <div className="store-actions">
              <button className="store-btn" disabled={saving} onClick={() => setDialogType(null)} type="button">Cancel</button>
              <button className="store-btn store-btn-approve" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save Business Type'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}