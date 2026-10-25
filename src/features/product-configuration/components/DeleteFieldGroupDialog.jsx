export default function DeleteFieldGroupDialog({ deleting, error, group, onCancel, onConfirm }) {
  return (
    <div className="business-type-modal-backdrop" onClick={() => !deleting && onCancel()} role="presentation">
      <div
        aria-labelledby="delete-field-group-title"
        aria-modal="true"
        className="business-type-modal"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
      >
        <h2 id="delete-field-group-title">Delete {group.name}?</h2>
        {error && <p className="store-feedback store-feedback-error" role="alert">{error}</p>}
        <p>
          The Field Group <code>{group.key}</code> will be permanently deleted. This cannot be undone.
        </p>
        <div className="store-actions">
          <button className="store-btn" disabled={deleting} onClick={onCancel} type="button">Cancel</button>
          <button className="store-btn store-btn-reject" disabled={deleting} onClick={onConfirm} type="button">
            {deleting ? 'Deleting...' : 'Delete Group'}
          </button>
        </div>
      </div>
    </div>
  )
}
