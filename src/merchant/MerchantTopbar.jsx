import { useEffect, useRef, useState } from 'react'
import MerchantIcon from './MerchantIcon.jsx'
import { merchantProfileItem } from './navigation.js'

export default function MerchantTopbar({ currentUser, handleLogout, moreOpen, navigateTo, onToggleMore, store }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const menuRef = useRef(null)
  const name = currentUser?.displayName || currentUser?.email || 'Merchant'

  useEffect(() => {
    if (!profileOpen) return undefined
    const close = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !menuRef.current?.contains(event.target)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [profileOpen])

  return (
    <header className="topbar merchant-topbar">
      <button aria-expanded={moreOpen} aria-label="Open more modules" className="merchant-icon-button merchant-more-toggle" onClick={onToggleMore} type="button">
        <MerchantIcon name="menu" />
      </button>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">D</span>
        <span>Dukan Setu</span>
      </div>
      <div className="merchant-store-chip">
        <strong>{store?.storeName || 'Your store'}</strong>
        <span className={`merchant-status merchant-status-${store?.status || 'unknown'}`}>{store?.status || 'unknown'}</span>
      </div>
      <div className="merchant-topbar-actions">
        <button aria-label="Notifications (coming soon)" className="merchant-icon-button" title="Notifications coming soon" type="button">
          <MerchantIcon name="bell" />
        </button>
        <div className="merchant-profile-menu" ref={menuRef}>
          <button aria-expanded={profileOpen} aria-haspopup="menu" className="merchant-profile-button" onClick={() => setProfileOpen((open) => !open)} type="button">
            <span className="merchant-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
            <span className="merchant-profile-name">{name}</span>
          </button>
          {profileOpen && (
            <div className="merchant-profile-dropdown" role="menu">
              <button onClick={() => { setProfileOpen(false); navigateTo(merchantProfileItem.path) }} role="menuitem" type="button">Profile</button>
              <button onClick={() => { setProfileOpen(false); handleLogout() }} role="menuitem" type="button">Log out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
