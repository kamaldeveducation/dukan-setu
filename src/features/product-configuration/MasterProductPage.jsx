import { useEffect, useState } from 'react'
import { listBusinessCategories } from '../../services/businessCategoryService.js'
import { listActiveBusinessTypes } from '../../services/businessTypeService.js'
import AddMasterProductDialog from './components/AddMasterProductDialog.jsx'
import { listProductTypeConfigs } from './services/productTypeConfigService.js'
import { deleteMasterProduct, listMasterProducts } from './services/masterProductService.js'

const PRODUCT_TABLE_COLUMNS = [
  'Product Image',
  'Product Name',
  'Product ID',
  'Business Type',
  'Business Category',
  'Product Type',
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

function EditIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
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

function productIdOf(product) {
  return product.product_id || product.documentId || ''
}

function productImageUrl(product) {
  const first = Array.isArray(product.product_photo) ? product.product_photo[0] : null
  return typeof first?.url === 'string' ? first.url : ''
}

// Saved name first, then saved ID, so older documents without metadata still display.
function labelFor(name, id) {
  return name || id || '—'
}

function matchesSearch(product, query) {
  if (!query) return true
  return [product.product_name, productIdOf(product), product.barcode]
    .some((value) => String(value ?? '').toLowerCase().includes(query))
}

// Confirmation for deleting a product. Cancel closes without changes; Confirm stays disabled while the delete runs.
function DeleteMasterProductDialog({ product, busy, error, onCancel, onConfirm }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onCancel])

  const name = product.product_name || '—'
  const id = productIdOf(product)
  return (
    <div className="master-product-dialog-backdrop" onClick={busy ? undefined : onCancel} role="presentation">
      <section
        aria-describedby="delete-master-product-text"
        aria-labelledby="delete-master-product-title"
        aria-modal="true"
        className="master-product-dialog master-product-confirm"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
      >
        <h2 id="delete-master-product-title">Delete Product?</h2>
        <p id="delete-master-product-text">
          Product Name: <strong>{name}</strong><br />
          Product ID: <strong>{id}</strong>
        </p>
        <p>The product document and its saved images will be permanently deleted. This cannot be undone.</p>
        {error && <p className="store-state store-state-error" role="alert">{error}</p>}
        <div className="store-actions">
          <button className="store-btn" disabled={busy} onClick={onCancel} type="button">Cancel</button>
          <button className="store-btn store-btn-reject" disabled={busy} onClick={onConfirm} type="button">
            {busy ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default function MasterProductPage() {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [productsReload, setProductsReload] = useState(0)
  const [businessTypes, setBusinessTypes] = useState([])
  const [productTypes, setProductTypes] = useState([])
  const [optionsError, setOptionsError] = useState('')
  const [selectedBusinessTypeId, setSelectedBusinessTypeId] = useState('')
  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [selectedBusinessCategoryId, setSelectedBusinessCategoryId] = useState('')
  const [selectedProductTypeId, setSelectedProductTypeId] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

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

  useEffect(() => {
    let active = true
    listMasterProducts()
      .then((records) => {
        if (!active) return
        setProducts(records)
        setProductsError('')
      })
      .catch((error) => {
        if (active) setProductsError(error.message || 'Products could not be loaded.')
      })
      .finally(() => {
        if (active) setProductsLoading(false)
      })
    return () => {
      active = false
    }
  }, [productsReload])

  function reloadProducts() {
    setProductsLoading(true)
    setProductsError('')
    setProductsReload((count) => count + 1)
  }

  function handleBusinessTypeChange(event) {
    const businessTypeId = event.target.value
    setSelectedBusinessTypeId(businessTypeId)
    setSelectedBusinessCategoryId('')
    setCategories([])
    setCategoriesLoading(Boolean(businessTypeId))
  }

  function openAddDialog() {
    setActionMessage('')
    setEditingProduct(null)
    setAddOpen(true)
  }

  function openEditDialog(product) {
    setActionMessage('')
    setEditingProduct(product)
    setAddOpen(true)
  }

  function closeProductDialog() {
    setAddOpen(false)
    setEditingProduct(null)
  }

  function handleProductSaved(result) {
    closeProductDialog()
    setActionMessage(`Product ${result.productId} ${result.created ? 'saved' : 'updated'} successfully.`)
    reloadProducts()
  }

  function openDeleteDialog(product) {
    setActionMessage('')
    setDeleteError('')
    setDeleteTarget(product)
  }

  function closeDeleteDialog() {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteError('')
  }

  async function confirmDelete() {
    if (deleting || !deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteMasterProduct({ documentId: deleteTarget.documentId })
      setActionMessage(`Product ${productIdOf(deleteTarget)} deleted successfully.`)
      setDeleteTarget(null)
      reloadProducts()
    } catch (error) {
      setDeleteError(error.message || 'The product could not be deleted.')
    } finally {
      setDeleting(false)
    }
  }

  const query = search.trim().toLowerCase()
  const visibleProducts = products.filter((product) => matchesSearch(product, query)
    && (!selectedBusinessTypeId || product.businessTypeId === selectedBusinessTypeId)
    && (!selectedBusinessCategoryId || product.businessCategoryId === selectedBusinessCategoryId)
    && (!selectedProductTypeId || product.productTypeId === selectedProductTypeId))

  return (
    <section className="product-config-page master-product-page" aria-labelledby="master-products-title">
      <div className="dashboard-heading master-product-heading">
        <div>
          <p className="eyebrow">DUKAN SETU / MASTER PRODUCTS</p>
          <h1 id="master-products-title">Master Products</h1>
          <p className="dashboard-intro">Manage your master product catalog</p>
        </div>
        <div className="master-product-header-actions">
          <button className="store-btn store-btn-approve" onClick={openAddDialog} type="button">+ Add Product</button>
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

      {productsError && <p className="store-feedback store-feedback-error" role="alert">{productsError}</p>}
      {actionMessage && <p className="store-feedback" role="status">{actionMessage}</p>}

      <div className="master-product-table-wrap">
        <table className="master-product-table">
          <thead>
            <tr>
              {PRODUCT_TABLE_COLUMNS.map((column) => (
                <th key={column} scope="col">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {productsLoading && (
              <tr><td className="master-product-table-message" colSpan={PRODUCT_TABLE_COLUMNS.length} role="status">Loading products...</td></tr>
            )}
            {!productsLoading && products.length > 0 && visibleProducts.length === 0 && (
              <tr><td className="master-product-table-message" colSpan={PRODUCT_TABLE_COLUMNS.length}>No products match the current search or filters.</td></tr>
            )}
            {visibleProducts.map((product) => {
              const imageUrl = productImageUrl(product)
              return (
                <tr key={product.documentId}>
                  <td>
                    {imageUrl
                      ? <img alt="" className="master-product-thumb" loading="lazy" src={imageUrl} />
                      : <span className="master-product-thumb master-product-thumb-placeholder" aria-label="No image">No image</span>}
                  </td>
                  <td>{product.product_name || '—'}</td>
                  <td>{productIdOf(product)}</td>
                  <td>{labelFor(product.businessTypeName, product.businessTypeId)}</td>
                  <td>{labelFor(product.businessCategoryName, product.businessCategoryId)}</td>
                  <td>{labelFor(product.productTypeName, product.productTypeId)}</td>
                  <td>
                    <div className="master-product-actions">
                      <button
                        aria-label={`Edit ${product.product_name || productIdOf(product)}`}
                        className="master-product-icon-btn"
                        disabled={deleting}
                        onClick={() => openEditDialog(product)}
                        title="Edit product"
                        type="button"
                      >
                        <EditIcon />
                      </button>
                      <button
                        aria-label={`Delete ${product.product_name || productIdOf(product)}`}
                        className="master-product-icon-btn master-product-icon-btn-danger"
                        disabled={deleting}
                        onClick={() => openDeleteDialog(product)}
                        title="Delete product"
                        type="button"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!productsLoading && !productsError && products.length === 0 && (
        <div className="master-product-empty">
          <PackageIcon />
          <h2>No Products Yet</h2>
          <p>Your master product catalog is empty. Add your first product to get started.</p>
          <button className="store-btn store-btn-approve" onClick={openAddDialog} type="button">+ Add First Product</button>
        </div>
      )}

      {addOpen && (
        <AddMasterProductDialog
          key={editingProduct?.documentId ?? 'new'}
          onClose={closeProductDialog}
          onSaved={handleProductSaved}
          product={editingProduct}
        />
      )}
      {deleteTarget && (
        <DeleteMasterProductDialog
          busy={deleting}
          error={deleteError}
          onCancel={closeDeleteDialog}
          onConfirm={confirmDelete}
          product={deleteTarget}
        />
      )}
    </section>
  )
}