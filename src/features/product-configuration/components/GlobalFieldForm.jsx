import { useState } from 'react'
import { normalizeGlobalFieldKey } from '../services/globalFieldService'

const initialValidation = {
  minLength: '',
  maxLength: '',
  minValue: '',
  maxValue: '',
  minSelections: '',
  maxSelections: '',
}

function initialValues(field) {
  return {
    name: field?.name ?? '',
    key: field?.key ?? '',
    label: field?.label ?? '',
    description: field?.description ?? '',
    fieldType: field?.fieldType ?? 'text',
    groupId: field?.groupId ?? '',
    required: field?.required ?? false,
    defaultVisibility: field?.defaultVisibility ?? 'visible',
    status: field?.status ?? 'active',
    sortOrder: String(field?.sortOrder ?? 10),
    validation: { ...initialValidation, ...(field?.validation ?? {}) },
    options: (field?.options ?? []).map((option) => ({ ...option })),
  }
}

export default function GlobalFieldForm({ error, field, fieldTypes, groups, onCancel, onSubmit, saving }) {
  const editing = Boolean(field)
  const [values, setValues] = useState(() => initialValues(field))
  const [keyEdited, setKeyEdited] = useState(editing)

  function setValue(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
  }

  function setValidation(name, value) {
    setValues((current) => ({ ...current, validation: { ...current.validation, [name]: value } }))
  }

  function updateOption(index, name, value) {
    setValues((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => optionIndex === index
        ? { ...option, [name]: value }
        : option),
    }))
  }

  function addOption() {
    setValues((current) => ({ ...current, options: [...current.options, { label: '', value: '', active: true }] }))
  }

  function removeOption(index) {
    setValues((current) => ({ ...current, options: current.options.filter((_, optionIndex) => optionIndex !== index) }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!saving) onSubmit(values)
  }

  const supportsTextLength = values.fieldType === 'text' || values.fieldType === 'textarea'
  const supportsNumericRange = values.fieldType === 'number' || values.fieldType === 'currency'
  const supportsOptions = values.fieldType === 'dropdown' || values.fieldType === 'multi_select'

  return (
    <div className="business-type-modal-backdrop" onClick={() => !saving && onCancel()} role="presentation">
      <form
        aria-labelledby="global-field-form-title"
        aria-modal="true"
        className="business-type-modal global-field-form"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
      >
        <h2 id="global-field-form-title">{editing ? 'Edit Global Field' : 'Add New Field'}</h2>
        {error && <p className="store-feedback store-feedback-error" role="alert">{error}</p>}

        <fieldset>
          <legend>Basic Information</legend>
          <label htmlFor="global-field-name">Field Name *</label>
          <input
            autoFocus
            id="global-field-name"
            maxLength={100}
            onChange={(event) => {
              const name = event.target.value
              setValues((current) => ({
                ...current,
                name,
                ...(!keyEdited ? { key: normalizeGlobalFieldKey(name) } : {}),
                ...(!current.label ? { label: name } : {}),
              }))
            }}
            required
            value={values.name}
          />

          <label htmlFor="global-field-key">Field Key *</label>
          <input
            id="global-field-key"
            maxLength={80}
            onChange={(event) => {
              setKeyEdited(true)
              setValue('key', event.target.value)
            }}
            pattern="[a-zA-Z0-9]+(_[a-zA-Z0-9]+)*"
            required
            title="Use letters and numbers separated by underscores. The key is normalized to lowercase underscores."
            value={values.key}
          />
          <small className="global-field-hint">Keys are saved as lowercase letters and numbers separated by underscores.</small>

          <label htmlFor="global-field-label">Field Label *</label>
          <input id="global-field-label" maxLength={100} onChange={(event) => setValue('label', event.target.value)} required value={values.label} />

          <label htmlFor="global-field-description">Description</label>
          <textarea id="global-field-description" maxLength={500} onChange={(event) => setValue('description', event.target.value)} rows={2} value={values.description} />

          <label htmlFor="global-field-type">Field Type *</label>
          <select id="global-field-type" onChange={(event) => setValue('fieldType', event.target.value)} required value={values.fieldType}>
            {fieldTypes.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </fieldset>

        <fieldset>
          <legend>Field Group</legend>
          <label htmlFor="global-field-group">Active Field Group *</label>
          <select id="global-field-group" onChange={(event) => setValue('groupId', event.target.value)} required value={values.groupId}>
            <option value="">Select a Field Group</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
          <small className="global-field-hint">The group's document ID and key are saved with this field.</small>
        </fieldset>

        {(supportsTextLength || supportsNumericRange || supportsOptions) && (
          <fieldset>
            <legend>Initial Configuration</legend>
            {supportsTextLength && (
              <div className="global-field-config-grid">
                <label>Minimum length
                  <input min="0" onChange={(event) => setValidation('minLength', event.target.value)} type="number" value={values.validation.minLength} />
                </label>
                <label>Maximum length
                  <input min="0" onChange={(event) => setValidation('maxLength', event.target.value)} type="number" value={values.validation.maxLength} />
                </label>
              </div>
            )}
            {supportsNumericRange && (
              <div className="global-field-config-grid">
                <label>Minimum value
                  <input onChange={(event) => setValidation('minValue', event.target.value)} step="any" type="number" value={values.validation.minValue} />
                </label>
                <label>Maximum value
                  <input onChange={(event) => setValidation('maxValue', event.target.value)} step="any" type="number" value={values.validation.maxValue} />
                </label>
              </div>
            )}
            {supportsOptions && (
              <>
                <div className="global-field-config-grid">
                  <label>Minimum selections
                    <input min="0" onChange={(event) => setValidation('minSelections', event.target.value)} type="number" value={values.validation.minSelections} />
                  </label>
                  <label>Maximum selections
                    <input max={values.fieldType === 'dropdown' ? 1 : undefined} min="1" onChange={(event) => setValidation('maxSelections', event.target.value)} type="number" value={values.validation.maxSelections} />
                  </label>
                </div>
                <div className="global-field-options-heading">
                  <h3>Allowed options *</h3>
                  <button className="store-btn" onClick={addOption} type="button">Add option</button>
                </div>
                {values.options.length === 0 && <p className="global-field-hint">Add at least one option.</p>}
                <div className="global-field-option-list">
                  {values.options.map((option, index) => (
                    <div className="global-field-option" key={`option-${index}`}>
                      <label>
                        <span>Label</span>
                        <input
                          maxLength={100}
                          onChange={(event) => {
                            const label = event.target.value
                            const currentOption = values.options[index]
                            updateOption(index, 'label', label)
                            if (!currentOption.value) updateOption(index, 'value', normalizeGlobalFieldKey(label))
                          }}
                          required
                          value={option.label}
                        />
                      </label>
                      <label>
                        <span>Value</span>
                        <input
                          onChange={(event) => updateOption(index, 'value', event.target.value)}
                          pattern="[a-zA-Z0-9]+(_[a-zA-Z0-9]+)*"
                          required
                          title="Use letters and numbers separated by underscores."
                          value={option.value}
                        />
                      </label>
                      <label className="global-field-option-active">
                        <input checked={option.active !== false} onChange={(event) => updateOption(index, 'active', event.target.checked)} type="checkbox" />
                        Active
                      </label>
                      <button aria-label={`Remove option ${index + 1}`} className="store-btn store-btn-reject" onClick={() => removeOption(index)} type="button">Remove</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </fieldset>
        )}

        <fieldset>
          <legend>Field Settings</legend>
          <div className="global-field-config-grid">
            <label htmlFor="global-field-required">Required</label>
            <select id="global-field-required" onChange={(event) => setValue('required', event.target.value === 'true')} value={String(values.required)}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>

            <label htmlFor="global-field-visibility">Default Visibility</label>
            <select id="global-field-visibility" onChange={(event) => setValue('defaultVisibility', event.target.value)} value={values.defaultVisibility}>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </select>

            <label htmlFor="global-field-status">Status</label>
            <select id="global-field-status" onChange={(event) => setValue('status', event.target.value)} value={values.status}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <label htmlFor="global-field-sort-order">Sort Order</label>
            <input id="global-field-sort-order" min="0" onChange={(event) => setValue('sortOrder', event.target.value)} required step="1" type="number" value={values.sortOrder} />
          </div>
        </fieldset>

        <div className="store-actions">
          <button className="store-btn" disabled={saving} onClick={onCancel} type="button">Cancel</button>
          <button className="store-btn store-btn-approve" disabled={saving} type="submit">{saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Field'}</button>
        </div>
      </form>
    </div>
  )
}
