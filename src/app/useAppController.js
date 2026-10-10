import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import {
  getEmailSignInMethods,
  hasPasswordProvider,
  linkPasswordToCurrentUser,
  refreshCurrentUser,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutCurrentUser,
} from '../auth/authService'
import { getUserSnapshot, hasAnotherUserWithEmail, updateCustomerAccess } from '../services/userService'
import { getCapabilities } from '../services/capabilityService'

const workspacePaths = {
  superAdmin: '/admin',
  merchant: '/merchant',
  customer: '/customer',
}

const LOGIN_INTENT_KEY = 'dukanSetuLoginIntent'
const loginIntents = ['customer', 'merchant']

function readLoginIntent() {
  const stored = sessionStorage.getItem(LOGIN_INTENT_KEY)
  return loginIntents.includes(stored) ? stored : 'customer'
}

function compatibilityRole(capabilities) {
  if (capabilities.isSuperAdmin) return 'superAdmin'
  if (capabilities.isMerchant) return 'merchant'
  if (capabilities.isCustomer) return 'customer'
  return null
}

function pickMerchantStore(stores) {
  for (const status of ['approved', 'pending', 'rejected']) {
    const store = stores.find((item) => item.status === status)
    if (store) return store
  }
  return stores[0] ?? null
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
  const [capabilities, setCapabilities] = useState(null)
  const [loginIntent, setLoginIntentState] = useState(readLoginIntent)
  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const [authChecking, setAuthChecking] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [customerAccount, setCustomerAccount] = useState(null)
  const [customerCheckVersion, setCustomerCheckVersion] = useState(0)
  const [customerSaving, setCustomerSaving] = useState(false)
  const [customerError, setCustomerError] = useState('')
  const customerRegistrationInProgress = useRef(false)
  const loginSubmissionInProgress = useRef(false)
  const [passwordResetError, setPasswordResetError] = useState('')
  const [passwordResetMessage, setPasswordResetMessage] = useState('')
  const [passwordResetSaving, setPasswordResetSaving] = useState(false)
  const [activePage, setActivePage] = useState('Dashboard')
  const [drawerOpen, setDrawerOpen] = useState(false)

  function navigateTo(path, replace = false) {
    if (path === '/customer' || path === '/merchant') setLoginIntent(path.slice(1))
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
          setCapabilities(null)
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
        const nextCapabilities = await getCapabilities(firebaseUser.uid)
        if (!active || auth.currentUser?.uid !== firebaseUser.uid) return

        const pathname = window.location.pathname
        const pendingRegistrationReturn = sessionStorage.getItem('dukanSetuAuthReturn') === '/register/store'
        const isRegistrationRoute = pathname === '/register/customer' || pathname === '/register/store' || pendingRegistrationReturn
        const isPublicStoreRoute = /^\/store\/[^/]+\/?$/.test(pathname)
        const selectedIntent = readLoginIntent()

        const applyCapabilities = () => {
          setCurrentUser(firebaseUser)
          setCapabilities(nextCapabilities)
          setPlatformRole(compatibilityRole(nextCapabilities))
          setMerchantStore(pickMerchantStore(nextCapabilities.stores))
          setErrorMessage('')
        }

        if (pendingRegistrationReturn) {
          sessionStorage.removeItem('dukanSetuAuthReturn')
          setAppPath('/register/store')
          setCurrentPath('/register/store')
        }

        if (isPublicStoreRoute || isRegistrationRoute) {
          applyCapabilities()
          return
        }

        if (nextCapabilities.isSuperAdmin) {
          applyCapabilities()
          setAppPath(workspacePaths.superAdmin)
          setCurrentPath(workspacePaths.superAdmin)
          return
        }

        if (nextCapabilities.isCustomer || nextCapabilities.isMerchant) {
          const workspacePath = selectedIntent === 'merchant' ? workspacePaths.merchant : workspacePaths.customer
          applyCapabilities()
          setCustomerAccount(null)
          setAppPath(workspacePath)
          setCurrentPath(workspacePath)
        } else {
          const workspacePath = selectedIntent === 'merchant' ? workspacePaths.merchant : workspacePaths.customer
          setCurrentUser(firebaseUser)
          setCapabilities(nextCapabilities)
          setPlatformRole(null)
          setMerchantStore(null)
          setAppPath(workspacePath)
          setCurrentPath(workspacePath)
        }
      } catch {
        if (active && auth.currentUser?.uid === firebaseUser.uid) {
          if (['/register/customer', '/register/store'].includes(window.location.pathname)) {
            setCurrentUser(firebaseUser)
            setPlatformRole(null)
            setMerchantStore(null)
            setCapabilities(null)
          } else {
            setCurrentUser(null)
            setPlatformRole(null)
            setCapabilities(null)
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
        setCapabilities(null)
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
        const existingPlatformRole = userData?.platformRoles?.dukanSetu
        const profileData = userData || {}
        const profile = {
          name: profileData.name || profileData.fullName || profileData.displayName || firebaseUser.displayName || '',
          mobile: profileData.mobile || profileData.phone || profileData.phoneNumber || '',
          email: profileData.email || firebaseUser.email || '',
          address: profileData.address || '',
        }

        if (existingPlatformRole === 'superAdmin') {
          setCustomerAccount({
            uid: firebaseUser.uid,
            status: 'ineligible',
            existingRole: 'superAdmin',
            userData,
            profile,
          })
          return
        }

        if (existingPlatformRole === 'customer' || userData?.dukanSetuCustomer === true || userData?.role === 'customer') {
          setCurrentUser(firebaseUser)
          setPlatformRole('customer')
          navigateTo('/customer', true)
          return
        }

        const hasMerchantAccess = existingPlatformRole === 'merchant' || Boolean(userData?.dukanSetuStoreId)
        if ((existingPlatformRole && !hasMerchantAccess) || (userData && userData.role !== 'customer' && !hasMerchantAccess)) {
          setCustomerAccount({
            uid: firebaseUser.uid,
            status: 'ineligible',
            existingRole: userData?.role || existingPlatformRole || 'Not assigned',
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
    if (loginSubmissionInProgress.current) return
    loginSubmissionInProgress.current = true
    setErrorMessage('')
    setSigningIn(true)

    const formData = new FormData(event.currentTarget)
    const email = formData.get('email')?.toString().trim() ?? ''
    const password = formData.get('password')?.toString() ?? ''

    try {
      await signInWithEmail(email, password)
    } catch (error) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
        try {
          const methods = await getEmailSignInMethods(email)
          if (methods.includes('google.com') && !methods.includes('password')) {
            setErrorMessage('Password login is not enabled for this account yet. Sign in with Google, or use "Forgot password?" below to set a new password for this account.')
          } else {
            setErrorMessage('That email and password combination was not recognized. If you signed up with Google, sign in with Google, or use "Forgot password?" below to set a new password.')
          }
        } catch {
          setErrorMessage('That email and password combination was not recognized. If you signed up with Google, sign in with Google, or use "Forgot password?" below to set a new password.')
        }
      } else if (error.code === 'auth/too-many-requests') {
        setErrorMessage('Too many attempts. Please wait a moment and try again.')
      } else if (error.code === 'auth/network-request-failed') {
        setErrorMessage('We could not connect to sign you in. Check your connection and try again.')
      } else if (error.code === 'auth/invalid-email') {
        setErrorMessage('Enter a valid email address and try again.')
      } else if (error.code === 'auth/user-disabled') {
        setErrorMessage('This account is disabled. Contact support for help signing in.')
      } else if (error.code === 'auth/operation-not-allowed') {
        setErrorMessage('Email and password sign-in is not enabled. Contact support for help.')
      } else {
        setErrorMessage('We could not sign you in. Check your connection and try again.')
      }
    } finally {
      loginSubmissionInProgress.current = false
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
    setCapabilities((current) => ({
      isCustomer: current?.isCustomer ?? false,
      isSuperAdmin: current?.isSuperAdmin ?? false,
      isMerchant: true,
      stores: [store, ...(current?.stores ?? []).filter((item) => (item.storeId ?? item.id) !== store.storeId)],
    }))
  }

  function markCustomerCapability() {
    setCapabilities((current) => ({ isMerchant: false, isSuperAdmin: false, stores: [], ...current, isCustomer: true }))
  }

  function setLoginIntent(intent) {
    if (!loginIntents.includes(intent)) return
    sessionStorage.setItem(LOGIN_INTENT_KEY, intent)
    setLoginIntentState(intent)
  }

  async function handleLogout() {
    sessionStorage.removeItem(LOGIN_INTENT_KEY)
    setLoginIntentState('customer')
    setCurrentUser(null)
    setCapabilities(null)
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

    const formData = new FormData(event.currentTarget)
    customerRegistrationInProgress.current = true
    setCustomerSaving(true)
    setCustomerError('')
    try {
      if (platformRole === 'customer') {
        navigateTo('/customer', true)
        return
      }

      let verifiedUser
      try {
        verifiedUser = await refreshCurrentUser()
      } catch {
        setCustomerError('We could not verify your sign-in providers. Please try again.')
        return
      }
      if (verifiedUser.uid !== customerAccount.uid) {
        setCustomerError('We could not verify your existing account. No new account was created.')
        return
      }

      const password = formData.get('password')?.toString() || ''
      const confirmPassword = formData.get('confirmPassword')?.toString() || ''
      const needsPassword = !hasPasswordProvider(verifiedUser)
      const { userData, profile } = customerAccount
      const updates = { dukanSetuCustomer: true }
      if (!userData?.platformRoles?.dukanSetu) {
        updates.platformRoles = { dukanSetu: 'customer' }
      }
      const hasValue = (...values) => values.some((value) => typeof value === 'string' && value.trim())

      if (needsPassword && !password) {
        setCustomerError('Please create a password to continue.')
        return
      }
      if (needsPassword && !confirmPassword) {
        setCustomerError('Please confirm your password.')
        return
      }
      if (needsPassword && password.length < 8) {
        setCustomerError('Use a password with at least 8 characters.')
        return
      }
      if (needsPassword && password !== confirmPassword) {
        setCustomerError('Passwords do not match.')
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

      if (needsPassword) {
        try {
          const result = await linkPasswordToCurrentUser(password)
          if (result.user.uid !== customerAccount.uid || !hasPasswordProvider(result.user)) {
            setCustomerError('We could not verify your existing account. No new account was created.')
            return
          }
          verifiedUser = result.user
        } catch (error) {
          if (error.code !== 'auth/provider-already-linked') throw error
          const linkedUser = await refreshCurrentUser()
          if (linkedUser.uid !== customerAccount.uid || !hasPasswordProvider(linkedUser)) throw error
          verifiedUser = linkedUser
        }
        setCurrentUser(verifiedUser)
        setCustomerAccount((current) => current?.uid === customerAccount.uid
          ? { ...current, passwordLinked: true }
          : current)
        return
      }

      await updateCustomerAccess(customerAccount.uid, updates)
      setCurrentUser(auth.currentUser)
      markCustomerCapability()
      setPlatformRole('customer')
      navigateTo('/customer', true)
    } catch (error) {
      if (error.code === 'auth/credential-already-in-use' || error.code === 'auth/email-already-in-use') {
        setCustomerError('This email is already linked to another Firebase account. Sign in to that account to continue.')
      } else if (error.code === 'auth/link-not-confirmed') {
        setCustomerError('We could not confirm your password was saved. Please try creating your password again.')
      } else if (error.code === 'auth/weak-password') {
        setCustomerError('Use a password with at least 8 characters.')
      } else if (error.code === 'auth/requires-recent-login') {
        setCustomerError('For your security, sign in with this Google account again, then retry password setup.')
      } else if (error.code === 'auth/popup-closed-by-user') {
        setCustomerError('Google verification was cancelled. Try again when ready.')
      } else if (error.code === 'auth/network-request-failed') {
        setCustomerError('We could not connect to set up your account. Check your connection and try again.')
      } else if (error.code === 'auth/missing-email') {
        setCustomerError('This Google account does not have an email address available for password sign-in.')
      } else if (error.code === 'auth/unverified-email') {
        setCustomerError('Verify this account email with Google before enabling password sign-in.')
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
    capabilities,
    loginIntent,
    setLoginIntent,
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