export default function GoogleAuth({ onSignIn, signingIn }) {
  return (
    <button className="google-sign-in-button" type="button" onClick={onSignIn} disabled={signingIn}>
      <span className="google-mark" aria-hidden="true">G</span>
      {signingIn ? 'Connecting to Google...' : 'Continue with Google'}
    </button>
  )
}