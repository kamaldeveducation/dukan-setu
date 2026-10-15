import { useEffect, useState } from 'react'
import { auth } from '../firebase'
import { hasPasswordProvider, linkPasswordToCurrentUser, refreshCurrentUser } from '../auth/authService'
import { getActiveBusinessType, listActiveBusinessTypes, listBusinessTypes } from '../services/businessTypeService'
import { listBusinessCategories } from '../services/businessCategoryService'
import { createStoreRegistration, resubmitStoreApplication } from '../services/storeService'
import BusinessCategoryStep from './BusinessCategoryStep.jsx'
import BusinessInformationStep from './BusinessInformationStep.jsx'
import BusinessTypeStep from './BusinessTypeStep.jsx'
import OwnerInformationStep from './OwnerInformationStep.jsx'
import PasswordStep from './PasswordStep.jsx'
import RegistrationReview from './RegistrationReview.jsx'

function categoryPairKey(businessTypeId, categoryId) {
  return JSON.stringify([businessTypeId, categoryId])
}

function uniqueCategorySelections(selections) {
  const seen = new Set()
  return selections.filter((selection) => {
    if (!selection?.businessTypeId || !selection?.categoryId) return false
    const key = categoryPairKey(selection.businessTypeId, selection.categoryId)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function businessFromStore(store) {
  const businessType = store.businessTypeId ?? store.businessType ?? ''
  const storedSelections = Array.isArray(store.businessCategoryIds) ? store.businessCategoryIds : []
  const businessCategoryIds = uniqueCategorySelections(storedSelections.length > 0
    ? storedSelections
    : store.businessCategoryId && businessType
      ? [{ businessTypeId: businessType, categoryId: store.businessCategoryId }]
      : [])
  return {
    businessType,
    businessTypeId: businessType,
    businessCategory: store.businessCategory ?? '',
    businessCategoryId: store.businessCategoryId ?? '',
    businessCategoryIds,
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
  businessTypeId: '',
  businessCategory: '',
  businessCategoryId: '',
  businessCategoryIds: [],
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
  const [categories, setCategories] = useState([])
  const [categoriesTypeId, setCategoriesTypeId] = useState('')
  const [categoriesLoading, setCategoriesLoading] = useState(Boolean(business.businessType))
  const [categoriesError, setCategoriesError] = useState('')
  const [categoriesReload, setCategoriesReload] = useState(0)
  const [categorySearch, setCategorySearch] = useState('')
  const [browseOpen, setBrowseOpen] = useState(false)
  const [browseBusinessTypes, setBrowseBusinessTypes] = useState([])
  const [browseTypesLoading, setBrowseTypesLoading] = useState(false)
  const [browseTypesError, setBrowseTypesError] = useState('')
  const [browseTypesReload, setBrowseTypesReload] = useState(0)
  const [browseCategories, setBrowseCategories] = useState([])
  const [browseCategoryCache, setBrowseCategoryCache] = useState([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseError, setBrowseError] = useState('')
  const [browseReload, setBrowseReload] = useState(0)
  const [browseTypeFilter, setBrowseTypeFilter] = useState('')

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
    if (!browseOpen) return undefined
    let active = true
    listBusinessTypes()
      .then((records) => {
        if (!active) return
        setBrowseBusinessTypes(records)
      })
      .catch((loadError) => {
        if (active) setBrowseTypesError(loadError.message || 'Check your connection and retry.')
      })
      .finally(() => {
        if (active) setBrowseTypesLoading(false)
      })
    return () => {
      active = false
    }
  }, [browseOpen, browseTypesReload])

  useEffect(() => {
    const businessTypeId = business.businessTypeId || business.businessType
    if (!businessTypeId) return undefined
    let active = true
    listBusinessCategories(businessTypeId)
      .then((records) => {
        if (!active) return
        setCategories(records.filter((category) => category.active === true))
        setCategoriesTypeId(businessTypeId)
        setCategoriesLoading(false)
      })
      .catch((loadError) => {
        if (!active) return
        setCategoriesError(loadError.message || 'Check your connection and retry.')
        setCategoriesTypeId(businessTypeId)
        setCategoriesLoading(false)
      })
    return () => {
      active = false
    }
  }, [business.businessType, business.businessTypeId, categoriesReload])

  useEffect(() => {
    if (!browseOpen || !browseTypeFilter) return undefined
    let active = true
    listBusinessCategories(browseTypeFilter)
      .then((records) => {
        if (!active) return
        const type = browseBusinessTypes.find((businessType) => businessType.id === browseTypeFilter)
        const activeRecords = records
          .filter((category) => category.active === true)
          .map((category) => ({
            ...category,
            businessTypeId: browseTypeFilter,
            businessTypeName: type?.name ?? browseTypeFilter,
          }))
        setBrowseCategories(activeRecords)
        setBrowseCategoryCache((current) => [
          ...current.filter((category) => category.businessTypeId !== browseTypeFilter),
          ...activeRecords,
        ])
      })
      .catch((loadError) => {
        if (active) setBrowseError(loadError.message || 'Check your connection and retry.')
      })
      .finally(() => {
        if (active) setBrowseLoading(false)
      })
    return () => {
      active = false
    }
  }, [browseOpen, browseTypeFilter, browseReload, browseBusinessTypes])

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
  const selectedType = businessTypes.find((type) => [type.id, type.code, type.name].includes(business.businessTypeId || business.businessType)) ?? null
  const suggestedCategories = categoriesTypeId === selectedType?.id
    ? categories.map((category) => ({ ...category, businessTypeId: selectedType.id, businessTypeName: selectedType.name }))
    : []
  const availableCategories = [...suggestedCategories, ...browseCategoryCache]
  const availableCategoryMap = new Map(availableCategories.map((category) => [
    categoryPairKey(category.businessTypeId, category.id),
    category,
  ]))
  const selectedPairs = business.businessCategoryIds ?? []
  const selectedCategories = selectedPairs.map((pair) => {
    const category = availableCategoryMap.get(categoryPairKey(pair.businessTypeId, pair.categoryId))
    const type = browseBusinessTypes.find((businessType) => businessType.id === pair.businessTypeId)
      ?? businessTypes.find((businessType) => businessType.id === pair.businessTypeId)
    return {
      ...pair,
      name: category?.name ?? pair.categoryId,
      businessTypeName: category?.businessTypeName ?? type?.name ?? pair.businessTypeId,
    }
  })
  const selectedCategoriesValid = selectedPairs.length > 0
    && selectedPairs.every((pair) => Boolean(pair.businessTypeId && pair.categoryId))
  const stepTwoLoading = categoriesLoading
    || Boolean((business.businessTypeId || business.businessType) && categoriesTypeId !== selectedType?.id)
    || (browseOpen && browseLoading)
  const categorySummary = selectedCategories.map((category) => (
    category.businessTypeId === selectedType?.id ? category.name : `${category.name} (${category.businessTypeName})`
  )).join(', ')
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

  function toggleCategory(category) {
    const businessTypeId = category.businessTypeId || selectedType?.id
    if (!businessTypeId || !category.id) return
    const key = categoryPairKey(businessTypeId, category.id)
    setBusiness((current) => {
      const currentSelections = current.businessCategoryIds ?? []
      const alreadySelected = currentSelections.some((selection) => categoryPairKey(selection.businessTypeId, selection.categoryId) === key)
      const nextSelections = alreadySelected
        ? currentSelections.filter((selection) => categoryPairKey(selection.businessTypeId, selection.categoryId) !== key)
        : [...currentSelections, { businessTypeId, categoryId: category.id }]
      const primarySelection = nextSelections.find((selection) => selection.businessTypeId === (current.businessTypeId || current.businessType))
      const primaryCategory = primarySelection
        ? availableCategoryMap.get(categoryPairKey(primarySelection.businessTypeId, primarySelection.categoryId))
        : null
      return {
        ...current,
        businessCategoryIds: nextSelections,
        businessCategory: primaryCategory?.name ?? '',
        businessCategoryId: primarySelection?.categoryId ?? '',
      }
    })
  }

  function toggleBrowseCategories() {
    const shouldOpen = !browseOpen
    setBrowseOpen(shouldOpen)
    if (shouldOpen) {
      setBrowseTypesLoading(true)
      setBrowseTypesError('')
    } else {
      setBrowseTypesLoading(false)
    }
    if (shouldOpen && browseTypeFilter) {
      setBrowseLoading(true)
      setBrowseError('')
    } else if (!shouldOpen) {
      setBrowseLoading(false)
    }
  }

  function changeBrowseTypeFilter(businessTypeId) {
    setBrowseTypeFilter(businessTypeId)
    setBrowseCategories([])
    setBrowseError('')
    setBrowseLoading(Boolean(businessTypeId && browseOpen))
  }

  function retryBrowseCategories() {
    setBrowseLoading(true)
    setBrowseError('')
    setBrowseReload((current) => current + 1)
  }

  function retryBusinessTypes() {
    setBusinessTypesLoading(true)
    setBusinessTypesError('')
    setBusinessTypesReload((current) => current + 1)
  }

  function retryBrowseBusinessTypes() {
    setBrowseTypesLoading(true)
    setBrowseTypesError('')
    setBrowseTypesReload((current) => current + 1)
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
          if (business.businessTypeId !== verifiedType.id || business.businessType !== verifiedType.id) {
            setBusiness((current) => ({ ...current, businessType: verifiedType.id, businessTypeId: verifiedType.id }))
          }
        } catch {
          setError('We could not validate the selected Business Type. Check your connection and retry.')
          return
        } finally {
          setValidatingBusinessType(false)
        }
      }
      if (step === 1 && (!selectedCategoriesValid || stepTwoLoading)) return
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
      retryBusinessTypes()
    }} onChange={(value) => {
      setBusiness((current) => ({
        ...current,
        businessType: value,
        businessTypeId: value,
        businessCategory: '',
        businessCategoryId: '',
        businessCategoryIds: [],
      }))
      setCategories([])
      setCategoriesTypeId('')
      setCategoriesError('')
      setCategorySearch('')
      setCategoriesLoading(Boolean(value))
    }} value={selectedType?.id ?? business.businessType} />,
    <BusinessCategoryStep
      browseCategories={browseCategories}
      browseError={browseError}
      browseLoading={browseLoading}
      browseOpen={browseOpen}
      browseTypeFilter={browseTypeFilter}
      businessTypes={browseBusinessTypes}
      businessTypesError={browseTypesError}
      businessTypesLoading={browseTypesLoading}
      categories={suggestedCategories}
      error={categoriesError}
      key="business-category"
      loading={categoriesLoading || Boolean((business.businessTypeId || business.businessType) && categoriesTypeId !== selectedType?.id)}
      onBrowseRetry={retryBrowseCategories}
      onBrowseToggle={toggleBrowseCategories}
      onBrowseTypeFilterChange={changeBrowseTypeFilter}
      onBusinessTypesRetry={retryBrowseBusinessTypes}
      onChange={toggleCategory}
      onRetry={() => {
        setCategoriesLoading(true)
        setCategoriesError('')
        setCategoriesReload((current) => current + 1)
      }}
      onSearchChange={setCategorySearch}
      onToggleCategory={toggleCategory}
      search={categorySearch}
      selectedCategories={selectedCategories}
      selectedPairs={selectedPairs}
    />,
    <BusinessInformationStep
      key="business-information"
      businessType={selectedType?.name ?? ''}
      category={categorySummary}
      onChange={updateBusiness}
      values={business}
    />,
    <OwnerInformationStep key="owner-information" onChange={updateOwner} values={ownerValues} />,
    <RegistrationReview
      business={business}
      businessType={selectedType?.name ?? ''}
      category={categorySummary}
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
            <button className="submit-button" disabled={saving || validatingBusinessType || (step === 0 && (businessTypesLoading || Boolean(businessTypesError) || businessTypes.length === 0)) || (step === 1 && (!selectedCategoriesValid || stepTwoLoading))} type="submit">
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