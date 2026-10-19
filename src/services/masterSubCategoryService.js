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
import { getActiveBusinessCategory } from './businessCategoryService'
import { getActiveBusinessType } from './businessTypeService'
import { generateMasterCategoryCode, listMasterCategories } from './masterCategoryService'

const MAX_IMAGE_BYTES = 102400
const masterCategoriesRef = collection(db, 'master_categories')
const subCategoriesRef = collection(db, 'master_sub_categories')

function serviceError(code, message) {
	const error = new Error(message)
	error.code = `master-sub-category/${code}`
	return error
}

function pairKey(businessTypeId, categoryId) {
	return JSON.stringify([businessTypeId, categoryId])
}

function normalizeSubCategory(snapshot) {
	const data = snapshot.data()
	return {
		id: snapshot.id,
		...data,
		code: data.code || snapshot.id,
		parentId: data.parentId || '',
		businessCategoryRefs: Array.isArray(data.businessCategoryRefs) ? data.businessCategoryRefs : [],
		imageUrl: data.imageUrl || '',
		imagePath: data.imagePath || '',
		level: 2,
	}
}

async function assertSuperAdmin() {
	const user = auth.currentUser
	if (!user) throw serviceError('unauthenticated', 'Sign in as a Super Admin to manage Master Sub Categories.')
	const snapshot = await getDoc(doc(db, 'users', user.uid))
	if (!snapshot.exists() || snapshot.data().platformRoles?.dukanSetu !== 'superAdmin') {
		throw serviceError('forbidden', 'Only Super Admin users can manage Master Sub Categories.')
	}
}

function normalizeRefs(refs) {
	if (!Array.isArray(refs)) throw serviceError('invalid-mapping', 'Business Category mappings are invalid.')
	const seen = new Set()
	return refs.map((ref) => {
		const businessTypeId = ref?.businessTypeId
		const categoryId = ref?.categoryId
		if (typeof businessTypeId !== 'string' || !businessTypeId || typeof categoryId !== 'string' || !categoryId) {
			throw serviceError('invalid-mapping', 'One or more Business Category mappings are invalid.')
		}
		const key = pairKey(businessTypeId, categoryId)
		if (seen.has(key)) throw serviceError('duplicate-mapping', 'A Business Category was mapped more than once.')
		seen.add(key)
		return { businessTypeId, categoryId }
	})
}

function validateFields({ name, code, sortOrder, active }) {
	const normalizedName = typeof name === 'string' ? name.trim() : ''
	const normalizedCode = typeof code === 'string' ? code.trim().toLowerCase() : ''
	const normalizedSortOrder = Number(sortOrder)
	if (!normalizedName || normalizedName.length > 80) {
		throw serviceError('invalid-name', 'Enter a Subcategory name between 1 and 80 characters.')
	}
	if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(normalizedCode) || normalizedCode.length > 50) {
		throw serviceError('invalid-code', 'Use a unique code with lowercase letters, numbers and underscores.')
	}
	if (!Number.isSafeInteger(normalizedSortOrder) || normalizedSortOrder < 0) {
		throw serviceError('invalid-sort-order', 'Sort order must be a non-negative whole number.')
	}
	if (typeof active !== 'boolean') throw serviceError('invalid-active', 'Subcategory active status must be true or false.')
	return { name: normalizedName, code: normalizedCode, sortOrder: normalizedSortOrder, active }
}

async function resolveParent(parentId) {
	if (typeof parentId !== 'string' || !parentId) {
		throw serviceError('invalid-parent', 'Select a parent Master Category.')
	}
	const snapshot = await getDoc(doc(masterCategoriesRef, parentId))
	if (!snapshot.exists()) throw serviceError('invalid-parent', 'The selected parent Master Category no longer exists.')
	const data = snapshot.data()
	const level = Number.isInteger(data.level) ? data.level : 1
	if (level !== 1) throw serviceError('invalid-parent', 'A Master Sub Category must be linked to a top-level Master Category.')
	return { id: snapshot.id, ...data, level }
}

async function validateMappings(refs, parent, existingRefs = []) {
	if (!refs.length) throw serviceError('mapping-required', 'Add at least one valid Business Category mapping before saving.')
	const parentKeys = new Set((Array.isArray(parent.businessCategoryRefs) ? parent.businessCategoryRefs : [])
		.map((ref) => pairKey(ref.businessTypeId, ref.categoryId)))
	const existingKeys = new Set(existingRefs.map((ref) => pairKey(ref.businessTypeId, ref.categoryId)))
	for (const ref of refs) {
		const key = pairKey(ref.businessTypeId, ref.categoryId)
		if (!parentKeys.has(key)) {
			throw serviceError('invalid-mapping', 'Each linked Business Category must also be linked to the selected parent Master Category.')
		}
		if (!existingKeys.has(key)) {
			const [businessType, businessCategory] = await Promise.all([
				getActiveBusinessType(ref.businessTypeId),
				getActiveBusinessCategory(ref.businessTypeId, ref.categoryId),
			])
			if (!businessType) throw serviceError('invalid-mapping', 'A selected Business Type is missing or inactive. Review the mappings and try again.')
			if (!businessCategory) throw serviceError('invalid-mapping', 'A selected Business Category is missing or inactive. Review the mappings and try again.')
		}
	}
}

async function findDuplicateName(name, parentId, excludingId = '') {
	const snapshot = await getDocs(subCategoriesRef)
	const normalized = name.trim().toLocaleLowerCase()
	return snapshot.docs.some((item) => {
		if (item.id === excludingId) return false
		const data = item.data()
		return data.parentId === parentId && String(data.name || '').trim().toLocaleLowerCase() === normalized
	})
}

function imagePathFor(ref, parent, code) {
	return `master_categories/${ref.businessTypeId}/${ref.categoryId}/${parent.id}/${code}/logo.webp`
}

function validateImage(blob, extension) {
	if (!(blob instanceof Blob) || blob.size === 0 || blob.size >= MAX_IMAGE_BYTES || blob.type !== 'image/webp' || extension !== 'webp') {
		throw serviceError('invalid-image', 'The processed subcategory image must be WebP and smaller than 100 KB. Crop it again and retry.')
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

async function uploadSubCategoryImage({ parent, refs, code, blob, existingPath, onProgress }) {
	if (!refs.length) throw serviceError('image-mapping-required', 'Link at least one Business Category before adding an image.')
	validateImage(blob, 'webp')
	const orderedRefs = [...refs].sort((left, right) => left.businessTypeId.localeCompare(right.businessTypeId)
		|| left.categoryId.localeCompare(right.categoryId))
	const path = imagePathFor(orderedRefs[0], parent, code)
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
	const snapshot = await getDocs(subCategoriesRef)
	if (snapshot.docs.some((item) => item.data().imagePath === path)) return []
	try {
		await deleteObject(storageRef(storage, path))
		return []
	} catch (error) {
		return [error]
	}
}

export async function listMasterSubCategories() {
	const snapshot = await getDocs(subCategoriesRef)
	return snapshot.docs.map(normalizeSubCategory).sort((left, right) => (
		Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) || String(left.name).localeCompare(String(right.name))
	))
}

export const generateMasterSubCategoryCode = generateMasterCategoryCode

export async function createMasterSubCategory(values, onProgress) {
	await assertSuperAdmin()
	const fields = validateFields({ ...values, active: values.active ?? true })
	const parent = await resolveParent(values.parentId)
	const refs = normalizeRefs(values.businessCategoryRefs ?? [])
	const imageBlob = values.imageBlob || null
	await validateMappings(refs, parent)
	if (fields.active && parent.active !== true) throw serviceError('inactive-parent', 'Activate the parent Master Category before creating an active subcategory.')
	if (await findDuplicateName(fields.name, parent.id)) throw serviceError('duplicate-name', 'A Master Sub Category with this name already exists under the selected parent.')
	const reference = doc(subCategoriesRef, fields.code)
	if ((await getDoc(reference)).exists()) throw serviceError('duplicate-code', 'A Master Sub Category with this code already exists.')
	const image = imageBlob
		? await uploadSubCategoryImage({ parent, refs, code: fields.code, blob: imageBlob, onProgress })
		: null
	try {
		await runTransaction(db, async (transaction) => {
			if ((await transaction.get(reference)).exists()) throw serviceError('duplicate-code', 'A Master Sub Category with this code already exists.')
			const timestamp = serverTimestamp()
			const data = {
				name: fields.name,
				code: fields.code,
				parentId: parent.id,
				parentName: parent.name || parent.id,
				level: 2,
				businessCategoryRefs: refs,
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

export async function updateMasterSubCategory(id, values, onProgress) {
	await assertSuperAdmin()
	if (!id) throw serviceError('missing', 'This Master Sub Category could not be found.')
	const reference = doc(subCategoriesRef, id)
	const snapshot = await getDoc(reference)
	if (!snapshot.exists()) throw serviceError('missing', 'This Master Sub Category no longer exists.')
	const current = normalizeSubCategory(snapshot)
	const fields = validateFields({ ...values, code: current.code })
	const parent = await resolveParent(values.parentId)
	const refs = normalizeRefs(values.businessCategoryRefs ?? [])
	await validateMappings(refs, parent, current.businessCategoryRefs)
	if (fields.active && parent.active !== true) throw serviceError('inactive-parent', 'Activate the parent Master Category before activating this subcategory.')
	if (await findDuplicateName(fields.name, parent.id, id)) throw serviceError('duplicate-name', 'A Master Sub Category with this name already exists under the selected parent.')

	let image = null
	if (values.imageBlob) {
		image = await uploadSubCategoryImage({ parent, refs, code: current.code, blob: values.imageBlob, existingPath: current.imagePath, onProgress })
	} else if (values.removeImage) {
		image = { imageUrl: '', imagePath: '', uploadedPath: '' }
	} else if (current.imagePath) {
		const validPaths = refs.map((ref) => imagePathFor(ref, parent, current.code))
		if (!validPaths.includes(current.imagePath)) {
			throw serviceError('image-mapping-required', 'The current image is stored under one of its Business Category mappings. Keep that mapping, replace the image, or remove it before saving.')
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
			parentId: parent.id,
			parentName: parent.name || parent.id,
			level: 2,
			businessCategoryRefs: refs,
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

export async function setMasterSubCategoryActive(id, active) {
	await assertSuperAdmin()
	if (typeof active !== 'boolean') throw serviceError('invalid-active', 'Subcategory active status must be true or false.')
	const reference = doc(subCategoriesRef, id)
	const snapshot = await getDoc(reference)
	if (!snapshot.exists()) throw serviceError('missing', 'This Master Sub Category no longer exists.')
	if (active) {
		const parent = await resolveParent(snapshot.data().parentId)
		if (parent.active !== true) throw serviceError('inactive-parent', 'Activate the parent Master Category before activating this subcategory.')
	}
	await updateDoc(reference, { active, updatedAt: serverTimestamp() })
}

export async function listSubCategoryParentOptions() {
	return (await listMasterCategories()).filter((category) => category.level === 1)
}