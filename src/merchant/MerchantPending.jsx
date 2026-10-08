export default function MerchantPending({ store }) {
  return (
    <section className="coming-panel merchant-pending-panel" aria-labelledby="merchant-pending-title">
      <p className="eyebrow">MERCHANT APPLICATION</p>
      <span className="pending-status">Pending Approval</span>
      <h1 id="merchant-pending-title">Your business is under review.</h1>
      <p>We will make your merchant workspace available after your store is approved.</p>
      {store && (
        <dl className="merchant-pending-details">
          <div><dt>Business Name</dt><dd>{store.storeName}</dd></div>
          <div><dt>Business ID</dt><dd>{store.storeId}</dd></div>
        </dl>
      )}
    </section>
  )
}