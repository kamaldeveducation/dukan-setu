import { useState } from 'react'
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
  const [showPassword, setShowPassword] = useState(false)

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
            <div className="password-input-wrap">
              <input
                autoComplete="current-password"
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                required
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="password-visibility-button"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {showPassword ? (
                    <>
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9 7-.2 1.1-1.1 2.4-2.4 3.6" />
                      <path d="M6.2 6.2C4.4 7.4 3.3 9 3 12c.3 2.5 4 7 9 7 1.1 0 2.1-.2 3-.6" />
                    </>
                  ) : (
                    <>
                      <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>

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