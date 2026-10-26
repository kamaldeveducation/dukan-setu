export default function FormConfigurationPreview({ groups, fieldsById, groupsById }) {
  if (!groups.length) return <p className="form-builder-empty">Add a group to preview the form layout.</p>
  return (
    <div className="form-preview">
      {groups.map((group) => {
        const record = groupsById.get(group.groupId)
        return (
          <section className="form-preview-group" key={group.groupId}>
            <h4>{record ? record.name : `Missing group (${group.groupKey || group.groupId})`}</h4>
            {group.fields.length === 0 ? (
              <p className="form-builder-empty">No fields selected.</p>
            ) : (
              <ol>
                {group.fields.map((field) => {
                  const global = fieldsById.get(field.fieldId)
                  const label = field.labelOverride.trim() || global?.label || field.fieldKey || field.fieldId
                  const help = field.helpTextOverride.trim() || global?.description
                  return (
                    <li className={field.visibility === 'hidden' ? 'is-hidden' : ''} key={field.fieldId}>
                      <span className="form-preview-label">
                        {label}{field.required && <b aria-label="required"> *</b>}
                      </span>
                      <small>
                        {global ? global.fieldType : 'missing field'}
                        {field.visibility === 'hidden' ? ' · hidden' : ''}
                      </small>
                      {help && <em>{help}</em>}
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        )
      })}
    </div>
  )
}
