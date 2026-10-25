import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '../../../firebase'

const productTypesRef = collection(db, 'product_type_configs')
const KEY_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/

function serviceError(code, message) {
  const error = new Error(message)
  error.code = `product-type-config/${code}`
  return error
}

function toServiceError(error, fallback) {
  if (error?.code?.startsWith('product-type-config/')) return error
  if (error?.code === 'permission-denied') {
    return serviceError('permission-denied', 'Permission denied. Your account is not allowed to manage Product Types in Firestore.')
  }
  if (error?.code === 'unavailable') {
    return serviceError('unavailable', 'Firestore is unreachable. Check your connection and try again.')
  }
  return serviceError('failed', error?.message || fallback)
}

async function assertSuperAdmin() {
  const user = auth.currentUser
  if (!user) throw serviceError('unauthenticated', 'Sign in as a Super Admin to manage Product Types.')
  const snapshot = await getDoc(doc(db, 'users', user.uid))
  if (!snapshot.exists() || snapshot.data().platformRoles?.dukanSetu !== 'superAdmin') {
    throw serviceError('forbidden', 'Only Super Admin users can manage Product Types.')
  }
}

export function generateProductTypeKey(name) {
  if (typeof name !== 'string') return ''
  return name.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
    .replace(/_+$/g, '')
}

function normalizeProductType(snapshot) {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    name: data.name ?? '',
    key: data.key ?? '',
    description: data.description ?? '',
    status: data.status === 'inactive' ? 'inactive' : 'active',
    sortOrder: Number.isSafeInteger(data.sortOrder) ? data.sortOrder : 0,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  }
}

function validateProductType(values) {
  const name = typeof values?.name === 'string' ? values.name.trim() : ''
  const key = typeof values?.key === 'string' ? values.key.trim().toLowerCase() : ''
  const description = typeof values?.description === 'string' ? values.description.trim() : ''
  const sortValue = typeof values?.sortOrder === 'string' ? values.sortOrder.trim() : values?.sortOrder
  const sortOrder = sortValue === '' || sortValue === null || sortValue === undefined ? NaN : Number(sortValue)

  if (!name || name.length > 80) {
    throw serviceError('invalid-name', 'Enter a Product Type Name between 1 and 80 characters.')
  }
  if (!KEY_PATTERN.test(key) || key.length > 50) {
    throw serviceError('invalid-key', 'Product Type Key must use lowercase letters, numbers, and single underscores.')
  }
  if (description.length > 300) {
    throw serviceError('invalid-description', 'Description can be at most 300 characters.')
  }
  if (values?.status !== 'active' && values?.status !== 'inactive') {
    throw serviceError('invalid-status', 'Status must be Active or Inactive.')
  }
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) {
    throw serviceError('invalid-sort-order', 'Sort Order must be a non-negative whole number.')
  }
  return { name, key, description, status: values.status, sortOrder }
}

async function assertKeyAvailable(key, exceptId = '') {
  const matches = await getDocs(query(productTypesRef, where('key', '==', key)))
  if (matches.docs.some((snapshot) => snapshot.id !== exceptId)) {
    throw serviceError('duplicate-key', `The Product Type Key "${key}" is already in use.`)
  }
}

export async function listProductTypeConfigs() {
  try {
    const snapshot = await getDocs(productTypesRef)
    return snapshot.docs.map(normalizeProductType).sort((left, right) => (
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
    ))
  } catch (error) {
    throw toServiceError(error, 'Product Types could not be loaded.')
  }
}

export async function createProductTypeConfig(values) {
  try {
    await assertSuperAdmin()
    const productType = validateProductType(values)
    await assertKeyAvailable(productType.key)
    const productTypeRef = doc(productTypesRef)
    await runTransaction(db, async (transaction) => {
      const timestamp = serverTimestamp()
      transaction.set(productTypeRef, {
        ...productType,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    })
    return productTypeRef.id
  } catch (error) {
    throw toServiceError(error, 'The Product Type could not be created.')
  }
}

export async function updateProductTypeConfig(id, values) {
  try {
    await assertSuperAdmin()
    const productType = validateProductType(values)
    await assertKeyAvailable(productType.key, id)
    const productTypeRef = doc(productTypesRef, id)
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(productTypeRef)
      if (!existing.exists()) {
        throw serviceError('not-found', 'This Product Type no longer exists. Refresh the list.')
      }
      transaction.update(productTypeRef, {
        ...productType,
        updatedAt: serverTimestamp(),
      })
    })
  } catch (error) {
    throw toServiceError(error, 'The Product Type could not be updated.')
  }
}

export async function setProductTypeConfigStatus(id, status) {
  try {
    await assertSuperAdmin()
    if (status !== 'active' && status !== 'inactive') {
      throw serviceError('invalid-status', 'Status must be Active or Inactive.')
    }
    await updateDoc(doc(productTypesRef, id), { status, updatedAt: serverTimestamp() })
  } catch (error) {
    throw toServiceError(error, 'The Product Type status could not be updated.')
  }
}
