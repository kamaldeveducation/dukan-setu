import { useState } from 'react'
import MerchantBottomNav from './MerchantBottomNav.jsx'
import MerchantSidebar, { MerchantNavLink } from './MerchantSidebar.jsx'
import MerchantTopbar from './MerchantTopbar.jsx'
import { merchantNavigation, resolveMerchantItem } from './navigation.js'
import { merchantPages } from './pages/index.js'

export default function MerchantPanel({ currentPath, currentUser, handleLogout, navigateTo, store }) {
  const [collapsed, setCollapsed] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const activeItem = resolveMerchantItem(currentPath)
  const Page = merchantPages[activeItem.id]
  const moreItems = merchantNavigation.filter((item) => !item.mobilePrimary)

  function go(path) {
    setMoreOpen(false)
    navigateTo(path)
  }

  return (
    <div className="admin-shell merchant-shell">
      <MerchantTopbar
        currentUser={currentUser}
        handleLogout={handleLogout}
        moreOpen={moreOpen}
        navigateTo={go}
        onToggleMore={() => setMoreOpen((open) => !open)}
        store={store}
      />
      {moreOpen && <button aria-label="Close menu" className="merchant-backdrop" onClick={() => setMoreOpen(false)} type="button" />}
      <div className={`merchant-layout${collapsed ? ' is-collapsed' : ''}`}>
        <MerchantSidebar collapsed={collapsed} currentPath={activeItem.path} items={merchantNavigation} navigateTo={go} onToggle={() => setCollapsed((value) => !value)} />
        {moreOpen && (
          <nav aria-label="More modules" className="merchant-more-menu">
            <p className="eyebrow">MORE</p>
            {moreItems.map((item) => (
              <MerchantNavLink currentPath={activeItem.path} item={item} key={item.id} navigateTo={go} />
            ))}
          </nav>
        )}
        <main className="dashboard-content merchant-content" id="merchant-main">
          <Page currentUser={currentUser} navigateTo={go} store={store} storeName={store?.storeName} />
        </main>
      </div>
      <MerchantBottomNav currentPath={activeItem.path} navigateTo={go} />
    </div>
  )
}
