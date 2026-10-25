import { useState } from 'react'
import { generateFieldGroupKey } from '../services/fieldGroupService'
import { FIELD_GROUP_KEY_PATTERN, FIELD_GROUP_LIMITS, FIELD_GROUP_STATUS, FIELD_GROUP_STATUS_LABELS } from '../types/fieldGroup.types'

export default function FieldGroupForm({ error, group, onCancel, onSubmit, saving, suggestedSortOrder }) {
  const editing = Boolean(group)
  const [values, setValues] = useState({
    name: group?.name ?? '',
    key: group?.key ?? '',
    description: group?.description ?? '',
    status: group?.status ?? FIELD_GROUP_STATUS.active,
    sortOrder: String(group?.sortOrder ?? suggestedSortOrder),
  })
  // Existing keys are never overwritten by name changes; new keys follow the name until edited by hand.
  const [keyEdited, setKeyEdited] = useState(editing)

  function setField(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!saving) onSubmit(values)
  }

  return (
    <div className="business-type-modal-backdrop" onClick={() => !saving && onCancel()} role="presentation">
      <form
        aria-labelledby="field-group-form-title"
        aria-modal="true"
        className="business-type-modal field-group-form"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
      >
        <h2 id="field-group-form-title">{editing ? 'Edit Field Group' : 'Create Field Group'}</h2>
        {error && <p className="store-feedback store-feedback-error" role="alert">{error}</p>}

        <label htmlFor="field-group-name">Group Name *</label>
        <input
          autoFocus
          id="field-group-name"
          maxLength={FIELD_GROUP_LIMITS.name}
          onChange={(event) => {
            const name = event.target.value
            setValues((current) => ({ ...current, name, ...(keyEdited ? {} : { key: generateFieldGroupKey(name) }) }))
          }}
          required
          value={values.name}
        />

        <label htmlFor="field-group-key">Group Key *</label>
        <div className="field-group-key-row">
          <input
            id="field-group-key"
            maxLength={FIELD_GROUP_LIMITS.key}
            onChange={(event) => {
              setKeyEdited(true)
              setField('key', event.target.value)
            }}
            pattern={FIELD_GROUP_KEY_PATTERN.source}
            required
            title="Use lowercase letters, numbers and single underscores."
            value={values.key}
          />
          <button
            className="store-btn"
            onClick={() => {
              setKeyEdited(false)
              setField('key', generateFieldGroupKey(values.name))
            }}
            type="button"
          >
            Auto-generate
          </button>
        </div>
        <small className="field-group-hint">
          {editing
            ? 'Changing the key does not change the Group\u2019s permanent ID.'
            : 'Generated from the name. You can edit it; it must be unique.'}
        </small>

        <label htmlFor="field-group-description">Description</label>
        <textarea
          id="field-group-description"
          maxLength={FIELD_GROUP_LIMITS.description}
          onChange={(event) => setField('description', event.target.value)}
          rows={3}
          value={values.description}
        />

        <label htmlFor="field-group-status">Status</label>
        <select id="field-group-status" onChange={(event) => setField('status', event.target.value)} value={values.status}>
          {Object.values(FIELD_GROUP_STATUS).map((status) => (
            <option key={status} value={status}>{FIELD_GROUP_STATUS_LABELS[status]}</option>
          ))}
        </select>

        <label htmlFor="field-group-sort-order">Sort Order</label>
        <input
          id="field-group-sort-order"
          min="0"
          onChange={(event) => setField('sortOrder', event.target.value)}
          required
          step="1"
          type="number"
          value={values.sortOrder}
        />

        <div className="store-actions">
          <button className="store-btn" disabled={saving} onClick={onCancel} type="button">Cancel</button>
          <button className="store-btn store-btn-approve" disabled={saving} type="submit">
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  )
}
