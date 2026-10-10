import {
  EmailAuthProvider,
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
} from 'firebase/auth'
import { auth } from '../firebase'

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

export function signInWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider())
}

export function signOutCurrentUser() {
  return signOut(auth)
}

export function hasPasswordProvider(user) {
  return user?.providerData.some((provider) => provider.providerId === 'password') ?? false
}

function getCurrentUser() {
  if (!auth.currentUser) {
    const error = new Error('No authenticated user is available.')
    error.code = 'auth/no-current-user'
    throw error
  }

  return auth.currentUser
}

export async function refreshCurrentUser() {
  const user = getCurrentUser()
  await reload(user)
  return getCurrentUser()
}

async function reauthenticateWithGoogle(user) {
  const result = await reauthenticateWithPopup(user, new GoogleAuthProvider())
  return result.user
}

function ensureSameUser(result, expectedUid) {
  if (result.user.uid !== expectedUid) {
    const error = new Error('The linked credential did not match the current account.')
    error.code = 'auth/uid-mismatch'
    throw error
  }

  return result
}

export async function linkPasswordToCurrentUser(password) {
  let user = await refreshCurrentUser()
  if (!user.email) {
    const error = new Error('The authenticated account has no email address.')
    error.code = 'auth/missing-email'
    throw error
  }
  if (!user.emailVerified) {
    const error = new Error('The authenticated account email must be verified before password sign-in can be enabled.')
    error.code = 'auth/unverified-email'
    throw error
  }
  if (hasPasswordProvider(user)) {
    const error = new Error('Password sign-in is already enabled.')
    error.code = 'auth/provider-already-linked'
    throw error
  }

  const originalUid = user.uid
  const credential = EmailAuthProvider.credential(user.email, password)
  let result
  try {
    result = ensureSameUser(await linkWithCredential(user, credential), originalUid)
  } catch (error) {
    if (error.code !== 'auth/requires-recent-login') throw error
    user = await reauthenticateWithGoogle(user)
    result = ensureSameUser(await linkWithCredential(user, credential), originalUid)
  }

  if (!hasPasswordProvider(result.user)) {
    const error = new Error('We could not confirm your password was saved. Please try again.')
    error.code = 'auth/link-not-confirmed'
    throw error
  }

  return result
}

export async function changePasswordForCurrentUser(password, currentPassword) {
  let user = getCurrentUser()
  if (!hasPasswordProvider(user)) {
    const error = new Error('Password sign-in is not enabled.')
    error.code = 'auth/provider-not-linked'
    throw error
  }

  try {
    await updatePassword(user, password)
    return user
  } catch (error) {
    if (error.code !== 'auth/requires-recent-login') throw error
    const hasGoogleProvider = user.providerData.some((provider) => provider.providerId === 'google.com')
    if (hasGoogleProvider) {
      user = await reauthenticateWithGoogle(user)
    } else if (user.email && currentPassword) {
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      const result = await reauthenticateWithCredential(user, credential)
      user = result.user
    } else {
      throw error
    }
    await updatePassword(user, password)
    return user
  }
}

export function sendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email)
}

export function getEmailSignInMethods(email) {
  return fetchSignInMethodsForEmail(auth, email)
}