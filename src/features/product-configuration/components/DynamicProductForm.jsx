import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { loadActiveFormForProductType } from '../services/productFormConfigService.js'
import { BOOLEAN_BEHAVIORS } from '../services/globalFieldService.js'
import { saveMasterProduct } from '../services/masterProductService.js'
import ImageFormField from './ImageFormField.jsx'

const INPUT_TYPES = {
  text: 'text', number: 'number', currency: 'number', url: 'url', email: 'email', phone: 'tel', date: 'date',
}

// Boolean fields render as a toggle unless a checkbox is explicitly chosen (entry first, then Global Field).
function booleanDisplayStyle(entryStyle, globalStyle) {
  return (entryStyle || globalStyle) === 'checkbox' ? 'checkbox' : 'toggle'
}

// A Boolean with a behavior (e.g. NEW badge) owns a companion date field saved under its own key.
function companionFor(global, fieldId) {
  if (global.fieldType !== 'boolean' || !Object.hasOwn(BOOLEAN_BEHAVIORS, global.behavior) || global.behavior === 'none') return null
  const { dataKey, dateLabel } = BOOLEAN_BEHAVIORS[global.behavior]
  return { id: `${fieldId}:${dataKey}`, key: dataKey, type: 'date', label: dateLabel, validation: {}, options: [] }
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
        .map(({ entry, global }) => {
          const key = global.key || entry.fieldKey
          const companion = companionFor(global, entry.fieldId)
          return {
            id: entry.fieldId,
            key,
            type: global.fieldType,
            label: entry.labelOverride.trim() || global.label || global.name || global.key,
            help: entry.helpTextOverride.trim() || global.description,
            required: entry.required,
            hidden: entry.visibility === 'hidden',
            validation: key === 'product_name'
              ? { ...global.validation, minLength: undefined, maxLength: undefined }
              : global.validation,
            options: global.options
              .filter((option) => option.active !== false)
              .slice()
              .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)),
            defaultValue: global.defaultValue === true,
            displayStyle: companion ? 'toggle' : booleanDisplayStyle(entry.displayStyle, global.displayStyle),
            companion,
            sortOrder: entry.sortOrder,
          }
        }),
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

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

// The companion date is required only while its Boolean is ON; a stored date is kept while OFF.
function companionError(field, values) {
  if (!field.companion || values[field.id] !== true) return ''
  const date = values[field.companion.id]
  if (!date) return `Select a date. It is required while ${field.label} is ON.`
  return isIsoDate(date) ? '' : 'Enter a valid date.'
}

function formatDisplayDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}


function extensionOf(storagePath) {
  const name = String(storagePath ?? '')
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

// Saved images carry url and storagePath only. previewUrl is the saved URL, so the crop editor can show it without a blob.
function savedImageItems(items) {
  const savedItems = Array.isArray(items) ? items : items ? [items] : []
  return savedItems.map((saved, index) => {
    const item = typeof saved === 'string' ? { url: saved } : saved || {}
    const url = item.url || item.downloadURL || item.downloadUrl || ''
    const storagePath = item.storagePath || item.path || ''
    return {
      id: `saved-${index}`,
      order: index,
      url,
      previewUrl: url,
      storagePath,
      contentType: item.contentType,
      extension: extensionOf(storagePath),
      width: item.width,
      height: item.height,
      size: item.size,
    }
  })
}

function FieldInput({ field, value, onChange, onBlur, describedBy, disabled }) {
  const common = { id: `dpf-${field.id}`, name: field.key, 'aria-describedby': describedBy, onBlur, disabled }
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
    const checked = value === true
    if (field.displayStyle === 'toggle') {
      return (
        <label className="dynamic-product-form-toggle">
          <input {...common} checked={checked} className="dynamic-product-form-toggle-input" onChange={(e) => onChange(e.target.checked)} role="switch" type="checkbox" />
          <span aria-hidden="true" className="dynamic-product-form-toggle-track" />
          <span className={`dynamic-product-form-toggle-text ${checked ? 'is-on' : 'is-off'}`}>{checked ? 'Yes' : 'No'}</span>
        </label>
      )
    }
    return (
      <label className="dynamic-product-form-check">
        <input {...common} checked={checked} onChange={(e) => onChange(e.target.checked)} type="checkbox" />
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

// initialData: saved product document in edit mode; its values are prefilled once the form layout is ready.
// editingProductId: set in edit mode; the Product ID is locked because it is the document ID.
export default function DynamicProductForm({ productTypeId, selection, onSaved, initialData, editingProductId, lockedProductId, createOnly = false }) {
  const [state, setState] = useState({ productTypeId: '', loading: true, error: '', data: null })
  const [reload, setReload] = useState(0)
  const [values, setValues] = useState({})
  const [touched, setTouched] = useState({})
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' })
  const savingRef = useRef(false)
  const prefilledRef = useRef(false)

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

  useEffect(() => {
    if (!initialData || prefilledRef.current || layout.length === 0) return
    prefilledRef.current = true
    const prefilled = {}
    for (const group of layout) {
      for (const field of group.fields) {
        const saved = initialData[field.key]
        if (field.companion && typeof initialData[field.companion.key] === 'string') {
          prefilled[field.companion.id] = initialData[field.companion.key]
        }
        if (field.type === 'boolean') {
          prefilled[field.id] = saved === undefined || saved === null ? field.defaultValue : saved === true || saved === 'true'
          continue
        }
        if (saved === undefined || saved === null) continue
        prefilled[field.id] = field.type === 'image' ? savedImageItems(saved) : saved
      }
    }
    setValues(prefilled)
  }, [initialData, layout])

  useEffect(() => {
    if (initialData || layout.length === 0) return
    setValues((current) => {
      const next = { ...current }
      for (const group of layout) {
        for (const field of group.fields) {
          if (field.type === 'boolean' && next[field.id] === undefined) next[field.id] = field.defaultValue
        }
      }
      return next
    })
  }, [initialData, layout])

  function retry() {
    setState({ productTypeId: '', loading: true, error: '', data: null })
    setReload((count) => count + 1)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (savingRef.current) return
    const visibleFields = visibleGroups.flatMap((group) => group.fields)
    const touchedIds = visibleFields.flatMap((field) => (field.companion ? [field.id, field.companion.id] : [field.id]))
    setTouched((prev) => ({ ...prev, ...Object.fromEntries(touchedIds.map((id) => [id, true])) }))
    if (visibleFields.some((field) => validateValue(field, values[field.id]) || companionError(field, values))) {
      setSaveState({ status: 'error', message: 'Fix the highlighted fields before saving.' })
      return
    }
    savingRef.current = true
    setSaveState({ status: 'saving', message: '' })
    try {
      const baseFields = createOnly ? layout.flatMap((group) => group.fields) : visibleFields
      // The save overwrites the whole document, so a companion is always sent with its Boolean to keep its stored date.
      const fieldsToSave = baseFields.flatMap((field) => (field.companion ? [field, field.companion] : [field]))
      const result = await saveMasterProduct({ fields: fieldsToSave, values, selection, editingProductId, createOnly })
      setSaveState({ status: 'success', message: `Product ${result.productId} ${result.created ? 'saved' : 'updated'} successfully.` })
      onSaved?.(result)
    } catch (error) {
      setSaveState({ status: 'error', message: error.message || 'The product could not be saved.' })
    } finally {
      savingRef.current = false
    }
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
    <form className="dynamic-product-form" noValidate onSubmit={handleSubmit} aria-label={current.data.config.name || 'Product Form'}>
      {visibleGroups.map((group) => (
        <fieldset className="dynamic-product-form-group" key={group.id}>
          <legend>{group.name}</legend>
          <div className="dynamic-product-form-grid">
            {group.fields.map((field) => {
              const error = touched[field.id] ? validateValue(field, values[field.id]) : ''
              const wide = field.type === 'textarea' || field.type === 'multi_select'
              const companion = field.companion
              return (
                <Fragment key={field.id}>
                <div className={`dynamic-master-product-field${wide ? ' is-wide' : ''}`}>
                  <label htmlFor={`dpf-${field.id}`}>
                    {field.label}{field.required && <span className="dynamic-master-product-required" aria-label="required"> *</span>}
                  </label>
                  <FieldInput
                    describedBy={`dpf-${field.id}-note`}
                    disabled={Boolean(editingProductId || lockedProductId) && field.key === 'product_id'}
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
                {companion && values[field.id] === true && (() => {
                  const dateValue = values[companion.id] ?? ''
                  const dateError = touched[companion.id] ? companionError(field, values) : ''
                  const dateNote = isIsoDate(dateValue)
                    ? `Selected date: ${formatDisplayDate(dateValue)}. The NEW badge is shown through this date.`
                    : 'The NEW badge is shown through the end of the selected date.'
                  return (
                    <div className="dynamic-master-product-field is-wide dynamic-master-product-companion">
                      <label htmlFor={`dpf-${companion.id}`}>
                        {companion.label}<span className="dynamic-master-product-required" aria-label="required"> *</span>
                      </label>
                      <FieldInput
                        describedBy={`dpf-${companion.id}-note`}
                        field={companion}
                        onBlur={() => setTouched((prev) => ({ ...prev, [companion.id]: true }))}
                        onChange={(next) => {
                          setValues((prev) => ({ ...prev, [companion.id]: next }))
                          setTouched((prev) => ({ ...prev, [companion.id]: true }))
                        }}
                        value={dateValue}
                      />
                      <span className={dateError ? 'dynamic-master-product-inline-error' : 'dynamic-master-product-note'} id={`dpf-${companion.id}-note`} role={dateError ? 'alert' : undefined}>
                        {dateError || dateNote}
                      </span>
                    </div>
                  )
                })()}
                </Fragment>
              )
            })}
          </div>
        </fieldset>
      ))}
      <div className="store-actions">
        <button className="store-btn store-btn-approve" disabled={saveState.status === 'saving'} type="submit">
          {saveState.status === 'saving' ? 'Saving...' : 'Save Product'}
        </button>
      </div>
      {saveState.message && (
        <p className={saveState.status === 'error' ? 'store-state store-state-error' : 'store-state'} role={saveState.status === 'error' ? 'alert' : 'status'}>
          {saveState.message}
        </p>
      )}
    </form>
  )
}
