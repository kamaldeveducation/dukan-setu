import { useEffect } from 'react'
import { listBusinessCategories } from '../../../services/businessCategoryService.js'
import { listMasterCategories, listMasterCategoriesForBusinessCategory } from '../../../services/masterCategoryService.js'
import { listMasterSubCategoriesByParent } from '../../../services/masterSubCategoryService.js'
import { listSubSubCategoriesByParent } from '../../../services/masterSubSubCategoryService.js'
import HierarchicalImageSelect from './HierarchicalImageSelect.jsx'
import { useChildOptions } from './childCategoryOptions.js'

const requestCache = new Map()

// Each scope is fetched once per page session. Failed requests are dropped so the next attempt refetches.
function cachedLoad(key, load) {
  if (!requestCache.has(key)) {
    const request = load()
    requestCache.set(key, request)
    request.catch(() => requestCache.delete(key))
  }
  return requestCache.get(key)
}

function sortByOrder(items) {
  return [...items].sort((left, right) => (
    Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) || String(left.name).localeCompare(String(right.name))
  ))
}

// Business Category selected: its mapped Master Categories.
// Only Business Type selected: union across that type's active Business Categories.
// No business scope: all active top-level Master Categories.
function loadMasterCategoryScope(businessTypeId, businessCategoryId) {
  if (businessTypeId && businessCategoryId) {
    return listMasterCategoriesForBusinessCategory(businessTypeId, businessCategoryId)
  }
  if (businessTypeId) {
    return listBusinessCategories(businessTypeId).then(async (categories) => {
      const activeCategories = categories.filter((category) => category.active === true)
      const lists = await Promise.all(activeCategories.map((category) => (
        listMasterCategoriesForBusinessCategory(businessTypeId, category.id)
      )))
      const byId = new Map()
      lists.flat().forEach((item) => byId.set(item.id, item))
      return sortByOrder([...byId.values()])
    })
  }
  return listMasterCategories().then((items) => sortByOrder(
    items.filter((item) => item.parentId === null && item.active === true),
  ))
}

export default function MasterProductCategoryFilters({
  businessTypeId,
  businessCategoryId,
  masterCategoryId,
  masterSubCategoryId,
  masterSubSubCategoryId,
  onChange,
}) {
  const masterScopeKey = `master:${businessTypeId}:${businessCategoryId}`
  const { view: masterView, retry: retryMaster } = useChildOptions(masterScopeKey, () => (
    cachedLoad(masterScopeKey, () => loadMasterCategoryScope(businessTypeId, businessCategoryId))
  ))

  const subKey = masterCategoryId ? `sub:${masterCategoryId}` : ''
  const { view: subView, retry: retrySub } = useChildOptions(subKey, () => (
    cachedLoad(subKey, () => listMasterSubCategoriesByParent(masterCategoryId))
  ))

  const subSubKey = masterSubCategoryId ? `subsub:${masterSubCategoryId}` : ''
  const { view: subSubView, retry: retrySubSub } = useChildOptions(subSubKey, () => (
    cachedLoad(subSubKey, () => listSubSubCategoriesByParent(masterSubCategoryId))
  ))

  // Drop a selection that is no longer valid for its scope, along with its children.
  useEffect(() => {
    if (masterView.status === 'ready' && masterCategoryId && !masterView.items.some((item) => item.id === masterCategoryId)) {
      onChange({ masterCategoryId: '', masterSubCategoryId: '', masterSubSubCategoryId: '' })
    }
  }, [masterView, masterCategoryId, onChange])

  useEffect(() => {
    if (subView.status === 'ready' && masterSubCategoryId && !subView.items.some((item) => item.id === masterSubCategoryId)) {
      onChange({ masterSubCategoryId: '', masterSubSubCategoryId: '' })
    }
  }, [subView, masterSubCategoryId, onChange])

  useEffect(() => {
    if (subSubView.status === 'ready' && masterSubSubCategoryId && !subSubView.items.some((item) => item.id === masterSubSubCategoryId)) {
      onChange({ masterSubSubCategoryId: '' })
    }
  }, [subSubView, masterSubSubCategoryId, onChange])

  function handleMasterCategoryChange(id) {
    onChange({ masterCategoryId: id, masterSubCategoryId: '', masterSubSubCategoryId: '' })
  }

  function handleMasterSubCategoryChange(id) {
    onChange({ masterSubCategoryId: id, masterSubSubCategoryId: '' })
  }

  function handleMasterSubSubCategoryChange(id) {
    onChange({ masterSubSubCategoryId: id })
  }

  return (
    <>
      <HierarchicalImageSelect
        allOption={{ label: 'All Categories' }}
        errorText={masterView.error || 'Master Categories could not be loaded.'}
        id="master-product-filter-master-category"
        label="Master Category"
        loadingText="Loading Master Categories..."
        emptyText="No Master Categories available"
        onChange={handleMasterCategoryChange}
        onRetry={retryMaster}
        options={masterView.items}
        status={masterView.status}
        value={masterCategoryId}
      />
      <HierarchicalImageSelect
        allOption={{ label: 'All Sub Categories' }}
        disabled={!masterCategoryId}
        disabledText="Select a Master Category first"
        errorText={subView.error || 'Master Sub Categories could not be loaded.'}
        id="master-product-filter-master-sub-category"
        label="Master Sub Category"
        loadingText="Loading Master Sub Categories..."
        emptyText="No Master Sub Categories available"
        onChange={handleMasterSubCategoryChange}
        onRetry={retrySub}
        options={subView.items}
        status={subView.status}
        value={masterSubCategoryId}
      />
      <HierarchicalImageSelect
        allOption={{ label: 'All Sub-Sub Categories' }}
        disabled={!masterSubCategoryId}
        disabledText="Select a Master Sub Category first"
        errorText={subSubView.error || 'Master Sub-Sub Categories could not be loaded.'}
        id="master-product-filter-master-sub-sub-category"
        label="Master Sub-Sub Category"
        loadingText="Loading Master Sub-Sub Categories..."
        emptyText="No Master Sub-Sub Categories available"
        onChange={handleMasterSubSubCategoryChange}
        onRetry={retrySubSub}
        options={subSubView.items}
        status={subSubView.status}
        value={masterSubSubCategoryId}
      />
    </>
  )
}
