import { useEffect, useMemo, useState } from 'react'
import { loadActiveFormForProductType } from '../services/productFormConfigService.js'
import ImageFormField from './ImageFormField.jsx'

const INPUT_TYPES = {
  text: 'text', number: 'number', currency: 'number', url: 'url', email: 'email', phone: 'tel', date: 'date',
}

// Resolves the stored configuration against live Field Groups and Global Fields.
function buildLayout({ config, groups, fields }) {
  const groupsById = new Map(groups.map((group) => [group.id, group]))
  const fieldsById = new Map(fields.map((field) => [field.id, field]))
  return config.groups
    .filter((group) => groupsById.get(group.groupId)?.status === 'active')
    .map((group) => ({
      id: group.groupId,
      name: groupsById.get(group.groupId).name,
      fields: group.fields
        .map((entry) => ({ entry, global: fieldsById.get(entry.fieldId) }))
        .filter(({ global }) => global && global.status === 'active')
        .map(({ entry, global }) => ({
          id: entry.fieldId,
          key: global.key || entry.fieldKey,
          type: global.fieldType,
          label: entry.labelOverride.trim() || global.label || global.name || global.key,
          help: entry.helpTextOverride.trim() || global.description,
          required: entry.required,
          hidden: entry.visibility === 'hidden',
          validation: global.validation,
          options: global.options
            .filter((option) => option.active !== false)
            .slice()
            .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)),
          sortOrder: entry.sortOrder,
        })),
    }))
}

function validateValue(field, value) {
  const { validation, type } = field
  const empty = value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
  if (empty) return field.required && type !== 'boolean' ? 'This field is required.' : ''
  if (type === 'text' || type === 'textarea') {
    if (validation.minLength !== undefined && value.length < validation.minLength) return `Enter at least ${validation.minLength} characters.`
    if (validation.maxLength !== undefined && value.length > validation.maxLength) return `Enter at most ${validation.maxLength} characters.`
  }
  if (type === 'number' || type === 'currency') {
    const number = Number(value)
    if (validation.minValue !== undefined && number < validation.minValue) return `Value must be at least ${validation.minValue}.`
    if (validation.maxValue !== undefined && number > validation.maxValue) return `Value must be at most ${validation.maxValue}.`
  }
  if (type === 'multi_select') {
    if (validation.minSelections !== undefined && value.length < validation.minSelections) return `Select at least ${validation.minSelections}.`
    if (validation.maxSelections !== undefined && value.length > validation.maxSelections) return `Select at most ${validation.maxSelections}.`
  }
  return ''
}

function FieldInput({ field, value, onChange, onBlur, describedBy }) {
  const common = { id: `dpf-${field.id}`, name: field.key, 'aria-describedby': describedBy, onBlur }
  const { validation } = field
  if (field.type === 'textarea') {
    return <textarea {...common} maxLength={validation.maxLength} minLength={validation.minLength} onChange={(e) => onChange(e.target.value)} rows={3} value={value ?? ''} />
  }
  if (field.type === 'dropdown') {
    return (
      <select {...common} onChange={(e) => onChange(e.target.value)} value={value ?? ''}>
        <option value="">Select an option</option>
        {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    )
  }
  if (field.type === 'multi_select') {
    const selected = Array.isArray(value) ? value : []
    return (
      <div className="dynamic-product-form-options" role="group" aria-describedby={describedBy} id={common.id}>
        {field.options.map((option) => (
          <label key={option.value}>
            <input
              checked={selected.includes(option.value)}
              onBlur={onBlur}
              onChange={(e) => onChange(e.target.checked
                ? [...selected, option.value]
                : selected.filter((item) => item !== option.value))}
              type="checkbox"
            />
            {option.label}
          </label>
        ))}
      </div>
    )
  }
  if (field.type === 'boolean') {
    return (
      <label className="dynamic-product-form-check">
        <input {...common} checked={value === true} onChange={(e) => onChange(e.target.checked)} type="checkbox" />
        Yes
      </label>
    )
  }
  if (field.type === 'image') {
    return <ImageFormField label={field.label} onChange={onChange} value={value} />
  }
  const isNumber = field.type === 'number' || field.type === 'currency'
  return (
    <input
      {...common}
      max={isNumber ? validation.maxValue : undefined}
      maxLength={field.type === 'text' ? validation.maxLength : undefined}
      min={isNumber ? validation.minValue : undefined}
      minLength={field.type === 'text' ? validation.minLength : undefined}
      onChange={(e) => onChange(e.target.value)}
      step={field.type === 'currency' ? '0.01' : isNumber ? 'any' : undefined}
      type={INPUT_TYPES[field.type] ?? 'text'}
      value={value ?? ''}
    />
  )
}

export default function DynamicProductForm({ productTypeId }) {
  const [state, setState] = useState({ productTypeId: '', loading: true, error: '', data: null })
  const [reload, setReload] = useState(0)
  const [values, setValues] = useState({})
  const [touched, setTouched] = useState({})

  useEffect(() => {
    let active = true
    loadActiveFormForProductType(productTypeId)
      .then((data) => { if (active) setState({ productTypeId, loading: false, error: '', data }) })
      .catch((error) => {
        if (active) setState({ productTypeId, loading: false, error: error.message || 'The form could not be loaded.', data: null })
      })
    return () => { active = false }
  }, [productTypeId, reload])

  // Derived so a stale form is never shown while a different Product Type is loading.
  const current = state.productTypeId === productTypeId ? state : { loading: true, error: '', data: null }
  const layout = useMemo(() => (current.data ? buildLayout(current.data) : []), [current.data])
  const visibleGroups = layout
    .map((group) => ({ ...group, fields: group.fields.filter((field) => !field.hidden) }))
    .filter((group) => group.fields.length > 0)

  function retry() {
    setState({ productTypeId: '', loading: true, error: '', data: null })
    setReload((count) => count + 1)
  }

  if (current.loading) return <p className="store-state" role="status">Loading Product Form...</p>
  if (current.error) {
    return (
      <div className="store-state store-state-error" role="alert">
        <p>Could not load the Product Form: {current.error}</p>
        <button className="store-btn" onClick={retry} type="button">Retry</button>
      </div>
    )
  }
  if (!current.data) {
    return <p className="store-state" role="status">इस Product Type के लिए अभी कोई सक्रिय Form Configuration उपलब्ध नहीं है।</p>
  }
  if (!layout.length) {
    return <p className="store-state" role="status">इस Form Configuration में कोई वैध Field Group उपलब्ध नहीं है।</p>
  }
  if (!visibleGroups.length) {
    return <p className="store-state" role="status">इस Form Configuration के Field Groups में कोई दिखाई देने वाला Field उपलब्ध नहीं है।</p>
  }

  return (
    <form className="dynamic-product-form" noValidate onSubmit={(event) => event.preventDefault()} aria-label={current.data.config.name || 'Product Form'}>
      {visibleGroups.map((group) => (
        <fieldset className="dynamic-product-form-group" key={group.id}>
          <legend>{group.name}</legend>
          <div className="dynamic-product-form-grid">
            {group.fields.map((field) => {
              const error = touched[field.id] ? validateValue(field, values[field.id]) : ''
              const wide = field.type === 'textarea' || field.type === 'multi_select'
              return (
                <div className={`dynamic-master-product-field${wide ? ' is-wide' : ''}`} key={field.id}>
                  <label htmlFor={`dpf-${field.id}`}>
                    {field.label}{field.required && <span className="dynamic-master-product-required" aria-label="required"> *</span>}
                  </label>
                  <FieldInput
                    describedBy={`dpf-${field.id}-note`}
                    field={field}
                    onBlur={() => setTouched((prev) => ({ ...prev, [field.id]: true }))}
                    onChange={(next) => {
                      setValues((prev) => ({ ...prev, [field.id]: next }))
                      setTouched((prev) => ({ ...prev, [field.id]: true }))
                    }}
                    value={values[field.id]}
                  />
                  <span className={error ? 'dynamic-master-product-inline-error' : 'dynamic-master-product-note'} id={`dpf-${field.id}-note`} role={error ? 'alert' : undefined}>
                    {error || field.help}
                  </span>
                </div>
              )
            })}
          </div>
        </fieldset>
      ))}
    </form>
  )
}
