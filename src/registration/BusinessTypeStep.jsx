export default function BusinessTypeStep({ businessTypes, value, onChange }) {
  return (
    <fieldset className="registration-choice-list">
      <legend className="registration-step-prompt">Choose the type that best describes your business.</legend>
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
    </fieldset>
  )
}