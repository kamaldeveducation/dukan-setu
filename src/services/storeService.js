import { collection, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { getBusinessType } from './businessTypeService'

export function getStoreSnapshot(storeId) {
	return getDoc(doc(db, 'stores', storeId))
}

export async function createStoreRegistration(ownerUid, business, owner) {
	const existingUserSnapshot = await getDoc(doc(db, 'users', ownerUid))
	const existingUser = existingUserSnapshot.exists() ? existingUserSnapshot.data() : {}
	const existingPlatformRole = existingUser.platformRoles?.dukanSetu

	if (existingPlatformRole && existingPlatformRole !== 'merchant') {
		throw new Error('This Dukan Setu account already has a different platform role.')
	}

	const businessType = getBusinessType(business.businessType)
	const generatedDocument = doc(collection(db, 'stores'))
	const storeId = `${businessType?.idPrefix ?? 'STO'}${generatedDocument.id.toUpperCase()}`
	const storeRef = doc(db, 'stores', storeId)
	const userRef = doc(db, 'users', ownerUid)
	const store = {
		storeId,
		storeName: business.businessName.trim(),
		businessType: business.businessType,
		businessCategory: business.businessCategory,
		ownerUid,
		ownerName: owner.ownerName.trim(),
		ownerMobile: owner.ownerMobile.trim(),
		ownerEmail: owner.ownerEmail.trim(),
		address: business.address.trim(),
		city: business.city.trim(),
		state: business.state.trim(),
		pincode: business.pincode.trim(),
		status: 'pending',
		createdAt: serverTimestamp(),
	}
	const batch = writeBatch(db)

	batch.set(storeRef, store)
	batch.set(userRef, {
		platformRoles: { dukanSetu: 'merchant' },
		dukanSetuStoreId: storeId,
		dukanSetuMerchantStatus: 'pending',
	}, { mergeFields: ['platformRoles.dukanSetu', 'dukanSetuStoreId', 'dukanSetuMerchantStatus'] })
	await batch.commit()

	return store
}

const storeService = { createStoreRegistration, getStoreSnapshot }

export default storeService