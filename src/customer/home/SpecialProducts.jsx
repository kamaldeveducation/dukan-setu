import ProductPreviewCard from './ProductPreviewCard.jsx'

const previewProducts = [
  {
    name: 'Everyday Wheat Flour',
    description: 'Freshly milled for everyday meals.',
    category: 'PANTRY PICK',
    discount: '15% OFF',
    illustration: '🌾',
    tone: 'flour',
  },
  {
    name: 'Mustard Cooking Oil',
    description: 'A bold, familiar flavour for your kitchen.',
    category: 'STORE SPECIAL',
    discount: '10% OFF',
    illustration: '🫙',
    tone: 'oil',
  },
]

export default function SpecialProducts() {
  return (
    <section className="special-products-section" aria-labelledby="special-products-title">
      <div className="customer-section-heading">
        <div>
          <p className="customer-eyebrow">HANDPICKED FOR YOU</p>
          <h2 id="special-products-title"><span aria-hidden="true">⭐</span> आज के Special Products</h2>
        </div>
        <span className="customer-section-note">Mukesh Kirana</span>
      </div>
      <div className="product-preview-grid">
        {previewProducts.map((product) => <ProductPreviewCard key={product.name} product={product} />)}
      </div>
    </section>
  )
}