import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore'
import { db } from '../firebase'

export function getUserSnapshot(uid) {
  return getDoc(doc(db, 'users', uid))
}

export function updateMerchantAccess(uid, updates) {
  const userRef = doc(db, 'users', uid)
  const mergeFields = Object.keys(updates).map((field) => `platformRoles.${field}`)
  return setDoc(userRef, { platformRoles: updates }, { mergeFields })
}

export async function hasAnotherUserWithEmail(emailValues, uid) {
  for (const email of emailValues) {
    const matches = await getDocs(query(collection(db, 'users'), where('email', '==', email), limit(5)))
    if (matches.docs.some((match) => match.id !== uid)) return true
  }

  return false
}

export function updateCustomerAccess(uid, updates) {
  const customerRef = doc(db, 'users', uid)
  const mergeFields = ['platformRoles.dukanSetu', ...Object.keys(updates).filter((field) => field !== 'platformRoles')]
  return setDoc(customerRef, updates, { mergeFields })
}