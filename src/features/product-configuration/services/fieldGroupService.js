import {
	collection,
	doc,
	getDoc,
	getDocs,
	runTransaction,
	serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../../../firebase'
import {
	FIELD_GROUP_KEYS_COLLECTION,
	FIELD_GROUP_KEY_PATTERN,
	FIELD_GROUP_LIMITS,
	FIELD_GROUP_STATUS,
	FIELD_GROUPS_COLLECTION,
} from '../types/fieldGroup.types'

const groupsRef = collection(db, FIELD_GROUPS_COLLECTION)
const keysRef = collection(db, FIELD_GROUP_KEYS_COLLECTION)

// Future modules (e.g. Global Fields) register a checker here so referenced Groups cannot be deleted.
// A checker receives the group and resolves to a list of human-readable usages (empty when unused).
const referenceCheckers = []

export function registerFieldGroupReferenceChecker(checker) {
	referenceCheckers.push(checker)
	return () => {
		const index = referenceCheckers.indexOf(checker)
		if (index >= 0) referenceCheckers.splice(index, 1)
	}
}

function serviceError(code, message) {
	const error = new Error(message)
	error.code = `field-group/${code}`
	return error
}

// Firestore security rules remain the real enforcement; this gives a clear message first.
async function assertSuperAdmin() {
	const user = auth.currentUser
	if (!user) throw serviceError('unauthenticated', 'Sign in as a Super Admin to manage Field Groups.')
	const snapshot = await getDoc(doc(db, 'users', user.uid))
	if (!snapshot.exists() || snapshot.data().platformRoles?.dukanSetu !== 'superAdmin') {
		throw serviceError('forbidden', 'Only Super Admin users can manage Field Groups.')
	}
}

function toServiceError(error, fallback) {
	if (error?.code?.startsWith('field-group/')) return error
	if (error?.code === 'permission-denied') {
		return serviceError('permission-denied', 'Permission denied. Your account is not allowed to access Field Groups in Firestore.')
	}
	if (error?.code === 'unavailable') {
		return serviceError('unavailable', 'Firestore is unreachable. Check your connection and try again.')
	}
	return serviceError('failed', error?.message || fallback)
}

export function generateFieldGroupKey(name) {
	if (typeof name !== 'string') return ''
	return name.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, FIELD_GROUP_LIMITS.key)
		.replace(/_+$/g, '')
}

function normalizeFieldGroup(snapshot) {
	const data = snapshot.data()
	return {
		id: snapshot.id,
		name: data.name ?? '',
		key: data.key ?? '',
		description: data.description ?? '',
		status: data.status === FIELD_GROUP_STATUS.active ? FIELD_GROUP_STATUS.active : FIELD_GROUP_STATUS.inactive,
		sortOrder: Number.isFinite(data.sortOrder) ? data.sortOrder : 0,
		createdAt: data.createdAt?.toDate?.() ?? null,
		updatedAt: data.updatedAt?.toDate?.() ?? null,
	}
}

function validateFieldGroup(values) {
	const name = typeof values?.name === 'string' ? values.name.trim() : ''
	const key = typeof values?.key === 'string' ? values.key.trim().toLowerCase() : ''
	const description = typeof values?.description === 'string' ? values.description.trim() : ''
	const rawSortOrder = typeof values?.sortOrder === 'string' ? values.sortOrder.trim() : values?.sortOrder
	const sortOrder = rawSortOrder === '' || rawSortOrder === null || rawSortOrder === undefined ? NaN : Number(rawSortOrder)

	if (!name || name.length > FIELD_GROUP_LIMITS.name) {
		throw serviceError('invalid-name', `Enter a Group Name between 1 and ${FIELD_GROUP_LIMITS.name} characters.`)
	}
	if (!key || key.length > FIELD_GROUP_LIMITS.key || !FIELD_GROUP_KEY_PATTERN.test(key)) {
		throw serviceError('invalid-key', 'Group Key is required and may only use lowercase letters, numbers and single underscores.')
	}
	if (description.length > FIELD_GROUP_LIMITS.description) {
		throw serviceError('invalid-description', `Description can be at most ${FIELD_GROUP_LIMITS.description} characters.`)
	}
	if (values?.status !== FIELD_GROUP_STATUS.active && values?.status !== FIELD_GROUP_STATUS.inactive) {
		throw serviceError('invalid-status', 'Status must be Active or Inactive.')
	}
	if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) {
		throw serviceError('invalid-sort-order', 'Sort Order must be a non-negative whole number.')
	}
	return { name, key, description, status: values.status, sortOrder }
}

// Reads only. A key claim whose group no longer exists (orphaned lock) is treated as free.
async function assertKeyAvailable(transaction, key, groupId) {
	const lock = await transaction.get(doc(keysRef, key))
	if (!lock.exists()) return
	const ownerId = lock.data().groupId
	if (ownerId === groupId) return
	const owner = ownerId ? await transaction.get(doc(groupsRef, ownerId)) : null
	if (owner?.exists() && owner.data().key === key) {
		throw serviceError('duplicate-key', `The Group Key "${key}" is already in use. Choose a different key.`)
	}
}

export async function listFieldGroups() {
	try {
		const snapshot = await getDocs(groupsRef)
		return snapshot.docs.map(normalizeFieldGroup).sort((left, right) => (
			left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
		))
	} catch (error) {
		throw toServiceError(error, 'Field Groups could not be loaded.')
	}
}

export async function createFieldGroup(values) {
	try {
		await assertSuperAdmin()
		const fields = validateFieldGroup(values)
		const groupRef = doc(groupsRef)
		await runTransaction(db, async (transaction) => {
			await assertKeyAvailable(transaction, fields.key, groupRef.id)
			const timestamp = serverTimestamp()
			transaction.set(doc(keysRef, fields.key), { groupId: groupRef.id, key: fields.key })
			transaction.set(groupRef, { ...fields, createdAt: timestamp, updatedAt: timestamp })
		})
		return groupRef.id
	} catch (error) {
		throw toServiceError(error, 'The Field Group could not be saved.')
	}
}

export async function updateFieldGroup(id, values) {
	try {
		await assertSuperAdmin()
		const fields = validateFieldGroup(values)
		const groupRef = doc(groupsRef, id)
		await runTransaction(db, async (transaction) => {
			const existing = await transaction.get(groupRef)
			if (!existing.exists()) throw serviceError('not-found', 'This Field Group no longer exists. Refresh the list.')
			const previousKey = existing.data().key
			const keyChanged = previousKey !== fields.key
			await assertKeyAvailable(transaction, fields.key, id)
			let previousLockOwned = false
			if (keyChanged && previousKey) {
				const previousLock = await transaction.get(doc(keysRef, previousKey))
				previousLockOwned = previousLock.exists() && previousLock.data().groupId === id
			}
			transaction.set(doc(keysRef, fields.key), { groupId: id, key: fields.key })
			if (previousLockOwned) transaction.delete(doc(keysRef, previousKey))
			transaction.update(groupRef, { ...fields, updatedAt: serverTimestamp() })
		})
	} catch (error) {
		throw toServiceError(error, 'The Field Group could not be updated.')
	}
}

export async function deleteFieldGroup(id) {
	try {
		await assertSuperAdmin()
		const groupRef = doc(groupsRef, id)
		const snapshot = await getDoc(groupRef)
		if (!snapshot.exists()) throw serviceError('not-found', 'This Field Group no longer exists. Refresh the list.')
		const group = normalizeFieldGroup(snapshot)
		const usages = (await Promise.all(referenceCheckers.map((check) => check(group)))).flat()
		if (usages.length) {
			throw serviceError('in-use', `"${group.name}" is in use (${usages.join(', ')}) and cannot be deleted.`)
		}
		await runTransaction(db, async (transaction) => {
			const existing = await transaction.get(groupRef)
			if (!existing.exists()) throw serviceError('not-found', 'This Field Group no longer exists. Refresh the list.')
			const key = existing.data().key
			const lock = key ? await transaction.get(doc(keysRef, key)) : null
			transaction.delete(groupRef)
			if (lock?.exists() && lock.data().groupId === id) transaction.delete(doc(keysRef, key))
		})
	} catch (error) {
		throw toServiceError(error, 'The Field Group could not be deleted.')
	}
}
