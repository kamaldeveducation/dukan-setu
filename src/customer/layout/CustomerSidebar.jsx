import { customerNavigation } from './navigation.js'

export default function CustomerSidebar({ menuOpen, onNavigate, handleLogout }) {
  return (
    <aside className={`customer-sidebar${menuOpen ? ' is-open' : ''}`} id="customer-sidebar" aria-label="Customer navigation">
      <div className="customer-sidebar-brand">
        <span className="customer-sidebar-mark" aria-hidden="true">🛍️</span>
        <span>Dukan Setu</span>
      </div>
      <p className="customer-sidebar-label">YOUR SHOPPING</p>
      <nav className="customer-sidebar-nav">
        {customerNavigation.map(({ label, icon }) => (
          <button
            aria-current={label === 'Home' ? 'page' : undefined}
            className={`customer-sidebar-item${label === 'Home' ? ' is-active' : ''}`}
            key={label}
            onClick={onNavigate}
            type="button"
          >
            <span className="customer-nav-icon" aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
        <button className="customer-sidebar-item" onClick={handleLogout} type="button">
          <span className="customer-nav-icon" aria-hidden="true">↪</span>
          <span>Log out</span>
        </button>
      </nav>
      <div className="customer-sidebar-note">
        <span aria-hidden="true">✳</span>
        <p>Your neighbourhood, all in one place.</p>
      </div>
    </aside>
  )
}