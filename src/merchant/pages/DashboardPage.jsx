import { merchantNavigation } from '../navigation.js'
import MerchantIcon from '../MerchantIcon.jsx'

const sections = [
  { title: 'Summary', text: 'Key store figures will appear here once reporting is set up.' },
  { title: 'Recent orders', text: 'Recent customer orders will be listed here.' },
  { title: 'Product activity', text: 'Product updates and stock activity will appear here.' },
]

export default function DashboardPage({ navigateTo, storeName }) {
  const shortcuts = merchantNavigation.filter((item) => ['products', 'orders', 'categories', 'users'].includes(item.id))

  return (
    <section className="merchant-page" aria-labelledby="merchant-page-title">
      <header className="merchant-page-head">
        <p className="eyebrow">DUKAN SETU / MERCHANT</p>
        <h1 id="merchant-page-title">Dashboard</h1>
        <p>{storeName ? `Overview of ${storeName}.` : 'Overview of your store.'}</p>
      </header>
      <div className="merchant-grid">
        {sections.map((section) => (
          <div className="merchant-card" key={section.title}>
            <h2>{section.title}</h2>
            <p className="merchant-muted">{section.text}</p>
            <span className="coming-status">Module setup pending</span>
          </div>
        ))}
        <div className="merchant-card">
          <h2>Shortcuts</h2>
          <div className="merchant-shortcuts">
            {shortcuts.map((item) => (
              <button key={item.id} onClick={() => navigateTo(item.path)} type="button">
                <MerchantIcon name={item.icon} /> {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
