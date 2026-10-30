import { useEffect, useState } from 'react'
import { listBusinessCategories } from '../../services/businessCategoryService.js'
import { listActiveBusinessTypes } from '../../services/businessTypeService.js'
import AddMasterProductDialog from './components/AddMasterProductDialog.jsx'
import { listProductTypeConfigs } from './services/productTypeConfigService.js'

const PRODUCT_TABLE_COLUMNS = [
  'Product Image',
  'Product Name',
  'Product ID',
  'Business Type',
  'Business Category',
  'Product Type',
  'Status',
  'Actions',
]

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function PackageIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="56" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" width="56">
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </svg>
  )
}

export default function MasterProductPage() {
  const [search, setSearch] = useState('')
  const [businessTypes, setBusinessTypes] = useState([])
  const [productTypes, setProductTypes] = useState([])
  const [optionsError, setOptionsError] = useState('')
  const [selectedBusinessTypeId, setSelectedBusinessTypeId] = useState('')
  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [selectedBusinessCategoryId, setSelectedBusinessCategoryId] = useState('')
  const [selectedProductTypeId, setSelectedProductTypeId] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([listActiveBusinessTypes(), listProductTypeConfigs()])
      .then(([types, configuredProductTypes]) => {
        if (!active) return
        setBusinessTypes(types)
        setProductTypes(configuredProductTypes.filter((productType) => productType.status === 'active'))
      })
      .catch((error) => {
        if (active) setOptionsError(error.message || 'Filter options could not be loaded.')
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedBusinessTypeId) return undefined
    let active = true
    listBusinessCategories(selectedBusinessTypeId)
      .then((records) => {
        if (active) setCategories(records.filter((category) => category.active === true))
      })
      .catch((error) => {
        if (active) setOptionsError(error.message || 'Business Categories could not be loaded.')
      })
      .finally(() => {
        if (active) setCategoriesLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedBusinessTypeId])

  function handleBusinessTypeChange(event) {
    const businessTypeId = event.target.value
    setSelectedBusinessTypeId(businessTypeId)
    setSelectedBusinessCategoryId('')
    setCategories([])
    setCategoriesLoading(Boolean(businessTypeId))
  }

  // Product rows are not loaded yet, so the table stays empty and these values only drive the UI.
  const hasProducts = false

  return (
    <section className="product-config-page master-product-page" aria-labelledby="master-products-title">
      <div className="dashboard-heading master-product-heading">
        <div>
          <p className="eyebrow">DUKAN SETU / MASTER PRODUCTS</p>
          <h1 id="master-products-title">Master Products</h1>
          <p className="dashboard-intro">Manage your master product catalog</p>
        </div>
        <div className="master-product-header-actions">
          <button className="store-btn store-btn-approve" onClick={() => setAddOpen(true)} type="button">+ Add Product</button>
        </div>
      </div>

      {optionsError && <p className="store-feedback store-feedback-error" role="alert">{optionsError}</p>}

      <div className="master-product-toolbar">
        <div className="master-product-search">
          <SearchIcon />
          <input
            aria-label="Search products"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products by name, product ID or barcode..."
            type="search"
            value={search}
          />
          {search && (
            <button aria-label="Clear search" className="master-product-search-clear" onClick={() => setSearch('')} type="button">×</button>
          )}
        </div>

        <label className="dynamic-master-product-field">
          <span>Business Type</span>
          <select onChange={handleBusinessTypeChange} value={selectedBusinessTypeId}>
            <option value="">All Business Types</option>
            {businessTypes.map((businessType) => (
              <option key={businessType.id} value={businessType.id}>{businessType.name}</option>
            ))}
          </select>
        </label>

        <label className="dynamic-master-product-field">
          <span>Business Category</span>
          <select
            disabled={!selectedBusinessTypeId || categoriesLoading}
            onChange={(event) => setSelectedBusinessCategoryId(event.target.value)}
            value={selectedBusinessCategoryId}
          >
            <option value="">All Business Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name || category.id}</option>
            ))}
          </select>
          {categoriesLoading && <span className="dynamic-master-product-note" role="status">Loading Business Categories...</span>}
        </label>

        <label className="dynamic-master-product-field">
          <span>Product Type</span>
          <select onChange={(event) => setSelectedProductTypeId(event.target.value)} value={selectedProductTypeId}>
            <option value="">All Product Types</option>
            {productTypes.map((productType) => (
              <option key={productType.id} value={productType.id}>{productType.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="master-product-table-wrap">
        <table className="master-product-table">
          <thead>
            <tr>
              {PRODUCT_TABLE_COLUMNS.map((column) => (
                <th key={column} scope="col">{column}</th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {!hasProducts && (
        <div className="master-product-empty">
          <PackageIcon />
          <h2>No Products Yet</h2>
          <p>Your master product catalog is empty. Add your first product to get started.</p>
          <button className="store-btn store-btn-approve" onClick={() => setAddOpen(true)} type="button">+ Add First Product</button>
        </div>
      )}

      {addOpen && <AddMasterProductDialog onClose={() => setAddOpen(false)} />}
    </section>
  )
}