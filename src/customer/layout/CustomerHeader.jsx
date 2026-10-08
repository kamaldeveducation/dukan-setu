export default function CustomerHeader({ handleLogout, menuOpen, onMenuToggle }) {
  return (
    <header className="customer-header">
      <button
        aria-controls="customer-sidebar"
        aria-expanded={menuOpen}
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        className="customer-menu-toggle"
        onClick={onMenuToggle}
        type="button"
      >
        <span aria-hidden="true">☰</span>
      </button>
      <div className="customer-header-brand">
        <span className="customer-bag-mark" aria-hidden="true">🛍️</span>
        <span className="customer-brand-copy">
          <strong>Dukan Setu</strong>
          <small>Global Customer · Multi-Store Shopping</small>
        </span>
      </div>
      <button className="customer-logout" type="button" onClick={handleLogout}>Log out</button>
    </header>
  )
}