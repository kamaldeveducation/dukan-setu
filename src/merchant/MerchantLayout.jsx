import MerchantDashboard from './MerchantDashboard.jsx'
import MerchantHeader from './MerchantHeader.jsx'
import MerchantPending from './MerchantPending.jsx'

export default function MerchantLayout({ handleLogout, navigateTo, store }) {
  const approved = store?.status === 'approved'

  return (
    <div className="admin-shell">
      <MerchantHeader handleLogout={handleLogout} />
      <main className="dashboard-content">
        {approved ? <MerchantDashboard /> : <MerchantPending navigateTo={navigateTo} store={store} />}
      </main>
    </div>
  )
}