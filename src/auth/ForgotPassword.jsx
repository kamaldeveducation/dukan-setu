import { useState } from 'react'

export default function ForgotPassword({ error, message, onReset, saving }) {
  const [open, setOpen] = useState(false)

  return (
    <section className="forgot-password-section">
      <button
        aria-expanded={open}
        className="forgot-password-toggle"
        onClick={() => setOpen((isOpen) => !isOpen)}
        type="button"
      >
        Forgot password?
      </button>
      {open && (
        <div className="forgot-password-panel">
          <h3>Reset your password</h3>
          <form className="forgot-password-form" onSubmit={(event) => {
            event.preventDefault()
            onReset(new FormData(event.currentTarget).get('email'))
          }}>
            <label htmlFor="reset-email">Email</label>
            <input
              autoComplete="email"
              id="reset-email"
              name="email"
              placeholder="your@email.com"
              required
              type="email"
            />
            {error && <p className="registration-error" role="alert">{error}</p>}
            {message && <p className="password-reset-success" role="status">{message}</p>}
            <button className="submit-button" disabled={saving} type="submit">
              {saving ? 'Sending...' : 'Send Reset Link'}
              {!saving && <span aria-hidden="true">&#8594;</span>}
            </button>
          </form>
        </div>
      )}
    </section>
  )
}