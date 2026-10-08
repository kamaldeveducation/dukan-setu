import { customerBottomNavigation } from './navigation.js'

export default function CustomerBottomNav({ activePage = 'Home' }) {
  return (
    <nav className="customer-bottom-nav" aria-label="Customer navigation">
      {customerBottomNavigation.map(({ label, icon }) => (
        <span aria-current={activePage === label ? 'page' : undefined} className={activePage === label ? 'is-active' : undefined} key={label}>
          <span aria-hidden="true">{icon}</span>
          <small>{label}</small>
        </span>
      ))}
    </nav>
  )
}