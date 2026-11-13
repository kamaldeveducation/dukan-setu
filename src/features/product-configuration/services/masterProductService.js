import { collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { deleteObject, getBlob, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { db, storage } from '../../../firebase'
import { buildImageStoragePath, getImageFieldPolicy } from './masterProductImagePolicy'

export const MASTER_PRODUCTS_COLLECTION = 'master_products'
const PRODUCT_ID_MAX_BYTES = 1500
const PRODUCT_ID_KEY = 'product_id'
const PRODUCT_NAME_KEY = 'product_name'
const IMAGE_READ_TIMEOUT_MS = 15000

function serviceError(code, message) {
  const error = new Error(message)
  error.code = code
  error.handled = true
  return error
}

// Firestore rejects "/", "." and "..", and "__x__" IDs. The stricter storage-safe check keeps the ID usable in Storage paths.
export function validateProductId(raw) {
  const productId = String(raw ?? '').trim()
  if (!productId) throw serviceError('invalid-product-id', 'Enter a Product ID.')
  if (new TextEncoder().encode(productId).length > PRODUCT_ID_MAX_BYTES) {
    throw serviceError('invalid-product-id', `Product ID can be at most ${PRODUCT_ID_MAX_BYTES} bytes.`)
  }
  if (productId === '.' || productId === '..' || /^__.*__$/.test(productId)) {
    throw serviceError('invalid-product-id', 'This Product ID is reserved. Use a different Product ID.')
  }
  if (/[/#[\]*?]/.test(productId)) {
    throw serviceError('invalid-product-id', 'Product ID cannot contain /, #, [, ], *, or ?.')
  }
  return productId
}

function extensionFor(item) {
  if (item.extension) return item.extension
  return item.contentType === 'image/webp' ? 'webp' : 'jpg'
}

function storagePathFor(item) {
  if (typeof item.storagePath === 'string' && item.storagePath) return item.storagePath
  if (typeof item.url !== 'string' || !item.url) return ''
  try {
    const url = new URL(item.url)
    if (url.hostname === 'firebasestorage.googleapis.com' || url.hostname === 'storage.googleapis.com') {
      return storageRef(storage, item.url).fullPath
    }
  } catch {
    return ''
  }
  return ''
}

// Images already saved in Storage (edit mode) have no blob. Their bytes are read through the authenticated SDK first, then the saved URL as a fallback.
async function imageBlobOf(item, fieldKey) {
  if (item.blob instanceof Blob && item.blob.size > 0) return item.blob

  let storageReadError
  const load = async () => {
    if (typeof item.storagePath === 'string' && item.storagePath) {
      try {
        const blob = await getBlob(storageRef(storage, item.storagePath))
        if (blob.size > 0) return blob
      } catch (error) {
        storageReadError = error
      }
    }
    if (typeof item.url === 'string' && item.url) {
      try {
        const response = await fetch(item.url)
        if (!response.ok) {
          throw serviceError('image-load-failed', `The saved image in "${fieldKey}" returned HTTP ${response.status}.`)
        }
        const blob = await response.blob()
        if (blob.size > 0) return blob
      } catch (error) {
        const storageMessage = storageReadError?.message ? ` Storage read failed: ${storageReadError.message}` : ''
        throw serviceError('image-load-failed', `The saved image in "${fieldKey}" could not be read from Firebase Storage: ${error.message || 'Unknown download error.'}.${storageMessage}`)
      }
    }
    throw serviceError('invalid-image', `An image in "${fieldKey}" is missing its data. Remove it and add it again.`)
  }

  let timeoutId
  const timeout = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(serviceError('image-load-timeout', `Loading the saved image in "${fieldKey}" timed out. Check Firebase Storage access and CORS settings, then try again.`))
    }, IMAGE_READ_TIMEOUT_MS)
  })
  try {
    return await Promise.race([load(), timeout])
  } finally {
    clearTimeout(timeoutId)
  }
}

async function uploadImageField({ fieldKey, items, selection, productId, copying = false }) {
  const sorted = [...items].sort((left, right) => left.order - right.order)
  // All sources are read before any write, so an upload can never overwrite a file that a later item still needs.
  const plans = []
  for (const [index, item] of sorted.entries()) {
    const storagePath = buildImageStoragePath({ selection, productId, fieldKey, index, extension: extensionFor(item) })
    const existingPath = storagePathFor(item)
    const existingImage = !item.blob && Boolean(item.url || existingPath)
    // Copies reuse saved image references; only images with new local blobs need uploading.
    // Regular edits preserve their existing behavior when categories change.
    const keep = copying
      ? existingImage
      : !item.blob && Boolean(item.url) && Boolean(item.storagePath)
    const existingUrl = item.url || (keep && existingPath ? await getDownloadURL(storageRef(storage, existingPath)) : '')
    plans.push({
      index,
      item: { ...item, url: existingUrl, storagePath: existingPath || item.storagePath },
      storagePath,
      keep,
      blob: keep ? null : await imageBlobOf(item, fieldKey),
    })
  }
  const uploaded = []
  for (const { index, item, storagePath, keep, blob } of plans) {
    if (keep) {
      uploaded.push({
        order: index,
        url: item.url,
        ...(item.storagePath ? { storagePath: item.storagePath } : {}),
        contentType: item.contentType,
        width: item.width,
        height: item.height,
        size: item.size,
      })
      continue
    }
    const objectRef = storageRef(storage, storagePath)
    let url
    try {
      await uploadBytes(objectRef, blob, { contentType: item.contentType })
      url = await getDownloadURL(objectRef)
    } catch (error) {
      if (error?.code === 'storage/network-request-failed' || error?.code === 'storage/unknown') {
        throw serviceError('storage-upload-failed', `Firebase Storage could not complete the image upload. Check your connection and Storage bucket CORS configuration for this app origin. ${error.message || ''}`.trim())
      }
      throw error
    }
    uploaded.push({
      order: index,
      url,
      storagePath,
      contentType: item.contentType,
      width: item.width,
      height: item.height,
      size: item.size,
    })
  }
  return uploaded
}

function normalizeValue(field, value) {
  if (field.type === 'image') return value ?? []
  if (field.type === 'boolean') return value === true
  if (value === undefined || value === null || value === '') return null
  if (field.type === 'number' || field.type === 'currency') return Number(value)
  if (field.type === 'multi_select') return Array.isArray(value) ? value : []
  if (typeof value === 'string') return value.trim()
  return value
}

// Collects storage paths from every image array in a stored document.
function storagePathsOf(data) {
  return Object.values(data ?? {})
    .filter(Array.isArray)
    .flat()
    .map((item) => item?.storagePath)
    .filter((path) => typeof path === 'string')
}

// Only selected levels are written; unselected optional levels are omitted.
export function buildCategoryMetadata(selection) {
  const levels = [
    ['businessTypeId', selection.businessTypeId, 'businessTypeName', selection.businessTypeName],
    ['businessCategoryId', selection.businessCategoryId, 'businessCategoryName', selection.businessCategoryName],
    ['masterCategoryId', selection.masterCategoryId, 'masterCategoryName', selection.masterCategoryName],
    ['masterSubCategoryId', selection.subCategoryId, 'masterSubCategoryName', selection.subCategoryName],
    ['masterSubSubCategoryId', selection.subSubCategoryId, 'masterSubSubCategoryName', selection.subSubCategoryName],
    ['productTypeId', selection.productTypeId, 'productTypeName', selection.productTypeName],
  ]
  const metadata = {}
  for (const [idKey, id, nameKey, name] of levels) {
    if (!id) continue
    // A child level is only valid when its parent level is selected.
    if (idKey === 'masterSubCategoryId' && !metadata.masterCategoryId) continue
    if (idKey === 'masterSubSubCategoryId' && !metadata.masterSubCategoryId) continue
    metadata[idKey] = id
    metadata[nameKey] = String(name ?? '').trim() || id
  }
  return metadata
}

function validateEntries(entries, selection) {
  if (!selection?.businessTypeId) throw serviceError('missing-selection', 'Select a Business Type.')
  if (!selection.businessCategoryId) throw serviceError('missing-selection', 'Select a Business Category.')
  const idEntry = entries.find(({ field }) => field.key === PRODUCT_ID_KEY)
  const nameEntry = entries.find(({ field }) => field.key === PRODUCT_NAME_KEY)
  if (!idEntry) throw serviceError('missing-product-id-field', 'The Product Form must include a "product_id" field.')
  if (!nameEntry) throw serviceError('missing-product-name-field', 'The Product Form must include a "product_name" field.')
  const productName = String(nameEntry.value ?? '').trim()
  if (!productName) throw serviceError('invalid-product-name', 'Enter a Product Name.')

  const imageEntries = entries.filter(({ field, value }) => field.type === 'image' && Array.isArray(value) && value.length > 0)
  for (const { field } of imageEntries) {
    if (!getImageFieldPolicy(field.key)) {
      throw serviceError('missing-image-policy', `Image field "${field.key}" has no storage path policy, so it cannot be saved yet.`)
    }
  }
  if (imageEntries.length && !selection.masterCategoryId) throw serviceError('missing-selection', 'Select a Master Category before uploading images.')
  return { productId: validateProductId(idEntry.value) }
}

function toFirebaseError(error) {
  if (error?.handled) return error
  if (error?.code === 'permission-denied' || error?.code === 'storage/unauthorized') {
    return serviceError('permission-denied', 'Permission denied. Your account is not allowed to save Master Products.')
  }
  if (error?.code === 'storage/network-request-failed') {
    return serviceError('storage-network-failed', 'Firebase Storage could not complete the image operation. Check your connection and Storage bucket CORS configuration for this app origin, then try again.')
  }
  if (error?.code === 'unavailable' || error?.code === 'storage/retry-limit-exceeded') {
    return serviceError('unavailable', 'Firebase is unreachable. Check your connection and try again. The form data is kept.')
  }
  return serviceError('failed', `The product could not be saved: ${error?.message || 'Unknown error.'}`)
}

// fields: visible form fields ({ id, key, type, ... }); values: submitted values keyed by field.id;
// selection: { businessTypeId, businessCategoryId, masterCategoryId, subCategoryId, subSubCategoryId }.
// editingProductId: set in edit mode; the save then updates that document and fails if it no longer exists.
export async function saveMasterProduct({ fields, values, selection, editingProductId, createOnly = false }) {
  const entries = fields.map((field) => ({ field, value: values[field.id] }))
  let productId
  let payload
  let created
  let stalePaths = []

  try {
    ({ productId } = validateEntries(entries, selection))
    if (editingProductId && productId !== editingProductId) {
      throw serviceError('product-id-changed', 'The Product ID cannot be changed while editing.')
    }
    const uploadedByKey = new Map()
    for (const { field, value } of entries) {
      if (field.type !== 'image' || !Array.isArray(value) || value.length === 0) continue
      uploadedByKey.set(field.key, await uploadImageField({ fieldKey: field.key, items: value, selection, productId, copying: createOnly }))
    }

    payload = {}
    for (const { field, value } of entries) {
      payload[field.key] = field.type === 'image'
        ? (uploadedByKey.get(field.key) ?? [])
        : normalizeValue(field, value)
    }
    const keptPaths = new Set([...uploadedByKey.values()].flat().map((item) => item.storagePath))

    const docRef = doc(db, MASTER_PRODUCTS_COLLECTION, productId)
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(docRef)
      const previous = snapshot.exists() ? snapshot.data() : null
      if (createOnly && previous) {
        throw serviceError('duplicate-product-id', `Product ID "${productId}" already exists. Choose a different ID.`)
      }
      if (editingProductId && !previous) {
        throw serviceError('not-found', 'This product no longer exists. Reload the list and try again.')
      }
      created = !previous
      stalePaths = previous ? storagePathsOf(previous).filter((path) => !keptPaths.has(path)) : []
      transaction.set(docRef, {
        ...payload,
        ...buildCategoryMetadata(selection),
        createdAt: previous?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })
  } catch (error) {
    throw toFirebaseError(error)
  }

  // Best-effort: the Firestore write already succeeded, so a failed cleanup only leaves unused files behind.
  await Promise.allSettled(stalePaths.map((path) => deleteObject(storageRef(storage, path))))
  return { productId, created }
}

export async function masterProductIdExists(rawProductId) {
  const productId = validateProductId(rawProductId)
  try {
    const snapshot = await getDoc(doc(db, MASTER_PRODUCTS_COLLECTION, productId))
    return snapshot.exists()
  } catch (error) {
    throw toFirebaseError(error)
  }
}

// Storage files are deleted first. If any file fails (other than already missing), the document is kept so the user can retry.
export async function deleteMasterProduct({ documentId }) {
  const docRef = doc(db, MASTER_PRODUCTS_COLLECTION, documentId)
  try {
    const snapshot = await getDoc(docRef)
    if (!snapshot.exists()) return
    const paths = storagePathsOf(snapshot.data())
    const results = await Promise.allSettled(paths.map((path) => deleteObject(storageRef(storage, path))))
    const failed = results.some((result) => result.status === 'rejected' && result.reason?.code !== 'storage/object-not-found')
    if (failed) {
      throw serviceError('storage-delete-failed', 'Product images could not be deleted from Storage, so the product was not deleted. Try again.')
    }
    await deleteDoc(docRef)
  } catch (error) {
    throw error?.handled ? error : toFirebaseError(error)
  }
}

function createdAtSeconds(product) {
  return typeof product.createdAt?.seconds === 'number' ? product.createdAt.seconds : 0
}

// Stored ID fields matched by equality in Firestore. Equality-only queries need no composite index.
const PRODUCT_FILTER_FIELDS = {
  businessTypeId: 'businessTypeId',
  businessCategoryId: 'businessCategoryId',
  productTypeId: 'productTypeId',
  masterCategoryId: 'masterCategoryId',
  masterSubCategoryId: 'masterSubCategoryId',
  masterSubSubCategoryId: 'masterSubSubCategoryId',
}

// Newest first. Documents written before category metadata existed are still returned.
// Empty filter values are ignored; set values are matched server-side against stored IDs.
export async function listMasterProducts(filters = {}) {
  try {
    const constraints = Object.entries(PRODUCT_FILTER_FIELDS)
      .filter(([key]) => filters[key])
      .map(([key, field]) => where(field, '==', filters[key]))
    const productsQuery = constraints.length
      ? query(collection(db, MASTER_PRODUCTS_COLLECTION), ...constraints)
      : collection(db, MASTER_PRODUCTS_COLLECTION)
    const snapshot = await getDocs(productsQuery)
    return snapshot.docs
      .map((docSnap) => ({ ...docSnap.data(), documentId: docSnap.id }))
      .sort((left, right) => createdAtSeconds(right) - createdAtSeconds(left))
  } catch (error) {
    throw toFirebaseError(error)
  }
}
