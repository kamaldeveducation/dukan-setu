export default function BusinessTypeStep({ businessTypes, error, loading, onChange, onRetry, value }) {
  return (
    <fieldset className="registration-choice-list">
      <legend className="registration-step-prompt">Choose the type that best describes your business.</legend>
      {loading ? (
        <p className="registration-state">Loading business types...</p>
      ) : error ? (
        <div className="registration-state registration-state-error" role="alert">
          <p>Business Types could not be loaded. {error}</p>
          <button className="registration-retry-button" onClick={onRetry} type="button">Retry</button>
        </div>
      ) : businessTypes.length === 0 ? (
        <p className="registration-state">No active Business Types are available. Please contact support.</p>
      ) : (
        <div className="business-type-grid">
          {businessTypes.map((type) => (
            <label className={`business-type-option${value === type.id ? ' is-selected' : ''}`} key={type.id}>
              <input
                checked={value === type.id}
                name="businessType"
                onChange={() => onChange(type.id)}
                required
                type="radio"
                value={type.id}
              />
              <span>{type.name}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}