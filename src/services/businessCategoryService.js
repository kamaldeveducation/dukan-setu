import {
	collection,
	doc,
	getDoc,
	getDocs,
	runTransaction,
	serverTimestamp,
	updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { listBusinessTypes } from './businessTypeService'

function normalizeBusinessCategory(snapshot) {
	return { id: snapshot.id, ...snapshot.data(), code: snapshot.data().code || snapshot.id }
}

function duplicateError(field) {
	const message = field === 'code'
		? 'A Business Category with this Code already exists for this Business Type.'
		: 'A Business Category with this Name already exists for this Business Type.'
	const error = new Error(message)
	error.code = `business-category/duplicate-${field}`
	return error
}

function invalidCategoryError(field, message) {
	const error = new Error(message)
	error.code = `business-category/invalid-${field}`
	return error
}

function missingBusinessTypeError() {
	const error = new Error('The selected Business Type could not be found.')
	error.code = 'business-category/missing-business-type'
	return error
}

function categoriesRef(businessTypeId) {
	return collection(db, 'business_types', businessTypeId, 'business_categories')
}

function normalizeCategoryData({ name, code, description = '', active = true, sortOrder }) {
	const normalizedName = typeof name === 'string' ? name.trim() : ''
	const normalizedCode = typeof code === 'string' ? code.trim().toLowerCase() : ''
	const normalizedDescription = typeof description === 'string' ? description.trim() : null
	const normalizedSortOrder = Number(sortOrder)

	if (!normalizedName || normalizedName.length > 80) {
		throw invalidCategoryError('name', 'Enter a Category name between 1 and 80 characters.')
	}
	if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(normalizedCode) || normalizedCode.length > 50) {
		throw invalidCategoryError('code', 'Use a unique code with lowercase letters, numbers and underscores.')
	}
	if (normalizedDescription === null || normalizedDescription.length > 300) {
		throw invalidCategoryError('description', 'Description must be 300 characters or fewer.')
	}
	if (!Number.isSafeInteger(normalizedSortOrder) || normalizedSortOrder < 0) {
		throw invalidCategoryError('sort-order', 'Sort order must be a non-negative whole number.')
	}
	if (typeof active !== 'boolean') {
		throw invalidCategoryError('active', 'Category active status must be true or false.')
	}

	return {
		name: normalizedName,
		code: normalizedCode,
		description: normalizedDescription,
		active,
		sortOrder: normalizedSortOrder,
	}
}

export async function listBusinessCategories(businessTypeId) {
	if (!businessTypeId) return []
	const snapshot = await getDocs(categoriesRef(businessTypeId))
	return snapshot.docs.map(normalizeBusinessCategory).sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder))
}

export async function listActiveBusinessCategoriesAcrossTypes() {
	const businessTypes = await listBusinessTypes()
	const categoriesByType = await Promise.all(businessTypes.map(async (businessType) => ({
		businessTypeId: businessType.id,
		businessTypeName: businessType.name,
		categories: await listBusinessCategories(businessType.id),
	})))
	return categoriesByType.flatMap(({ businessTypeId, businessTypeName, categories }) => categories
		.filter((category) => category.active === true)
		.map((category) => ({ ...category, businessTypeId, businessTypeName })))
}

export async function getActiveBusinessCategory(businessTypeId, categoryId) {
	if (!businessTypeId || !categoryId) return null
	const snapshot = await getDoc(doc(categoriesRef(businessTypeId), categoryId))
	if (!snapshot.exists() || snapshot.data().active !== true) return null
	return normalizeBusinessCategory(snapshot)
}

async function findDuplicateCategory(businessTypeId, field, value, excludingId = '') {
	const snapshot = await getDocs(categoriesRef(businessTypeId))
	const normalized = value.trim().toLocaleLowerCase()
	return snapshot.docs.some((item) => {
		if (item.id === excludingId) return false
		const itemData = item.data()
		const existingValue = field === 'code' ? itemData.code || item.id : itemData[field]
		return String(existingValue || '').trim().toLocaleLowerCase() === normalized
	})
}

export async function createBusinessCategory(businessTypeId, values) {
	if (!businessTypeId) throw missingBusinessTypeError()
	const businessTypeSnapshot = await getDoc(doc(db, 'business_types', businessTypeId))
	if (!businessTypeSnapshot.exists()) throw missingBusinessTypeError()

	const category = normalizeCategoryData({ ...values, active: true })
	if (await findDuplicateCategory(businessTypeId, 'code', category.code)) throw duplicateError('code')
	if (await findDuplicateCategory(businessTypeId, 'name', category.name)) throw duplicateError('name')

	// Document ID must exactly equal the entered code; never let Firestore auto-generate one.
	const reference = doc(categoriesRef(businessTypeId), category.code)
	await runTransaction(db, async (transaction) => {
		const existing = await transaction.get(reference)
		if (existing.exists()) throw duplicateError('code')
		const timestamp = serverTimestamp()
		transaction.set(reference, {
			...category,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
	})
	return reference.id
}

export async function updateBusinessCategory(businessTypeId, categoryId, { name, description, sortOrder, active }) {
	if (!businessTypeId || !categoryId) throw missingBusinessTypeError()
	const reference = doc(categoriesRef(businessTypeId), categoryId)
	const snapshot = await getDoc(reference)
	if (!snapshot.exists()) throw new Error('This Business Category no longer exists.')
	const current = snapshot.data()
	// Code and Document ID are immutable after creation; only these fields may change on edit.
	const category = normalizeCategoryData({
		...current,
		code: current.code || categoryId,
		name,
		description,
		sortOrder,
		active: typeof active === 'boolean' ? active : current.active ?? true,
	})
	if (await findDuplicateCategory(businessTypeId, 'name', category.name, categoryId)) throw duplicateError('name')
	await updateDoc(reference, {
		name: category.name,
		description: category.description,
		sortOrder: category.sortOrder,
		active: category.active,
		updatedAt: serverTimestamp(),
	})
}

export async function setBusinessCategoryActive(businessTypeId, categoryId, active) {
	if (typeof active !== 'boolean') {
		throw invalidCategoryError('active', 'Category active status must be true or false.')
	}
	if (!businessTypeId || !categoryId) throw missingBusinessTypeError()
	await updateDoc(doc(categoriesRef(businessTypeId), categoryId), { active, updatedAt: serverTimestamp() })
}

const businessCategoryService = {
	createBusinessCategory,
	getActiveBusinessCategory,
	listActiveBusinessCategoriesAcrossTypes,
	listBusinessCategories,
	setBusinessCategoryActive,
	updateBusinessCategory,
}

export default businessCategoryService
