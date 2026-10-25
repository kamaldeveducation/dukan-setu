import { useState } from 'react'

export default function AdminNavigationGroup({ activePage, id, items, label, onSelect }) {
  const containsActivePage = items.some((item) => item.label === activePage)
  const [expanded, setExpanded] = useState(containsActivePage)
  const listId = `${id}-items`

  return (
    <div className={`nav-group${containsActivePage ? ' has-active' : ''}`}>
      <button
        aria-controls={listId}
        aria-expanded={expanded}
        className="nav-group-toggle"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span>{label.toUpperCase()}</span>
        <svg aria-hidden="true" className="nav-group-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 8 4 4 4-4" />
        </svg>
      </button>
      {expanded && (
        <div className="nav-subitems" id={listId}>
          {items.map((item) => (
            <button
              aria-current={activePage === item.label ? 'page' : undefined}
              className={`nav-item nav-subitem${activePage === item.label ? ' is-active' : ''}`}
              key={item.label}
              onClick={() => onSelect(item.label)}
              type="button"
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
