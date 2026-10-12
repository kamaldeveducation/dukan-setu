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
    <section className="product-preview-section" aria-label="Demo products">
      <div className="product-preview-grid">
        {previewProducts.map((product) => <ProductPreviewCard key={product.name} product={product} />)}
      </div>
    </section>
  )
}