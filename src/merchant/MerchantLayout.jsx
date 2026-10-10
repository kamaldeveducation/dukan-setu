import MerchantHeader from './MerchantHeader.jsx'
import MerchantPanel from './MerchantPanel.jsx'
import MerchantPending from './MerchantPending.jsx'

export default function MerchantLayout({ currentPath = '/merchant', currentUser, handleLogout, navigateTo, store }) {
  if (store?.status === 'approved') {
    return <MerchantPanel currentPath={currentPath} currentUser={currentUser} handleLogout={handleLogout} navigateTo={navigateTo} store={store} />
  }

  return (
    <div className="admin-shell">
      <MerchantHeader handleLogout={handleLogout} />
      <main className="dashboard-content">
        <MerchantPending navigateTo={navigateTo} store={store} />
      </main>
    </div>
  )
}