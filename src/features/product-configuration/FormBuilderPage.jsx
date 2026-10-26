import { useEffect, useMemo, useState } from 'react'
import FormBuilderTable from './components/FormBuilderTable.jsx'
import FormConfigurationEditor from './components/FormConfigurationEditor.jsx'
import {
  deleteFormConfig,
  listFormConfigs,
  loadFormBuilderSources,
  saveFormConfig,
  setFormConfigStatus,
} from './services/productFormConfigService'
import './styles/form-builder.css'

export default function FormBuilderPage() {
  const [configs, setConfigs] = useState([])
  const [sources, setSources] = useState({ productTypes: [], groups: [], fields: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [editorTarget, setEditorTarget] = useState(null)
  const [editorError, setEditorError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([listFormConfigs(), loadFormBuilderSources()])
      .then(([records, loaded]) => {
        if (!active) return
        setConfigs(records)
        setSources(loaded)
        setLoadError('')
      })
      .catch((error) => {
        if (active) setLoadError(error.message || 'Could not load Form Configurations.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reload])

  const typesById = useMemo(() => new Map(sources.productTypes.map((type) => [type.id, type])), [sources.productTypes])
  const productTypeName = (config) => typesById.get(config.productTypeId)?.name ?? `Missing Product Type (${config.productTypeKey || config.productTypeId})`

  const visibleConfigs = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return configs.filter((config) => {
      const typeName = typesById.get(config.productTypeId)?.name ?? ''
      const matchesSearch = !term || [config.name, typeName, config.productTypeKey]
        .some((value) => String(value || '').toLocaleLowerCase().includes(term))
      return matchesSearch && (statusFilter === 'all' || config.status === statusFilter)
    })
  }, [configs, search, statusFilter, typesById])

  function refresh() {
    setLoadError('')
    setLoading(true)
    setReload((current) => current + 1)
  }

  function openEditor(config) {
    setFeedback(null)
    setEditorError('')
    setEditorTarget({ config })
  }

  async function handleSave(values) {
    setSaving(true)
    setEditorError('')
    try {
      await saveFormConfig(editorTarget.config?.id ?? null, values)
      setFeedback({ type: 'success', text: `${values.name.trim()} was ${editorTarget.config ? 'updated' : 'created'}.` })
      setEditorTarget(null)
      refresh()
    } catch (error) {
      setEditorError(error.message || 'The Form Configuration could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(config) {
    const status = config.status === 'active' ? 'inactive' : 'active'
    setBusyId(config.id)
    setFeedback(null)
    try {
      await setFormConfigStatus(config.id, status)
      setFeedback({ type: 'success', text: `${config.name} was ${status === 'active' ? 'activated' : 'deactivated'}.` })
      refresh()
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'Status could not be changed.' })
    } finally {
      setBusyId('')
    }
  }

  async function handleDelete() {
    setBusyId(deleteTarget.id)
    setDeleteError('')
    try {
      await deleteFormConfig(deleteTarget.id)
      setFeedback({ type: 'success', text: `${deleteTarget.name} was deleted.` })
      setDeleteTarget(null)
      refresh()
    } catch (error) {
      setDeleteError(error.message || 'The Form Configuration could not be deleted.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <section className="product-config-page product-type-config-page" aria-labelledby="form-builder-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">DUKAN SETU / PRODUCT CONFIGURATION STUDIO</p>
          <h1 id="form-builder-title">Form Builder</h1>
          <p className="dashboard-intro">Configure fields, groups, and display order for each Product Type.</p>
        </div>
        <div className="product-type-config-header-actions">
          <button className="store-btn" disabled={loading} onClick={refresh} type="button">Refresh</button>
          <button className="store-btn store-btn-approve" disabled={loading || Boolean(loadError)} onClick={() => openEditor(null)} type="button">
            Create Form Configuration
          </button>
        </div>
      </div>

      {feedback && <p className={`store-feedback store-feedback-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}

      <div className="product-type-config-toolbar">
        <input
          aria-label="Search Form Configurations"
          className="store-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search form name or Product Type"
          type="search"
          value={search}
        />
        <select aria-label="Filter by status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <p className="store-state" role="status">Loading Form Configurations...</p>
      ) : loadError ? (
        <div className="store-state store-state-error" role="alert">
          <p>Could not load Form Configurations: {loadError}</p>
          <button className="store-btn" onClick={refresh} type="button">Retry</button>
        </div>
      ) : configs.length === 0 ? (
        <p className="store-state">No Form Configurations have been created yet.</p>
      ) : visibleConfigs.length === 0 ? (
        <p className="store-state">No Form Configurations match the search or status filter.</p>
      ) : (
        <FormBuilderTable
          busyId={busyId}
          configs={visibleConfigs}
          onDelete={(config) => { setDeleteError(''); setDeleteTarget(config) }}
          onEdit={openEditor}
          onToggleStatus={handleToggleStatus}
          productTypeName={productTypeName}
        />
      )}

      {editorTarget && (
        <FormConfigurationEditor
          config={editorTarget.config}
          configs={configs}
          error={editorError}
          onCancel={() => setEditorTarget(null)}
          onSubmit={handleSave}
          saving={saving}
          sources={sources}
        />
      )}

      {deleteTarget && (
        <div className="business-type-modal-backdrop" onClick={() => !busyId && setDeleteTarget(null)} role="presentation">
          <div aria-labelledby="delete-form-config-title" aria-modal="true" className="business-type-modal" onClick={(event) => event.stopPropagation()} role="alertdialog">
            <h2 id="delete-form-config-title">Delete {deleteTarget.name}?</h2>
            {deleteError && <p className="store-feedback store-feedback-error" role="alert">{deleteError}</p>}
            <p>This Form Configuration will be permanently deleted. The Field Groups and Global Fields it references are not affected.</p>
            <div className="store-actions">
              <button className="store-btn" disabled={Boolean(busyId)} onClick={() => setDeleteTarget(null)} type="button">Cancel</button>
              <button className="store-btn store-btn-reject" disabled={Boolean(busyId)} onClick={handleDelete} type="button">
                {busyId ? 'Deleting...' : 'Delete Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
