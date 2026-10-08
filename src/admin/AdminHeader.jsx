export default function AdminHeader({ displayName, currentUser, drawerOpen, setDrawerOpen, setActivePage }) {
  return (
    <header className="topbar">
      <button
        aria-controls="master-admin-navigation"
        aria-expanded={drawerOpen}
        aria-label={drawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
        className="menu-toggle"
        onClick={() => setDrawerOpen((open) => !open)}
        type="button"
      >
        <span aria-hidden="true">&#9776;</span>
      </button>
      <button className="brand" type="button" onClick={() => setActivePage('Dashboard')} aria-label="Dukan Setu dashboard">
        <span className="brand-mark" aria-hidden="true">D</span>
        <span>Dukan Setu</span>
      </button>
      <span className="topbar-divider" aria-hidden="true" />
      <span className="portal-name">Master Admin</span>
      <div className="topbar-account">
        <div className="account-identity">
          <span className="account-label">{displayName}</span>
          {currentUser.email && <span className="account-email">{currentUser.email}</span>}
        </div>
        <span className="user-avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
      </div>
    </header>
  )
}