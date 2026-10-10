import { getStoreSnapshot, getStoresByOwnerUid } from './storeService'
import { getUserSnapshotFromServer } from './userService'

export function resolveCapabilities(userData, stores = []) {
  const platformRole = userData?.platformRoles?.dukanSetu
  const hasLegacyMerchant = platformRole === 'merchant' || Boolean(userData?.dukanSetuStoreId)

  return {
    isCustomer: userData?.dukanSetuCustomer === true || platformRole === 'customer' || userData?.role === 'customer',
    isMerchant: stores.length > 0 || hasLegacyMerchant,
    isSuperAdmin: platformRole === 'superAdmin',
    stores,
  }
}

export async function getCapabilities(uid) {
  const userSnapshot = await getUserSnapshotFromServer(uid)
  const userData = userSnapshot.exists() ? userSnapshot.data() : null
  let stores = []

  try {
    stores = await getStoresByOwnerUid(uid)
  } catch {
    // Rules may not allow owner queries yet; the legacy pointer below still works.
  }

  if (!stores.length && userData?.dukanSetuStoreId) {
    try {
      const legacyStore = await getStoreSnapshot(userData.dukanSetuStoreId)
      if (legacyStore.exists() && legacyStore.data().ownerUid === uid) {
        stores = [{ id: legacyStore.id, ...legacyStore.data() }]
      }
    } catch {
      // The legacy store is optional; isMerchant still reflects the user document.
    }
  }

  return resolveCapabilities(userData, stores)
}
