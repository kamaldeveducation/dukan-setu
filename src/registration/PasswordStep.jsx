export default function PasswordStep({ confirmPassword, onConfirmPasswordChange, onPasswordChange, password }) {
  return (
    <div className="registration-step-fields">
      <p className="registration-step-prompt">Create a password so you can also sign in to Dukan Setu with your email.</p>
      <div className="registration-form-grid">
        <label className="registration-input" htmlFor="storePassword">
          Create password
          <input
            autoComplete="new-password"
            id="storePassword"
            minLength={8}
            onChange={(event) => onPasswordChange(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <label className="registration-input" htmlFor="storeConfirmPassword">
          Confirm password
          <input
            autoComplete="new-password"
            id="storeConfirmPassword"
            minLength={8}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </label>
      </div>
    </div>
  )
}
