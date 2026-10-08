import AdminDashboard from './AdminDashboard.jsx'
import AdminHeader from './AdminHeader.jsx'
import AdminSidebar from './AdminSidebar.jsx'

export default function AdminLayout({
  activePage,
  currentUser,
  drawerOpen,
  handleLogout,
  setActivePage,
  setDrawerOpen,
}) {
  const displayName = currentUser.displayName || currentUser.email || 'Master Admin'

  return (
    <div className="admin-shell">
      <AdminHeader
        currentUser={currentUser}
        displayName={displayName}
        drawerOpen={drawerOpen}
        setActivePage={setActivePage}
        setDrawerOpen={setDrawerOpen}
      />
      {drawerOpen && (
        <button
          aria-label="Close navigation menu"
          className="drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          type="button"
        />
      )}
      <div className="admin-layout">
        <AdminSidebar
          activePage={activePage}
          currentUser={currentUser}
          displayName={displayName}
          drawerOpen={drawerOpen}
          handleLogout={handleLogout}
          setActivePage={setActivePage}
          setDrawerOpen={setDrawerOpen}
        />
        <AdminDashboard activePage={activePage} displayName={displayName} setActivePage={setActivePage} />
      </div>
    </div>
  )
}