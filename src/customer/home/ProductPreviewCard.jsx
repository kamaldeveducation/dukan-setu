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
        <div className="product-quantity-demo" aria-label="Demo quantity controls">
          <div className="product-quantity-stepper">
            <button aria-label="Decrease quantity" type="button">−</button>
            <output>1 kg</output>
            <button aria-label="Increase quantity" type="button">+</button>
          </div>
          <div className="product-suggested-quantities" aria-label="Suggested quantities">
            <button type="button">250 g</button>
            <button type="button">500 g</button>
            <button type="button">1 kg</button>
          </div>
          <div className="product-custom-quantity">
            <input aria-label="Custom quantity" inputMode="decimal" placeholder="Qty" type="text" />
            <button type="button">लागू</button>
          </div>
        </div>
      </div>
    </article>
  )
}