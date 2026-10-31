// Storage path policy for Master Product image fields, keyed by Field Key.
// An image field can only be uploaded when it has an entry here; other image keys are rejected with a validation message.
const IMAGE_FIELD_POLICIES = {
  product_photo: { baseName: 'product-photo' },
}

export const MASTER_PRODUCTS_STORAGE_ROOT = 'master_products'

export function getImageFieldPolicy(fieldKey) {
  return Object.hasOwn(IMAGE_FIELD_POLICIES, fieldKey) ? IMAGE_FIELD_POLICIES[fieldKey] : null
}

// The first image keeps the base name; later images are numbered (product-photo-2.webp, ...).
export function buildImageFileName(policy, index, extension) {
  const name = index === 0 ? policy.baseName : `${policy.baseName}-${index + 1}`
  return `${name}.${extension}`
}

// Only selected hierarchy levels become folders. Document IDs are used because they never change, unlike display names.
export function buildImageStoragePath({ selection, productId, fieldKey, index, extension }) {
  const policy = getImageFieldPolicy(fieldKey)
  if (!policy) throw new Error(`Image field "${fieldKey}" has no storage path policy.`)
  const folders = [selection.businessTypeId, selection.businessCategoryId, selection.masterCategoryId]
  if (selection.subCategoryId) folders.push(selection.subCategoryId)
  if (selection.subSubCategoryId) folders.push(selection.subSubCategoryId)
  return [MASTER_PRODUCTS_STORAGE_ROOT, ...folders, productId, buildImageFileName(policy, index, extension)].join('/')
}
