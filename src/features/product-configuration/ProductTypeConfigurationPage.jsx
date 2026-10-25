import { useEffect, useMemo, useState } from 'react'
import ProductTypeConfigForm from './components/ProductTypeConfigForm.jsx'
import ProductTypeConfigTable from './components/ProductTypeConfigTable.jsx'
import {
  createProductTypeConfig,
  listProductTypeConfigs,
  setProductTypeConfigStatus,
  updateProductTypeConfig,
} from './services/productTypeConfigService'

export default function ProductTypeConfigurationPage() {
  const [productTypes, setProductTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [formTarget, setFormTarget] = useState(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    let active = true
    listProductTypeConfigs()
      .then((records) => {
        if (!active) return
        setProductTypes(records)
        setLoadError('')
      })
      .catch((error) => {
        if (active) setLoadError(error.message || 'Could not load Product Types.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reload])

  const visibleProductTypes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return productTypes.filter((productType) => {
      const matchesSearch = !term || [productType.name, productType.key, productType.description]
        .some((value) => String(value || '').toLocaleLowerCase().includes(term))
      const matchesStatus = statusFilter === 'all' || productType.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [productTypes, search, statusFilter])

  function refresh() {
    setLoadError('')
    setLoading(true)
    setReload((current) => current + 1)
  }

  const suggestedSortOrder = (productTypes.length
    ? Math.max(...productTypes.map((productType) => productType.sortOrder))
    : 0) + 10

  function openCreate() {
    setFeedback(null)
    setFormError('')
    setFormTarget({ mode: 'create' })
  }

  function openEdit(productType) {
    setFeedback(null)
    setFormError('')
    setFormTarget({ mode: 'edit', productType })
  }

  async function handleSave(values) {
    setSaving(true)
    setFormError('')
    try {
      if (formTarget.mode === 'edit') {
        await updateProductTypeConfig(formTarget.productType.id, values)
        setFeedback({ type: 'success', text: `${values.name.trim()} was updated.` })
      } else {
        await createProductTypeConfig(values)
        setFeedback({ type: 'success', text: `${values.name.trim()} was added.` })
      }
      setFormTarget(null)
      refresh()
    } catch (error) {
      setFormError(error.message || 'The Product Type could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(productType) {
    const status = productType.status === 'active' ? 'inactive' : 'active'
    setBusyId(productType.id)
    setFeedback(null)
    try {
      await setProductTypeConfigStatus(productType.id, status)
      setFeedback({
        type: 'success',
        text: `${productType.name} was ${status === 'active' ? 'activated' : 'deactivated'}.`,
      })
      refresh()
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'Product Type status could not be changed.' })
    } finally {
      setBusyId('')
    }
  }

  return (
    <section className="product-config-page product-type-config-page" aria-labelledby="product-type-config-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">DUKAN SETU / PRODUCT CONFIGURATION STUDIO</p>
          <h1 id="product-type-config-title">Product Type Configuration</h1>
          <p className="dashboard-intro">Configure and manage the product types available in the catalog.</p>
        </div>
        <div className="product-type-config-header-actions">
          <button className="store-btn" disabled={loading} onClick={refresh} type="button">Refresh</button>
          <button className="store-btn store-btn-approve" disabled={loading || Boolean(loadError)} onClick={openCreate} type="button">
            Add Product Type
          </button>
        </div>
      </div>

      {feedback && <p className={`store-feedback store-feedback-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}

      <div className="product-type-config-toolbar">
        <input
          aria-label="Search Product Types"
          className="store-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, key, or description"
          type="search"
          value={search}
        />
        <select aria-label="Filter Product Types by status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <p className="store-state" role="status">Loading Product Types...</p>
      ) : loadError ? (
        <div className="store-state store-state-error" role="alert">
          <p>Could not load Product Types: {loadError}</p>
          <button className="store-btn" onClick={refresh} type="button">Retry</button>
        </div>
      ) : productTypes.length === 0 ? (
        <p className="store-state">No Product Types have been added yet.</p>
      ) : visibleProductTypes.length === 0 ? (
        <p className="store-state">No Product Types match the search or status filter.</p>
      ) : (
        <ProductTypeConfigTable
          busyId={busyId}
          onEdit={openEdit}
          onToggleStatus={handleToggleStatus}
          productTypes={visibleProductTypes}
        />
      )}

      {formTarget && (
        <ProductTypeConfigForm
          error={formError}
          onCancel={() => setFormTarget(null)}
          onSubmit={handleSave}
          productType={formTarget.productType}
          saving={saving}
          suggestedSortOrder={suggestedSortOrder}
        />
      )}
    </section>
  )
}
