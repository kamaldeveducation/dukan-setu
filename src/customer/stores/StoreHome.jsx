import StoreHeader from './StoreHeader.jsx'
import StoreTypeRenderer from './StoreTypeRenderer.jsx'

export default function StoreHome({ storeName, storeType }) {
  return (
    <section className="store-home">
      <StoreHeader storeName={storeName} />
      <StoreTypeRenderer storeType={storeType} />
    </section>
  )
}