import AdminStores from './AdminStores.jsx'
import AdminBusinessTypes from './AdminBusinessTypes.jsx'
import AdminBusinessCategories from './AdminBusinessCategories.jsx'
import AdminMasterCategories from './AdminMasterCategories.jsx'
import AdminMasterSubCategories from './AdminMasterSubCategories.jsx'
import AdminMasterSubSubCategories from './AdminMasterSubSubCategories.jsx'
import { navigationItems } from './navigation.js'
import NavigationIcon from './NavigationIcon.jsx'

export default function AdminDashboard({ activePage, displayName, setActivePage }) {
  const activeItem = navigationItems.find((item) => item.label === activePage)

  return (
    <main className="dashboard-content" id="dashboard">
      <div className="page-context"><span>DUKAN SETU</span><span aria-hidden="true">/</span><span>{activePage}</span></div>
      {activePage === 'Dashboard' ? (
        <>
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">CONTROL ROOM</p>
              <h1>Welcome back, {displayName}.</h1>
              <p className="dashboard-intro">Your Dukan Setu platform workspace, all in one place.</p>
            </div>
            <div className="access-badge"><span aria-hidden="true" /> Access verified</div>
          </div>

          <section className="overview-banner" aria-labelledby="overview-title">
            <div className="overview-copy">
              <p className="eyebrow">PLATFORM OVERVIEW</p>
              <h2 id="overview-title">A clearer view of local commerce.</h2>
              <p>Manage the tools and services that help every dukan move forward.</p>
            </div>
            <div className="overview-stamp" aria-label="Dukan Setu Master Admin workspace">
              <span>DS</span>
              <small>MASTER ADMIN</small>
            </div>
          </section>

          <section className="platform-section" aria-labelledby="platform-areas-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR WORKSPACE</p>
                <h2 id="platform-areas-title">Platform areas</h2>
              </div>
              <span className="section-count">{navigationItems.length - 1} areas</span>
            </div>
            <div className="platform-grid">
              {navigationItems.filter((item) => item.label !== 'Dashboard').map((item, index) => (
                <button className="platform-card" key={item.label} onClick={() => setActivePage(item.label)} type="button">
                  <span className="platform-card-icon"><NavigationIcon name={item.icon} /></span>
                  <span className="platform-card-title">{item.label}</span>
                  <span className="platform-card-footer">
                    <span>Coming next</span>
                    <span aria-hidden="true">&#8594;</span>
                  </span>
                  <span className="platform-card-index">0{index + 1}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : activePage === 'Stores' ? (
        <AdminStores />
      ) : activePage === 'Business Types' ? (
        <AdminBusinessTypes />
      ) : activePage === 'Business Categories' ? (
        <AdminBusinessCategories />
      ) : activePage === 'Master Categories' ? (
        <AdminMasterCategories />
      ) : activePage === 'Master Sub Categories' ? (
        <AdminMasterSubCategories />
      ) : activePage === 'Master Sub-Subcategories' ? (
        <AdminMasterSubSubCategories />
      ) : (
        <section className="coming-panel" aria-labelledby="coming-title">
          <span className="coming-icon"><NavigationIcon name={activeItem.icon} /></span>
          <p className="eyebrow">DUKAN SETU / {activePage.toUpperCase()}</p>
          <h1 id="coming-title">{activePage}</h1>
          <p>This workspace is being prepared. It will appear here in a future update.</p>
          <span className="coming-status">Coming next</span>
          <button className="return-button" onClick={() => setActivePage('Dashboard')} type="button">
            <span aria-hidden="true">&#8592;</span> Back to dashboard
          </button>
        </section>
      )}
    </main>
  )
}