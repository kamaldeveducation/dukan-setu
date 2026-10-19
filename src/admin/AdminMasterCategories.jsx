import { useEffect, useState } from 'react'
import MasterCategoryImageField from './MasterCategoryImageField.jsx'
import {
  MAX_MASTER_CATEGORY_LEVEL,
  createMasterCategory,
  generateMasterCategoryCode,
  listMasterCategoryFilterOptions,
  listMasterCategories,
  setMasterCategoryActive,
  updateMasterCategory,
} from '../services/masterCategoryService'

const emptyForm = { name: '', code: '', parentId: '', businessCategoryRefs: [], sortOrder: '10', active: true }
const statusFilters = ['all', 'active', 'inactive']

function pairKey(businessTypeId, categoryId) {
  return JSON.stringify([businessTypeId, categoryId])
}

function StatusBadge({ active }) {
  return <span className={`store-status store-status-${active ? 'approved' : 'rejected'}`}>{active ? 'Active' : 'Inactive'}</span>
}

function CategoryThumbnail({ category }) {
  const [failed, setFailed] = useState(false)
  const url = category.logoUrl || category.logoRefs?.[0]?.logoUrl
  return url && !failed
    ? <img alt={category.name} className="master-category-thumbnail" onError={() => setFailed(true)} src={url} />
    : <span aria-label={`${category.name}: no image`} className="master-category-thumbnail-placeholder" role="img" />
}

export default function AdminMasterCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)

  const [businessTypes, setBusinessTypes] = useState([])
  const [options, setOptions] = useState([])
  const [optionsLoaded, setOptionsLoaded] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [businessTypeFilter, setBusinessTypeFilter] = useState('')
  const [businessCategoryFilter, setBusinessCategoryFilter] = useState('')
  const [mappingSearch, setMappingSearch] = useState('')

  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [codeEdited, setCodeEdited] = useState(false)
  const [formError, setFormError] = useState('')
  const [imageAsset, setImageAsset] = useState(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [confirmTarget, setConfirmTarget] = useState(null)

  useEffect(() => {
    let active = true
    listMasterCategories()
      .then((records) => {
        if (!active) return
        setCategories(records)
        setLoading(false)
      })
      .catch((error) => {
        if (!active) return
        setLoadError(error.message || 'Could not load Master Categories.')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reload])

  useEffect(() => {
    let active = true
    listMasterCategoryFilterOptions()
      .then(({ businessTypes: records, categories: categoryOptions }) => {
        if (!active) return
        setBusinessTypes(records)
        setOptions(categoryOptions)
        setOptionsLoaded(true)
      })
      .catch((error) => {
        if (active) setOptionsError(error.message || 'Could not load Business Type and Category filters.')
      })
      .finally(() => {
        if (active) setOptionsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const optionByKey = new Map(options.map((option) => [pairKey(option.businessTypeId, option.categoryId), option]))
  const term = search.trim().toLocaleLowerCase()
  const selectedCategoryRef = businessCategoryFilter ? JSON.parse(businessCategoryFilter) : null
  const matchingCategories = categories.filter((category) => {
    const refs = category.businessCategoryRefs
    const matchesType = !businessTypeFilter || refs.some((ref) => ref.businessTypeId === businessTypeFilter)
    const matchesCategory = !selectedCategoryRef || refs.some((ref) => (
      ref.businessTypeId === selectedCategoryRef[0] && ref.categoryId === selectedCategoryRef[1]
    ))
    const matchesSearch = !term || [category.name, category.code]
      .some((value) => String(value || '').toLocaleLowerCase().includes(term))
    return matchesType && matchesCategory && matchesSearch
  })
  const counts = {
    all: matchingCategories.length,
    active: matchingCategories.filter((category) => category.active === true).length,
    inactive: matchingCategories.filter((category) => category.active !== true).length,
    unmapped: matchingCategories.filter((category) => category.businessCategoryRefs.length === 0).length,
  }
  const visibleCategories = matchingCategories.filter((category) => (
    statusFilter === 'all' || (statusFilter === 'active' ? category.active === true : category.active !== true)
  ))
  const categoryFilterOptions = options.filter((option) => !businessTypeFilter || option.businessTypeId === businessTypeFilter)

  function hasChildren(id) {
    return categories.some((category) => category.parentId === id)
  }

  function isDescendantOf(category, ancestorId) {
    const seen = new Set()
    let cursor = category
    while (cursor?.parentId && !seen.has(cursor.id)) {
      if (cursor.parentId === ancestorId) return true
      seen.add(cursor.id)
      cursor = categoryById.get(cursor.parentId)
    }
    return false
  }

  const editingId = dialog?.mode === 'edit' ? dialog.id : ''
  const parentChoices = categories.filter((category) => (
    category.level < MAX_MASTER_CATEGORY_LEVEL && category.id !== editingId && !(editingId && isDescendantOf(category, editingId))
  ))
  const mappingTerm = mappingSearch.trim().toLocaleLowerCase()
  const selectableOptions = options.filter((option) => option.active
    && (!mappingTerm || [option.name, option.businessTypeName].some((value) => String(value).toLocaleLowerCase().includes(mappingTerm))))
  const optionGroups = [...selectableOptions.reduce((groups, option) => {
    const group = groups.get(option.businessTypeId) ?? { name: option.businessTypeName, items: [] }
    group.items.push(option)
    return groups.set(option.businessTypeId, group)
  }, new Map()).entries()]

  function loadOptions() {
    setOptionsLoading(true)
    setOptionsError('')
    listMasterCategoryFilterOptions()
      .then(({ businessTypes: records, categories: categoryOptions }) => {
        setBusinessTypes(records)
        setOptions(categoryOptions)
        setOptionsLoaded(true)
      })
      .catch((error) => setOptionsError(error.message || 'Could not load Business Categories.'))
      .finally(() => setOptionsLoading(false))
  }

  function ensureOptions() {
    if (!optionsLoaded && !optionsLoading) loadOptions()
  }

  function openCreate() {
    const topLevelOrders = categories.map((category) => Number(category.sortOrder) || 0)
    setForm({ ...emptyForm, sortOrder: String((topLevelOrders.length ? Math.max(...topLevelOrders) : 0) + 10) })
    setCodeEdited(false)
    setFormError('')
    setImageAsset(null)
    setRemoveImage(false)
    setMappingSearch('')
    setDialog({ mode: 'create' })
    ensureOptions()
  }

  function openEdit(category) {
    setForm({
      name: category.name || '',
      code: category.code || category.id,
      parentId: category.parentId || '',
      businessCategoryRefs: category.businessCategoryRefs.map(({ businessTypeId, categoryId }) => ({ businessTypeId, categoryId })),
      sortOrder: String(category.sortOrder ?? 0),
      active: category.active === true,
    })
    setCodeEdited(true)
    setFormError('')
    setImageAsset(null)
    setRemoveImage(false)
    setMappingSearch('')
    setDialog({ mode: 'edit', id: category.id })
    ensureOptions()
  }

  function toggleMapping(option) {
    const key = pairKey(option.businessTypeId, option.categoryId)
    setForm((current) => {
      const exists = current.businessCategoryRefs.some((ref) => pairKey(ref.businessTypeId, ref.categoryId) === key)
      return {
        ...current,
        businessCategoryRefs: exists
          ? current.businessCategoryRefs.filter((ref) => pairKey(ref.businessTypeId, ref.categoryId) !== key)
          : [...current.businessCategoryRefs, { businessTypeId: option.businessTypeId, categoryId: option.categoryId }],
      }
    })
  }

  function removeMapping(ref) {
    const key = pairKey(ref.businessTypeId, ref.categoryId)
    setForm((current) => ({
      ...current,
      businessCategoryRefs: current.businessCategoryRefs.filter((item) => pairKey(item.businessTypeId, item.categoryId) !== key),
    }))
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
        parentId: form.parentId || null,
        businessCategoryRefs: form.businessCategoryRefs,
        sortOrder: Number(form.sortOrder),
        active: form.active,
        imageBlob: imageAsset?.blob || null,
        imageExtension: imageAsset?.extension || '',
        removeLogo: removeImage,
      }
      if (dialog.mode === 'edit') {
        const result = await updateMasterCategory(dialog.id, values)
        setFeedback(result?.cleanupErrors?.length
          ? { type: 'error', text: `${form.name.trim()} was updated, but ${result.cleanupErrors.length} obsolete image file(s) could not be removed.` }
          : { type: 'success', text: `${form.name.trim()} was updated.` })
      } else {
        await createMasterCategory(values)
        setFeedback({ type: 'success', text: `${form.name.trim()} was added.` })
      }
      setDialog(null)
      setLoading(true)
      setReload((current) => current + 1)
    } catch (error) {
      setFormError(error.message || 'The Master Category could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function applyActive(category, active) {
    setBusyId(category.id)
    setFeedback(null)
    setConfirmTarget(null)
    try {
      await setMasterCategoryActive(category.id, active)
      setFeedback({ type: 'success', text: `${category.name} was ${active ? 'activated' : 'deactivated'}.` })
      setLoading(true)
      setReload((current) => current + 1)
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'The status could not be changed.' })
    } finally {
      setBusyId('')
    }
  }

  function requestToggle(category) {
    if (category.active === true) setConfirmTarget(category)
    else void applyActive(category, true)
  }

  function retryLoad() {
    setLoadError('')
    setLoading(true)
    setReload((current) => current + 1)
  }

  function parentLabel(category) {
    if (!category.parentId) return 'Top level'
    return categoryById.get(category.parentId)?.name || category.parentId
  }

  function actionButtons(category) {
    return (
      <div className="store-actions">
        <button className="store-btn" onClick={() => openEdit(category)} type="button">Edit</button>
        <button className="store-btn" disabled={busyId === category.id} onClick={() => requestToggle(category)} type="button">
          {busyId === category.id ? 'Saving...' : category.active === true ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    )
  }

  const summaryCards = [
    { label: 'Total Master Categories', value: counts.all },
    { label: 'Active Categories', value: counts.active },
    { label: 'Inactive Categories', value: counts.inactive },
    { label: 'Without Business Category mappings', value: counts.unmapped },
  ]
  const confirmActiveChildren = confirmTarget
    ? categories.filter((category) => category.parentId === confirmTarget.id && category.active === true).length
    : 0

  return (
    <section className="admin-master-categories" aria-labelledby="master-categories-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">DUKAN SETU / MASTER CATALOG</p>
          <h1 id="master-categories-title">Master Categories</h1>
          <p className="dashboard-intro">Manage the shared category catalog and link it to Business Categories.</p>
        </div>
        <button className="store-btn store-btn-approve" disabled={loading || Boolean(loadError)} onClick={openCreate} type="button">Add Master Category</button>
      </div>

      {feedback && <p className={`store-feedback store-feedback-${feedback.type}`} role="status">{feedback.text}</p>}

      <div className="master-category-summary" aria-label="Master Category summary">
        {summaryCards.map((card) => (
          <div className="master-category-summary-card" key={card.label}>
            <strong>{loading || loadError ? '—' : card.value}</strong>
            <span>{card.label}</span>
          </div>
        ))}
      </div>

      <div className="business-type-toolbar master-category-toolbar">
        <div className="store-tabs" aria-label="Filter Master Categories by status">
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
          aria-label="Search Master Categories"
          className="store-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or code"
          type="search"
          value={search}
        />
        <div className="master-category-filters">
          <label>
            <span>Business Type</span>
            <select
              aria-label="Filter by Business Type"
              disabled={optionsLoading || Boolean(optionsError)}
              onChange={(event) => {
                setBusinessTypeFilter(event.target.value)
                setBusinessCategoryFilter('')
              }}
              value={businessTypeFilter}
            >
              <option value="">All Business Types</option>
              {businessTypes.map((type) => <option key={type.id} value={type.id}>{type.name || type.id}</option>)}
            </select>
          </label>
          <label>
            <span>Business Category</span>
            <select
              aria-label="Filter by Business Category"
              disabled={optionsLoading || Boolean(optionsError)}
              onChange={(event) => setBusinessCategoryFilter(event.target.value)}
              value={businessCategoryFilter}
            >
              <option value="">All Business Categories</option>
              {categoryFilterOptions.map((option) => {
                const key = pairKey(option.businessTypeId, option.categoryId)
                return <option key={key} value={key}>{option.name} · {option.businessTypeName}</option>
              })}
            </select>
          </label>
          <button
            className="store-btn master-category-clear"
            disabled={!businessTypeFilter && !businessCategoryFilter && !search}
            onClick={() => {
              setBusinessTypeFilter('')
              setBusinessCategoryFilter('')
              setSearch('')
            }}
            type="button"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {optionsError && (
        <div className="store-state store-state-error master-category-filter-error" role="alert">
          <p>Could not load Business Type and Category filters: {optionsError}</p>
          <button className="store-btn" onClick={loadOptions} type="button">Retry</button>
        </div>
      )}
      {optionsLoading && <p className="master-category-filter-loading" role="status">Loading Business Type and Category filters...</p>}
      <p className="master-category-result-count" role="status">{visibleCategories.length} matching Master {visibleCategories.length === 1 ? 'Category' : 'Categories'}</p>

      {loading ? (
        <p className="store-state" role="status">Loading Master Categories...</p>
      ) : loadError ? (
        <div className="store-state store-state-error" role="alert">
          <p>Could not load Master Categories: {loadError}</p>
          <button className="store-btn" onClick={retryLoad} type="button">Retry</button>
        </div>
      ) : categories.length === 0 ? (
        <p className="store-state">No Master Categories have been added yet.</p>
      ) : visibleCategories.length === 0 ? (
        <p className="store-state">No Master Categories match the selected filters.</p>
      ) : (
        <>
          <table className="business-type-table">
            <thead><tr><th>Image</th><th>Name</th><th>Code / ID</th><th>Parent</th><th>Level</th><th>Linked</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleCategories.map((category) => (
                <tr key={category.id}>
                  <td><CategoryThumbnail category={category} key={category.logoUrl || category.id} /></td>
                  <td><strong>{category.name}</strong></td>
                  <td><code>{category.id}</code></td>
                  <td>{parentLabel(category)}</td>
                  <td>{category.level}</td>
                  <td>{category.businessCategoryRefs.length}</td>
                  <td><StatusBadge active={category.active === true} /></td>
                  <td>{actionButtons(category)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="business-type-cards">
            {visibleCategories.map((category) => (
              <li key={category.id}>
                <div className="business-type-card-head"><div className="master-category-card-title"><CategoryThumbnail category={category} key={category.logoUrl || category.id} /><strong>{category.name}</strong></div><StatusBadge active={category.active === true} /></div>
                <p><code>{category.id}</code> <span>Level {category.level}</span></p>
                <p>Parent: {parentLabel(category)}</p>
                <p>{category.businessCategoryRefs.length} linked Business {category.businessCategoryRefs.length === 1 ? 'Category' : 'Categories'}</p>
                {actionButtons(category)}
              </li>
            ))}
          </ul>
        </>
      )}

      {dialog && (
        <div className="business-type-modal-backdrop" onClick={() => !saving && setDialog(null)} role="presentation">
          <form aria-labelledby="master-category-form-title" aria-modal="true" className="business-type-modal master-category-modal" onClick={(event) => event.stopPropagation()} onSubmit={submitForm} role="dialog">
            <h2 id="master-category-form-title">{dialog.mode === 'edit' ? 'Edit Master Category' : 'Add Master Category'}</h2>
            {formError && <p className="store-feedback store-feedback-error" role="alert">{formError}</p>}

            <MasterCategoryImageField
              imageAsset={imageAsset}
              onChange={(asset) => {
                setImageAsset(asset)
                setRemoveImage(false)
              }}
              onRemove={() => {
                setImageAsset(null)
                setRemoveImage(true)
              }}
              savedUrl={dialog.mode === 'edit'
                ? categoryById.get(dialog.id)?.logoUrl || categoryById.get(dialog.id)?.logoRefs?.[0]?.logoUrl || ''
                : ''}
            />

            <label htmlFor="master-category-name">Category name</label>
            <input
              autoFocus
              id="master-category-name"
              maxLength={80}
              onChange={(event) => {
                const name = event.target.value
                setForm((current) => ({
                  ...current,
                  name,
                  ...(dialog.mode === 'create' && !codeEdited ? { code: generateMasterCategoryCode(name) } : {}),
                }))
              }}
              required
              value={form.name}
            />

            <label htmlFor="master-category-code">Category code</label>
            <input
              id="master-category-code"
              maxLength={50}
              onChange={(event) => {
                setCodeEdited(true)
                setForm((current) => ({ ...current, code: event.target.value }))
              }}
              pattern="[a-z0-9]+(_[a-z0-9]+)*"
              readOnly={dialog.mode === 'edit'}
              required
              title="Use lowercase letters, numbers and underscores."
              value={form.code}
            />

            <label htmlFor="master-category-parent">Parent category</label>
            <select
              disabled={dialog.mode === 'edit' && hasChildren(dialog.id)}
              id="master-category-parent"
              onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}
              value={form.parentId}
            >
              <option value="">None (top-level category)</option>
              {parentChoices.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} (Level {category.level}){category.active === true ? '' : ' - Inactive'}
                </option>
              ))}
            </select>
            {dialog.mode === 'edit' && hasChildren(dialog.id) && (
              <small className="master-category-hint">This category has child categories, so its parent cannot be changed.</small>
            )}

            <label htmlFor="master-category-mapping-search">Business Category mapping</label>
            {form.businessCategoryRefs.length > 0 ? (
              <div aria-label="Selected Business Categories" className="master-category-chips">
                {form.businessCategoryRefs.map((ref) => {
                  const option = optionByKey.get(pairKey(ref.businessTypeId, ref.categoryId))
                  const label = option ? `${option.name} · ${option.businessTypeName}` : `${ref.categoryId} · ${ref.businessTypeId}`
                  return (
                    <button aria-label={`Remove ${label}`} className="master-category-chip" key={pairKey(ref.businessTypeId, ref.categoryId)} onClick={() => removeMapping(ref)} type="button">
                      <span>{label}{option && !option.active ? ' (Inactive)' : ''}{!option && optionsLoaded ? ' (Unavailable)' : ''}</span>
                      <span aria-hidden="true">x</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <small className="master-category-hint">No Business Categories linked yet.</small>
            )}
            {optionsLoading ? (
              <p className="store-state" role="status">Loading Business Categories...</p>
            ) : optionsError ? (
              <div className="store-state store-state-error" role="alert">
                <p>Could not load Business Categories: {optionsError}</p>
                <button className="store-btn" onClick={loadOptions} type="button">Retry</button>
              </div>
            ) : optionsLoaded && options.filter((option) => option.active).length === 0 ? (
              <p className="store-state">No active Business Categories are available to link.</p>
            ) : optionsLoaded && (
              <>
                <input
                  autoComplete="off"
                  id="master-category-mapping-search"
                  onChange={(event) => setMappingSearch(event.target.value)}
                  placeholder="Search Business Categories"
                  type="search"
                  value={mappingSearch}
                />
                <div className="master-category-options">
                  {optionGroups.length === 0 ? (
                    <p className="master-category-hint">No Business Categories match your search.</p>
                  ) : optionGroups.map(([businessTypeId, group]) => (
                    <fieldset key={businessTypeId}>
                      <legend>{group.name}</legend>
                      {group.items.map((option) => {
                        const key = pairKey(option.businessTypeId, option.categoryId)
                        const checked = form.businessCategoryRefs.some((ref) => pairKey(ref.businessTypeId, ref.categoryId) === key)
                        return (
                          <label className="master-category-option" key={key}>
                            <input checked={checked} onChange={() => toggleMapping(option)} type="checkbox" />
                            <span>{option.name}</span>
                            <small>{option.businessTypeName}</small>
                          </label>
                        )
                      })}
                    </fieldset>
                  ))}
                </div>
              </>
            )}

            <label htmlFor="master-category-sort-order">Sort order</label>
            <input id="master-category-sort-order" min="0" onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} required type="number" value={form.sortOrder} />

            <label htmlFor="master-category-status">Status</label>
            <select id="master-category-status" onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === 'active' }))} value={form.active ? 'active' : 'inactive'}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <div className="store-actions">
              <button className="store-btn" disabled={saving} onClick={() => setDialog(null)} type="button">Cancel</button>
              <button className="store-btn store-btn-approve" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save Category'}</button>
            </div>
          </form>
        </div>
      )}

      {confirmTarget && (
        <div className="business-type-modal-backdrop" onClick={() => setConfirmTarget(null)} role="presentation">
          <div aria-labelledby="master-category-confirm-title" aria-modal="true" className="business-type-modal" onClick={(event) => event.stopPropagation()} role="alertdialog">
            <h2 id="master-category-confirm-title">Deactivate {confirmTarget.name}?</h2>
            <p>
              It will no longer be offered for new merchant imports. Existing references and data stay intact.
              {confirmActiveChildren > 0 && ` ${confirmActiveChildren} active child ${confirmActiveChildren === 1 ? 'category is' : 'categories are'} not changed automatically.`}
            </p>
            <div className="store-actions">
              <button className="store-btn" onClick={() => setConfirmTarget(null)} type="button">Cancel</button>
              <button className="store-btn store-btn-reject" onClick={() => applyActive(confirmTarget, false)} type="button">Deactivate</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
