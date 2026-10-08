export default function ProductPreviewCard({ product }) {
  return (
    <article className="product-preview-card">
      <div className={`product-preview-art tone-${product.tone}`} role="img" aria-label={`${product.name} illustration placeholder`}>
        <span className="product-discount">{product.discount}</span>
        <span className="product-wishlist" aria-hidden="true">♡</span>
        <span className="product-illustration" aria-hidden="true">{product.illustration}</span>
        <span className="product-art-caption">DUKAN SETU · DAILY ESSENTIALS</span>
      </div>
      <div className="product-preview-copy">
        <span className="product-category-label">{product.category}</span>
        <h3>{product.name}</h3>
        <p>{product.description}</p>
      </div>
    </article>
  )
}