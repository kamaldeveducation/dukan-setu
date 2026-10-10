const icons = {
  dashboard: <><rect x="3" y="3" width="5" height="5" rx="1" /><rect x="12" y="3" width="5" height="5" rx="1" /><rect x="3" y="12" width="5" height="5" rx="1" /><rect x="12" y="12" width="5" height="5" rx="1" /></>,
  box: <><path d="m10 2 7 4v8l-7 4-7-4V6Z" /><path d="m3.5 5.8 6.5 4 6.5-4M10 10v8" /></>,
  barcode: <path d="M3 4v12M6 4v12M9 4v12M12 4v12M15 4v12M17 4v12" />,
  grid: <><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="11" y="3" width="6" height="6" rx="1" /><rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" /></>,
  receipt: <><path d="M5 2h10v16l-2.5-1.5L10 18l-2.5-1.5L5 18Z" /><path d="M8 7h4M8 11h4" /></>,
  bill: <><path d="M5 2h7l4 4v12H5Z" /><path d="M12 2v4h4M8 10h5M8 14h5" /></>,
  people: <><circle cx="7.5" cy="6.5" r="2.7" /><path d="M2.5 17v-1a5 5 0 0 1 10 0v1" /><circle cx="14" cy="7" r="2.2" /><path d="M14.5 11.2a4.2 4.2 0 0 1 3 4.1V17" /></>,
  heart: <path d="M10 17s-7-4.3-7-9a3.8 3.8 0 0 1 7-2 3.8 3.8 0 0 1 7 2c0 4.7-7 9-7 9Z" />,
  megaphone: <><path d="M3 8v4h3l8 4V4L6 8Z" /><path d="M17 8.5v3" /></>,
  play: <><rect x="2.5" y="4" width="15" height="12" rx="2" /><path d="m8.5 7.5 4 2.5-4 2.5Z" /></>,
  calculator: <><rect x="4" y="2" width="12" height="16" rx="2" /><path d="M7 6h6M7 10h.01M10 10h.01M13 10h.01M7 14h.01M10 14h.01M13 14h.01" /></>,
  settings: <><circle cx="10" cy="10" r="2.8" /><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" /></>,
  person: <><circle cx="10" cy="6" r="3" /><path d="M4 18v-1a6 6 0 0 1 12 0v1Z" /></>,
  bell: <><path d="M5 8a5 5 0 0 1 10 0c0 5 2 6 2 6H3s2-1 2-6Z" /><path d="M8.5 17a1.8 1.8 0 0 0 3 0" /></>,
  menu: <path d="M3 5h14M3 10h14M3 15h14" />,
  chevron: <path d="m12 5-5 5 5 5" />,
  more: <><circle cx="4" cy="10" r="1" /><circle cx="10" cy="10" r="1" /><circle cx="16" cy="10" r="1" /></>,
}

export default function MerchantIcon({ name }) {
  return (
    <svg aria-hidden="true" className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  )
}
