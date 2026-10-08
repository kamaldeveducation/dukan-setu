import ForgotPassword from './ForgotPassword.jsx'

export default function LoginPage({
  errorMessage,
  handlePasswordReset,
  handleSubmit,
  loginIntent,
  navigateTo,
  passwordResetError,
  passwordResetMessage,
  passwordResetSaving,
  setLoginIntent,
  signingIn,
}) {
  return (
    <main className="login-layout">
      <section className="login-story" aria-label="Dukan Setu">
        <div className="story-topline">
          <a className="brand brand-light" href="#login">
            <span className="brand-mark" aria-hidden="true">D</span>
            <span>Dukan Setu</span>
          </a>
          <span className="story-edition">DUKAN SETU</span>
        </div>

        <div className="story-copy">
          <p className="eyebrow">ONE PLATFORM. EVERY DUKAN.</p>
          <h1>Good business<br />starts <em>together.</em></h1>
          <p className="story-description">A clear view of the work that keeps local commerce moving.</p>
        </div>

        <div className="story-footer">
          <span>DUKAN SETU</span>
          <span>01 / 01</span>
        </div>
      </section>

      <section className="login-panel" id="login">
        <div className="login-panel-inner">
          <p className="eyebrow">SECURE SIGN IN</p>
          <h2>Welcome back.</h2>
          <p className="form-intro">Sign in to continue to Dukan Setu.</p>

          {errorMessage && (
            <div className="notice notice-error" role="alert">{errorMessage}</div>
          )}

          <fieldset className="login-intent">
            <legend>Login As</legend>
            {[['customer', 'Customer'], ['merchant', 'Merchant']].map(([value, label]) => (
              <label className={`login-intent-option${loginIntent === value ? ' is-selected' : ''}`} key={value}>
                <input
                  checked={loginIntent === value}
                  name="loginIntent"
                  onChange={() => setLoginIntent(value)}
                  type="radio"
                  value={value}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email</label>
            <input
              autoComplete="username"
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              autoComplete="current-password"
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              required
            />

            <button className="submit-button" type="submit" disabled={signingIn}>
              {signingIn ? 'Signing in...' : 'Sign in'}
              {!signingIn && <span aria-hidden="true">&#8594;</span>}
            </button>
          </form>

          <ForgotPassword
            error={passwordResetError}
            message={passwordResetMessage}
            onReset={handlePasswordReset}
            saving={passwordResetSaving}
          />

          <section className="registration-options" aria-labelledby="registration-options-title">
            <h3 id="registration-options-title">Create an account</h3>
            <div className="registration-choice-grid">
              <button className="registration-choice" type="button" onClick={() => navigateTo('/register/customer')}>
                <span className="registration-choice-type">Customer</span>
                <strong>Create Customer Account</strong>
                <span className="registration-choice-copy">Shop from local stores on Dukan Setu.</span>
                <span className="registration-choice-action">Continue <span aria-hidden="true">&#8594;</span></span>
              </button>
              <button className="registration-choice" type="button" onClick={() => navigateTo('/register/store')}>
                <span className="registration-choice-type">Store / Business</span>
                <strong>Register Your Store</strong>
                <span className="registration-choice-copy">Bring your business online.</span>
                <span className="registration-choice-action">Register <span aria-hidden="true">&#8594;</span></span>
              </button>
            </div>
          </section>

          <p className="security-note"><span aria-hidden="true">&#9679;</span> Secure access to your Dukan Setu workspace</p>
        </div>
        <footer className="login-footer">DUKAN SETU</footer>
      </section>
    </main>
  )
}