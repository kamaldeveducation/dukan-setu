const demoStores = ['Mukesh Kirana', 'Sharma General', 'Gupta Store']

export default function StoreSelector() {
  return (
    <section className="store-selector" aria-label="Demo stores">
      <div className="store-chip-list">
        {demoStores.map((store, index) => (
          <span className={`store-chip${index === 0 ? ' is-selected' : ''}`} key={store}>
            <span className="store-chip-dot" aria-hidden="true" />
            {store}
          </span>
        ))}
      </div>
    </section>
  )
}