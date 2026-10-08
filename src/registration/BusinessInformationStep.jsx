const fields = [
  { name: 'businessName', label: 'Business name', autoComplete: 'organization', required: true },
  { name: 'businessMobile', label: 'Business mobile number', type: 'tel', autoComplete: 'tel', pattern: '[0-9]{10}', maxLength: 10, required: true },
  { name: 'businessEmail', label: 'Business email', type: 'email', autoComplete: 'email', required: true },
  { name: 'address', label: 'Address', autoComplete: 'street-address', required: true },
  { name: 'city', label: 'City', autoComplete: 'address-level2', required: true },
  { name: 'state', label: 'State', autoComplete: 'address-level1', required: true },
  { name: 'pincode', label: 'Pincode', type: 'text', autoComplete: 'postal-code', inputMode: 'numeric', pattern: '[0-9]{6}', maxLength: 6, required: true },
]

export default function BusinessInformationStep({ businessType, category, values, onChange }) {
  return (
    <div className="registration-step-fields">
      <p className="registration-step-prompt">Add the details customers will use to identify and contact your business.</p>
      <div className="registration-form-grid">
        {fields.map((field) => (
          <label className={`registration-input${field.name === 'address' ? ' is-wide' : ''}`} htmlFor={field.name} key={field.name}>
            {field.label}
            <input
              autoComplete={field.autoComplete}
              id={field.name}
              inputMode={field.inputMode}
              maxLength={field.maxLength}
              onChange={(event) => onChange(field.name, event.target.value)}
              pattern={field.pattern}
              required={field.required}
              type={field.type ?? 'text'}
              value={values[field.name]}
            />
          </label>
        ))}
      </div>
      <p className="registration-selected-summary">{businessType} · {category}</p>
    </div>
  )
}