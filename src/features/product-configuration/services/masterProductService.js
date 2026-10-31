import { collection, deleteDoc, doc, getDoc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore'
import { deleteObject, getBlob, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { db, storage } from '../../../firebase'
import { buildImageStoragePath, getImageFieldPolicy } from './masterProductImagePolicy'

export const MASTER_PRODUCTS_COLLECTION = 'master_products'
const PRODUCT_ID_MAX_BYTES = 1500
const PRODUCT_ID_KEY = 'product_id'
const PRODUCT_NAME_KEY = 'product_name'

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

// Images already saved in Storage (edit mode) have no blob. Their bytes are read through the authenticated SDK first, then the saved URL as a fallback.
async function imageBlobOf(item, fieldKey) {
  if (item.blob instanceof Blob && item.blob.size > 0) return item.blob
  if (typeof item.storagePath === 'string' && item.storagePath) {
    try {
      const blob = await getBlob(storageRef(storage, item.storagePath))
      if (blob.size > 0) return blob
    } catch {
      // Fall back to the saved URL below.
    }
  }
  if (typeof item.url === 'string' && item.url) {
    const response = await fetch(item.url)
    if (!response.ok) {
      throw serviceError('image-load-failed', `A saved image in "${fieldKey}" could not be loaded. Try again.`)
    }
    const blob = await response.blob()
    if (blob.size > 0) return blob
  }
  throw serviceError('invalid-image', `An image in "${fieldKey}" is missing its data. Remove it and add it again.`)
}

async function uploadImageField({ fieldKey, items, selection, productId }) {
  const sorted = [...items].sort((left, right) => left.order - right.order)
  // All sources are read before any write, so an upload can never overwrite a file that a later item still needs.
  const plans = []
  for (const [index, item] of sorted.entries()) {
    const storagePath = buildImageStoragePath({ selection, productId, fieldKey, index, extension: extensionFor(item) })
    // An already saved image stays at its current Storage path even if the product's categories changed.
    const keep = !item.blob && Boolean(item.url) && typeof item.storagePath === 'string' && Boolean(item.storagePath)
    plans.push({ index, item, storagePath, keep, blob: keep ? null : await imageBlobOf(item, fieldKey) })
  }
  const uploaded = []
  for (const { index, item, storagePath, keep, blob } of plans) {
    if (keep) {
      uploaded.push({
        order: index,
        url: item.url,
        storagePath: item.storagePath,
        contentType: item.contentType,
        width: item.width,
        height: item.height,
        size: item.size,
      })
      continue
    }
    const objectRef = storageRef(storage, storagePath)
    await uploadBytes(objectRef, blob, { contentType: item.contentType })
    const url = await getDownloadURL(objectRef)
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
  if (error?.code === 'unavailable' || error?.code === 'storage/retry-limit-exceeded' || error?.code === 'storage/network-request-failed') {
    return serviceError('unavailable', 'Firebase is unreachable. Check your connection and try again. The form data is kept.')
  }
  return serviceError('failed', `The product could not be saved: ${error?.message || 'Unknown error.'}`)
}

// fields: visible form fields ({ id, key, type, ... }); values: submitted values keyed by field.id;
// selection: { businessTypeId, businessCategoryId, masterCategoryId, subCategoryId, subSubCategoryId }.
// editingProductId: set in edit mode; the save then updates that document and fails if it no longer exists.
export async function saveMasterProduct({ fields, values, selection, editingProductId }) {
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
      uploadedByKey.set(field.key, await uploadImageField({ fieldKey: field.key, items: value, selection, productId }))
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

// Newest first. Documents written before category metadata existed are still returned.
export async function listMasterProducts() {
  try {
    const snapshot = await getDocs(collection(db, MASTER_PRODUCTS_COLLECTION))
    return snapshot.docs
      .map((docSnap) => ({ ...docSnap.data(), documentId: docSnap.id }))
      .sort((left, right) => createdAtSeconds(right) - createdAtSeconds(left))
  } catch (error) {
    throw toFirebaseError(error)
  }
}
