const categories = [
  { label: 'सभी', icon: '🛍️', tone: 'all' },
  { label: 'Grocery', icon: '🛒', tone: 'grocery' },
  { label: 'Oil', icon: '🛢️', tone: 'oil' },
  { label: 'Snacks', icon: '🍿', tone: 'snacks' },
]

export default function CategorySection() {
  return (
    <section className="category-section" aria-labelledby="category-title">
      <div className="customer-section-heading category-heading">
        <div>
          <p className="customer-eyebrow">BROWSE THE AISLES</p>
          <h2 id="category-title">Categories</h2>
        </div>
        <span className="customer-section-note">Flour</span>
      </div>
      <div className="category-grid">
        {categories.map(({ label, icon, tone }) => (
          <div className="category-item" key={label}>
            <span className={`category-icon tone-${tone}`} aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}