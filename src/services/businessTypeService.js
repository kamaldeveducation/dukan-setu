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
	writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'

const initialBusinessTypes = [
	{ id: 'retail', code: 'retail_store', name: 'Retail Store', idPrefix: 'RET', categories: ['General Retail', 'Clothing', 'Household'] },
	{ id: 'kirana', code: 'kirana_grocery', name: 'Kirana / Grocery', idPrefix: 'KIR', categories: ['Grocery', 'General Store', 'Supermarket'] },
	{ id: 'medical', code: 'medical', name: 'Medical', idPrefix: 'MED', categories: ['Pharmacy', 'Medical Store'] },
	{ id: 'bakery', code: 'bakery', name: 'Bakery', idPrefix: 'BAK', categories: ['Bakery', 'Cake Shop'] },
	{ id: 'electronics', code: 'electronics', name: 'Electronics', idPrefix: 'ELC', categories: ['Electronics Store', 'Mobile Store'] },
	{ id: 'garments', code: 'garments', name: 'Garments', idPrefix: 'GAR', categories: ['Garments', 'Boutique'] },
	{ id: 'professional-services', code: 'professional_services', name: 'Professional Services', idPrefix: 'SER', categories: ['Consulting', 'Repair Services'] },
	{ id: 'other', code: 'other', name: 'Other', idPrefix: 'OTH', categories: ['Other'] },
]

const collectionRef = collection(db, 'business_types')

function normalizeBusinessType(snapshot) {
	return { id: snapshot.id, ...snapshot.data(), code: snapshot.data().code || snapshot.id }
}

function duplicateError(field) {
	const error = new Error(`A Business Type with this ${field} already exists.`)
	error.code = `business-type/duplicate-${field}`
	return error
}

function invalidBusinessTypeError(field, message) {
	const error = new Error(message)
	error.code = `business-type/invalid-${field}`
	return error
}

export function generateBusinessTypeCode(name) {
	if (typeof name !== 'string') return ''
	return name.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 50)
		.replace(/_+$/g, '')
}

function normalizeBusinessTypeData({ name, code, description = '', active = true, sortOrder, idPrefix }) {
	const normalizedName = typeof name === 'string' ? name.trim() : ''
	const normalizedCode = typeof code === 'string' ? code.trim().toLowerCase() : ''
	const normalizedDescription = typeof description === 'string' ? description.trim() : null
	const normalizedSortOrder = Number(sortOrder)

	if (!normalizedName || normalizedName.length > 80) {
		throw invalidBusinessTypeError('name', 'Enter a Business Type name between 1 and 80 characters.')
	}
	if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(normalizedCode) || normalizedCode.length > 50) {
		throw invalidBusinessTypeError('code', 'Use a unique code with lowercase letters, numbers and underscores.')
	}
	if (normalizedDescription === null || normalizedDescription.length > 300) {
		throw invalidBusinessTypeError('description', 'Description must be 300 characters or fewer.')
	}
	if (!Number.isSafeInteger(normalizedSortOrder) || normalizedSortOrder < 0) {
		throw invalidBusinessTypeError('sort-order', 'Sort order must be a non-negative whole number.')
	}
	if (typeof active !== 'boolean') {
		throw invalidBusinessTypeError('active', 'Business Type active status must be true or false.')
	}
	if (idPrefix !== undefined && (typeof idPrefix !== 'string' || !idPrefix.trim())) {
		throw invalidBusinessTypeError('id-prefix', 'Store ID prefix must be a non-empty string when provided.')
	}

	const data = {
		name: normalizedName,
		code: normalizedCode,
		description: normalizedDescription,
		active,
		sortOrder: normalizedSortOrder,
	}
	if (idPrefix !== undefined) data.idPrefix = idPrefix
	return data
}

export async function listActiveBusinessTypes() {
	const snapshot = await getDocs(query(collectionRef, where('active', '==', true)))
	return snapshot.docs.map(normalizeBusinessType).sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder))
}

export async function listBusinessTypes() {
	const snapshot = await getDocs(collectionRef)
	return snapshot.docs.map(normalizeBusinessType).sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder))
}

export async function getActiveBusinessType(id) {
	if (!id) return null
	const snapshot = await getDoc(doc(db, 'business_types', id))
	if (!snapshot.exists() || snapshot.data().active !== true) return null
	return normalizeBusinessType(snapshot)
}

async function findDuplicate(field, value, excludingId = '') {
	const snapshot = await getDocs(collectionRef)
	const normalized = value.trim().toLocaleLowerCase()
	return snapshot.docs.some((item) => {
		if (item.id === excludingId) return false
		const itemData = item.data()
		const existingValue = field === 'code' ? itemData.code || item.id : itemData[field]
		return String(existingValue || '').trim().toLocaleLowerCase() === normalized
	})
}

export async function createBusinessType(values) {
	const businessType = normalizeBusinessTypeData({ ...values, active: true })
	if (await findDuplicate('code', businessType.code)) throw duplicateError('code')
	if (await findDuplicate('name', businessType.name)) throw duplicateError('name')
	const reference = doc(collectionRef, businessType.code)
	await runTransaction(db, async (transaction) => {
		const existing = await transaction.get(reference)
		if (existing.exists()) throw duplicateError('code')
		const timestamp = serverTimestamp()
		transaction.set(reference, {
			...businessType,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
	})
	return reference.id
}

export async function updateBusinessType(id, { name, description, sortOrder }) {
	const reference = doc(db, 'business_types', id)
	const snapshot = await getDoc(reference)
	if (!snapshot.exists()) throw new Error('This Business Type no longer exists.')
	const current = snapshot.data()
	const businessType = normalizeBusinessTypeData({
		...current,
		code: current.code || id,
		name,
		description,
		sortOrder,
		active: current.active ?? true,
	})
	if (await findDuplicate('name', businessType.name, id)) throw duplicateError('name')
	await updateDoc(reference, {
		name: businessType.name,
		description: businessType.description,
		sortOrder: businessType.sortOrder,
		updatedAt: serverTimestamp(),
	})
}

export async function setBusinessTypeActive(id, active) {
	if (typeof active !== 'boolean') {
		throw invalidBusinessTypeError('active', 'Business Type active status must be true or false.')
	}
	await updateDoc(doc(db, 'business_types', id), { active, updatedAt: serverTimestamp() })
}

export async function seedInitialBusinessTypes() {
	const existing = await getDocs(collectionRef)
	const existingRecords = existing.docs.map(normalizeBusinessType)
	const timestamp = serverTimestamp()
	const batch = writeBatch(db)
	let pendingWrites = 0
	initialBusinessTypes.forEach(({ id, code, name, idPrefix }, index) => {
		const normalizedCode = code.toLocaleLowerCase()
		const normalizedName = name.toLocaleLowerCase()
		const alreadyPresent = existingRecords.some((type) => type.id === id
			|| type.code.toLocaleLowerCase() === normalizedCode
			|| type.name.toLocaleLowerCase() === normalizedName)
		if (alreadyPresent) return
		if (existingRecords.some((type) => type.id === normalizedCode)) {
			throw duplicateError('code')
		}
		const businessType = normalizeBusinessTypeData({
			name,
			code,
			description: '',
			active: true,
			sortOrder: index + 1,
			idPrefix,
		})
		batch.set(doc(collectionRef, businessType.code), {
			...businessType,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
		pendingWrites += 1
	})
	if (pendingWrites > 0) await batch.commit()
}

export function getBusinessCategories(businessTypeId) {
	return initialBusinessTypes.find((type) => [type.id, type.code, type.name].includes(businessTypeId))?.categories
		?? (businessTypeId ? ['General'] : [])
}

export function getBusinessType(businessTypeId) {
	return initialBusinessTypes.find((type) => [type.id, type.code, type.name].includes(businessTypeId)) ?? null
}

const businessTypeService = {
	createBusinessType,
	getActiveBusinessType,
	getBusinessCategories,
	getBusinessType,
	listActiveBusinessTypes,
	listBusinessTypes,
	seedInitialBusinessTypes,
	setBusinessTypeActive,
	updateBusinessType,
}

export default businessTypeService