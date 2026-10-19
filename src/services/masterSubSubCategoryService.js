import {
	collection,
	doc,
	getDoc,
	getDocs,
	runTransaction,
	serverTimestamp,
	updateDoc,
} from 'firebase/firestore'
import { deleteObject, getBytes, getDownloadURL, ref as storageRef, uploadBytes, uploadBytesResumable } from 'firebase/storage'
import { auth, db, storage } from '../firebase'
import { listBusinessCategories } from './businessCategoryService'
import { listBusinessTypes } from './businessTypeService'
import { generateMasterCategoryCode, listMasterCategories } from './masterCategoryService'
import { listMasterSubCategories } from './masterSubCategoryService'

const MAX_IMAGE_BYTES = 102400
const masterCategoriesRef = collection(db, 'master_categories')
const masterSubCategoriesRef = collection(db, 'master_sub_categories')
const subSubCategoriesRef = collection(db, 'master_sub_sub_categories')

function serviceError(code, message) {
	const error = new Error(message)
	error.code = `master-sub-sub-category/${code}`
	return error
}

function pairKey(businessTypeId, categoryId) {
	return JSON.stringify([businessTypeId, categoryId])
}

function normalizeSubSubCategory(snapshot) {
	const data = snapshot.data()
	return {
		id: snapshot.id,
		...data,
		code: data.code || snapshot.id,
		parentId: data.parentId || data.parentMasterSubCategoryId || '',
		businessCategoryRefs: Array.isArray(data.businessCategoryRefs) ? data.businessCategoryRefs : [],
		imageUrl: data.imageUrl || '',
		imagePath: data.imagePath || '',
		level: 3,
	}
}

async function assertSuperAdmin() {
	const user = auth.currentUser
	if (!user) throw serviceError('unauthenticated', 'Sign in as a Super Admin to manage Master Sub-Subcategories.')
	const snapshot = await getDoc(doc(db, 'users', user.uid))
	if (!snapshot.exists() || snapshot.data().platformRoles?.dukanSetu !== 'superAdmin') {
		throw serviceError('forbidden', 'Only Super Admin users can manage Master Sub-Subcategories.')
	}
}

function validateFields({ name, code, sortOrder, active }) {
	const normalizedName = typeof name === 'string' ? name.trim() : ''
	const normalizedCode = typeof code === 'string' ? code.trim().toLowerCase() : ''
	const normalizedSortOrder = Number(sortOrder)
	if (!normalizedName || normalizedName.length > 80) {
		throw serviceError('invalid-name', 'Enter a Sub-Subcategory name between 1 and 80 characters.')
	}
	if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(normalizedCode) || normalizedCode.length > 50) {
		throw serviceError('invalid-code', 'Use a unique code with lowercase letters, numbers and underscores.')
	}
	if (!Number.isSafeInteger(normalizedSortOrder) || normalizedSortOrder < 0) {
		throw serviceError('invalid-sort-order', 'Sort order must be a non-negative whole number.')
	}
	if (typeof active !== 'boolean') throw serviceError('invalid-active', 'Sub-Subcategory active status must be true or false.')
	return { name: normalizedName, code: normalizedCode, sortOrder: normalizedSortOrder, active }
}

async function resolveHierarchy(values, current = null) {
	const { businessTypeId, businessCategoryId, masterCategoryId, parentId } = values
	if (![businessTypeId, businessCategoryId, masterCategoryId, parentId].every((id) => typeof id === 'string' && id)) {
		throw serviceError('invalid-parent', 'Select a Business Type, Business Category, Master Category, and Master Subcategory.')
	}
	const [businessTypeSnapshot, businessCategorySnapshot, masterCategorySnapshot, subCategorySnapshot] = await Promise.all([
		getDoc(doc(db, 'business_types', businessTypeId)),
		getDoc(doc(db, 'business_types', businessTypeId, 'business_categories', businessCategoryId)),
		getDoc(doc(masterCategoriesRef, masterCategoryId)),
		getDoc(doc(masterSubCategoriesRef, parentId)),
	])
	if (!businessTypeSnapshot.exists()) throw serviceError('invalid-hierarchy', 'The selected Business Type no longer exists.')
	if (!businessCategorySnapshot.exists()) throw serviceError('invalid-hierarchy', 'The selected Business Category no longer exists.')
	if (!masterCategorySnapshot.exists()) throw serviceError('invalid-hierarchy', 'The selected Master Category no longer exists.')
	if (!subCategorySnapshot.exists()) throw serviceError('invalid-hierarchy', 'The selected Master Subcategory no longer exists.')

	const businessType = { id: businessTypeSnapshot.id, ...businessTypeSnapshot.data() }
	const businessCategory = { id: businessCategorySnapshot.id, ...businessCategorySnapshot.data() }
	const masterCategory = { id: masterCategorySnapshot.id, ...masterCategorySnapshot.data() }
	const subCategory = { id: subCategorySnapshot.id, ...subCategorySnapshot.data() }
	const key = pairKey(businessTypeId, businessCategoryId)
	const unchanged = current
		&& current.businessTypeId === businessTypeId
		&& current.businessCategoryId === businessCategoryId
		&& current.masterCategoryId === masterCategoryId
		&& (current.parentId || current.parentMasterSubCategoryId) === parentId
	const validBusinessContext = (record) => Array.isArray(record.businessCategoryRefs)
		&& record.businessCategoryRefs.some((ref) => pairKey(ref.businessTypeId, ref.categoryId) === key)

	if (Number(masterCategory.level || 1) !== 1 || !validBusinessContext(masterCategory)) {
		throw serviceError('invalid-hierarchy', 'The selected Master Category is not mapped to this Business Category.')
	}
	if (subCategory.parentId !== masterCategoryId || !validBusinessContext(subCategory)) {
		throw serviceError('invalid-hierarchy', 'The selected Master Subcategory does not belong to this Master Category and Business Category.')
	}
	if ((!unchanged || values.active) && (businessType.active !== true || businessCategory.active !== true)) {
		throw serviceError('inactive-parent', 'Select an active Business Type and Business Category for this Sub-Subcategory.')
	}
	if ((!unchanged || values.active) && (masterCategory.active !== true || subCategory.active !== true)) {
		throw serviceError('inactive-parent', 'Activate the selected Master Category and Master Subcategory before saving an active Sub-Subcategory.')
	}
	return { businessType, businessCategory, masterCategory, subCategory, unchanged }
}

async function findDuplicateName(name, parentId, excludingId = '') {
	const snapshot = await getDocs(subSubCategoriesRef)
	const normalized = name.trim().toLocaleLowerCase()
	return snapshot.docs.some((item) => {
		if (item.id === excludingId) return false
		const data = item.data()
		return (data.parentId || data.parentMasterSubCategoryId) === parentId
			&& String(data.name || '').trim().toLocaleLowerCase() === normalized
	})
}

function imagePathFor({ businessTypeId, businessCategoryId, masterCategoryId, parentId, code }) {
	return `master_categories/${businessTypeId}/${businessCategoryId}/${masterCategoryId}/${parentId}/${code}/logo.webp`
}

function validateImage(blob) {
	if (!(blob instanceof Blob) || blob.size === 0 || blob.size >= MAX_IMAGE_BYTES || blob.type !== 'image/webp') {
		throw serviceError('invalid-image', 'The processed Sub-Subcategory image must be WebP and smaller than 100 KB. Crop it again and retry.')
	}
}

function uploadImage(path, blob, onProgress) {
	const task = uploadBytesResumable(storageRef(storage, path), blob, { contentType: 'image/webp' })
	return new Promise((resolve, reject) => {
		task.on('state_changed', (snapshot) => {
			if (typeof onProgress === 'function') {
				onProgress(snapshot.totalBytes ? Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100) : 0)
			}
		}, reject, () => resolve(task.snapshot))
	})
}

async function rollbackImage(path, backup) {
	if (backup) {
		await uploadBytes(storageRef(storage, path), backup, { contentType: 'image/webp' })
		return
	}
	try {
		await deleteObject(storageRef(storage, path))
	} catch (error) {
		if (error.code !== 'storage/object-not-found') throw error
	}
}

async function uploadSubSubCategoryImage({ values, code, blob, existingPath, onProgress }) {
	validateImage(blob)
	const path = imagePathFor({ ...values, code })
	let backup = null
	if (path === existingPath) {
		try {
			backup = new Blob([await getBytes(storageRef(storage, path))], { type: 'image/webp' })
		} catch {
			throw serviceError('image-backup-failed', 'The current image could not be backed up safely. No image was changed; retry or choose a different image.')
		}
	}
	try {
		const snapshot = await uploadImage(path, blob, onProgress)
		return { imagePath: path, imageUrl: await getDownloadURL(snapshot.ref), uploadedPath: path, backup }
	} catch (error) {
		try {
			await rollbackImage(path, backup)
		} catch {
			throw serviceError('image-rollback-failed', 'The image upload failed and its previous Storage object could not be restored. Inspect Firebase Storage before retrying.')
		}
		throw error
	}
}

async function removeImageIfUnused(path) {
	if (!path) return []
	const snapshot = await getDocs(subSubCategoriesRef)
	if (snapshot.docs.some((item) => item.data().imagePath === path)) return []
	try {
		await deleteObject(storageRef(storage, path))
		return []
	} catch (error) {
		return [error]
	}
}

export async function listMasterSubSubCategories() {
	const snapshot = await getDocs(subSubCategoriesRef)
	return snapshot.docs.map(normalizeSubSubCategory).sort((left, right) => (
		Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) || String(left.name).localeCompare(String(right.name))
	))
}

export async function listSubSubCategoryOptions() {
	const businessTypes = await listBusinessTypes()
	const categoriesByType = await Promise.all(businessTypes.map(async (businessType) => ({
		businessType,
		categories: await listBusinessCategories(businessType.id),
	})))
	const businessCategories = categoriesByType.flatMap(({ businessType, categories }) => categories.map((category) => ({
		...category,
		businessTypeId: businessType.id,
		businessTypeName: businessType.name || businessType.id,
	})))
	const [masterCategories, masterSubCategories] = await Promise.all([listMasterCategories(), listMasterSubCategories()])
	return { businessTypes, businessCategories, masterCategories, masterSubCategories }
}

export const generateMasterSubSubCategoryCode = generateMasterCategoryCode

export async function createMasterSubSubCategory(values, onProgress) {
	await assertSuperAdmin()
	const fields = validateFields({ ...values, active: values.active ?? true })
	const hierarchy = await resolveHierarchy({ ...values, ...fields })
	if (await findDuplicateName(fields.name, hierarchy.subCategory.id)) {
		throw serviceError('duplicate-name', 'A Master Sub-Subcategory with this name already exists under the selected Master Subcategory.')
	}
	const reference = doc(subSubCategoriesRef, fields.code)
	if ((await getDoc(reference)).exists()) throw serviceError('duplicate-code', 'A Master Sub-Subcategory with this code already exists.')
	const image = values.imageBlob
		? await uploadSubSubCategoryImage({ values, code: fields.code, blob: values.imageBlob, onProgress })
		: null
	try {
		await runTransaction(db, async (transaction) => {
			if ((await transaction.get(reference)).exists()) throw serviceError('duplicate-code', 'A Master Sub-Subcategory with this code already exists.')
			const timestamp = serverTimestamp()
			const data = {
				name: fields.name,
				code: fields.code,
				parentId: hierarchy.subCategory.id,
				parentMasterSubCategoryId: hierarchy.subCategory.id,
				parentName: hierarchy.subCategory.name || hierarchy.subCategory.id,
				level: 3,
				businessTypeId: hierarchy.businessType.id,
				businessCategoryId: hierarchy.businessCategory.id,
				masterCategoryId: hierarchy.masterCategory.id,
				businessCategoryRefs: [{ businessTypeId: hierarchy.businessType.id, categoryId: hierarchy.businessCategory.id }],
				sortOrder: fields.sortOrder,
				active: fields.active,
				createdAt: timestamp,
				updatedAt: timestamp,
			}
			if (image) Object.assign(data, { imageUrl: image.imageUrl, imagePath: image.imagePath })
			transaction.set(reference, data)
		})
	} catch (error) {
		if (image) {
			try { await rollbackImage(image.uploadedPath, image.backup) } catch {
				throw serviceError('image-rollback-failed', 'The Firestore save failed and the uploaded image could not be removed. Inspect Firebase Storage before retrying.')
			}
		}
		throw error
	}
	return reference.id
}

export async function updateMasterSubSubCategory(id, values, onProgress) {
	await assertSuperAdmin()
	if (!id) throw serviceError('missing', 'This Master Sub-Subcategory could not be found.')
	const reference = doc(subSubCategoriesRef, id)
	const snapshot = await getDoc(reference)
	if (!snapshot.exists()) throw serviceError('missing', 'This Master Sub-Subcategory no longer exists.')
	const current = normalizeSubSubCategory(snapshot)
	const fields = validateFields({ ...values, code: current.code })
	const hierarchy = await resolveHierarchy({ ...values, ...fields }, current)
	if (await findDuplicateName(fields.name, hierarchy.subCategory.id, id)) {
		throw serviceError('duplicate-name', 'A Master Sub-Subcategory with this name already exists under the selected Master Subcategory.')
	}

	let image = null
	if (values.imageBlob) {
		image = await uploadSubSubCategoryImage({ values, code: current.code, blob: values.imageBlob, existingPath: current.imagePath, onProgress })
	} else if (values.removeImage) {
		image = { imageUrl: '', imagePath: '', uploadedPath: '' }
	} else if (current.imagePath) {
		const expectedPath = imagePathFor({ ...values, code: current.code })
		if (current.imagePath !== expectedPath) {
			throw serviceError('image-hierarchy-change', 'Replace or remove the image when changing its parent hierarchy so it remains stored in the correct location.')
		}
	}
	const imageFields = image
		? image.imagePath
			? { imageUrl: image.imageUrl, imagePath: image.imagePath }
			: { imageUrl: null, imagePath: null }
		: {}
	try {
		await updateDoc(reference, {
			name: fields.name,
			code: current.code,
			parentId: hierarchy.subCategory.id,
			parentMasterSubCategoryId: hierarchy.subCategory.id,
			parentName: hierarchy.subCategory.name || hierarchy.subCategory.id,
			level: 3,
			businessTypeId: hierarchy.businessType.id,
			businessCategoryId: hierarchy.businessCategory.id,
			masterCategoryId: hierarchy.masterCategory.id,
			businessCategoryRefs: [{ businessTypeId: hierarchy.businessType.id, categoryId: hierarchy.businessCategory.id }],
			sortOrder: fields.sortOrder,
			active: fields.active,
			updatedAt: serverTimestamp(),
			...imageFields,
		})
	} catch (error) {
		if (image?.uploadedPath) {
			try { await rollbackImage(image.uploadedPath, image.backup) } catch {
				throw serviceError('image-rollback-failed', 'The Firestore save failed and the previous image could not be restored. Inspect Firebase Storage before retrying.')
			}
		}
		throw error
	}
	const oldPath = current.imagePath && current.imagePath !== image?.imagePath ? current.imagePath : ''
	const cleanupErrors = await removeImageIfUnused(oldPath)
	return { cleanupErrors }
}

export async function setMasterSubSubCategoryActive(id, active) {
	await assertSuperAdmin()
	if (typeof active !== 'boolean') throw serviceError('invalid-active', 'Sub-Subcategory active status must be true or false.')
	const reference = doc(subSubCategoriesRef, id)
	const snapshot = await getDoc(reference)
	if (!snapshot.exists()) throw serviceError('missing', 'This Master Sub-Subcategory no longer exists.')
	if (active) {
		const current = normalizeSubSubCategory(snapshot)
		await resolveHierarchy({
			businessTypeId: current.businessTypeId,
			businessCategoryId: current.businessCategoryId,
			masterCategoryId: current.masterCategoryId,
			parentId: current.parentId,
			active: true,
		}, current)
	}
	await updateDoc(reference, { active, updatedAt: serverTimestamp() })
}