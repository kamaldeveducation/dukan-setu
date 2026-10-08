const fields = [
  { name: 'ownerName', label: 'Owner name', type: 'text', autoComplete: 'name' },
  { name: 'ownerMobile', label: 'Owner mobile number', type: 'tel', autoComplete: 'tel', pattern: '[0-9]{10}', maxLength: 10 },
  { name: 'ownerEmail', label: 'Owner email', type: 'email', autoComplete: 'email' },
]

export default function OwnerInformationStep({ values, onChange }) {
  return (
    <div className="registration-step-fields">
      <p className="registration-step-prompt">These details identify the person responsible for the store.</p>
      <div className="registration-form-grid">
        {fields.map((field) => (
          <label className="registration-input" htmlFor={field.name} key={field.name}>
            {field.label}
            <input
              autoComplete={field.autoComplete}
              id={field.name}
              maxLength={field.maxLength}
              onChange={(event) => onChange(field.name, event.target.value)}
              pattern={field.pattern}
              required
              type={field.type}
              value={values[field.name]}
            />
          </label>
        ))}
      </div>
    </div>
  )
}