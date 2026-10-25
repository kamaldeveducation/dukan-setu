import {
  addDoc,
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
import { listBusinessCategories } from '../../../services/businessCategoryService'
import { listBusinessTypes } from '../../../services/businessTypeService'
import { listProductTypeConfigs } from './productTypeConfigService'

const mappingsRef = collection(db, 'business_category_mappings')

function serviceError(code, message) {
  const error = new Error(message)
  error.code = `business-category-mapping/${code}`
  return error
}

function toServiceError(error, fallback) {
  if (error?.code?.startsWith('business-category-mapping/')) return error
  if (error?.code === 'permission-denied') {
    return serviceError('permission-denied', 'Permission denied. Your account is not allowed to manage Business Category Mappings in Firestore.')
  }
  if (error?.code === 'unavailable') {
    return serviceError('unavailable', 'Firestore is unreachable. Check your connection and try again.')
  }
  return serviceError('failed', error?.message || fallback)
}

async function assertSuperAdmin() {
  const user = auth.currentUser
  if (!user) throw serviceError('unauthenticated', 'Sign in as a Super Admin to manage Business Category Mappings.')
  const snapshot = await getDoc(doc(db, 'users', user.uid))
  if (!snapshot.exists() || snapshot.data().platformRoles?.dukanSetu !== 'superAdmin') {
    throw serviceError('forbidden', 'Only Super Admin users can manage Business Category Mappings.')
  }
}

function normalizeMapping(snapshot) {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    businessTypeId: data.businessTypeId ?? '',
    businessCategoryId: data.businessCategoryId ?? '',
    productTypeIds: Array.isArray(data.productTypeIds)
      ? [...new Set(data.productTypeIds.filter((id) => typeof id === 'string' && id))]
      : [],
    status: data.status === 'inactive' ? 'inactive' : 'active',
    sortOrder: Number.isSafeInteger(data.sortOrder) ? data.sortOrder : 0,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  }
}

function validateValues(values) {
  const businessTypeId = typeof values?.businessTypeId === 'string' ? values.businessTypeId.trim() : ''
  const businessCategoryId = typeof values?.businessCategoryId === 'string' ? values.businessCategoryId.trim() : ''
  const rawSortOrder = typeof values?.sortOrder === 'string' ? values.sortOrder.trim() : values?.sortOrder
  const sortOrder = rawSortOrder === '' || rawSortOrder === null || rawSortOrder === undefined ? NaN : Number(rawSortOrder)
  const productTypeIds = Array.isArray(values?.productTypeIds)
    ? [...new Set(values.productTypeIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))]
    : null

  if (!businessTypeId) throw serviceError('invalid-business-type', 'Select a Business Type.')
  if (!businessCategoryId) throw serviceError('invalid-business-category', 'Select a Business Category.')
  if (!productTypeIds) throw serviceError('invalid-product-types', 'Product Type selections are invalid.')
  if (values?.status !== 'active' && values?.status !== 'inactive') {
    throw serviceError('invalid-status', 'Status must be Active or Inactive.')
  }
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) {
    throw serviceError('invalid-sort-order', 'Sort Order must be a non-negative whole number.')
  }

  return { businessTypeId, businessCategoryId, productTypeIds, status: values.status, sortOrder }
}

async function assertReferencesActive({ businessTypeId, businessCategoryId, productTypeIds }, existingMapping = null) {
  const businessTypeSnapshot = await getDoc(doc(db, 'business_types', businessTypeId))
  const existingBusinessType = existingMapping?.businessTypeId === businessTypeId
  if (!businessTypeSnapshot.exists() || (businessTypeSnapshot.data().active !== true && !existingBusinessType)) {
    throw serviceError('invalid-business-type', 'The selected Business Type is missing or inactive. Refresh and select an active type.')
  }

  const categorySnapshot = await getDoc(doc(db, 'business_types', businessTypeId, 'business_categories', businessCategoryId))
  const existingBusinessCategory = existingBusinessType && existingMapping?.businessCategoryId === businessCategoryId
  if (!categorySnapshot.exists() || (categorySnapshot.data().active !== true && !existingBusinessCategory)) {
    throw serviceError('invalid-business-category', 'The selected Business Category is missing or inactive. Refresh and select an active category.')
  }

  const selectedTypes = await Promise.all(productTypeIds.map((id) => getDoc(doc(db, 'product_type_configs', id))))
  const existingProductTypeIds = new Set(existingMapping?.productTypeIds ?? [])
  if (selectedTypes.some((snapshot, index) => (
    !snapshot.exists()
      || (snapshot.data().status !== 'active' && !existingProductTypeIds.has(productTypeIds[index]))
  ))) {
    throw serviceError('invalid-product-types', 'One or more selected Product Types are missing or inactive. Refresh the list and try again.')
  }
}

async function assertNoDuplicatePair(businessTypeId, businessCategoryId, exceptId = '') {
  const matches = await getDocs(query(mappingsRef, where('businessTypeId', '==', businessTypeId)))
  if (matches.docs.some((snapshot) => (
    snapshot.id !== exceptId && snapshot.data().businessCategoryId === businessCategoryId
  ))) {
    throw serviceError('duplicate-mapping', 'A mapping already exists for this Business Type and Business Category.')
  }
}

export async function listBusinessCategoryMappings() {
  try {
    const snapshot = await getDocs(mappingsRef)
    return snapshot.docs.map(normalizeMapping).sort((left, right) => (
      left.sortOrder - right.sortOrder
        || left.businessTypeId.localeCompare(right.businessTypeId)
        || left.businessCategoryId.localeCompare(right.businessCategoryId)
    ))
  } catch (error) {
    throw toServiceError(error, 'Business Category Mappings could not be loaded.')
  }
}

export async function loadBusinessCategoryMappingSources() {
  try {
    const [businessTypes, productTypes] = await Promise.all([
      listBusinessTypes(),
      listProductTypeConfigs(),
    ])
    const categoryGroups = await Promise.all(businessTypes.map(async (businessType) => ({
      businessTypeId: businessType.id,
      categories: await listBusinessCategories(businessType.id),
    })))
    return {
      businessTypes,
      categories: categoryGroups.flatMap(({ businessTypeId, categories }) => (
        categories.map((category) => ({ ...category, businessTypeId }))
      )),
      productTypes,
    }
  } catch (error) {
    throw toServiceError(error, 'Business Type, Category, or Product Type options could not be loaded.')
  }
}

export async function createBusinessCategoryMapping(values) {
  try {
    await assertSuperAdmin()
    const mapping = validateValues(values)
    await assertReferencesActive(mapping)
    await assertNoDuplicatePair(mapping.businessTypeId, mapping.businessCategoryId)
    const timestamp = serverTimestamp()
    const mappingRef = await addDoc(mappingsRef, {
      ...mapping,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    return mappingRef.id
  } catch (error) {
    throw toServiceError(error, 'The Business Category Mapping could not be created.')
  }
}

export async function updateBusinessCategoryMapping(id, values) {
  try {
    await assertSuperAdmin()
    const mapping = validateValues(values)
    const mappingRef = doc(mappingsRef, id)
    const existingSnapshot = await getDoc(mappingRef)
    if (!existingSnapshot.exists()) {
      throw serviceError('not-found', 'This mapping no longer exists. Refresh the list and try again.')
    }
    const existingMapping = normalizeMapping(existingSnapshot)
    await assertReferencesActive(mapping, existingMapping)
    await assertNoDuplicatePair(mapping.businessTypeId, mapping.businessCategoryId, id)
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(mappingRef)
      if (!existing.exists()) {
        throw serviceError('not-found', 'This mapping no longer exists. Refresh the list and try again.')
      }
      transaction.update(mappingRef, { ...mapping, updatedAt: serverTimestamp() })
    })
  } catch (error) {
    throw toServiceError(error, 'The Business Category Mapping could not be updated.')
  }
}

export async function setBusinessCategoryMappingStatus(id, status) {
  try {
    await assertSuperAdmin()
    if (status !== 'active' && status !== 'inactive') {
      throw serviceError('invalid-status', 'Status must be Active or Inactive.')
    }
    await updateDoc(doc(mappingsRef, id), { status, updatedAt: serverTimestamp() })
  } catch (error) {
    throw toServiceError(error, 'The mapping status could not be updated.')
  }
}
