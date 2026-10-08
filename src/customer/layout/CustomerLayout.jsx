import { useState } from 'react'
import CustomerHeader from './CustomerHeader.jsx'
import CustomerSidebar from './CustomerSidebar.jsx'
import CustomerBottomNav from './CustomerBottomNav.jsx'
import CustomerHome from '../home/CustomerHome.jsx'
import '../Customer.css'

export default function CustomerLayout({ handleLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="customer-app-shell">
      {menuOpen && (
        <button
          aria-label="Close customer navigation"
          className="customer-drawer-backdrop"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      )}
      <CustomerSidebar menuOpen={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <div className="customer-workspace">
        <CustomerHeader
          handleLogout={handleLogout}
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((open) => !open)}
        />
        <main className="customer-main">
          <CustomerHome />
        </main>
        <CustomerBottomNav activePage="Home" />
      </div>
    </div>
  )
}