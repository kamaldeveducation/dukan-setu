import { Fragment } from 'react'
import { navigationItems } from './navigation.js'
import NavigationIcon from './NavigationIcon.jsx'

export default function AdminSidebar({ activePage, currentUser, displayName, drawerOpen, handleLogout, setActivePage, setDrawerOpen }) {
  return (
    <aside className={`sidebar${drawerOpen ? ' drawer-open' : ''}`} id="master-admin-navigation" aria-label="Master Admin navigation">
      <div className="mobile-profile">
        <span className="user-avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
        <div className="mobile-profile-identity">
          <span className="mobile-profile-name">{displayName}</span>
          {currentUser.email && <span className="mobile-profile-email">{currentUser.email}</span>}
        </div>
      </div>
      <div className="drawer-heading">
        <span>WORKSPACE</span>
      </div>
      <p className="sidebar-label">WORKSPACE</p>
      <nav className="sidebar-nav" aria-label="Dashboard sections">
        {navigationItems.map((item, index) => (
          <Fragment key={item.label}>
            {item.group && item.group !== navigationItems[index - 1]?.group && <p className="nav-group-label">{item.group.toUpperCase()}</p>}
            <button
              aria-current={activePage === item.label ? 'page' : undefined}
              className={`nav-item${activePage === item.label ? ' is-active' : ''}`}
              onClick={() => {
                setActivePage(item.label)
                setDrawerOpen(false)
              }}
              type="button"
            >
              <NavigationIcon name={item.icon} />
              <span>{item.label}</span>
              {item.label === 'Dashboard' && <span className="nav-indicator" aria-hidden="true" />}
            </button>
          </Fragment>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="logout-button" type="button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </aside>
  )
}