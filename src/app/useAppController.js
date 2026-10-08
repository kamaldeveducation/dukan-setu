import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import {
  getEmailSignInMethods,
  hasPasswordProvider,
  linkPasswordToCurrentUser,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutCurrentUser,
} from '../auth/authService'
import { getUserSnapshot, hasAnotherUserWithEmail, updateCustomerAccess } from '../services/userService'
import { getStoreSnapshot } from '../services/storeService'

const workspacePaths = {
  superAdmin: '/admin',
  merchant: '/merchant',
  customer: '/customer',
}

function setAppPath(path, replace = true) {
  if (window.location.pathname !== path) {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
  }
}

export default function useAppController() {
  const [currentUser, setCurrentUser] = useState(null)
  const [platformRole, setPlatformRole] = useState(null)
  const [merchantStore, setMerchantStore] = useState(null)
  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const [authChecking, setAuthChecking] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [customerAccount, setCustomerAccount] = useState(null)
  const [customerCheckVersion, setCustomerCheckVersion] = useState(0)
  const [customerSaving, setCustomerSaving] = useState(false)
  const [customerError, setCustomerError] = useState('')
  const customerRegistrationInProgress = useRef(false)
  const [passwordResetError, setPasswordResetError] = useState('')
  const [passwordResetMessage, setPasswordResetMessage] = useState('')
  const [passwordResetSaving, setPasswordResetSaving] = useState(false)
  const [activePage, setActivePage] = useState('Dashboard')
  const [drawerOpen, setDrawerOpen] = useState(false)

  function navigateTo(path, replace = false) {
    setAppPath(path, replace)
    setCurrentPath(path)
    setCustomerAccount(null)
    setCustomerError('')
  }

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        if (active) {
          setCurrentUser(null)
          setPlatformRole(null)
          setMerchantStore(null)
          const isPublicStoreRoute = /^\/store\/[^/]+\/?$/.test(window.location.pathname)
          if (!['/register/customer', '/register/store'].includes(window.location.pathname) && !isPublicStoreRoute) {
            setAppPath('/login')
            setCurrentPath('/login')
          }
          setAuthChecking(false)
        }
        return
      }

      setAuthChecking(true)

      try {
        const userSnapshot = await getUserSnapshot(firebaseUser.uid)
        if (!active || auth.currentUser?.uid !== firebaseUser.uid) return

        const userData = userSnapshot.exists() ? userSnapshot.data() : null
        const role = userData?.platformRoles?.dukanSetu
        const isCustomerRegistration = window.location.pathname === '/register/customer'
        const pendingRegistrationReturn = sessionStorage.getItem('dukanSetuAuthReturn') === '/register/store'
        const isStoreRegistration = window.location.pathname === '/register/store' || pendingRegistrationReturn
        let registeredStore = null

        if (role === 'merchant' && userData?.dukanSetuStoreId) {
          try {
            const storeSnapshot = await getStoreSnapshot(userData.dukanSetuStoreId)
            if (storeSnapshot.exists()) registeredStore = storeSnapshot.data()
          } catch {}
        }
        if (!active || auth.currentUser?.uid !== firebaseUser.uid) return

        if (pendingRegistrationReturn) {
          sessionStorage.removeItem('dukanSetuAuthReturn')
          setAppPath('/register/store')
          setCurrentPath('/register/store')
        }

        if (/^\/store\/[^/]+\/?$/.test(window.location.pathname)) {
          setCurrentUser(firebaseUser)
          setPlatformRole(Object.hasOwn(workspacePaths, role) ? role : null)
          setMerchantStore(registeredStore)
          setErrorMessage('')
          return
        }

        if (role === 'customer') {
          setCurrentUser(firebaseUser)
          setPlatformRole('customer')
          setMerchantStore(null)
          setAppPath('/customer')
          setCurrentPath('/customer')
          setCustomerAccount(null)
          setErrorMessage('')
          return
        }

        if (isCustomerRegistration || isStoreRegistration) {
          setCurrentUser(firebaseUser)
          setMerchantStore(registeredStore)
          setPlatformRole(Object.hasOwn(workspacePaths, role) ? role : null)
          setErrorMessage('')
          return
        }

        if (Object.hasOwn(workspacePaths, role)) {
          setCurrentUser(firebaseUser)
          setPlatformRole(role)
          setMerchantStore(registeredStore)
          setAppPath(workspacePaths[role])
          setErrorMessage('')
        } else if (userData?.role === 'customer') {
          setCurrentUser(firebaseUser)
          setPlatformRole(null)
          setMerchantStore(null)
          setAppPath('/register/customer')
          setCurrentPath('/register/customer')
          setErrorMessage('')
        } else {
          if (isStoreRegistration) {
            setCurrentUser(firebaseUser)
            setPlatformRole(null)
            setMerchantStore(null)
            setErrorMessage('')
            return
          }
          setCurrentUser(null)
          setPlatformRole(null)
          setMerchantStore(null)
          setAppPath('/login')
          setCurrentPath('/login')
          setErrorMessage('Your account is not registered for Dukan Setu yet.')
          try {
            await signOutCurrentUser()
          } catch {}
        }
      } catch {
        if (active && auth.currentUser?.uid === firebaseUser.uid) {
          if (['/register/customer', '/register/store'].includes(window.location.pathname)) {
            setCurrentUser(firebaseUser)
            setPlatformRole(null)
            setMerchantStore(null)
          } else {
            setCurrentUser(null)
            setPlatformRole(null)
            setAppPath('/login')
            setCurrentPath('/login')
            setErrorMessage('We could not verify your Dukan Setu access. Please sign in again.')
            try {
              await signOutCurrentUser()
            } catch {}
          }
        }
      } finally {
        if (active) setAuthChecking(false)
      }
    }, () => {
      if (active) {
        setCurrentUser(null)
        setPlatformRole(null)
        setMerchantStore(null)
        setAppPath('/login')
        setAuthChecking(false)
        setErrorMessage('We could not verify your Firebase sign-in state. Please refresh and try again.')
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (currentPath !== '/register/customer') return

    const firebaseUser = auth.currentUser
    if (!firebaseUser) return

    let active = true

    async function detectCustomerAccount() {
      try {
        const userSnapshot = await getUserSnapshot(firebaseUser.uid)
        if (!active || auth.currentUser?.uid !== firebaseUser.uid) return

        const userData = userSnapshot.exists() ? userSnapshot.data() : null
        if (userData?.platformRoles?.dukanSetu === 'customer') {
          setCurrentUser(firebaseUser)
          setPlatformRole('customer')
          navigateTo('/customer', true)
          return
        }

        const profileData = userData || {}
        const profile = {
          name: profileData.name || profileData.fullName || profileData.displayName || firebaseUser.displayName || '',
          mobile: profileData.mobile || profileData.phone || profileData.phoneNumber || '',
          email: profileData.email || firebaseUser.email || '',
          address: profileData.address || '',
        }
        if (userData?.platformRoles?.dukanSetu && userData.platformRoles.dukanSetu !== 'customer') {
          setCustomerAccount({
            uid: firebaseUser.uid,
            status: 'ineligible',
            existingRole: userData.role || userData.platformRoles.dukanSetu,
            userData,
            profile,
          })
          return
        }
        if (userData && userData.role !== 'customer' && userData.platformRoles?.dukanSetu !== 'customer') {
          setCustomerAccount({
            uid: firebaseUser.uid,
            status: 'ineligible',
            existingRole: userData.role || 'Not assigned',
            userData,
            profile,
          })
          return
        }

        if (!userData) {
          if (!firebaseUser.email) {
            setCustomerAccount({ uid: firebaseUser.uid, status: 'email-check-error' })
            return
          }

          const emailValues = [...new Set([firebaseUser.email, firebaseUser.email.toLowerCase()])]
          let matchingUser = false
          try {
            matchingUser = await hasAnotherUserWithEmail(emailValues, firebaseUser.uid)
          } catch {
            if (active) setCustomerAccount({ uid: firebaseUser.uid, status: 'email-check-error' })
            return
          }

          if (!active || auth.currentUser?.uid !== firebaseUser.uid) return
          if (matchingUser) {
            await signOutCurrentUser()
            if (active) setCustomerAccount({ uid: null, status: 'email-conflict' })
            return
          }
        }

        setCustomerAccount({
          uid: firebaseUser.uid,
          status: 'ready',
          isExisting: Boolean(userData),
          userData,
          profile,
        })
      } catch {
        if (active) setCustomerAccount({ uid: firebaseUser.uid, status: 'error' })
      }
    }

    detectCustomerAccount()

    return () => {
      active = false
    }
  }, [currentPath, currentUser?.uid, customerCheckVersion])

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setSigningIn(true)

    const formData = new FormData(event.currentTarget)
    const email = formData.get('email').trim()

    try {
      await signInWithEmail(email, formData.get('password'))
    } catch (error) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
        try {
          const methods = await getEmailSignInMethods(email)
          if (methods.includes('google.com') && !methods.includes('password')) {
            setErrorMessage('Password login is not enabled for this account yet. Please sign in with Google or create a password from your account.')
          } else {
            setErrorMessage('That email and password combination was not recognized. If this is a Google-only account, sign in with Google or create a password from your account.')
          }
        } catch {
          setErrorMessage('That email and password combination was not recognized. If this is a Google-only account, sign in with Google or create a password from your account.')
        }
      } else if (error.code === 'auth/too-many-requests') {
        setErrorMessage('Too many attempts. Please wait a moment and try again.')
      } else if (error.code === 'auth/network-request-failed') {
        setErrorMessage('We could not connect to sign you in. Check your connection and try again.')
      } else {
        setErrorMessage('We could not sign you in. Check your connection and try again.')
      }
    } finally {
      setSigningIn(false)
    }
  }

  async function handleGoogleSignIn() {
    setCustomerError('')
    setSigningIn(true)

    try {
      await signInWithGoogle()
      return true
    } catch (error) {
      if (error.code === 'auth/account-exists-with-different-credential') {
        setCustomerError('This email already uses another sign-in method. Go to Sign In with that account before linking Google.')
      } else if (error.code === 'auth/popup-closed-by-user') {
        setCustomerError('Google sign-in was cancelled. You can try again when ready.')
      } else if (error.code === 'auth/operation-not-allowed') {
        setCustomerError('Google sign-in is not enabled for this Firebase project yet.')
      } else {
        setCustomerError('We could not sign you in with Google. Please try again.')
      }
      return false
    } finally {
      setSigningIn(false)
    }
  }

  function handleMerchantRegistration(store) {
    setCurrentUser(auth.currentUser)
    setPlatformRole('merchant')
    setMerchantStore(store)
  }

  async function handleLogout() {
    setCurrentUser(null)
    setPlatformRole(null)
    setAuthChecking(true)
    setErrorMessage('')
    setAppPath('/login')
    setCurrentPath('/login')

    try {
      await signOutCurrentUser()
    } catch {
      setAuthChecking(false)
      setErrorMessage('We could not sign you out of Firebase. The dashboard remains locked.')
    }
  }

  async function handleCustomerRegistration(event) {
    event.preventDefault()
    if (
      customerRegistrationInProgress.current
      || customerAccount?.status !== 'ready'
      || !auth.currentUser
      || auth.currentUser.uid !== customerAccount.uid
    ) return

    if (platformRole === 'customer') {
      navigateTo('/customer', true)
      return
    }

    setCustomerError('')
    const formData = new FormData(event.currentTarget)
    const password = formData.get('password')?.toString() || ''
    const confirmPassword = formData.get('confirmPassword')?.toString() || ''
    const needsPassword = !hasPasswordProvider(auth.currentUser)
    const { userData, profile } = customerAccount
    const updates = { platformRoles: { dukanSetu: 'customer' } }
    const hasValue = (...values) => values.some((value) => typeof value === 'string' && value.trim())

    if (needsPassword && !password) {
      setCustomerError('Please create a password to continue.')
      return
    }
    if (needsPassword && !confirmPassword) {
      setCustomerError('Please confirm your password.')
      return
    }
    if (needsPassword && password !== confirmPassword) {
      setCustomerError('Passwords do not match.')
      return
    }
    if (needsPassword && password.length < 8) {
      setCustomerError('Use a password with at least 8 characters.')
      return
    }
    if (userData?.role !== 'customer') {
      const missingProfileFields = [
        ['name', 'full name', profile.name],
        ['mobile', 'mobile number', profile.mobile],
        ['address', 'address', profile.address],
      ]
      const missingField = missingProfileFields.find(([field, , value]) => (
        !hasValue(value, formData.get(field)?.toString())
      ))
      if (missingField) {
        setCustomerError(`Please enter your ${missingField[1]} to continue.`)
        return
      }
    }

    customerRegistrationInProgress.current = true
    setCustomerSaving(true)

    if (userData?.role !== 'customer') {
      if (!hasValue(userData?.name, userData?.fullName, userData?.displayName)) {
        updates.name = profile.name || formData.get('name')?.toString().trim()
      }
      if (!hasValue(userData?.mobile, userData?.phone, userData?.phoneNumber)) {
        updates.mobile = profile.mobile || formData.get('mobile')?.toString().trim()
      }
      if (!hasValue(userData?.email)) updates.email = profile.email || auth.currentUser.email
      if (!hasValue(userData?.address)) updates.address = profile.address || formData.get('address')?.toString().trim()

      for (const field of ['name', 'mobile', 'email', 'address']) {
        if (!hasValue(updates[field])) delete updates[field]
      }
    }

    try {
      if (needsPassword) {
        const result = await linkPasswordToCurrentUser(password)
        if (result.user.uid !== customerAccount.uid) {
          setCustomerError('We could not verify your existing account. No new account was created.')
          return
        }
        setCurrentUser(result.user)
      }

      await updateCustomerAccess(customerAccount.uid, updates)
      setCurrentUser(auth.currentUser)
      setPlatformRole('customer')
      navigateTo('/customer', true)
    } catch (error) {
      if (error.code === 'auth/credential-already-in-use' || error.code === 'auth/email-already-in-use') {
        setCustomerError('This email is already linked to another Firebase account. Sign in to that account to continue.')
      } else if (error.code === 'auth/provider-already-linked') {
        try {
          await updateCustomerAccess(auth.currentUser.uid, updates)
          setCurrentUser(auth.currentUser)
          setPlatformRole('customer')
          navigateTo('/customer', true)
        } catch {
          setCustomerError('Your password is already enabled, but we could not finish customer access. Please try again.')
        }
      } else if (error.code === 'auth/weak-password') {
        setCustomerError('Use a password with at least 8 characters.')
      } else if (error.code === 'auth/popup-closed-by-user') {
        setCustomerError('Google verification was cancelled. Try again when ready.')
      } else if (error.code === 'auth/network-request-failed') {
        setCustomerError('We could not connect to set up your account. Check your connection and try again.')
      } else if (error.code === 'auth/missing-email') {
        setCustomerError('This Google account does not have an email address available for password sign-in.')
      } else {
        setCustomerError('We could not set up your account. Please try again.')
      }
    } finally {
      customerRegistrationInProgress.current = false
      setCustomerSaving(false)
    }
  }

  async function handlePasswordReset(email) {
    setPasswordResetError('')
    setPasswordResetMessage('')
    setPasswordResetSaving(true)

    try {
      await sendPasswordReset(email.trim())
      setPasswordResetMessage('Password reset link sent. Please check your email.')
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        setPasswordResetError('No account was found for that email address.')
      } else if (error.code === 'auth/invalid-email') {
        setPasswordResetError('Enter a valid email address and try again.')
      } else if (error.code === 'auth/too-many-requests') {
        setPasswordResetError('Too many reset requests. Please wait a moment and try again.')
      } else if (error.code === 'auth/network-request-failed') {
        setPasswordResetError('We could not send the reset link. Check your connection and try again.')
      } else {
        setPasswordResetError('We could not send the reset link. Please try again.')
      }
    } finally {
      setPasswordResetSaving(false)
    }
  }

  function returnFromCustomerRegistration() {
    if (platformRole && workspacePaths[platformRole]) {
      navigateTo(workspacePaths[platformRole], true)
      return
    }

    handleLogout()
  }

  return {
    currentUser,
    platformRole,
    merchantStore,
    currentPath,
    authChecking,
    signingIn,
    errorMessage,
    customerAccount,
    customerCheckVersion,
    customerSaving,
    customerError,
    passwordResetError,
    passwordResetMessage,
    passwordResetSaving,
    activePage,
    setActivePage,
    drawerOpen,
    setDrawerOpen,
    navigateTo,
    setCustomerCheckVersion,
    handleSubmit,
    handleGoogleSignIn,
    handleLogout,
    handleCustomerRegistration,
    handleMerchantRegistration,
    handlePasswordReset,
    returnFromCustomerRegistration,
  }
}