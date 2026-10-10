import { merchantProfileItem } from '../navigation.js'

export default function ProfilePage({ currentUser, store }) {
  return (
    <section className="merchant-page" aria-labelledby="merchant-page-title">
      <header className="merchant-page-head">
        <p className="eyebrow">DUKAN SETU / MERCHANT</p>
        <h1 id="merchant-page-title">{merchantProfileItem.label}</h1>
        <p>{merchantProfileItem.description}</p>
      </header>
      <div className="merchant-card">
        <dl className="merchant-details">
          <div><dt>Name</dt><dd>{currentUser?.displayName || store?.ownerName || '—'}</dd></div>
          <div><dt>Email</dt><dd>{currentUser?.email || store?.ownerEmail || '—'}</dd></div>
          <div><dt>Store</dt><dd>{store?.storeName || '—'}</dd></div>
          <div><dt>Store ID</dt><dd>{store?.storeId || '—'}</dd></div>
          <div><dt>Status</dt><dd>{store?.status || '—'}</dd></div>
        </dl>
        <span className="coming-status">Profile editing setup pending</span>
      </div>
    </section>
  )
}
