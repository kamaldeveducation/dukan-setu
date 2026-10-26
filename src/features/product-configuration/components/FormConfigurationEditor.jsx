import { useMemo, useState } from 'react'
import FormConfigurationPreview from './FormConfigurationPreview.jsx'

function toDraftGroups(config) {
  return (config?.groups ?? []).map((group) => ({
    groupId: group.groupId,
    groupKey: group.groupKey,
    fields: group.fields.map((field) => ({ ...field })),
  }))
}

function move(list, index, delta) {
  const target = index + delta
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

function FieldPicker({ group, groupFields, usedElsewhere, onAdd }) {
  const [search, setSearch] = useState('')
  const [allGroups, setAllGroups] = useState(false)
  const selected = new Set(group.fields.map((field) => field.fieldId))
  const term = search.trim().toLocaleLowerCase()
  const candidates = groupFields
    .filter((field) => allGroups || field.groupId === group.groupId)
    .filter((field) => !selected.has(field.id))
    .filter((field) => !term || [field.name, field.key, field.label].some((value) => value.toLocaleLowerCase().includes(term)))

  return (
    <div className="form-builder-picker">
      <div className="form-builder-picker-head">
        <input
          aria-label="Search fields to add"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search fields to add"
          type="search"
          value={search}
        />
        <label className="form-builder-inline">
          <input checked={allGroups} onChange={(event) => setAllGroups(event.target.checked)} type="checkbox" />
          Fields from all groups
        </label>
      </div>
      {candidates.length === 0 ? (
        <p className="form-builder-empty">No matching active fields available.</p>
      ) : (
        <ul>
          {candidates.map((field) => {
            const elsewhere = usedElsewhere.get(field.id)
            return (
              <li key={field.id}>
                <span><strong>{field.name}</strong> <code>{field.key}</code> <small>{field.fieldType}</small></span>
                {elsewhere ? (
                  <small>Already in {elsewhere}</small>
                ) : (
                  <button className="store-btn" onClick={() => onAdd(field)} type="button">Add</button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function FormConfigurationEditor({ config, configs, error, onCancel, onSubmit, saving, sources }) {
  const editing = Boolean(config)
  const [name, setName] = useState(config?.name ?? '')
  const [productTypeId, setProductTypeId] = useState(config?.productTypeId ?? '')
  const [status, setStatus] = useState(config?.status ?? 'active')
  const [groups, setGroups] = useState(() => toDraftGroups(config))
  const [groupToAdd, setGroupToAdd] = useState('')
  const [pickerOpen, setPickerOpen] = useState('')
  const [localError, setLocalError] = useState('')

  const groupsById = useMemo(() => new Map(sources.groups.map((group) => [group.id, group])), [sources.groups])
  const fieldsById = useMemo(() => new Map(sources.fields.map((field) => [field.id, field])), [sources.fields])
  const activeFields = useMemo(() => sources.fields.filter((field) => field.status === 'active'), [sources.fields])

  const productTypeOptions = sources.productTypes.filter((type) => type.status === 'active' || type.id === config?.productTypeId)
  const takenBy = configs.find((item) => item.productTypeId === productTypeId && item.id !== config?.id)
  const addableGroups = sources.groups.filter((group) => group.status === 'active' && !groups.some((item) => item.groupId === group.id))

  function updateGroup(groupId, update) {
    setGroups((current) => current.map((group) => (group.groupId === groupId ? update(group) : group)))
  }

  function addGroup() {
    const record = groupsById.get(groupToAdd)
    if (!record) return
    setGroups((current) => [...current, { groupId: record.id, groupKey: record.key, fields: [] }])
    setPickerOpen(record.id)
    setGroupToAdd('')
  }

  function addField(groupId, field) {
    updateGroup(groupId, (group) => ({
      ...group,
      fields: [...group.fields, {
        fieldId: field.id,
        fieldKey: field.key,
        required: field.required,
        visibility: field.defaultVisibility,
        sortOrder: group.fields.length + 1,
        labelOverride: '',
        helpTextOverride: '',
      }],
    }))
  }

  function updateField(groupId, fieldId, patch) {
    updateGroup(groupId, (group) => ({
      ...group,
      fields: group.fields.map((field) => (field.fieldId === fieldId ? { ...field, ...patch } : field)),
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (saving) return
    setLocalError('')
    if (takenBy) {
      setLocalError(`A Form Configuration ("${takenBy.name}") already exists for this Product Type.`)
      return
    }
    onSubmit({ name, productTypeId, status, groups })
  }

  const stale = groups.some((group) => {
    const record = groupsById.get(group.groupId)
    return !record || record.status !== 'active' || group.fields.some((field) => fieldsById.get(field.fieldId)?.status !== 'active')
  })

  return (
    <div className="business-type-modal-backdrop" onClick={() => !saving && onCancel()} role="presentation">
      <form
        aria-labelledby="form-builder-editor-title"
        aria-modal="true"
        className="business-type-modal form-builder-editor"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
      >
        <h2 id="form-builder-editor-title">{editing ? 'Edit Form Configuration' : 'Create Form Configuration'}</h2>
        {(error || localError) && <p className="store-feedback store-feedback-error" role="alert">{localError || error}</p>}
        {stale && (
          <p className="store-feedback store-feedback-error" role="alert">
            Some groups or fields are missing or inactive. Remove them (or reactivate the originals) before saving.
          </p>
        )}

        <div className="form-builder-columns">
          <div className="form-builder-main">
            <fieldset className="form-builder-basic">
              <legend>Basic Settings</legend>
              <label htmlFor="form-config-name">Form Configuration Name *</label>
              <input id="form-config-name" maxLength={100} onChange={(event) => setName(event.target.value)} required value={name} />

              <label htmlFor="form-config-type">Product Type *</label>
              <select id="form-config-type" onChange={(event) => setProductTypeId(event.target.value)} required value={productTypeId}>
                <option value="">Select a Product Type</option>
                {productTypeOptions.map((type) => (
                  <option key={type.id} value={type.id}>{type.name} ({type.key}){type.status !== 'active' ? ' - inactive' : ''}</option>
                ))}
              </select>
              {sources.productTypes.length === 0 && <small>No Product Types exist yet. Add them in Product Type Configuration first.</small>}
              {takenBy && <small className="form-builder-warning">"{takenBy.name}" already uses this Product Type.</small>}

              <label htmlFor="form-config-status">Status</label>
              <select id="form-config-status" onChange={(event) => setStatus(event.target.value)} value={status}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </fieldset>

            <fieldset className="form-builder-groups">
              <legend>Groups and Fields</legend>
              <div className="form-builder-add-group">
                <select aria-label="Group to add" onChange={(event) => setGroupToAdd(event.target.value)} value={groupToAdd}>
                  <option value="">Select an active Field Group</option>
                  {addableGroups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.key})</option>)}
                </select>
                <button className="store-btn" disabled={!groupToAdd} onClick={addGroup} type="button">Add Group</button>
              </div>
              {sources.groups.length === 0 && <small>No Field Groups exist yet.</small>}

              {groups.map((group, groupIndex) => {
                const record = groupsById.get(group.groupId)
                const usedElsewhere = new Map()
                groups.forEach((other) => {
                  if (other.groupId === group.groupId) return
                  other.fields.forEach((field) => usedElsewhere.set(field.fieldId, groupsById.get(other.groupId)?.name ?? other.groupKey))
                })
                const groupProblem = !record ? 'This Field Group no longer exists.' : record.status !== 'active' ? 'This Field Group is inactive.' : ''
                return (
                  <section className="form-builder-group" key={group.groupId}>
                    <header>
                      <strong>{record?.name ?? `Missing group (${group.groupKey || group.groupId})`}</strong>
                      <div className="store-actions">
                        <button aria-label="Move group up" className="store-btn" disabled={groupIndex === 0} onClick={() => setGroups((current) => move(current, groupIndex, -1))} type="button">↑</button>
                        <button aria-label="Move group down" className="store-btn" disabled={groupIndex === groups.length - 1} onClick={() => setGroups((current) => move(current, groupIndex, 1))} type="button">↓</button>
                        <button className="store-btn" onClick={() => setPickerOpen(pickerOpen === group.groupId ? '' : group.groupId)} type="button">
                          {pickerOpen === group.groupId ? 'Close Fields' : 'Add Fields'}
                        </button>
                        <button className="store-btn store-btn-reject" onClick={() => setGroups((current) => current.filter((item) => item.groupId !== group.groupId))} type="button">Remove Group</button>
                      </div>
                    </header>
                    {groupProblem && <p className="form-builder-warning">{groupProblem}</p>}

                    {pickerOpen === group.groupId && (
                      <FieldPicker
                        group={group}
                        groupFields={activeFields}
                        onAdd={(field) => addField(group.groupId, field)}
                        usedElsewhere={usedElsewhere}
                      />
                    )}

                    {group.fields.length === 0 && <p className="form-builder-empty">No fields selected.</p>}
                    {group.fields.map((field, fieldIndex) => {
                      const global = fieldsById.get(field.fieldId)
                      const problem = !global ? 'This field no longer exists.' : global.status !== 'active' ? 'This field is inactive.' : ''
                      return (
                        <div className="form-builder-field" key={field.fieldId}>
                          <div className="form-builder-field-head">
                            <span>
                              <strong>{global?.name ?? `Missing field (${field.fieldKey || field.fieldId})`}</strong>{' '}
                              <code>{global?.key ?? field.fieldKey}</code>{global && <small> {global.fieldType}</small>}
                            </span>
                            <div className="store-actions">
                              <button aria-label="Move field up" className="store-btn" disabled={fieldIndex === 0} onClick={() => updateGroup(group.groupId, (current) => ({ ...current, fields: move(current.fields, fieldIndex, -1) }))} type="button">↑</button>
                              <button aria-label="Move field down" className="store-btn" disabled={fieldIndex === group.fields.length - 1} onClick={() => updateGroup(group.groupId, (current) => ({ ...current, fields: move(current.fields, fieldIndex, 1) }))} type="button">↓</button>
                              <button className="store-btn store-btn-reject" onClick={() => updateGroup(group.groupId, (current) => ({ ...current, fields: current.fields.filter((item) => item.fieldId !== field.fieldId) }))} type="button">Remove</button>
                            </div>
                          </div>
                          {problem && <p className="form-builder-warning">{problem}</p>}
                          <div className="form-builder-field-settings">
                            <label className="form-builder-inline">
                              <input checked={field.required} onChange={(event) => updateField(group.groupId, field.fieldId, { required: event.target.checked })} type="checkbox" />
                              Required
                            </label>
                            <select aria-label="Visibility" onChange={(event) => updateField(group.groupId, field.fieldId, { visibility: event.target.value })} value={field.visibility}>
                              <option value="visible">Visible</option>
                              <option value="hidden">Hidden</option>
                            </select>
                            <input
                              aria-label="Label override"
                              maxLength={100}
                              onChange={(event) => updateField(group.groupId, field.fieldId, { labelOverride: event.target.value })}
                              placeholder={global?.label ? `Label: ${global.label}` : 'Label override'}
                              value={field.labelOverride}
                            />
                            <input
                              aria-label="Help text override"
                              maxLength={300}
                              onChange={(event) => updateField(group.groupId, field.fieldId, { helpTextOverride: event.target.value })}
                              placeholder="Help text override"
                              value={field.helpTextOverride}
                            />
                            <span className="form-builder-order">Order {fieldIndex + 1}</span>
                          </div>
                        </div>
                      )
                    })}
                  </section>
                )
              })}
            </fieldset>
          </div>

          <aside className="form-builder-preview" aria-label="Form Configuration Preview">
            <h3>Form Configuration Preview</h3>
            <small>Configuration preview only, not the customer-facing form.</small>
            <FormConfigurationPreview fieldsById={fieldsById} groups={groups} groupsById={groupsById} />
          </aside>
        </div>

        <div className="store-actions">
          <button className="store-btn" disabled={saving} onClick={onCancel} type="button">Cancel</button>
          <button className="store-btn store-btn-approve" disabled={saving || Boolean(takenBy)} type="submit">
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Configuration'}
          </button>
        </div>
      </form>
    </div>
  )
}
