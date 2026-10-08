export default function MerchantPending({ navigateTo, store }) {
  const rejected = store?.status === 'rejected'

  return (
    <section className="coming-panel merchant-pending-panel" aria-labelledby="merchant-pending-title">
      <p className="eyebrow">MERCHANT APPLICATION</p>
      <span className="pending-status">{rejected ? 'Not Approved' : 'Pending Approval'}</span>
      <h1 id="merchant-pending-title">{rejected ? 'Your application needs changes.' : 'Your business is under review.'}</h1>
      <p>{rejected
        ? 'Update your application details and resubmit it for review.'
        : 'We will make your merchant workspace available after your store is approved.'}</p>
      {rejected && navigateTo && (
        <button className="submit-button" onClick={() => navigateTo('/register/store')} type="button">
          Edit and resubmit <span aria-hidden="true">&#8594;</span>
        </button>
      )}
      {store && (
        <dl className="merchant-pending-details">
          <div><dt>Business Name</dt><dd>{store.storeName}</dd></div>
          <div><dt>Business ID</dt><dd>{store.storeId}</dd></div>
        </dl>
      )}
    </section>
  )
}