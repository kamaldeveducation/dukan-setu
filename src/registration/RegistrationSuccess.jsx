export default function RegistrationSuccess({ store, navigateTo }) {
  return (
    <div className="registration-success" role="status">
      <span className="registration-success-mark" aria-hidden="true">&#10003;</span>
      <p className="eyebrow">APPLICATION RECEIVED</p>
      <h2>Business Registration Submitted</h2>
      <p>Your business is currently under review.</p>
      <dl className="registration-success-details">
        <div><dt>Business Name</dt><dd>{store.storeName}</dd></div>
        <div><dt>Business ID</dt><dd>{store.storeId}</dd></div>
        <div><dt>Status</dt><dd><span className="pending-status">Pending Approval</span></dd></div>
      </dl>
      <p>Your Dukan Setu store link will be available after approval.</p>
      <button className="submit-button" onClick={() => navigateTo('/merchant')} type="button">
        View application status <span aria-hidden="true">&#8594;</span>
      </button>
    </div>
  )
}