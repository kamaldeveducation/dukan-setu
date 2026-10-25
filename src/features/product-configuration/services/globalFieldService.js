import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { auth, db } from '../../../firebase'
import { registerFieldGroupReferenceChecker } from './fieldGroupService'

const fieldsRef = collection(db, 'global_fields')
const fieldTypes = new Set([
  'text', 'textarea', 'number', 'currency', 'image', 'url',
  'email', 'phone', 'date', 'boolean', 'dropdown', 'multi_select',
])

function serviceError(code, message) {
  const error = new Error(message)
  error.code = `global-field/${code}`
  return error
}

async function assertSuperAdmin() {
  const user = auth.currentUser
  if (!user) throw serviceError('unauthenticated', 'Sign in as a Super Admin to manage Global Fields.')
  const snapshot = await getDoc(doc(db, 'users', user.uid))
  if (!snapshot.exists() || snapshot.data().platformRoles?.dukanSetu !== 'superAdmin') {
    throw serviceError('forbidden', 'Only Super Admin users can manage Global Fields.')
  }
}

function toServiceError(error, fallback) {
  if (error?.code?.startsWith('global-field/')) return error
  if (error?.code === 'permission-denied') {
    return serviceError('permission-denied', 'Permission denied. Your account is not allowed to access Global Fields in Firestore.')
  }
  if (error?.code === 'unavailable') {
    return serviceError('unavailable', 'Firestore is unreachable. Check your connection and try again.')
  }
  return serviceError('failed', error?.message || fallback)
}

export function normalizeGlobalFieldKey(value) {
  if (typeof value !== 'string') return ''
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
    .replace(/_+$/g, '')
}

function normalizeGlobalField(snapshot) {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    name: data.name ?? '',
    key: data.key ?? '',
    label: data.label ?? '',
    description: data.description ?? '',
    fieldType: data.fieldType ?? 'text',
    groupId: data.groupId ?? '',
    groupKey: data.groupKey ?? '',
    required: data.required === true,
    defaultVisibility: data.defaultVisibility === 'hidden' ? 'hidden' : 'visible',
    status: data.status === 'inactive' ? 'inactive' : 'active',
    sortOrder: Number.isFinite(data.sortOrder) ? data.sortOrder : 0,
    validation: data.validation && typeof data.validation === 'object' ? data.validation : {},
    options: Array.isArray(data.options) ? data.options : [],
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  }
}

function optionalNumber(value, label, { integer = false } = {}) {
  if (value === '' || value === null || value === undefined) return undefined
  const number = Number(value)
  if (!Number.isFinite(number) || (integer && !Number.isSafeInteger(number))) {
    throw serviceError('invalid-validation', `${label} must be a valid ${integer ? 'whole number' : 'number'}.`)
  }
  return number
}

function validateOptions(options, fieldType) {
  if (fieldType !== 'dropdown' && fieldType !== 'multi_select') return []
  if (!Array.isArray(options)) throw serviceError('invalid-options', 'Dropdown options must be a list.')
  const seen = new Set()
  return options.map((option, index) => {
    const label = typeof option?.label === 'string' ? option.label.trim() : ''
    const value = normalizeGlobalFieldKey(option?.value || label)
    if (!label || !value) throw serviceError('invalid-options', `Option ${index + 1} needs a label and a valid value.`)
    if (seen.has(value)) throw serviceError('duplicate-option', `The option value "${value}" is repeated.`)
    seen.add(value)
    return { label, value, active: option.active !== false, sortOrder: index + 1 }
  })
}

function validateField(values) {
  const name = typeof values?.name === 'string' ? values.name.trim() : ''
  const key = normalizeGlobalFieldKey(values?.key)
  const label = typeof values?.label === 'string' ? values.label.trim() : ''
  const description = typeof values?.description === 'string' ? values.description.trim() : ''
  const fieldType = values?.fieldType
  const groupId = typeof values?.groupId === 'string' ? values.groupId.trim() : ''
  const required = values?.required
  const defaultVisibility = values?.defaultVisibility
  const status = values?.status
  const sortOrder = optionalNumber(values?.sortOrder, 'Sort Order', { integer: true })

  if (!name) throw serviceError('invalid-name', 'Field Name is required.')
  if (!key || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(key)) {
    throw serviceError('invalid-key', 'Field Key is required. Use lowercase letters, numbers, and underscores.')
  }
  if (!label) throw serviceError('invalid-label', 'Field Label is required.')
  if (!fieldTypes.has(fieldType)) throw serviceError('invalid-type', 'Select a supported Field Type.')
  if (!groupId) throw serviceError('invalid-group', 'Select an active Field Group.')
  if (typeof required !== 'boolean') throw serviceError('invalid-required', 'Choose whether the field is required.')
  if (defaultVisibility !== 'visible' && defaultVisibility !== 'hidden') {
    throw serviceError('invalid-visibility', 'Choose a default visibility.')
  }
  if (status !== 'active' && status !== 'inactive') throw serviceError('invalid-status', 'Choose a field status.')
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) {
    throw serviceError('invalid-sort-order', 'Sort Order must be a non-negative whole number.')
  }

  const validation = {}
  if (fieldType === 'text' || fieldType === 'textarea') {
    const minLength = optionalNumber(values.validation?.minLength, 'Minimum length', { integer: true })
    const maxLength = optionalNumber(values.validation?.maxLength, 'Maximum length', { integer: true })
    if (minLength !== undefined && minLength < 0) throw serviceError('invalid-validation', 'Minimum length cannot be negative.')
    if (maxLength !== undefined && maxLength < 0) throw serviceError('invalid-validation', 'Maximum length cannot be negative.')
    if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
      throw serviceError('invalid-validation', 'Minimum length cannot exceed maximum length.')
    }
    if (minLength !== undefined) validation.minLength = minLength
    if (maxLength !== undefined) validation.maxLength = maxLength
  } else if (fieldType === 'number' || fieldType === 'currency') {
    const minValue = optionalNumber(values.validation?.minValue, 'Minimum value')
    const maxValue = optionalNumber(values.validation?.maxValue, 'Maximum value')
    if (minValue !== undefined && maxValue !== undefined && minValue > maxValue) {
      throw serviceError('invalid-validation', 'Minimum value cannot exceed maximum value.')
    }
    if (minValue !== undefined) validation.minValue = minValue
    if (maxValue !== undefined) validation.maxValue = maxValue
  } else if (fieldType === 'dropdown' || fieldType === 'multi_select') {
    const minSelections = optionalNumber(values.validation?.minSelections, 'Minimum selections', { integer: true })
    const maxSelections = optionalNumber(values.validation?.maxSelections, 'Maximum selections', { integer: true })
    if (minSelections !== undefined && minSelections < 0) throw serviceError('invalid-validation', 'Minimum selections cannot be negative.')
    if (maxSelections !== undefined && maxSelections < 1) throw serviceError('invalid-validation', 'Maximum selections must be at least 1.')
    if (minSelections !== undefined && maxSelections !== undefined && minSelections > maxSelections) {
      throw serviceError('invalid-validation', 'Minimum selections cannot exceed maximum selections.')
    }
    if (fieldType === 'dropdown' && minSelections !== undefined && minSelections > 1) {
      throw serviceError('invalid-validation', 'A Dropdown can require at most one selection.')
    }
    if (fieldType === 'dropdown' && maxSelections !== undefined && maxSelections > 1) {
      throw serviceError('invalid-validation', 'A Dropdown can have at most one selection.')
    }
    if (minSelections !== undefined) validation.minSelections = minSelections
    if (maxSelections !== undefined) validation.maxSelections = maxSelections
  }

  const options = validateOptions(values.options, fieldType)
  if ((fieldType === 'dropdown' || fieldType === 'multi_select') && options.length === 0) {
    throw serviceError('invalid-options', 'Add at least one option for Dropdown and Multi-select fields.')
  }

  return {
    name,
    key,
    label,
    description,
    fieldType,
    groupId,
    required,
    defaultVisibility,
    status,
    sortOrder,
    validation,
    options,
  }
}

async function assertGroupAvailable(groupId) {
  const snapshot = await getDoc(doc(db, 'global_field_groups', groupId))
  if (!snapshot.exists() || snapshot.data().status !== 'active') {
    throw serviceError('invalid-group', 'The selected Field Group no longer exists or is inactive. Choose an active group.')
  }
  return snapshot.data().key
}

async function assertUniqueKey(key, exceptId = '') {
  const matches = await getDocs(query(fieldsRef, where('key', '==', key)))
  if (matches.docs.some((snapshot) => snapshot.id !== exceptId)) {
    throw serviceError('duplicate-key', `The Field Key "${key}" is already in use. Choose a different key.`)
  }
}

export async function listGlobalFields() {
  try {
    const snapshot = await getDocs(fieldsRef)
    return snapshot.docs.map(normalizeGlobalField).sort((left, right) => (
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
    ))
  } catch (error) {
    throw toServiceError(error, 'Global Fields could not be loaded.')
  }
}

export async function createGlobalField(values) {
  try {
    await assertSuperAdmin()
    const fields = validateField(values)
    const groupKey = await assertGroupAvailable(fields.groupId)
    const fieldRef = doc(fieldsRef)
    await assertUniqueKey(fields.key)
    await runTransaction(db, async (transaction) => {
      const timestamp = serverTimestamp()
      transaction.set(fieldRef, { ...fields, groupKey, createdAt: timestamp, updatedAt: timestamp })
    })
    return fieldRef.id
  } catch (error) {
    throw toServiceError(error, 'The Global Field could not be created.')
  }
}

export async function updateGlobalField(id, values) {
  try {
    await assertSuperAdmin()
    const fields = validateField(values)
    const groupKey = await assertGroupAvailable(fields.groupId)
    const fieldRef = doc(fieldsRef, id)
    await assertUniqueKey(fields.key, id)
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(fieldRef)
      if (!existing.exists()) throw serviceError('not-found', 'This Global Field no longer exists. Refresh the list.')
      transaction.update(fieldRef, { ...fields, groupKey, updatedAt: serverTimestamp() })
    })
  } catch (error) {
    throw toServiceError(error, 'The Global Field could not be updated.')
  }
}

export async function setGlobalFieldStatus(id, status) {
  try {
    await assertSuperAdmin()
    if (status !== 'active' && status !== 'inactive') {
      throw serviceError('invalid-status', 'Choose a valid field status.')
    }
    await runTransaction(db, async (transaction) => {
      const fieldRef = doc(fieldsRef, id)
      const existing = await transaction.get(fieldRef)
      if (!existing.exists()) throw serviceError('not-found', 'This Global Field no longer exists. Refresh the list.')
      transaction.update(fieldRef, { status, updatedAt: serverTimestamp() })
    })
  } catch (error) {
    throw toServiceError(error, 'The Global Field status could not be updated.')
  }
}

export async function deleteGlobalField(id) {
  try {
    await assertSuperAdmin()
    const fieldRef = doc(fieldsRef, id)
    const snapshot = await getDoc(fieldRef)
    if (!snapshot.exists()) throw serviceError('not-found', 'This Global Field no longer exists. Refresh the list.')
    await deleteDoc(fieldRef)
  } catch (error) {
    throw toServiceError(error, 'The Global Field could not be deleted.')
  }
}

registerFieldGroupReferenceChecker(async (group) => {
  const snapshot = await getDocs(query(fieldsRef, where('groupId', '==', group.id)))
  return snapshot.empty ? [] : [`${snapshot.size} Global Field${snapshot.size === 1 ? '' : 's'}`]
})
