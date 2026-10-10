import { useEffect, useState } from 'react'
import { hasPasswordProvider, refreshCurrentUser } from './authService.js'

export default function CustomerPasswordSection({ currentUser, onResetPassword, passwordLinkSuccess }) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordProviderStatus, setPasswordProviderStatus] = useState('checking')

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

  if (passwordProviderStatus === 'checking') {
    return <p className="registration-status" aria-live="polite">Checking password sign-in...</p>
  }

  if (passwordProviderStatus === 'error') {
    return <p className="registration-error" role="alert">We could not verify password sign-in. Please refresh and try again.</p>
  }

  if (passwordLinkSuccess) {
    return (
      <section className="customer-password-section" aria-live="polite">
        <div>
          <h2>Password linked successfully</h2>
          <p>This account can now sign in with its email and password.</p>
        </div>
      </section>
    )
  }

  if (passwordProviderStatus === 'linked') {
    return (
      <section className="customer-password-section" aria-live="polite">
        <div>
          <h2>Password Login Enabled</h2>
          <p>This Firebase account already has password sign-in enabled. If you need to recover it, return to sign in and use Forgot password.</p>
        </div>
        <button className="password-text-button" onClick={onResetPassword} type="button">
          Go to sign in for password recovery
        </button>
      </section>
    )
  }

  return (
    <section className="customer-password-section" aria-labelledby="customer-password-title">
      <div>
        <h2 id="customer-password-title">Create a password</h2>
        <p>Set a password so you can also sign in with your email and password.</p>
      </div>
      <label className="registration-input" htmlFor="customer-password">
        Create Password
        <span className="password-input-control">
          <input
            autoComplete="new-password"
            id="customer-password"
            minLength={8}
            name="password"
            placeholder="Create a password"
            required
            type={showPassword ? 'text' : 'password'}
          />
          <button
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="password-visibility-button"
            onClick={() => setShowPassword((visible) => !visible)}
            type="button"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </span>
      </label>
      <label className="registration-input" htmlFor="customer-confirm-password">
        Confirm Password
        <span className="password-input-control">
          <input
            autoComplete="new-password"
            id="customer-confirm-password"
            minLength={8}
            name="confirmPassword"
            placeholder="Confirm password"
            required
            type={showConfirmPassword ? 'text' : 'password'}
          />
          <button
            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            className="password-visibility-button"
            onClick={() => setShowConfirmPassword((visible) => !visible)}
            type="button"
          >
            {showConfirmPassword ? 'Hide' : 'Show'}
          </button>
        </span>
      </label>
    </section>
  )
}