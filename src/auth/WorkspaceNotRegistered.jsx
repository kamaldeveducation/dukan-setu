const workspaceCopy = {
  customer: {
    title: 'Not registered as Customer',
    message: 'You are not registered as a customer. Please create your customer account first.',
    path: '/register/customer',
    action: 'Register as Customer',
    other: { capability: 'isMerchant', path: '/merchant', label: 'Open Merchant workspace' },
  },
  merchant: {
    title: 'Not registered as Merchant',
    message: 'You are not registered as a merchant. Please register your store first.',
    path: '/register/store',
    action: 'Register Your Store',
    other: { capability: 'isCustomer', path: '/customer', label: 'Open Customer workspace' },
  },
}

export default function WorkspaceNotRegistered({ capabilities, handleLogout, kind, navigateTo }) {
  const copy = workspaceCopy[kind]

  return (
    <main className="customer-registration">
      <header className="registration-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span>Dukan Setu</span>
        </div>
        <button className="registration-back" type="button" onClick={handleLogout}>Log out</button>
      </header>
      <section className="registration-panel" aria-labelledby="not-registered-title">
        <p className="eyebrow">DUKAN SETU</p>
        <h1 id="not-registered-title">{copy.title}</h1>
        <p className="registration-intro">{copy.message}</p>
        <button className="submit-button" type="button" onClick={() => navigateTo(copy.path)}>
          {copy.action} <span aria-hidden="true">&#8594;</span>
        </button>
        {capabilities[copy.other.capability] && (
          <button className="password-text-button" type="button" onClick={() => navigateTo(copy.other.path)}>
            {copy.other.label}
          </button>
        )}
      </section>
    </main>
  )
}
