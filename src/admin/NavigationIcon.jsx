const navigationIcons = {
  dashboard: <><rect x="3" y="3" width="5" height="5" rx="1" /><rect x="12" y="3" width="5" height="5" rx="1" /><rect x="3" y="12" width="5" height="5" rx="1" /><rect x="12" y="12" width="5" height="5" rx="1" /></>,
  store: <><path d="M3 8.5 4.5 3h11L17 8.5" /><path d="M4 8v9h12V8M7 17v-5h6v5" /><path d="M3 8.5a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" /></>,
  types: <><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M7 7h6M7 10h6M7 13h3" /></>,
  categories: <><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h3.4l1.4 1.5H15a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 15 15.5H4.5A1.5 1.5 0 0 1 3 14Z" /></>,
  people: <><path d="M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M5 19v-1a7 7 0 0 1 14 0v1" /><path d="M5.5 5.5a3 3 0 0 0 0 5.8M2.5 18v-1a5 5 0 0 1 2-4" /></>,
  person: <><circle cx="10" cy="6" r="3" /><path d="M4 18v-1a6 6 0 0 1 12 0v1Z" /></>,
  box: <><path d="m10 2 7 4v8l-7 4-7-4V6Z" /><path d="m3.5 5.8 6.5 4 6.5-4M10 10v8" /></>,
  receipt: <><path d="M5 2h10v16l-2.5-1.5L10 18l-2.5-1.5L5 18Z" /><path d="M8 7h4M8 11h4" /></>,
  ledger: <><circle cx="10" cy="10" r="8" /><path d="M12.5 7.5c-.5-.7-1.3-1-2.4-1-1.2 0-2.1.6-2.1 1.6 0 2.6 5 .8 5 3.8 0 1.1-1 1.8-2.5 1.8-1.2 0-2.2-.4-2.8-1.2M10 5v10" /></>,
  refresh: <><path d="M16 7V3l3 3-3 3V7a6 6 0 0 0-10.2-4.2M4 13v4l-3-3 3-3v2a6 6 0 0 0 10.2 4.2" /></>,
  settings: <><circle cx="10" cy="10" r="3" /><path d="m8.4 2.8.5-1h2.2l.5 1 1.5.9 1.1-.2 1.1 1.9-.6.9v1.8l.6.9-1.1 1.9-1.1-.2-1.5.9-.5 1h-2.2l-.5-1-1.5-.9-1.1.2-1.1-1.9.6-.9V5.4l-.6-.9 1.1-1.9 1.1.2Z" transform="translate(0 2)" /></>,
}

export default function NavigationIcon({ name }) {
  return (
    <svg aria-hidden="true" className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {navigationIcons[name]}
    </svg>
  )
}