const businessTypes = [
	{ id: 'retail', name: 'Retail Store', idPrefix: 'RET', categories: ['General Retail', 'Clothing', 'Household'] },
	{ id: 'kirana', name: 'Kirana / Grocery', idPrefix: 'KIR', categories: ['Grocery', 'General Store', 'Supermarket'] },
	{ id: 'medical', name: 'Medical', idPrefix: 'MED', categories: ['Pharmacy', 'Medical Store'] },
	{ id: 'bakery', name: 'Bakery', idPrefix: 'BAK', categories: ['Bakery', 'Cake Shop'] },
	{ id: 'electronics', name: 'Electronics', idPrefix: 'ELC', categories: ['Electronics Store', 'Mobile Store'] },
	{ id: 'garments', name: 'Garments', idPrefix: 'GAR', categories: ['Garments', 'Boutique'] },
	{ id: 'professional-services', name: 'Professional Services', idPrefix: 'SER', categories: ['Consulting', 'Repair Services'] },
	{ id: 'other', name: 'Other', idPrefix: 'OTH', categories: ['Other'] },
]

export function getBusinessTypes() {
	return businessTypes
}

export function getBusinessCategories(businessTypeId) {
	return businessTypes.find((type) => type.id === businessTypeId)?.categories ?? []
}

export function getBusinessType(businessTypeId) {
	return businessTypes.find((type) => type.id === businessTypeId) ?? null
}

const businessTypeService = { getBusinessTypes, getBusinessCategories, getBusinessType }

export default businessTypeService