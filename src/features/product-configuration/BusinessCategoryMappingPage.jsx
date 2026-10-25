import { useEffect, useMemo, useState } from 'react'
import BusinessCategoryMappingForm from './components/BusinessCategoryMappingForm.jsx'
import BusinessCategoryMappingTable from './components/BusinessCategoryMappingTable.jsx'
import {
  createBusinessCategoryMapping,
  listBusinessCategoryMappings,
  loadBusinessCategoryMappingSources,
  setBusinessCategoryMappingStatus,
  updateBusinessCategoryMapping,
} from './services/businessCategoryMappingService'

export default function BusinessCategoryMappingPage() {
  const [mappings, setMappings] = useState([])
  const [businessTypes, setBusinessTypes] = useState([])
  const [categories, setCategories] = useState([])
  const [productTypes, setProductTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [formMapping, setFormMapping] = useState(null)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([listBusinessCategoryMappings(), loadBusinessCategoryMappingSources()])
      .then(([mappingRecords, sources]) => {
        if (!active) return
        setMappings(mappingRecords)
        setBusinessTypes(sources.businessTypes)
        setCategories(sources.categories)
        setProductTypes(sources.productTypes)
        setLoadError('')
      })
      .catch((error) => {
        if (active) setLoadError(error.message || 'Business Category Mapping data could not be loaded.')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
          setRefreshing(false)
        }
      })
    return () => {
      active = false
    }
  }, [reload])

  const businessTypesById = useMemo(() => new Map(businessTypes.map((type) => [type.id, type])), [businessTypes])
  const categoriesByPair = useMemo(() => new Map(categories.map((category) => [
    `${category.businessTypeId}:${category.id}`,
    category,
  ])), [categories])
  const productTypesById = useMemo(() => new Map(productTypes.map((type) => [type.id, type])), [productTypes])

  const visibleMappings = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return mappings.filter((mapping) => {
      const typeName = businessTypesById.get(mapping.businessTypeId)?.name || mapping.businessTypeId
      const categoryName = categoriesByPair.get(`${mapping.businessTypeId}:${mapping.businessCategoryId}`)?.name || mapping.businessCategoryId
      const productNames = mapping.productTypeIds.map((id) => productTypesById.get(id)?.name || id)
      const matchesSearch = !term || [typeName, mapping.businessTypeId, categoryName, mapping.businessCategoryId, ...productNames]
        .some((value) => String(value || '').toLocaleLowerCase().includes(term))
      return matchesSearch && (statusFilter === 'all' || mapping.status === statusFilter)
    })
  }, [businessTypesById, categoriesByPair, mappings, productTypesById, search, statusFilter])

  function refresh() {
    if (loading || refreshing || saving || Boolean(busyId)) return
    setLoadError('')
    setFeedback(null)
    setRefreshing(true)
    setReload((current) => current + 1)
  }

  const suggestedSortOrder = (mappings.length ? Math.max(...mappings.map((mapping) => mapping.sortOrder)) : 0) + 10

  function openCreate() {
    setFeedback(null)
    setFormError('')
    setFormMapping(null)
    setCreating(true)
  }

  function openEdit(mapping) {
    setFeedback(null)
    setFormError('')
    setFormMapping(mapping)
    setCreating(false)
  }

  function closeForm() {
    if (saving) return
    setCreating(false)
    setFormMapping(null)
    setFormError('')
  }

  async function handleSave(values) {
    if (saving) return
    setSaving(true)
    setFormError('')
    try {
      if (formMapping) {
        await updateBusinessCategoryMapping(formMapping.id, values)
        setFeedback({ type: 'success', text: 'Business Category Mapping was updated.' })
      } else {
        await createBusinessCategoryMapping(values)
        setFeedback({ type: 'success', text: 'Business Category Mapping was created.' })
      }
      setCreating(false)
      setFormMapping(null)
      setReload((current) => current + 1)
    } catch (error) {
      setFormError(error.message || 'The Business Category Mapping could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(mapping) {
    if (busyId || saving) return
    const status = mapping.status === 'active' ? 'inactive' : 'active'
    setBusyId(mapping.id)
    setFeedback(null)
    try {
      await setBusinessCategoryMappingStatus(mapping.id, status)
      setFeedback({ type: 'success', text: `Mapping was ${status === 'active' ? 'activated' : 'deactivated'}.` })
      setReload((current) => current + 1)
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'The mapping status could not be changed.' })
    } finally {
      setBusyId('')
    }
  }

  const activeBusinessTypes = businessTypes.filter((type) => type.active === true)
  const activeProductTypes = productTypes.filter((type) => type.status === 'active')
  const activeCategories = categories.filter((category) => category.active === true)
  const loadingScreen = loading || refreshing

  return (
    <section className="product-config-page business-category-mapping-page" aria-labelledby="business-category-mapping-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">DUKAN SETU / PRODUCT CONFIGURATION STUDIO</p>
          <h1 id="business-category-mapping-title">Business Category Mapping</h1>
          <p className="dashboard-intro">Map Business Categories to the Product Types available for them.</p>
        </div>
        <div className="category-mapping-header-actions">
          <button className="store-btn" disabled={loadingScreen || saving || Boolean(busyId)} onClick={refresh} type="button">
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="store-btn store-btn-approve" disabled={loadingScreen || Boolean(loadError) || saving} onClick={openCreate} type="button">
            Add Mapping
          </button>
        </div>
      </div>

      {feedback && <p className={`store-feedback store-feedback-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}

      <div className="category-mapping-toolbar">
        <input
          aria-label="Search mappings"
          className="store-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search Business Type, Category, or Product Type"
          type="search"
          value={search}
        />
        <select aria-label="Filter mappings by status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loadingScreen ? (
        <p className="store-state" role="status">{refreshing ? 'Refreshing mappings...' : 'Loading mappings...'}</p>
      ) : loadError ? (
        <div className="store-state store-state-error" role="alert">
          <p>Could not load Business Category Mappings: {loadError}</p>
          <button className="store-btn" disabled={refreshing} onClick={refresh} type="button">Retry</button>
        </div>
      ) : activeBusinessTypes.length === 0 ? (
        <p className="store-state">No active Business Types are available. Add or activate a Business Type before creating mappings.</p>
      ) : activeCategories.length === 0 ? (
        <p className="store-state">No active Business Categories are available. Add an active Business Category before creating mappings.</p>
      ) : activeProductTypes.length === 0 ? (
        <p className="store-state">No active Product Types are available. Add an active Product Type before creating mappings.</p>
      ) : mappings.length === 0 ? (
        <p className="store-state">No Business Category Mappings have been created yet.</p>
      ) : visibleMappings.length === 0 ? (
        <p className="store-state">No mappings match the search or status filter.</p>
      ) : (
        <BusinessCategoryMappingTable
          businessTypesById={businessTypesById}
          busyId={busyId}
          categoriesByPair={categoriesByPair}
          mappings={visibleMappings}
          onEdit={openEdit}
          onToggleStatus={handleToggleStatus}
          productTypesById={productTypesById}
        />
      )}

      {(creating || formMapping) && (
        <BusinessCategoryMappingForm
          businessTypes={businessTypes}
          categories={categories}
          error={formError}
          mapping={formMapping}
          onCancel={closeForm}
          onSubmit={handleSave}
          productTypes={productTypes}
          saving={saving}
          suggestedSortOrder={suggestedSortOrder}
        />
      )}
    </section>
  )
}
