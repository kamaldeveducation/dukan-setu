import CategorySection from './CategorySection.jsx'
import CustomerSearchBar from './CustomerSearchBar.jsx'
import SpecialProducts from './SpecialProducts.jsx'
import StoreSelector from './StoreSelector.jsx'

export default function CustomerHome() {
  return (
    <div className="customer-home">
      <StoreSelector />
      <CustomerSearchBar />

      <section className="current-store-banner" aria-label="Current store">
        <span className="store-banner-icon" aria-hidden="true">🏪</span>
        <span><strong>Mukesh Kirana</strong><small>Retail Price</small></span>
        <span className="store-banner-arrow" aria-hidden="true">›</span>
      </section>

      <CategorySection />
      <SpecialProducts />
    </div>
  )
}