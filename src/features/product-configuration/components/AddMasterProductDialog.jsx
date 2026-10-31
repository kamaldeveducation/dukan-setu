import { useEffect, useMemo, useState } from 'react'
import { listBusinessCategories } from '../../../services/businessCategoryService.js'
import { listActiveBusinessTypes } from '../../../services/businessTypeService.js'
import { listBusinessCategoryMappings } from '../services/businessCategoryMappingService.js'
import { listProductTypeConfigs } from '../services/productTypeConfigService.js'
import DynamicProductForm from './DynamicProductForm.jsx'
import MasterCategorySelection from './MasterCategorySelection.jsx'

const EMPTY_MASTER_SELECTION = {
  masterCategoryId: '',
  masterCategoryName: '',
  subCategoryId: '',
  subCategoryName: '',
  subSubCategoryId: '',
  subSubCategoryName: '',
}

function masterSelectionOf(product) {
  if (!product) return EMPTY_MASTER_SELECTION
  return {
    masterCategoryId: product.masterCategoryId ?? '',
    masterCategoryName: product.masterCategoryName ?? '',
    subCategoryId: product.masterSubCategoryId ?? '',
    subCategoryName: product.masterSubCategoryName ?? '',
    subSubCategoryId: product.masterSubSubCategoryId ?? '',
    subSubCategoryName: product.masterSubSubCategoryName ?? '',
  }
}

// product: a saved master product in edit mode; omitted when adding a new product.
export default function AddMasterProductDialog({ onClose, onSaved, product }) {
  const isEditing = Boolean(product)
  const [businessTypes, setBusinessTypes] = useState([])
  const [productTypes, setProductTypes] = useState([])
  const [mappings, setMappings] = useState([])
  const [sourceLoading, setSourceLoading] = useState(true)
  const [sourceError, setSourceError] = useState('')
  const [sourceReload, setSourceReload] = useState(0)
  const [selectedBusinessTypeId, setSelectedBusinessTypeId] = useState(product?.businessTypeId ?? '')
  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(Boolean(product?.businessTypeId))
  const [categoriesError, setCategoriesError] = useState('')
  const [categoryReload, setCategoryReload] = useState(0)
  const [selectedBusinessCategoryId, setSelectedBusinessCategoryId] = useState(product?.businessCategoryId ?? '')
  const [selectedProductTypeId, setSelectedProductTypeId] = useState(product?.productTypeId ?? '')
  const [masterSelection, setMasterSelection] = useState(() => masterSelectionOf(product))

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    let active = true
    Promise.all([
      listActiveBusinessTypes(),
      listProductTypeConfigs(),
      listBusinessCategoryMappings(),
    ])
      .then(([types, configuredProductTypes, categoryMappings]) => {
        if (!active) return
        setBusinessTypes(types)
        setProductTypes(configuredProductTypes)
        setMappings(categoryMappings)
        setSourceError('')
      })
      .catch((error) => {
        if (active) setSourceError(error.message || 'Selection options could not be loaded.')
      })
      .finally(() => {
        if (active) setSourceLoading(false)
      })
    return () => {
      active = false
    }
  }, [sourceReload])

  useEffect(() => {
    if (!selectedBusinessTypeId) return undefined
    let active = true
    listBusinessCategories(selectedBusinessTypeId)
      .then((records) => {
        if (active) setCategories(records.filter((category) => category.active === true))
      })
      .catch((error) => {
        if (active) setCategoriesError(error.message || 'Business Categories could not be loaded.')
      })
      .finally(() => {
        if (active) setCategoriesLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedBusinessTypeId, categoryReload])

  const availableProductTypes = useMemo(() => {
    if (!selectedBusinessTypeId || !selectedBusinessCategoryId) return []
    const mappedIds = new Set(mappings
      .filter((mapping) => mapping.status === 'active'
        && mapping.businessTypeId === selectedBusinessTypeId
        && mapping.businessCategoryId === selectedBusinessCategoryId)
      .flatMap((mapping) => mapping.productTypeIds))
    return productTypes.filter((productType) => productType.status === 'active' && mappedIds.has(productType.id))
  }, [mappings, productTypes, selectedBusinessCategoryId, selectedBusinessTypeId])

  const selectedBusinessType = businessTypes.find((type) => type.id === selectedBusinessTypeId)
  const selectedBusinessCategory = categories.find((category) => category.id === selectedBusinessCategoryId)
  const selectedProductType = availableProductTypes.find((productType) => productType.id === selectedProductTypeId)

  function handleBusinessTypeChange(event) {
    const businessTypeId = event.target.value
    setSelectedBusinessTypeId(businessTypeId)
    setSelectedBusinessCategoryId('')
    setSelectedProductTypeId('')
    setMasterSelection(EMPTY_MASTER_SELECTION)
    setCategories([])
    setCategoriesError('')
    setCategoriesLoading(Boolean(businessTypeId))
  }

  function handleBusinessCategoryChange(event) {
    setSelectedBusinessCategoryId(event.target.value)
    setSelectedProductTypeId('')
    setMasterSelection(EMPTY_MASTER_SELECTION)
  }

  function retrySources() {
    setSourceError('')
    setSourceLoading(true)
    setSourceReload((current) => current + 1)
  }

  function retryCategories() {
    setCategoriesError('')
    setCategoriesLoading(true)
    setCategoryReload((current) => current + 1)
  }

  return (
    <div className="master-product-dialog-backdrop" onClick={onClose} role="presentation">
      <section
        aria-labelledby="add-master-product-title"
        aria-modal="true"
        className="master-product-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="master-product-dialog-head">
          <div>
            <h2 id="add-master-product-title">{isEditing ? 'Edit Product' : 'Add Product'}</h2>
            <p className="dashboard-intro">Choose a Business Type, Business Category, and Product Type.</p>
          </div>
          <button aria-label="Close" className="store-btn" onClick={onClose} type="button">×</button>
        </div>

        {sourceLoading ? (
          <p className="store-state" role="status">Loading selection options...</p>
        ) : sourceError ? (
          <div className="store-state store-state-error" role="alert">
            <p>Could not load selection options: {sourceError}</p>
            <button className="store-btn" onClick={retrySources} type="button">Retry</button>
          </div>
        ) : (
          <>
            <div className="dynamic-master-product-selection">
              <label className="dynamic-master-product-field">
                <span>Business Type <span className="dynamic-master-product-required" aria-hidden="true">*</span></span>
                <select
                  onChange={handleBusinessTypeChange}
                  required
                  value={selectedBusinessTypeId}
                >
                  <option value="">Select a Business Type</option>
                  {businessTypes.map((businessType) => (
                    <option key={businessType.id} value={businessType.id}>{businessType.name}</option>
                  ))}
                </select>
              </label>
              {businessTypes.length === 0 && (
                <p className="dynamic-master-product-note">No active Business Types are available.</p>
              )}

              <label className="dynamic-master-product-field">
                <span>Business Category <span className="dynamic-master-product-required" aria-hidden="true">*</span></span>
                <select
                  disabled={!selectedBusinessTypeId || categoriesLoading || Boolean(categoriesError)}
                  onChange={handleBusinessCategoryChange}
                  required
                  value={selectedBusinessCategoryId}
                >
                  <option value="">Select a Business Category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name || category.id}</option>
                  ))}
                </select>
                {categoriesLoading && <span className="dynamic-master-product-note" role="status">Loading Business Categories...</span>}
                {categoriesError && (
                  <span className="dynamic-master-product-inline-error" role="alert">
                    {categoriesError} <button className="store-btn" onClick={retryCategories} type="button">Retry</button>
                  </span>
                )}
                {selectedBusinessTypeId && !categoriesLoading && !categoriesError && categories.length === 0 && (
                  <span className="dynamic-master-product-note">No active Business Categories are available for this Business Type.</span>
                )}
              </label>

              <label className="dynamic-master-product-field">
                <span>Product Type <span className="dynamic-master-product-required" aria-hidden="true">*</span></span>
                <select
                  disabled={!selectedBusinessCategoryId || availableProductTypes.length === 0}
                  onChange={(event) => setSelectedProductTypeId(event.target.value)}
                  required
                  value={selectedProductTypeId}
                >
                  <option value="">Select a Product Type</option>
                  {availableProductTypes.map((productType) => (
                    <option key={productType.id} value={productType.id}>{productType.name}</option>
                  ))}
                </select>
                {selectedBusinessCategoryId && availableProductTypes.length === 0 && (
                  <span className="dynamic-master-product-note">No active Product Types are configured for this Business Category.</span>
                )}
              </label>
            </div>

            <MasterCategorySelection
              key={`${selectedBusinessTypeId}:${selectedBusinessCategoryId}`}
              businessCategoryId={selectedBusinessCategoryId}
              businessTypeId={selectedBusinessTypeId}
              initialMasterCategoryId={masterSelection.masterCategoryId}
              initialSubCategoryId={masterSelection.subCategoryId}
              initialSubSubCategoryId={masterSelection.subSubCategoryId}
              onSelectionChange={setMasterSelection}
            />

            {selectedBusinessType && selectedBusinessCategory && selectedProductType && (
              <section className="dynamic-master-product-confirmation" aria-labelledby="dynamic-master-product-selection-title">
                <h2 id="dynamic-master-product-selection-title">Selection confirmed</h2>
                <dl>
                  <div><dt>Business Type</dt><dd>{selectedBusinessType.name}</dd></div>
                  <div><dt>Business Category</dt><dd>{selectedBusinessCategory.name || selectedBusinessCategory.id}</dd></div>
                  <div><dt>Product Type</dt><dd>{selectedProductType.name}</dd></div>
                </dl>
                <DynamicProductForm
                  key={selectedProductType.id}
                  editingProductId={product?.documentId}
                  initialData={product}
                  onSaved={onSaved}
                  productTypeId={selectedProductType.id}
                  selection={{
                    businessTypeId: selectedBusinessTypeId,
                    businessTypeName: selectedBusinessType.name,
                    businessCategoryId: selectedBusinessCategoryId,
                    businessCategoryName: selectedBusinessCategory.name,
                    productTypeId: selectedProductType.id,
                    productTypeName: selectedProductType.name,
                    ...masterSelection,
                  }}
                />

              </section>
            )}
          </>
        )}
      </section>
    </div>
  )
}
