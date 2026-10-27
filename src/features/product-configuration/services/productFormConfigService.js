import {
  addDoc,
  collection,
  deleteDoc,
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
import { listFieldGroups } from './fieldGroupService'
import { listGlobalFields } from './globalFieldService'
import { listProductTypeConfigs } from './productTypeConfigService'

export const FORM_CONFIGS_COLLECTION = 'product_form_configs'
export const FORM_CONFIG_LIMITS = { name: 100, label: 100, helpText: 300 }

const formConfigsRef = collection(db, FORM_CONFIGS_COLLECTION)

function serviceError(code, message) {
  const error = new Error(message)
  error.code = `form-config/${code}`
  return error
}

function toServiceError(error, fallback) {
  if (error?.code?.startsWith('form-config/')) return error
  if (error?.code === 'permission-denied') {
    return serviceError('permission-denied', 'Permission denied. Your account is not allowed to access Form Configurations in Firestore.')
  }
  if (error?.code === 'unavailable') {
    return serviceError('unavailable', 'Firestore is unreachable. Check your connection and try again.')
  }
  return serviceError('failed', error?.message || fallback)
}

async function assertSuperAdmin() {
  const user = auth.currentUser
  if (!user) throw serviceError('unauthenticated', 'Sign in as a Super Admin to manage Form Configurations.')
  const snapshot = await getDoc(doc(db, 'users', user.uid))
  if (!snapshot.exists() || snapshot.data().platformRoles?.dukanSetu !== 'superAdmin') {
    throw serviceError('forbidden', 'Only Super Admin users can manage Form Configurations.')
  }
}

function normalizeFormConfig(snapshot) {
  const data = snapshot.data()
  const groups = (Array.isArray(data.groups) ? data.groups : [])
    .map((group) => ({
      groupId: typeof group?.groupId === 'string' ? group.groupId : '',
      groupKey: group?.groupKey ?? '',
      sortOrder: Number.isFinite(group?.sortOrder) ? group.sortOrder : 0,
      fields: (Array.isArray(group?.fields) ? group.fields : [])
        .map((field) => ({
          fieldId: typeof field?.fieldId === 'string' ? field.fieldId : '',
          fieldKey: field?.fieldKey ?? '',
          required: field?.required === true,
          visibility: field?.visibility === 'hidden' ? 'hidden' : 'visible',
          sortOrder: Number.isFinite(field?.sortOrder) ? field.sortOrder : 0,
          labelOverride: field?.labelOverride ?? '',
          helpTextOverride: field?.helpTextOverride ?? '',
        }))
        .sort((left, right) => left.sortOrder - right.sortOrder),
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder)
  return {
    id: snapshot.id,
    name: data.name ?? '',
    productTypeId: data.productTypeId ?? '',
    productTypeKey: data.productTypeKey ?? '',
    status: data.status === 'inactive' ? 'inactive' : 'active',
    groups,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  }
}

export async function listFormConfigs() {
  try {
    const snapshot = await getDocs(formConfigsRef)
    return snapshot.docs.map(normalizeFormConfig).sort((left, right) => left.name.localeCompare(right.name))
  } catch (error) {
    throw toServiceError(error, 'Form Configurations could not be loaded.')
  }
}

// Loads the live Product Types, Field Groups and Global Fields the editor works against.
export async function loadFormBuilderSources() {
  try {
    const [productTypes, groups, fields] = await Promise.all([
      listProductTypeConfigs(),
      listFieldGroups(),
      listGlobalFields(),
    ])
    return { productTypes, groups, fields }
  } catch (error) {
    throw toServiceError(error, 'Product Types, Field Groups or Global Fields could not be loaded.')
  }
}

function sanitizeText(value, max, label) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > max) throw serviceError('invalid-override', `${label} can be at most ${max} characters.`)
  return text
}

// Validates the draft against the current Firebase records and returns the document payload.
function buildPayload(values, sources, existingId) {
  const name = typeof values?.name === 'string' ? values.name.trim() : ''
  if (!name || name.length > FORM_CONFIG_LIMITS.name) {
    throw serviceError('invalid-name', `Enter a Form Configuration Name between 1 and ${FORM_CONFIG_LIMITS.name} characters.`)
  }
  if (values?.status !== 'active' && values?.status !== 'inactive') {
    throw serviceError('invalid-status', 'Status must be Active or Inactive.')
  }

  const productType = sources.productTypes.find((item) => item.id === values?.productTypeId)
  if (!values?.productTypeId || !productType) {
    throw serviceError('invalid-product-type', 'Select a Product Type that exists in Product Type Configuration.')
  }
  const productTypeChanged = !existingId || sources.existing?.productTypeId !== productType.id
  if (productType.status !== 'active' && productTypeChanged) {
    throw serviceError('inactive-product-type', `Product Type "${productType.name}" is inactive. Select an active Product Type.`)
  }

  const groupsInput = Array.isArray(values.groups) ? values.groups : []
  if (!groupsInput.length) throw serviceError('no-groups', 'Add at least one Field Group to the form.')

  const groupsById = new Map(sources.groups.map((group) => [group.id, group]))
  const fieldsById = new Map(sources.fields.map((field) => [field.id, field]))
  const seenGroups = new Set()
  const seenFields = new Map()
  const problems = []

  const groups = groupsInput.map((group, groupIndex) => {
    const record = groupsById.get(group.groupId)
    if (!record) {
      problems.push(`Field Group ${group.groupKey ? `"${group.groupKey}" ` : ''}(${group.groupId || 'no ID'}) no longer exists.`)
    } else if (record.status !== 'active') {
      problems.push(`Field Group "${record.name}" is inactive.`)
    }
    if (seenGroups.has(group.groupId)) problems.push(`Field Group "${record?.name ?? group.groupId}" is added more than once.`)
    seenGroups.add(group.groupId)

    const fieldsInput = Array.isArray(group.fields) ? group.fields : []
    if (!fieldsInput.length) problems.push(`Field Group "${record?.name ?? group.groupId}" has no fields selected.`)

    const fields = fieldsInput.map((field, fieldIndex) => {
      const global = fieldsById.get(field.fieldId)
      if (!global) {
        problems.push(`Field ${field.fieldKey ? `"${field.fieldKey}" ` : ''}(${field.fieldId || 'no ID'}) no longer exists.`)
      } else if (global.status !== 'active') {
        problems.push(`Field "${global.name}" is inactive.`)
      }
      if (seenFields.has(field.fieldId)) {
        problems.push(`Field "${global?.name ?? field.fieldId}" is selected more than once (also in ${seenFields.get(field.fieldId)}).`)
      }
      seenFields.set(field.fieldId, record?.name ?? group.groupId)

      const result = {
        fieldId: field.fieldId,
        fieldKey: global?.key ?? field.fieldKey ?? '',
        required: field.required === true,
        visibility: field.visibility === 'hidden' ? 'hidden' : 'visible',
        sortOrder: fieldIndex + 1,
      }
      const labelOverride = sanitizeText(field.labelOverride, FORM_CONFIG_LIMITS.label, 'Label override')
      const helpTextOverride = sanitizeText(field.helpTextOverride, FORM_CONFIG_LIMITS.helpText, 'Help text override')
      if (labelOverride) result.labelOverride = labelOverride
      if (helpTextOverride) result.helpTextOverride = helpTextOverride
      return result
    })

    return {
      groupId: group.groupId,
      groupKey: record?.key ?? group.groupKey ?? '',
      sortOrder: groupIndex + 1,
      fields,
    }
  })

  if (problems.length) {
    throw serviceError('invalid-references', `Fix these issues before saving: ${problems.join(' ')}`)
  }

  return { name, productTypeId: productType.id, productTypeKey: productType.key, status: values.status, groups }
}

async function assertProductTypeAvailable(productTypeId, exceptId) {
  const matches = await getDocs(query(formConfigsRef, where('productTypeId', '==', productTypeId)))
  const clash = matches.docs.find((snapshot) => snapshot.id !== exceptId)
  if (clash) {
    throw serviceError('duplicate-product-type', `A Form Configuration ("${clash.data().name}") already exists for this Product Type. Edit it instead.`)
  }
}

export async function saveFormConfig(id, values) {
  try {
    await assertSuperAdmin()
    const sources = await loadFormBuilderSources()
    let existingSnapshot = null
    if (id) {
      existingSnapshot = await getDoc(doc(formConfigsRef, id))
      if (!existingSnapshot.exists()) {
        throw serviceError('not-found', 'This Form Configuration no longer exists. Refresh the list.')
      }
      sources.existing = existingSnapshot.data()
    }
    const payload = buildPayload(values, sources, id)
    await assertProductTypeAvailable(payload.productTypeId, id)

    if (id) {
      const configRef = doc(formConfigsRef, id)
      await runTransaction(db, async (transaction) => {
        const current = await transaction.get(configRef)
        if (!current.exists()) throw serviceError('not-found', 'This Form Configuration no longer exists. Refresh the list.')
        transaction.update(configRef, { ...payload, updatedAt: serverTimestamp() })
      })
      return id
    }
    const timestamp = serverTimestamp()
    const created = await addDoc(formConfigsRef, { ...payload, createdAt: timestamp, updatedAt: timestamp })
    return created.id
  } catch (error) {
    throw toServiceError(error, 'The Form Configuration could not be saved.')
  }
}

export async function setFormConfigStatus(id, status) {
  try {
    await assertSuperAdmin()
    if (status !== 'active' && status !== 'inactive') {
      throw serviceError('invalid-status', 'Status must be Active or Inactive.')
    }
    await updateDoc(doc(formConfigsRef, id), { status, updatedAt: serverTimestamp() })
  } catch (error) {
    throw toServiceError(error, 'The Form Configuration status could not be updated.')
  }
}

export async function deleteFormConfig(id) {
  try {
    await assertSuperAdmin()
    await deleteDoc(doc(formConfigsRef, id))
  } catch (error) {
    throw toServiceError(error, 'The Form Configuration could not be deleted.')
  }
}

// Read-only: loads the active configuration and the live groups/fields it references.
export async function loadActiveFormForProductType(productTypeId) {
  try {
    const snapshot = await getDocs(query(formConfigsRef, where('productTypeId', '==', productTypeId), where('status', '==', 'active')))
    const configs = snapshot.docs.map(normalizeFormConfig)
      .sort((left, right) => (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0))
    if (!configs.length) return null
    const [groups, fields] = await Promise.all([listFieldGroups(), listGlobalFields()])
    return { config: configs[0], groups, fields }
  } catch (error) {
    throw toServiceError(error, 'The Form Configuration could not be loaded.')
  }
}
