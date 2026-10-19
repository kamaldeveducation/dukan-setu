import {
	collection,
	deleteField,
	doc,
	getDoc,
	getDocs,
	query,
	runTransaction,
	serverTimestamp,
	updateDoc,
	where,
} from 'firebase/firestore'
import { deleteObject, getBytes, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from '../firebase'
import { getActiveBusinessCategory, listBusinessCategories } from './businessCategoryService'
import { listBusinessTypes } from './businessTypeService'

export const MAX_MASTER_CATEGORY_LEVEL = 3
const MAX_LOGO_BYTES = 102400

const collectionRef = collection(db, 'master_categories')

function serviceError(code, message) {
	const error = new Error(message)
	error.code = `master-category/${code}`
	return error
}

function normalizeMasterCategory(snapshot) {
	const data = snapshot.data()
	return {
		id: snapshot.id,
		...data,
		code: data.code || snapshot.id,
		parentId: data.parentId ?? null,
		level: Number.isInteger(data.level) ? data.level : 1,
		businessCategoryRefs: Array.isArray(data.businessCategoryRefs) ? data.businessCategoryRefs : [],
		logoRefs: Array.isArray(data.logoRefs) ? data.logoRefs : [],
	}
}

function pairKey(businessTypeId, categoryId) {
	return JSON.stringify([businessTypeId, categoryId])
}

// Service-level guard; Firestore security rules remain the real enforcement.
async function assertSuperAdmin() {
	const user = auth.currentUser
	if (!user) throw serviceError('unauthenticated', 'Sign in as a Super Admin to manage Master Categories.')
	const snapshot = await getDoc(doc(db, 'users', user.uid))
	if (!snapshot.exists() || snapshot.data().platformRoles?.dukanSetu !== 'superAdmin') {
		throw serviceError('forbidden', 'Only Super Admin users can manage Master Categories.')
	}
}

export function generateMasterCategoryCode(name) {
	if (typeof name !== 'string') return ''
	return name.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 50)
		.replace(/_+$/g, '')
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

function sortedLogoMappings(refs) {
	return [...refs].sort((left, right) => left.businessTypeId.localeCompare(right.businessTypeId)
		|| left.categoryId.localeCompare(right.categoryId))
}

function logoPathFor(ref, code, extension) {
	return `master_categories/${ref.businessTypeId}/${ref.categoryId}/${code}/logo.${extension}`
}

function extensionFromPath(path = '') {
	const extension = path.split('.').pop()?.toLowerCase()
	return extension === 'jpg' || extension === 'jpeg' ? 'jpg' : extension === 'webp' ? 'webp' : ''
}

function validateLogoBlob(blob, extension) {
	const expectedType = extension === 'webp' ? 'image/webp' : 'image/jpeg'
	if (!(blob instanceof Blob) || blob.size === 0 || blob.size >= MAX_LOGO_BYTES || blob.type !== expectedType) {
		throw serviceError('invalid-logo', 'The processed category image must be a valid WebP or JPEG smaller than 100 KB. Crop it again and retry.')
	}
}

async function rollbackLogoUploads(uploadedPaths, backups) {
	const results = await Promise.allSettled(uploadedPaths.map(async (path) => {
		const objectRef = storageRef(storage, path)
		const backup = backups.get(path)
		if (backup) await uploadBytes(objectRef, backup.blob, { contentType: backup.contentType })
		else await deleteObject(objectRef)
	}))
	return results.filter((result) => result.status === 'rejected').map((result) => result.reason)
}

function rollbackError(originalError, rollbackErrors) {
	if (!rollbackErrors.length) return originalError
	return serviceError('rollback-failed', `${originalError.message || 'The category could not be saved.'} ${rollbackErrors.length} image object(s) could not be restored or removed; retry the operation or inspect Storage.`)
}

async function uploadLogoMappings({ refs, code, blob, extension, existingLogoRefs = [] }) {
	if (!refs.length) throw serviceError('logo-mapping-required', 'Select at least one Business Category mapping before saving this image. The image must be stored under a mapped Business Type and Business Category.')
	const mappings = sortedLogoMappings(refs)
	const targets = mappings.map((mapping) => ({ ...mapping, logoPath: logoPathFor(mapping, code, extension) }))
	const existingByPath = new Map(existingLogoRefs.filter((item) => item?.logoPath && item?.logoUrl).map((item) => [item.logoPath, item]))
	const forceUpload = Boolean(blob)
	const missingTargets = targets.filter((target) => forceUpload || !existingByPath.has(target.logoPath))
	let bytes = blob
	if (!bytes && missingTargets.length) {
		const sourceRef = existingLogoRefs.find((item) => item?.logoPath)
		if (!sourceRef) throw serviceError('logo-source-missing', 'The existing image has no usable Storage path. Choose a replacement image before changing its Business Category mappings.')
		try {
			const downloaded = await getBytes(storageRef(storage, sourceRef.logoPath))
			bytes = new Blob([downloaded], { type: extension === 'webp' ? 'image/webp' : 'image/jpeg' })
		} catch {
			throw serviceError('logo-copy-failed', 'The existing image could not be read to add its new mapping. Replace the image and try again.')
		}
		validateLogoBlob(bytes, extension)
	}
	if (bytes) validateLogoBlob(bytes, extension)

	const backups = new Map()
	for (const target of missingTargets) {
		if (existingByPath.has(target.logoPath)) {
			try {
				const previous = await getBytes(storageRef(storage, target.logoPath))
				const contentType = extension === 'webp' ? 'image/webp' : 'image/jpeg'
				backups.set(target.logoPath, { blob: new Blob([previous], { type: contentType }), contentType })
			} catch {
				throw serviceError('logo-backup-failed', 'The current image could not be backed up safely. No image was changed; retry or choose a different image.')
			}
		}
	}

	const uploadedPaths = []
	try {
		for (const target of missingTargets) {
			const objectRef = storageRef(storage, target.logoPath)
			await uploadBytes(objectRef, bytes, { contentType: extension === 'webp' ? 'image/webp' : 'image/jpeg' })
			uploadedPaths.push(target.logoPath)
		}
		const logoRefs = await Promise.all(targets.map(async (target) => {
			const existing = existingByPath.get(target.logoPath)
			return {
				businessTypeId: target.businessTypeId,
				categoryId: target.categoryId,
				logoPath: target.logoPath,
				logoUrl: existing && !forceUpload ? existing.logoUrl : await getDownloadURL(storageRef(storage, target.logoPath)),
			}
		}))
		return { logoRefs, uploadedPaths, backups }
	} catch (error) {
		const rollbackErrors = await rollbackLogoUploads(uploadedPaths, backups)
		throw rollbackError(error, rollbackErrors)
	}
}

async function cleanupObsoleteLogoPaths(oldLogoRefs, newLogoRefs) {
	const retained = new Set(newLogoRefs.map((item) => item.logoPath))
	const candidates = [...new Set(oldLogoRefs.map((item) => item?.logoPath).filter((path) => path && !retained.has(path)))]
	if (!candidates.length) return []
	const snapshot = await getDocs(collectionRef)
	const referenced = new Set()
	for (const category of snapshot.docs) {
		const data = category.data()
		if (data.logoPath) referenced.add(data.logoPath)
		for (const item of Array.isArray(data.logoRefs) ? data.logoRefs : []) {
			if (item?.logoPath) referenced.add(item.logoPath)
		}
	}
	const results = await Promise.allSettled(candidates.filter((path) => !referenced.has(path)).map((path) => deleteObject(storageRef(storage, path))))
	return results.filter((result) => result.status === 'rejected').map((result) => result.reason)
}

function logoFields(logoRefs) {
	if (!logoRefs.length) return { logoUrl: deleteField(), logoPath: deleteField(), logoRefs: deleteField() }
	return { logoUrl: logoRefs[0].logoUrl, logoPath: logoRefs[0].logoPath, logoRefs }
}

// Only mappings not already stored must point at an active Business Category.
async function validateNewRefs(refs, existingRefs = []) {
	const existingKeys = new Set(existingRefs.map((ref) => pairKey(ref.businessTypeId, ref.categoryId)))
	await Promise.all(refs.filter((ref) => !existingKeys.has(pairKey(ref.businessTypeId, ref.categoryId))).map(async (ref) => {
		const category = await getActiveBusinessCategory(ref.businessTypeId, ref.categoryId)
		if (!category) throw serviceError('invalid-mapping', 'A selected Business Category is missing or inactive. Review the mappings and try again.')
	}))
}

function validateFields({ name, code, sortOrder, active }) {
	const normalizedName = typeof name === 'string' ? name.trim() : ''
	const normalizedCode = typeof code === 'string' ? code.trim().toLowerCase() : ''
	const normalizedSortOrder = Number(sortOrder)
	if (!normalizedName || normalizedName.length > 80) {
		throw serviceError('invalid-name', 'Enter a Category name between 1 and 80 characters.')
	}
	if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(normalizedCode) || normalizedCode.length > 50) {
		throw serviceError('invalid-code', 'Use a unique code with lowercase letters, numbers and underscores.')
	}
	if (!Number.isSafeInteger(normalizedSortOrder) || normalizedSortOrder < 0) {
		throw serviceError('invalid-sort-order', 'Sort order must be a non-negative whole number.')
	}
	if (typeof active !== 'boolean') {
		throw serviceError('invalid-active', 'Category active status must be true or false.')
	}
	return { name: normalizedName, code: normalizedCode, sortOrder: normalizedSortOrder, active }
}

// Returns the parent record, or null for a top-level category.
async function resolveParent(parentId, selfId = '') {
	if (parentId === null || parentId === undefined || parentId === '') return null
	if (typeof parentId !== 'string') throw serviceError('invalid-parent', 'The selected parent category is invalid.')
	if (selfId && parentId === selfId) throw serviceError('invalid-parent', 'A category cannot be its own parent.')
	const parentSnapshot = await getDoc(doc(collectionRef, parentId))
	if (!parentSnapshot.exists()) throw serviceError('invalid-parent', 'The selected parent category no longer exists.')
	const parent = normalizeMasterCategory(parentSnapshot)

	// Walk the ancestor chain so an edit can never create a cycle.
	const visited = new Set([parent.id])
	let cursor = parent
	while (cursor.parentId) {
		if (cursor.parentId === selfId || visited.has(cursor.parentId)) {
			throw serviceError('circular-parent', 'This parent selection would create a circular hierarchy.')
		}
		visited.add(cursor.parentId)
		const next = await getDoc(doc(collectionRef, cursor.parentId))
		if (!next.exists()) throw serviceError('invalid-parent', 'The parent hierarchy is incomplete.')
		cursor = normalizeMasterCategory(next)
	}

	if (parent.level >= MAX_MASTER_CATEGORY_LEVEL) {
		throw serviceError('max-level', `Categories can be at most ${MAX_MASTER_CATEGORY_LEVEL} levels deep.`)
	}
	return parent
}

async function findDuplicateName(name, parentId, excludingId = '') {
	const snapshot = await getDocs(collectionRef)
	const normalized = name.trim().toLocaleLowerCase()
	return snapshot.docs.some((item) => {
		if (item.id === excludingId) return false
		const data = item.data()
		return (data.parentId ?? null) === parentId && String(data.name || '').trim().toLocaleLowerCase() === normalized
	})
}

export async function listMasterCategories() {
	const snapshot = await getDocs(collectionRef)
	return snapshot.docs.map(normalizeMasterCategory).sort((left, right) => (
		Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0) || String(left.name).localeCompare(String(right.name))
	))
}

// One pass over Business Types and their categories; inactive categories are flagged so callers can hide them from new selections.
export async function listMasterCategoryFilterOptions() {
	const businessTypes = await listBusinessTypes()
	const groups = await Promise.all(businessTypes.map(async (businessType) => ({
		businessType,
		categories: await listBusinessCategories(businessType.id),
	})))
	const categories = groups.flatMap(({ businessType, categories: businessCategories }) => businessCategories.map((category) => ({
		businessTypeId: businessType.id,
		businessTypeName: businessType.name || businessType.id,
		categoryId: category.id,
		name: category.name || category.id,
		active: category.active === true,
	})))
	return { businessTypes, categories }
}

export async function listBusinessCategoryOptions() {
	const { categories } = await listMasterCategoryFilterOptions()
	return categories
}

export async function createMasterCategory(values) {
	await assertSuperAdmin()
	const fields = validateFields({ ...values, active: values.active ?? true })
	const parentId = values.parentId || null
	const refs = normalizeRefs(values.businessCategoryRefs ?? [])
	const imageBlob = values.imageBlob || null
	const parent = await resolveParent(parentId)
	await validateNewRefs(refs)
	if (await findDuplicateName(fields.name, parentId)) {
		throw serviceError('duplicate-name', 'A Master Category with this name already exists under the same parent.')
	}
	if (parent && fields.active && parent.active !== true) {
		throw serviceError('inactive-parent', 'Activate the parent category before creating an active child.')
	}
	if (imageBlob && !refs.length) {
		throw serviceError('logo-mapping-required', 'Select at least one Business Category mapping before saving this image. The image must be stored under a mapped Business Type and Business Category.')
	}

	// Document ID is the code; never let Firestore auto-generate one.
	const reference = doc(collectionRef, fields.code)
	if ((await getDoc(reference)).exists()) throw serviceError('duplicate-code', 'A Master Category with this code already exists.')
	const uploadResult = imageBlob
		? await uploadLogoMappings({ refs, code: fields.code, blob: imageBlob, extension: values.imageExtension })
		: { logoRefs: [], uploadedPaths: [], backups: new Map() }
	try {
		await runTransaction(db, async (transaction) => {
			const existing = await transaction.get(reference)
			if (existing.exists()) throw serviceError('duplicate-code', 'A Master Category with this code already exists.')
			const timestamp = serverTimestamp()
			const data = {
				name: fields.name,
				code: fields.code,
				parentId,
				level: parent ? parent.level + 1 : 1,
				businessCategoryRefs: refs,
				sortOrder: fields.sortOrder,
				active: fields.active,
				createdAt: timestamp,
				updatedAt: timestamp,
			}
			if (uploadResult.logoRefs.length) Object.assign(data, {
				logoUrl: uploadResult.logoRefs[0].logoUrl,
				logoPath: uploadResult.logoRefs[0].logoPath,
				logoRefs: uploadResult.logoRefs,
			})
			transaction.set(reference, data)
		})
	} catch (error) {
		const rollbackErrors = await rollbackLogoUploads(uploadResult.uploadedPaths, uploadResult.backups)
		throw rollbackError(error, rollbackErrors)
	}
	return reference.id
}

export async function updateMasterCategory(id, values) {
	await assertSuperAdmin()
	if (!id) throw serviceError('missing', 'This Master Category could not be found.')
	const reference = doc(collectionRef, id)
	const snapshot = await getDoc(reference)
	if (!snapshot.exists()) throw serviceError('missing', 'This Master Category no longer exists.')
	const current = normalizeMasterCategory(snapshot)

	// Code and Document ID stay immutable; the stored code is always used.
	const fields = validateFields({ ...values, code: current.code })
	const parentId = values.parentId || null
	const refs = normalizeRefs(values.businessCategoryRefs ?? [])
	const oldLogoRefs = current.logoRefs.filter((item) => item?.logoPath)
	if (current.logoPath && !oldLogoRefs.some((item) => item.logoPath === current.logoPath)) {
		oldLogoRefs.push({ logoPath: current.logoPath, logoUrl: current.logoUrl || '' })
	}
	const parent = await resolveParent(parentId, id)
	await validateNewRefs(refs, current.businessCategoryRefs)
	if (await findDuplicateName(fields.name, parentId, id)) {
		throw serviceError('duplicate-name', 'A Master Category with this name already exists under the same parent.')
	}

	const level = parent ? parent.level + 1 : 1
	if (parentId !== current.parentId || level !== current.level) {
		const children = await getDocs(query(collectionRef, where('parentId', '==', id)))
		if (!children.empty) {
			throw serviceError('has-children', 'This category has child categories, so its parent cannot be changed.')
		}
	}
	if (parent && fields.active && parent.active !== true && current.active !== true) {
		throw serviceError('inactive-parent', 'Activate the parent category before activating this child.')
	}

	let uploadResult = { logoRefs: oldLogoRefs, uploadedPaths: [], backups: new Map() }
	let imageFields = {}
	if (values.removeLogo) {
		uploadResult.logoRefs = []
		imageFields = logoFields([])
	} else if (values.imageBlob) {
		uploadResult = await uploadLogoMappings({
			refs,
			code: current.code,
			blob: values.imageBlob,
			extension: values.imageExtension,
			existingLogoRefs: oldLogoRefs,
		})
		imageFields = logoFields(uploadResult.logoRefs)
	} else if (oldLogoRefs.length) {
		if (!refs.length) {
			throw serviceError('logo-mapping-required', 'This category has an image but no Business Category mapping. Add a mapping or explicitly remove the image before saving.')
		}
		const extension = extensionFromPath(current.logoPath || oldLogoRefs[0].logoPath)
		if (!extension) throw serviceError('invalid-logo-path', 'The current image path has an unsupported format. Replace the image before changing its mappings.')
		uploadResult = await uploadLogoMappings({ refs, code: current.code, extension, existingLogoRefs: oldLogoRefs })
		imageFields = logoFields(uploadResult.logoRefs)
	} else if (current.logoUrl && refs.length) {
		throw serviceError('legacy-logo-path', 'Replace this legacy image before assigning Business Category mappings so it can be stored under the required hierarchy.')
	}

	try {
		await updateDoc(reference, {
		name: fields.name,
		parentId,
		level,
		businessCategoryRefs: refs,
		sortOrder: fields.sortOrder,
		active: fields.active,
		updatedAt: serverTimestamp(),
		...imageFields,
		})
	} catch (error) {
		const rollbackErrors = await rollbackLogoUploads(uploadResult.uploadedPaths, uploadResult.backups)
		throw rollbackError(error, rollbackErrors)
	}
	let cleanupErrors = []
	try {
		cleanupErrors = await cleanupObsoleteLogoPaths(oldLogoRefs, uploadResult.logoRefs)
	} catch (error) {
		cleanupErrors = [error]
	}
	return { cleanupErrors }
}

export async function setMasterCategoryActive(id, active) {
	await assertSuperAdmin()
	if (typeof active !== 'boolean') throw serviceError('invalid-active', 'Category active status must be true or false.')
	const reference = doc(collectionRef, id)
	const snapshot = await getDoc(reference)
	if (!snapshot.exists()) throw serviceError('missing', 'This Master Category no longer exists.')
	const current = normalizeMasterCategory(snapshot)
	if (active && current.parentId) {
		const parentSnapshot = await getDoc(doc(collectionRef, current.parentId))
		if (!parentSnapshot.exists() || parentSnapshot.data().active !== true) {
			throw serviceError('inactive-parent', 'Activate the parent category before activating this child.')
		}
	}
	await updateDoc(reference, { active, updatedAt: serverTimestamp() })
}

const masterCategoryService = {
	createMasterCategory,
	generateMasterCategoryCode,
	listBusinessCategoryOptions,
	listMasterCategoryFilterOptions,
	listMasterCategories,
	setMasterCategoryActive,
	updateMasterCategory,
}

export default masterCategoryService
