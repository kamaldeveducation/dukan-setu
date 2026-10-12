import CategorySection from './CategorySection.jsx'
import CustomerSearchBar from './CustomerSearchBar.jsx'
import SpecialProducts from './SpecialProducts.jsx'
import StoreSelector from './StoreSelector.jsx'

export default function CustomerHome() {
  return (
    <div className="customer-home">
      <StoreSelector />
      <CustomerSearchBar />

      <section className="customer-offer-banner" aria-labelledby="customer-offer-title">
        <div className="customer-offer-copy">
          <span className="customer-offer-eyebrow">TODAY'S OFFER</span>
          <h2 id="customer-offer-title">आज की खास बचत!</h2>
          <p>चुनिंदा प्रोडक्ट्स पर शानदार ऑफर</p>
          <button type="button">अभी देखें →</button>
        </div>
        <span className="customer-offer-illustration" aria-hidden="true">🧺</span>
      </section>

      <CategorySection />
      <SpecialProducts />
    </div>
  )
}