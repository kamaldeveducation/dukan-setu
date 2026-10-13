import { useEffect, useState } from 'react'
import { auth } from '../firebase'
import { hasPasswordProvider, linkPasswordToCurrentUser, refreshCurrentUser } from '../auth/authService'
import { getActiveBusinessType, getBusinessCategories, listActiveBusinessTypes } from '../services/businessTypeService'
import { createStoreRegistration, resubmitStoreApplication } from '../services/storeService'
import BusinessCategoryStep from './BusinessCategoryStep.jsx'
import BusinessInformationStep from './BusinessInformationStep.jsx'
import BusinessTypeStep from './BusinessTypeStep.jsx'
import OwnerInformationStep from './OwnerInformationStep.jsx'
import PasswordStep from './PasswordStep.jsx'
import RegistrationReview from './RegistrationReview.jsx'

function businessFromStore(store) {
  return {
    businessType: store.businessType ?? '',
    businessCategory: store.businessCategory ?? '',
    businessName: store.storeName ?? '',
    businessMobile: store.businessMobile ?? '',
    businessEmail: store.businessEmail ?? '',
    address: store.address ?? '',
    city: store.city ?? '',
    state: store.state ?? '',
    pincode: store.pincode ?? '',
  }
}

function errorMessage(error) {
  if (error.code === 'auth/weak-password') return 'Use a password with at least 8 characters.'
  if (error.code === 'auth/credential-already-in-use' || error.code === 'auth/email-already-in-use') {
    return 'This email is already linked to another Firebase account. Sign in to that account to continue.'
  }
  if (error.code === 'auth/popup-closed-by-user') return 'Google verification was cancelled. Try again when ready.'
  if (error.code === 'auth/network-request-failed') return 'We could not connect. Check your connection and try again.'
  if (error.code === 'auth/link-not-confirmed') return 'We could not confirm your password was saved. Please try again.'
  if (error.code === 'business-type/not-active') return 'That Business Type is no longer available. Choose an active type and try again.'
  if (error.code) return 'We could not complete your registration. Please try again.'
  return error.message || 'We could not submit your registration. Please try again.'
}

const initialBusiness = {
  businessType: '',
  businessCategory: '',
  businessName: '',
  businessMobile: '',
  businessEmail: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
}

export default function StoreRegistration({
  authError,
  currentUser,
  handleGoogleSignIn,
  merchantStore,
  navigateTo,
  onRegistrationComplete,
  platformRole,
  signingIn,
}) {
  const applicationStatus = platformRole === 'merchant' ? merchantStore?.status : undefined
  const rejectedStore = applicationStatus === 'rejected' ? merchantStore : null
  const hasExistingApplication = applicationStatus === 'pending' || applicationStatus === 'approved'
  const [step, setStep] = useState(0)
  const [business, setBusiness] = useState(() => (rejectedStore ? businessFromStore(rejectedStore) : initialBusiness))
  const [owner, setOwner] = useState(() => (rejectedStore
    ? { ownerName: rejectedStore.ownerName ?? '', ownerMobile: rejectedStore.ownerMobile ?? '', ownerEmail: rejectedStore.ownerEmail ?? '' }
    : {}))
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLinked, setPasswordLinked] = useState(false)
  const [passwordProviderStatus, setPasswordProviderStatus] = useState('checking')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [businessTypes, setBusinessTypes] = useState([])
  const [businessTypesLoading, setBusinessTypesLoading] = useState(true)
  const [businessTypesError, setBusinessTypesError] = useState('')
  const [businessTypesReload, setBusinessTypesReload] = useState(0)
  const [validatingBusinessType, setValidatingBusinessType] = useState(false)

  useEffect(() => {
    let active = true
    listActiveBusinessTypes()
      .then((records) => {
        if (!active) return
        setBusinessTypes(records)
        setBusinessTypesLoading(false)
      })
      .catch((loadError) => {
        if (!active) return
        setBusinessTypesError(loadError.message || 'Check your connection and retry.')
        setBusinessTypesLoading(false)
      })
    return () => {
      active = false
    }
  }, [businessTypesReload])

  useEffect(() => {
    let active = true
    refreshCurrentUser()
      .then((user) => {
        if (active && user.uid === currentUser?.uid) {
          setPasswordProviderStatus(hasPasswordProvider(user) ? 'linked' : 'unlinked')
        }
      })
      .catch(() => {
        if (active) setPasswordProviderStatus('error')
      })

    return () => {
      active = false
    }
  }, [currentUser?.uid])

  useEffect(() => {
    if (currentUser && hasExistingApplication) navigateTo('/merchant', true)
  }, [currentUser, hasExistingApplication, navigateTo])

  if (!currentUser) {
    return (
      <main className="customer-registration">
        <RegistrationHeader navigateTo={navigateTo} />
        <section className="registration-panel" aria-labelledby="store-registration-title">
          <p className="eyebrow">STORE / BUSINESS</p>
          <h1 id="store-registration-title">Register Your Store</h1>
          <p className="registration-intro">Continue with Google to start your Dukan Setu business application.</p>
          {(error || authError) && <div className="notice notice-error" role="alert">{error || authError}</div>}
          <button
            className="google-sign-in-button"
            disabled={signingIn}
            onClick={async () => {
              setError('')
              await handleGoogleSignIn()
            }}
            style={{ width: '100%' }}
            type="button"
          >
            {signingIn ? 'Signing in...' : 'Continue with Google'}
          </button>
        </section>
      </main>
    )
  }

  if (hasExistingApplication) return null

  if (platformRole && platformRole !== 'merchant') {
    return (
      <main className="customer-registration">
        <RegistrationHeader navigateTo={navigateTo} />
        <section className="registration-panel" aria-labelledby="store-registration-title">
          <p className="eyebrow">STORE / BUSINESS</p>
          <h1 id="store-registration-title">Register Your Store</h1>
          <p className="registration-intro">This account already has a different Dukan Setu role and cannot register a store.</p>
        </section>
      </main>
    )
  }

  const needsPassword = passwordProviderStatus !== 'linked' || passwordLinked
  const stepTitles = [
    'Business Type',
    'Business Category',
    'Business Information',
    'Owner Information',
    needsPassword ? 'Review' : 'Review & Submit',
    ...(needsPassword ? ['Create Password'] : []),
  ]
  const lastStep = stepTitles.length - 1
  const selectedType = businessTypes.find((type) => [type.id, type.code, type.name].includes(business.businessType)) ?? null
  const categories = getBusinessCategories(selectedType?.id ?? business.businessType)
  const ownerValues = {
    ownerName: owner.ownerName ?? currentUser.displayName ?? '',
    ownerMobile: owner.ownerMobile ?? currentUser.phoneNumber ?? '',
    ownerEmail: owner.ownerEmail ?? currentUser.email ?? '',
  }

  function updateBusiness(field, value) {
    setBusiness((current) => ({ ...current, [field]: value }))
  }

  function updateOwner(field, value) {
    setOwner((current) => ({ ...current, [field]: value }))
  }

  function passwordProblem() {
    if (!password) return 'Create a password to continue.'
    if (!confirmPassword) return 'Confirm your password to continue.'
    if (password.length < 8) return 'Use a password with at least 8 characters.'
    if (password !== confirmPassword) return 'Passwords do not match.'
    return ''
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (step < lastStep) {
      if (step === 0) {
        if (!selectedType || businessTypesLoading || businessTypesError || businessTypes.length === 0) return
        setValidatingBusinessType(true)
        try {
          const verifiedType = await getActiveBusinessType(selectedType.id)
          if (!verifiedType) {
            setError('That Business Type is no longer active. Choose an active type to continue.')
            return
          }
          if (business.businessType !== verifiedType.id) updateBusiness('businessType', verifiedType.id)
        } catch {
          setError('We could not validate the selected Business Type. Check your connection and retry.')
          return
        } finally {
          setValidatingBusinessType(false)
        }
      }
      if (step === 1 && !business.businessCategory) return
      setStep((current) => current + 1)
      return
    }

    const firebaseUser = auth.currentUser
    if (!firebaseUser || firebaseUser.uid !== currentUser.uid) {
      setError('Sign in before submitting your business registration.')
      return
    }

    let verifiedUser
    try {
      verifiedUser = await refreshCurrentUser()
    } catch {
      setError('We could not verify your password sign-in. Please try again.')
      return
    }
    if (verifiedUser.uid !== firebaseUser.uid) {
      setError('We could not verify your account. Please sign in again.')
      return
    }
    const hasPasswordLogin = hasPasswordProvider(verifiedUser)
    setPasswordProviderStatus(hasPasswordLogin ? 'linked' : 'unlinked')
    const linkRequired = !hasPasswordLogin && !passwordLinked
    if (linkRequired) {
      const problem = passwordProblem()
      if (problem) {
        setError(problem)
        return
      }
    }

    setSaving(true)
    try {
      if (linkRequired) {
        try {
          const result = await linkPasswordToCurrentUser(password)
          if (result.user.uid !== firebaseUser.uid) throw new Error('We could not verify your account. No new account was created.')
        } catch (linkError) {
          if (linkError.code !== 'auth/provider-already-linked') throw linkError
          const linkedUser = await refreshCurrentUser()
          if (linkedUser.uid !== firebaseUser.uid || !hasPasswordProvider(linkedUser)) throw linkError
        }
        setPasswordLinked(true)
        setPasswordProviderStatus('linked')
      }

      const store = rejectedStore
        ? await resubmitStoreApplication(firebaseUser.uid, rejectedStore.storeId, business, ownerValues)
        : await createStoreRegistration(firebaseUser.uid, business, ownerValues)
      onRegistrationComplete(store)
      navigateTo('/merchant', true)
    } catch (submissionError) {
      setError(errorMessage(submissionError))
    } finally {
      setSaving(false)
    }
  }

  const stepContent = [
    <BusinessTypeStep key="business-type" businessTypes={businessTypes} error={businessTypesError} loading={businessTypesLoading} onRetry={() => {
      setBusinessTypesLoading(true)
      setBusinessTypesError('')
      setBusinessTypesReload((current) => current + 1)
    }} onChange={(value) => {
      updateBusiness('businessType', value)
      updateBusiness('businessCategory', '')
    }} value={selectedType?.id ?? business.businessType} />,
    <BusinessCategoryStep key="business-category" categories={categories} onChange={(value) => updateBusiness('businessCategory', value)} value={business.businessCategory} />,
    <BusinessInformationStep
      key="business-information"
      businessType={selectedType?.name ?? ''}
      category={business.businessCategory}
      onChange={updateBusiness}
      values={business}
    />,
    <OwnerInformationStep key="owner-information" onChange={updateOwner} values={ownerValues} />,
    <RegistrationReview
      business={business}
      businessType={selectedType?.name ?? ''}
      category={business.businessCategory}
      key="registration-review"
      owner={ownerValues}
    />,
    <PasswordStep
      confirmPassword={confirmPassword}
      key="password"
      onConfirmPasswordChange={setConfirmPassword}
      onPasswordChange={setPassword}
      password={password}
    />,
  ]

  return (
    <main className="customer-registration">
      <RegistrationHeader navigateTo={navigateTo} />
      <section className="registration-panel registration-panel-wide" aria-labelledby="store-registration-title">
        <p className="eyebrow">STORE / BUSINESS</p>
        <h1 id="store-registration-title">Register Your Store</h1>
        <p className="registration-intro">
          {rejectedStore
            ? 'Your previous application was not approved. Update your details and resubmit.'
            : 'Set up your business profile for Dukan Setu.'}
        </p>

        <ol className="registration-progress" aria-label="Registration progress" style={{ gridTemplateColumns: `repeat(${stepTitles.length}, minmax(0, 1fr))` }}>
          {stepTitles.map((title, index) => (
            <li className={index === step ? 'is-current' : index < step ? 'is-complete' : ''} key={title}>
              <span>{index + 1}</span>
              <span className="registration-progress-title">{title}</span>
            </li>
          ))}
        </ol>

        {error && <div className="notice notice-error" role="alert">{error}</div>}

        <form className="store-registration-form" onSubmit={handleSubmit}>
          <div className="registration-step-heading">
            <span>STEP {String(step + 1).padStart(2, '0')} / {String(stepTitles.length).padStart(2, '0')}</span>
            <h2>{stepTitles[step]}</h2>
          </div>
          {stepContent[step]}
          <div className="registration-step-actions">
            <button className="registration-secondary-button" disabled={step === 0 || saving} onClick={() => setStep((current) => current - 1)} type="button">
              Back
            </button>
            <button className="submit-button" disabled={saving || validatingBusinessType || (step === 0 && (businessTypesLoading || Boolean(businessTypesError) || businessTypes.length === 0))} type="submit">
              {saving ? 'Submitting...' : validatingBusinessType ? 'Checking...' : step === lastStep ? 'Submit for review' : 'Continue'}
              {!saving && !validatingBusinessType && <span aria-hidden="true">&#8594;</span>}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

function RegistrationHeader({ navigateTo }) {
  return (
    <header className="registration-header">
      <a className="brand" href="/login" onClick={(event) => { event.preventDefault(); navigateTo('/login') }}>
        <span className="brand-mark" aria-hidden="true">D</span>
        <span>Dukan Setu</span>
      </a>
      <button className="registration-back" onClick={() => navigateTo('/login')} type="button">Back to sign in</button>
    </header>
  )
}