import { useEffect, useMemo, useState } from 'react'
import GlobalFieldForm from './components/GlobalFieldForm.jsx'
import GlobalFieldTable from './components/GlobalFieldTable.jsx'
import {
  createGlobalField,
  deleteGlobalField,
  listGlobalFields,
  setGlobalFieldStatus,
  updateGlobalField,
} from './services/globalFieldService'
import { listFieldGroups } from './services/fieldGroupService'

const fieldTypes = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'image', label: 'Image' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multi_select', label: 'Multi-select' },
]
const typeLabels = Object.fromEntries(fieldTypes.map(({ value, label }) => [value, label]))

export default function GlobalFieldLibraryPage({ onNavigate }) {
  const [fields, setFields] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [groupsError, setGroupsError] = useState('')
  const [reload, setReload] = useState(0)
  const [feedback, setFeedback] = useState(null)

  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [formTarget, setFormTarget] = useState(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    let active = true
    Promise.allSettled([listGlobalFields(), listFieldGroups()])
      .then(([fieldResult, groupResult]) => {
        if (!active) return
        if (fieldResult.status === 'fulfilled') {
          setFields(fieldResult.value)
          setLoadError('')
        } else {
          setLoadError(fieldResult.reason?.message || 'Could not load Global Fields.')
        }
        if (groupResult.status === 'fulfilled') {
          setGroups(groupResult.value)
          setGroupsError('')
        } else {
          setGroupsError(groupResult.reason?.message || 'Could not load Field Groups.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reload])

  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])
  const activeGroups = useMemo(() => groups.filter((group) => group.status === 'active'), [groups])
  const visibleFields = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return fields.filter((field) => {
      const matchesQuery = !query || [field.name, field.key, field.label]
        .some((value) => String(value || '').toLocaleLowerCase().includes(query))
      return matchesQuery
        && (!groupFilter || field.groupId === groupFilter)
        && (!typeFilter || field.fieldType === typeFilter)
        && (!statusFilter || field.status === statusFilter)
    })
  }, [fields, groupFilter, search, statusFilter, typeFilter])

  function refresh() {
    setLoadError('')
    setGroupsError('')
    setLoading(true)
    setReload((current) => current + 1)
  }

  function openCreate() {
    setFeedback(null)
    setFormError('')
    setFormTarget({ mode: 'create' })
  }

  function openEdit(field) {
    setFeedback(null)
    setFormError('')
    setFormTarget({ mode: 'edit', field })
  }

  async function handleSave(values) {
    setSaving(true)
    setFormError('')
    try {
      if (formTarget.mode === 'edit') {
        await updateGlobalField(formTarget.field.id, values)
        setFeedback({ type: 'success', text: `${values.name.trim()} was updated.` })
      } else {
        await createGlobalField(values)
        setFeedback({ type: 'success', text: `${values.name.trim()} was created.` })
      }
      setFormTarget(null)
      refresh()
    } catch (error) {
      setFormError(error.message || 'The Global Field could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(field) {
    const status = field.status === 'active' ? 'inactive' : 'active'
    setBusyId(field.id)
    setFeedback(null)
    try {
      await setGlobalFieldStatus(field.id, status)
      setFeedback({ type: 'success', text: `${field.name} was ${status === 'active' ? 'activated' : 'deactivated'}.` })
      refresh()
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'The field status could not be changed.' })
    } finally {
      setBusyId('')
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteGlobalField(deleteTarget.id)
      setFeedback({ type: 'success', text: `${deleteTarget.name} was deleted.` })
      setDeleteTarget(null)
      refresh()
    } catch (error) {
      setDeleteError(error.message || 'The Global Field could not be deleted.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="product-config-page global-field-library" aria-labelledby="global-field-library-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">DUKAN SETU / PRODUCT CONFIGURATION STUDIO</p>
          <h1 id="global-field-library-title">Global Field Library</h1>
          <p className="dashboard-intro">Manage reusable fields for all product types and dynamic forms.</p>
        </div>
        <button
          className="store-btn store-btn-approve"
          disabled={loading || Boolean(loadError) || Boolean(groupsError) || activeGroups.length === 0}
          onClick={openCreate}
          type="button"
        >
          Add New Field
        </button>
      </div>

      {feedback && <p className={`store-feedback store-feedback-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}
      {groupsError && (
        <div className="store-state store-state-error" role="alert">
          <p>Could not load Field Groups: {groupsError}</p>
          <button className="store-btn" onClick={refresh} type="button">Retry</button>
        </div>
      )}
      {!groupsError && !loading && activeGroups.length === 0 && (
        <div className="store-state global-field-groups-empty">
          <p>No active Field Groups are available. Create an active group before adding a field.</p>
          <button className="store-btn" disabled={!onNavigate} onClick={() => onNavigate?.('Field Groups')} type="button">
            Go to Field Groups
          </button>
        </div>
      )}

      <div className="global-field-filters" aria-label="Search and filter Global Fields">
        <input
          aria-label="Search by field name, key, or label"
          className="store-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, key, or label"
          type="search"
          value={search}
        />
        <select aria-label="Filter by Field Group" onChange={(event) => setGroupFilter(event.target.value)} value={groupFilter}>
          <option value="">All Field Groups</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        <select aria-label="Filter by Field Type" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
          <option value="">All Field Types</option>
          {fieldTypes.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Filter by Status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <p className="store-state" role="status">Loading Global Fields...</p>
      ) : loadError ? (
        <div className="store-state store-state-error" role="alert">
          <p>Could not load Global Fields: {loadError}</p>
          <button className="store-btn" onClick={refresh} type="button">Retry</button>
        </div>
      ) : fields.length === 0 ? (
        <p className="store-state">No Global Fields have been created yet.</p>
      ) : visibleFields.length === 0 ? (
        <p className="store-state">No Global Fields match the selected search or filters.</p>
      ) : (
        <GlobalFieldTable
          fields={visibleFields}
          groupsById={groupsById}
          onDelete={(field) => {
            setDeleteError('')
            setDeleteTarget(field)
          }}
          onEdit={openEdit}
          onStatusChange={handleStatusChange}
          typeLabels={typeLabels}
          busyId={busyId}
        />
      )}

      {formTarget && (
        <GlobalFieldForm
          error={formError}
          field={formTarget.field}
          fieldTypes={fieldTypes}
          groups={activeGroups}
          onCancel={() => setFormTarget(null)}
          onSubmit={handleSave}
          saving={saving}
        />
      )}

      {deleteTarget && (
        <div className="business-type-modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)} role="presentation">
          <div
            aria-labelledby="delete-global-field-title"
            aria-modal="true"
            className="business-type-modal"
            onClick={(event) => event.stopPropagation()}
            role="alertdialog"
          >
            <h2 id="delete-global-field-title">Delete {deleteTarget.name}?</h2>
            {deleteError && <p className="store-feedback store-feedback-error" role="alert">{deleteError}</p>}
            <p>This permanently removes <code>{deleteTarget.key}</code>. If a future form configuration references this field, update that configuration before confirming.</p>
            <div className="store-actions">
              <button className="store-btn" disabled={deleting} onClick={() => setDeleteTarget(null)} type="button">Cancel</button>
              <button className="store-btn store-btn-reject" disabled={deleting} onClick={handleDelete} type="button">
                {deleting ? 'Deleting...' : 'Delete Field'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
