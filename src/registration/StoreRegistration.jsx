import { useState } from 'react'
import { auth } from '../firebase'
import { getBusinessCategories, getBusinessType, getBusinessTypes } from '../services/businessTypeService'
import { createStoreRegistration } from '../services/storeService'
import BusinessCategoryStep from './BusinessCategoryStep.jsx'
import BusinessInformationStep from './BusinessInformationStep.jsx'
import BusinessTypeStep from './BusinessTypeStep.jsx'
import OwnerInformationStep from './OwnerInformationStep.jsx'
import RegistrationReview from './RegistrationReview.jsx'
import RegistrationSuccess from './RegistrationSuccess.jsx'

const stepTitles = ['Business Type', 'Business Category', 'Business Information', 'Owner Information', 'Review & Submit']

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
  currentUser,
  handleGoogleSignIn,
  navigateTo,
  onRegistrationComplete,
  platformRole,
  signingIn,
}) {
  const [step, setStep] = useState(0)
  const [business, setBusiness] = useState(initialBusiness)
  const [owner, setOwner] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [submittedStore, setSubmittedStore] = useState(null)
  const businessTypes = getBusinessTypes()
  const selectedType = getBusinessType(business.businessType)
  const categories = getBusinessCategories(business.businessType)
  const ownerValues = {
    ownerName: owner.ownerName ?? currentUser?.displayName ?? '',
    ownerMobile: owner.ownerMobile ?? currentUser?.phoneNumber ?? '',
    ownerEmail: owner.ownerEmail ?? currentUser?.email ?? '',
  }

  function updateBusiness(field, value) {
    setBusiness((current) => ({ ...current, [field]: value }))
  }

  function updateOwner(field, value) {
    setOwner((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (step < stepTitles.length - 1) {
      if (step === 0 && !business.businessType) return
      if (step === 1 && !business.businessCategory) return
      setStep((current) => current + 1)
      return
    }

    const firebaseUser = auth.currentUser
    if (!firebaseUser || !currentUser || firebaseUser.uid !== currentUser.uid) {
      setError('Sign in before submitting your business registration.')
      return
    }
    if (platformRole && platformRole !== 'merchant') {
      setError('This account already has a different Dukan Setu role and cannot be changed here.')
      return
    }

    setSaving(true)
    try {
      const store = await createStoreRegistration(firebaseUser.uid, business, ownerValues)
      onRegistrationComplete(store)
      setSubmittedStore(store)
    } catch (submissionError) {
      setError(submissionError.message || 'We could not submit your registration. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function signInWithGoogle() {
    const signedIn = await handleGoogleSignIn()
    if (!signedIn) setError('We could not sign you in with Google. Please try again.')
  }

  if (submittedStore) {
    return (
      <main className="customer-registration">
        <RegistrationHeader navigateTo={navigateTo} />
        <section className="registration-panel registration-panel-wide">
          <RegistrationSuccess navigateTo={navigateTo} store={submittedStore} />
        </section>
      </main>
    )
  }

  const stepContent = [
    <BusinessTypeStep key="business-type" businessTypes={businessTypes} onChange={(value) => {
      updateBusiness('businessType', value)
      updateBusiness('businessCategory', '')
    }} value={business.businessType} />,
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
  ]

  return (
    <main className="customer-registration">
      <RegistrationHeader navigateTo={navigateTo} />
      <section className="registration-panel registration-panel-wide" aria-labelledby="store-registration-title">
        <p className="eyebrow">STORE / BUSINESS</p>
        <h1 id="store-registration-title">Register Your Store</h1>
        <p className="registration-intro">Set up your business profile for Dukan Setu.</p>

        <ol className="registration-progress" aria-label="Registration progress">
          {stepTitles.map((title, index) => (
            <li className={index === step ? 'is-current' : index < step ? 'is-complete' : ''} key={title}>
              <span>{index + 1}</span>
              <span className="registration-progress-title">{title}</span>
            </li>
          ))}
        </ol>

        {!currentUser && (
          <div className="registration-auth-prompt">
            <p>Sign in to submit this registration. Your existing Firebase account will be used.</p>
            <div>
              <button className="google-sign-in-button" disabled={signingIn} onClick={signInWithGoogle} type="button">
                {signingIn ? 'Signing in...' : 'Continue with Google'}
              </button>
              <button className="password-text-button" onClick={() => {
                sessionStorage.setItem('dukanSetuAuthReturn', '/register/store')
                navigateTo('/login')
              }} type="button">Sign in with email and password</button>
            </div>
          </div>
        )}

        {error && <div className="notice notice-error" role="alert">{error}</div>}

        <form className="store-registration-form" onSubmit={handleSubmit}>
          <div className="registration-step-heading">
            <span>STEP {String(step + 1).padStart(2, '0')} / 05</span>
            <h2>{stepTitles[step]}</h2>
          </div>
          {stepContent[step]}
          <div className="registration-step-actions">
            <button className="registration-secondary-button" disabled={step === 0 || saving} onClick={() => setStep((current) => current - 1)} type="button">
              Back
            </button>
            <button className="submit-button" disabled={saving} type="submit">
              {saving ? 'Submitting...' : step === stepTitles.length - 1 ? 'Submit for review' : 'Continue'}
              {!saving && <span aria-hidden="true">&#8594;</span>}
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