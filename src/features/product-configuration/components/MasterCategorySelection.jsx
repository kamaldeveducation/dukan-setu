import { useState } from 'react'
import { listMasterCategoriesForBusinessCategory } from '../../../services/masterCategoryService.js'
import { listMasterSubCategoriesByParent } from '../../../services/masterSubCategoryService.js'
import { listSubSubCategoriesByParent } from '../../../services/masterSubSubCategoryService.js'
import HierarchicalImageSelect from './HierarchicalImageSelect.jsx'
import { useChildOptions } from './childCategoryOptions.js'

function labelOf(items, id) {
  return items.find((item) => item.id === id)?.name ?? ''
}

export default function MasterCategorySelection({
  businessTypeId,
  businessCategoryId,
  initialMasterCategoryId = '',
  initialSubCategoryId = '',
  initialSubSubCategoryId = '',
  onSelectionChange,
}) {
  const [masterCategoryId, setMasterCategoryId] = useState(initialMasterCategoryId)
  const [subCategoryId, setSubCategoryId] = useState(initialSubCategoryId)
  const [subSubCategoryId, setSubSubCategoryId] = useState(initialSubSubCategoryId)

  const masterCategories = useChildOptions(
    businessCategoryId ? `${businessTypeId}:${businessCategoryId}` : '',
    () => listMasterCategoriesForBusinessCategory(businessTypeId, businessCategoryId),
  )
  const subCategories = useChildOptions(masterCategoryId, () => listMasterSubCategoriesByParent(masterCategoryId))
  const subSubCategories = useChildOptions(subCategoryId, () => listSubSubCategoriesByParent(subCategoryId))

  function reportSelection(next) {
    onSelectionChange?.({
      masterCategoryId: '',
      masterCategoryName: '',
      subCategoryId: '',
      subCategoryName: '',
      subSubCategoryId: '',
      subSubCategoryName: '',
      ...next,
    })
  }

  function handleMasterCategoryChange(nextValue) {
    setMasterCategoryId(nextValue)
    setSubCategoryId('')
    setSubSubCategoryId('')
    reportSelection({ masterCategoryId: nextValue, masterCategoryName: labelOf(masterCategories.view.items, nextValue) })
  }

  function handleSubCategoryChange(nextValue) {
    setSubCategoryId(nextValue)
    setSubSubCategoryId('')
    reportSelection({
      masterCategoryId,
      masterCategoryName: labelOf(masterCategories.view.items, masterCategoryId),
      subCategoryId: nextValue,
      subCategoryName: labelOf(subCategories.view.items, nextValue),
    })
  }

  function handleSubSubCategoryChange(nextValue) {
    setSubSubCategoryId(nextValue)
    reportSelection({
      masterCategoryId,
      masterCategoryName: labelOf(masterCategories.view.items, masterCategoryId),
      subCategoryId,
      subCategoryName: labelOf(subCategories.view.items, subCategoryId),
      subSubCategoryId: nextValue,
      subSubCategoryName: labelOf(subSubCategories.view.items, nextValue),
    })
  }

  const masterCategoryView = masterCategories.view
  const subCategoryView = subCategories.view
  const subSubCategoryView = subSubCategories.view

  return (
    <section className="master-category-section" aria-labelledby="master-product-categorization-title">
      <h3 id="master-product-categorization-title" className="master-category-section-title">Master Product Categorization</h3>
      <div className="dynamic-master-product-selection master-category-selectors">
        <HierarchicalImageSelect
          allOption={{ label: 'All Categories' }}
          disabledText="Select Business Category First"
          disabled={!businessCategoryId}
          emptyText="No Master Categories Mapped"
          errorText="Could not load options"
          id="master-category-select"
          label="Master Category"
          onChange={handleMasterCategoryChange}
          onRetry={masterCategories.retry}
          options={masterCategoryView.items}
          placeholder="Select a Master Category"
          status={masterCategoryView.status}
          value={masterCategoryId}
        />
        <HierarchicalImageSelect
          allOption={{ label: 'All Sub Categories' }}
          disabledText="Select Master Category First"
          disabled={!masterCategoryId}
          emptyText="No Sub Categories Available"
          errorText="Could not load options"
          id="master-sub-category-select"
          label="Master Sub Category"
          onChange={handleSubCategoryChange}
          onRetry={subCategories.retry}
          optional
          options={subCategoryView.items}
          placeholder="Select a Master Sub Category"
          status={subCategoryView.status}
          value={subCategoryId}
        />
        <HierarchicalImageSelect
          allOption={{ label: 'All Sub-Subcategories' }}
          disabledText="Select Master Sub Category First"
          disabled={!subCategoryId}
          emptyText="No Sub-Subcategories Available"
          errorText="Could not load options"
          id="master-sub-sub-category-select"
          label="Master Sub-Subcategory"
          onChange={handleSubSubCategoryChange}
          onRetry={subSubCategories.retry}
          optional
          options={subSubCategoryView.items}
          placeholder="Select a Master Sub-Subcategory"
          status={subSubCategoryView.status}
          value={subSubCategoryId}
        />
      </div>
    </section>
  )
}
