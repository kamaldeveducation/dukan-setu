import MerchantIcon from '../MerchantIcon.jsx'

export default function ModulePlaceholder({ description, icon, title }) {
  return (
    <section className="merchant-page" aria-labelledby="merchant-page-title">
      <header className="merchant-page-head">
        <p className="eyebrow">DUKAN SETU / MERCHANT</p>
        <h1 id="merchant-page-title">{title}</h1>
        <p>{description}</p>
      </header>
      <div className="merchant-card merchant-empty">
        <span className="coming-icon"><MerchantIcon name={icon} /></span>
        <h2>Module setup pending</h2>
        <p>This module is not available yet. It will appear here in a future update.</p>
      </div>
    </section>
  )
}
