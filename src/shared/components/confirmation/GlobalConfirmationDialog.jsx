import { useEffect, useRef, useState } from 'react'
import './GlobalConfirmationDialog.css'

function WarningIcon({ type }) {
  const isDelete = type === 'delete'
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {isDelete
        ? <>
            <path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2.1h16a1.4 1.4 0 0 0 1.2-2.1L12 3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </>
        : <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <path d="M12 8h.01" />
          </>}
    </svg>
  )
}

function EntityIcon({ entityType }) {
  if (entityType === 'product') {
    return (
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="m3 7 9-4 9 4-9 4-9-4Z" />
        <path d="M3 7v10l9 4 9-4V7M12 11v10" />
      </svg>
    )
  }
  if (entityType === 'merchant' || entityType === 'store') {
    return (
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24">
        <path d="M3 10h18l-1.5-6h-15L3 10Z" />
        <path d="M5 10v10h14V10M9 20v-6h6v6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      </svg>
    )
  }
  if (entityType === 'customer') {
    return (
      <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M4 5h16v14H4zM8 9h8M8 13h8M8 17h4" />
    </svg>
  )
}

export default function GlobalConfirmationDialog({
  title,
  subtitle,
  message,
  description,
  itemName,
  itemId,
  itemImage,
  warningIcon = true,
  confirmButtonText,
  cancelButtonText = 'Cancel',
  dialogType = 'confirmation',
  onConfirm,
  onCancel,
  loading = false,
  entityType = 'item',
  error,
}) {
  const [submitting, setSubmitting] = useState(false)
  const [failedImage, setFailedImage] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const confirmLock = useRef(false)
  const isBusy = loading || submitting
  const isDelete = dialogType === 'delete'
  const dialogTitle = title || (isDelete ? 'Delete?' : dialogType === 'warning' ? 'Warning' : 'Are you sure?')
  const confirmText = confirmButtonText || (isDelete ? 'Delete' : 'Confirm')
  const warningMessage = message || description
  const hasItem = Boolean(itemName || itemId || itemImage)

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isBusy) onCancel?.()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isBusy, onCancel])

  async function handleConfirm() {
    if (confirmLock.current || isBusy || !onConfirm) return
    confirmLock.current = true
    setSubmitting(true)
    setConfirmError('')
    try {
      await onConfirm()
    } catch (confirmFailure) {
      setConfirmError(confirmFailure?.message || 'The action could not be completed. Please try again.')
    } finally {
      confirmLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <div
      className="global-confirmation-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) onCancel?.()
      }}
      role="presentation"
    >
      <section
        aria-describedby={warningMessage ? 'global-confirmation-message' : undefined}
        aria-labelledby="global-confirmation-title"
        aria-modal="true"
        className={`global-confirmation-dialog global-confirmation-${dialogType}`}
        onClick={(event) => event.stopPropagation()}
        role={isDelete || dialogType === 'warning' ? 'alertdialog' : 'dialog'}
      >
        <header className={`global-confirmation-header${isDelete ? ' global-confirmation-header-centered' : ''}`}>
          {warningIcon && (
            <span className="global-confirmation-icon">
              {typeof warningIcon === 'boolean' ? <WarningIcon type={dialogType} /> : warningIcon}
            </span>
          )}
          <div className="global-confirmation-heading">
            <h2 id="global-confirmation-title">{dialogTitle}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </header>

        {hasItem && (
          <div className="global-confirmation-item">
            <div className="global-confirmation-item-image">
              {itemImage && failedImage !== itemImage
                ? <img alt="" onError={() => setFailedImage(itemImage)} src={itemImage} />
                : <EntityIcon entityType={entityType} />}
            </div>
            <div className="global-confirmation-item-details">
              {itemName && <strong className="global-confirmation-item-name">{itemName}</strong>}
              {itemId && <span className="global-confirmation-item-id">{entityType} ID: <strong>{itemId}</strong></span>}
            </div>
          </div>
        )}

        {warningMessage && (
          <div className="global-confirmation-warning">
            <p id="global-confirmation-message">{warningMessage}</p>
          </div>
        )}

        {(error || confirmError) && (
          <p className="global-confirmation-error" role="alert">{error || confirmError}</p>
        )}

        <footer className="global-confirmation-actions">
          <button className="global-confirmation-cancel" disabled={isBusy} onClick={onCancel} type="button">
            {cancelButtonText}
          </button>
          <button
            className="global-confirmation-confirm"
            disabled={isBusy}
            onClick={handleConfirm}
            type="button"
          >
            {isBusy && <span aria-hidden="true" className="global-confirmation-spinner" />}
            {isBusy ? (isDelete ? 'Deleting...' : 'Please wait...') : confirmText}
          </button>
        </footer>
      </section>
    </div>
  )
}
