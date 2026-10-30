import { useEffect, useMemo, useRef, useState } from 'react'

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function FallbackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
      <path d="m3 7.5 9 4.5 9-4.5M12 12v9" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

// Falls back to an icon when there is no image URL or the image fails to load.
function Thumb({ src, menu = false, Icon = MenuIcon }) {
  const [failedSrc, setFailedSrc] = useState('')
  if (menu) return <span className="hier-thumb hier-thumb-icon" aria-hidden="true"><Icon /></span>
  if (!src || failedSrc === src) return <span className="hier-thumb hier-thumb-icon" aria-hidden="true"><FallbackIcon /></span>
  return <img className="hier-thumb" src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} />
}

// Matches the visible name and any searchTerms (code, document ID), case-insensitively and by substring.
function matchesQuery(option, needle) {
  return [option.name, ...(option.searchTerms ?? [])].some((term) => String(term).toLowerCase().includes(needle))
}

// Reusable picker for any hierarchy level. Options are { id, name, imageUrl, searchTerms? }.
// `allOption` ({ label, icon? }) adds a leading entry that clears the selection. It is not a record and is never saved as an ID.
export default function HierarchicalImageSelect({
  id,
  label,
  optional = false,
  options,
  value,
  onChange,
  status = 'ready',
  disabled = false,
  disabledText = '',
  placeholder = 'Select',
  emptyText = 'No options available',
  loadingText = 'Loading...',
  errorText = 'Could not load options',
  onRetry,
  allOption = null,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const triggerRef = useRef(null)

  // Drop duplicate ids so the same record never appears twice.
  const uniqueOptions = useMemo(() => {
    const seen = new Set()
    return options.filter((option) => {
      if (seen.has(option.id)) return false
      seen.add(option.id)
      return true
    })
  }, [options])

  const interactive = !disabled && status === 'ready' && uniqueOptions.length > 0
  const isOpen = open && interactive

  useEffect(() => {
    if (!isOpen) return undefined
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])
  const selected = uniqueOptions.find((option) => option.id === value) || null
  const needle = query.trim().toLowerCase()
  const visible = needle ? uniqueOptions.filter((option) => matchesQuery(option, needle)) : uniqueOptions
  const showAll = Boolean(allOption) && (!needle || allOption.label.toLowerCase().includes(needle))

  let trigger
  if (disabled) trigger = <span className="hier-select-name">{disabledText}</span>
  else if (status === 'loading') trigger = <span className="hier-select-name">{loadingText}</span>
  else if (status === 'error') trigger = <span className="hier-select-name">{errorText}</span>
  else if (uniqueOptions.length === 0) trigger = <span className="hier-select-name">{emptyText}</span>
  else if (selected) trigger = <><Thumb src={selected.imageUrl} /><span className="hier-select-name">{selected.name}</span></>
  else if (allOption) trigger = <><Thumb menu Icon={allOption.icon} /><span className="hier-select-name">{allOption.label}</span></>
  else trigger = <span className="hier-select-name hier-select-placeholder">{placeholder}</span>

  function close() {
    setOpen(false)
    setQuery('')
  }

  function choose(nextValue) {
    onChange(nextValue)
    close()
    triggerRef.current?.focus()
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && isOpen) {
      event.stopPropagation()
      close()
      triggerRef.current?.focus()
    }
  }

  return (
    <div className="dynamic-master-product-field hier-select" onKeyDown={handleKeyDown} ref={rootRef}>
      <label htmlFor={id}>
        {label}
        {optional
          ? <span className="master-category-optional"> (Optional)</span>
          : <span className="dynamic-master-product-required" aria-hidden="true"> *</span>}
      </label>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="hier-select-trigger"
        disabled={!interactive}
        id={id}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        {trigger}
        <span className="hier-select-caret"><ChevronIcon /></span>
      </button>
      {isOpen && (
        <div className="hier-select-panel">
          <input
            aria-label={`Search ${label}`}
            autoFocus
            className="hier-select-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            type="search"
            value={query}
          />
          <div aria-label={label} className="hier-select-list" role="listbox">
            {showAll && (
              <button
                aria-selected={!value}
                className={`hier-select-option${!value ? ' is-selected' : ''}`}
                onClick={() => choose('')}
                role="option"
                type="button"
              >
                <Thumb menu Icon={allOption.icon} />
                <span className="hier-select-name">{allOption.label}</span>
              </button>
            )}
            {visible.map((option) => (
              <button
                aria-selected={option.id === value}
                className={`hier-select-option${option.id === value ? ' is-selected' : ''}`}
                key={option.id}
                onClick={() => choose(option.id)}
                role="option"
                type="button"
              >
                <Thumb src={option.imageUrl} />
                <span className="hier-select-name">{option.name}</span>
              </button>
            ))}
            {!showAll && visible.length === 0 && <p className="hier-select-empty">No matches found</p>}
          </div>
        </div>
      )}
      {status === 'error' && (
        <span className="dynamic-master-product-inline-error" role="alert">
          {errorText} <button className="store-btn" onClick={onRetry} type="button">Retry</button>
        </span>
      )}
    </div>
  )
}
