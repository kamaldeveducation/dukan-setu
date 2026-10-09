import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { getBusinessType } from './businessTypeService'

export function getStoreSnapshot(storeId) {
	return getDoc(doc(db, 'stores', storeId))
}

export async function getStoresByOwnerUid(uid) {
	const snapshot = await getDocs(query(collection(db, 'stores'), where('ownerUid', '==', uid)))
	return snapshot.docs.map((storeDoc) => ({ id: storeDoc.id, ...storeDoc.data() }))
}

function applicationFields(business, owner) {
	return {
		storeName: business.businessName.trim(),
		businessType: business.businessType,
		businessCategory: business.businessCategory,
		ownerName: owner.ownerName.trim(),
		ownerMobile: owner.ownerMobile.trim(),
		ownerEmail: owner.ownerEmail.trim(),
		businessMobile: business.businessMobile.trim(),
		businessEmail: business.businessEmail.trim(),
		address: business.address.trim(),
		city: business.city.trim(),
		state: business.state.trim(),
		pincode: business.pincode.trim(),
	}
}

export async function resubmitStoreApplication(ownerUid, storeId, business, owner) {
	const storeRef = doc(db, 'stores', storeId)
	const snapshot = await getDoc(storeRef)

	if (!snapshot.exists() || snapshot.data().ownerUid !== ownerUid || snapshot.data().status !== 'rejected') {
		throw new Error('This application can no longer be resubmitted.')
	}

	const updates = { ...applicationFields(business, owner), status: 'pending', resubmittedAt: serverTimestamp() }
	const batch = writeBatch(db)
	batch.update(storeRef, updates)
	batch.set(doc(db, 'users', ownerUid), { dukanSetuMerchantStatus: 'pending' }, { mergeFields: ['dukanSetuMerchantStatus'] })
	await batch.commit()

	return { ...snapshot.data(), ...updates }
}

export async function createStoreRegistration(ownerUid, business, owner) {
	const existingUserSnapshot = await getDoc(doc(db, 'users', ownerUid))
	const existingUser = existingUserSnapshot.exists() ? existingUserSnapshot.data() : {}
	const existingPlatformRole = existingUser.platformRoles?.dukanSetu

	if (existingPlatformRole && !['customer', 'merchant'].includes(existingPlatformRole)) {
		throw new Error('This Dukan Setu account already has a different platform role.')
	}
	if (existingUser.dukanSetuStoreId) {
		throw new Error('A store application already exists for this account.')
	}

	const businessType = getBusinessType(business.businessType)
	const generatedDocument = doc(collection(db, 'stores'))
	const storeId = `${businessType?.idPrefix ?? 'STO'}${generatedDocument.id.toUpperCase()}`
	const storeRef = doc(db, 'stores', storeId)
	const userRef = doc(db, 'users', ownerUid)
	const store = {
		storeId,
		...applicationFields(business, owner),
		ownerUid,
		status: 'pending',
		createdAt: serverTimestamp(),
	}
	const batch = writeBatch(db)

	batch.set(storeRef, store)
	const userUpdates = {
		dukanSetuStoreId: storeId,
		dukanSetuMerchantStatus: 'pending',
	}
	const userMergeFields = ['dukanSetuStoreId', 'dukanSetuMerchantStatus']
	if (!existingPlatformRole) {
		userUpdates.platformRoles = { dukanSetu: 'merchant' }
		userMergeFields.push('platformRoles.dukanSetu')
	}
	batch.set(userRef, userUpdates, { mergeFields: userMergeFields })
	await batch.commit()

	return store
}

const storeService = { createStoreRegistration, getStoreSnapshot, getStoresByOwnerUid, resubmitStoreApplication }

export default storeService