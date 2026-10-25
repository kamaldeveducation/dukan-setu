export default function ModulePlaceholder({ title, summary }) {
  return (
    <section className="coming-panel product-config-placeholder" aria-labelledby="product-config-placeholder-title">
      <p className="eyebrow">PRODUCT CONFIGURATION STUDIO / {title.toUpperCase()}</p>
      <h1 id="product-config-placeholder-title">{title}</h1>
      <p>{summary}</p>
      <span className="coming-status">Placeholder - not implemented yet</span>
    </section>
  )
}
