import GoogleAuth from './GoogleAuth.jsx'
import CustomerPasswordSection from './CustomerPasswordSection.jsx'

export default function CustomerRegistration({
  currentUser,
  customerAccount,
  customerError,
  customerSaving,
  handleCustomerRegistration,
  handleGoogleSignIn,
  navigateTo,
  platformRole,
  returnFromCustomerRegistration,
  setCustomerCheckVersion,
  signingIn,
}) {
  const customerAccountForView = customerAccount?.uid === (currentUser?.uid ?? null) ? customerAccount : null
  const profile = customerAccountForView?.profile

  return (
    <main className="customer-registration">
      <header className="registration-header">
        <a className="brand" href="/login" onClick={(event) => { event.preventDefault(); navigateTo('/login') }}>
          <span className="brand-mark" aria-hidden="true">D</span>
          <span>Dukan Setu</span>
        </a>
        <button className="registration-back" type="button" onClick={() => navigateTo('/login')}>
          Back to sign in
        </button>
      </header>

      <section className="registration-panel" aria-labelledby="registration-title">
        <p className="eyebrow">CUSTOMER ACCOUNT</p>
        <h1 id="registration-title">Customer Registration</h1>
        <p className="registration-intro">Create your Dukan Setu customer account</p>

        {customerAccountForView?.status === 'email-conflict' ? (
          <div className="registration-message" role="alert">
            <p>This email is already associated with another account. Sign in with that account or complete account linking before continuing.</p>
            <button className="submit-button" type="button" onClick={() => navigateTo('/login')}>
              Go to Sign In <span aria-hidden="true">&#8594;</span>
            </button>
          </div>
        ) : customerAccountForView?.status === 'email-check-error' ? (
          <div className="registration-message" role="alert">
            <p>We could not verify whether this email belongs to another account. No customer profile was changed.</p>
            <button className="submit-button" type="button" onClick={() => setCustomerCheckVersion((version) => version + 1)}>
              Try again <span aria-hidden="true">&#8594;</span>
            </button>
          </div>
        ) : customerAccountForView?.status === 'ineligible' ? (
          <div className="registration-message" role="alert">
            <div className="existing-account-grid">
              {customerAccountForView.profile?.name && <div className="existing-account-field"><span>Full Name</span><strong>{customerAccountForView.profile.name}</strong></div>}
              {customerAccountForView.profile?.mobile && <div className="existing-account-field"><span>Mobile Number</span><strong>{customerAccountForView.profile.mobile}</strong></div>}
              {customerAccountForView.profile?.email && <div className="existing-account-field"><span>Email</span><strong>{customerAccountForView.profile.email}</strong></div>}
              {customerAccountForView.profile?.address && <div className="existing-account-field"><span>Address</span><strong>{customerAccountForView.profile.address}</strong></div>}
              <div className="existing-account-field"><span>Existing Role</span><strong>{customerAccountForView.existingRole}</strong></div>
            </div>
            <p>Your existing account is registered with a different role.</p>
            <button className="submit-button" type="button" onClick={returnFromCustomerRegistration}>
              {platformRole ? 'Return to your workspace' : 'Go to Sign In'}
              <span aria-hidden="true">&#8594;</span>
            </button>
          </div>
        ) : currentUser && !customerAccountForView ? (
          <p className="registration-status" aria-live="polite">Checking your existing account...</p>
        ) : !currentUser ? (
          <div className="registration-message">
            {customerError && <p className="registration-error" role="alert">{customerError}</p>}
            <GoogleAuth onSignIn={handleGoogleSignIn} signingIn={signingIn} />
            <p className="existing-account-prompt">Already have an account? <button type="button" onClick={() => navigateTo('/login')}>Go to Sign In</button></p>
          </div>
        ) : customerAccountForView?.status === 'error' ? (
          <div className="registration-message" role="alert">
            <p>We could not check your existing account. Please try again.</p>
            <button className="submit-button" type="button" onClick={() => setCustomerCheckVersion((version) => version + 1)}>
              Try again <span aria-hidden="true">&#8594;</span>
            </button>
          </div>
        ) : profile ? (
          <>
            <div className="existing-account-heading">
              <span aria-hidden="true">&#10003;</span>
              <div>
                <h2>{customerAccountForView.isExisting ? 'Existing Account Found' : 'Google account verified'}</h2>
                <p>{customerAccountForView.isExisting ? 'Existing Account Information' : 'Complete the missing details below'}</p>
              </div>
            </div>
            <form className="customer-registration-form" id="customer-registration-form" noValidate onSubmit={handleCustomerRegistration}>
              <div className="existing-account-grid">
                {profile.name && <div className="existing-account-field"><span>Full Name</span><strong>{profile.name}</strong></div>}
                {profile.mobile && <div className="existing-account-field"><span>Mobile Number</span><strong>{profile.mobile}</strong></div>}
                {profile.email && <div className="existing-account-field"><span>Email</span><strong>{profile.email}</strong></div>}
                {profile.address && <div className="existing-account-field"><span>Address</span><strong>{profile.address}</strong></div>}
                {customerAccountForView.isExisting && <div className="existing-account-field"><span>Existing Role</span><strong>{customerAccountForView.userData.role || 'Not assigned'}</strong></div>}
              </div>

              {[
                ['name', 'Full Name', profile.name],
                ['mobile', 'Mobile Number', profile.mobile],
                ['address', 'Address', profile.address],
              ].filter(([, , value]) => !value).map(([field, label]) => (
                <label className="registration-input" htmlFor={`customer-${field}`} key={field}>
                  {label}
                  <input
                    autoComplete={field === 'name' ? 'name' : field === 'mobile' ? 'tel' : 'street-address'}
                    id={`customer-${field}`}
                    name={field}
                    required
                    type="text"
                  />
                </label>
              ))}

              <CustomerPasswordSection currentUser={currentUser} />
              {customerError && <p className="registration-error" role="alert">{customerError}</p>}
              <button className="submit-button" type="submit" disabled={customerSaving}>
                {customerSaving ? 'Setting up your account...' : 'Continue to Dukan Setu'}
                {!customerSaving && <span aria-hidden="true">&#8594;</span>}
              </button>
            </form>
          </>
        ) : null}
      </section>
    </main>
  )
}