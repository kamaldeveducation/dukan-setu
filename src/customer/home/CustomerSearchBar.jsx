export default function CustomerSearchBar() {
  return (
    <div className="customer-search" role="search">
      <span className="customer-search-icon" aria-hidden="true">⌕</span>
      <input
        aria-label="Search products"
        placeholder="Search: rice, dal, sabun, oil..."
        type="search"
      />
      <button type="button">खोजें</button>
    </div>
  )
}