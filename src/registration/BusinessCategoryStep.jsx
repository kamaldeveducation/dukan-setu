function pairKey(businessTypeId, categoryId) {
  return JSON.stringify([businessTypeId, categoryId])
}

function CategoryOptions({ categories, selectedPairs, onChange }) {
  return (
    <div className="business-category-grid">
      {categories.map((category) => {
        const businessTypeId = category.businessTypeId
        const selected = selectedPairs.some((pair) => pairKey(pair.businessTypeId, pair.categoryId) === pairKey(businessTypeId, category.id))
        return (
          <label className={`business-category-option${selected ? ' is-selected' : ''}`} key={pairKey(businessTypeId, category.id)}>
            <input
              checked={selected}
              onChange={() => onChange(category)}
              type="checkbox"
              value={category.id}
            />
            <span>{category.name}</span>
            {category.businessTypeName && <small>{category.businessTypeName}</small>}
          </label>
        )
      })}
    </div>
  )
}

export default function BusinessCategoryStep({
  browseCategories,
  browseError,
  browseLoading,
  browseOpen,
  browseTypeFilter,
  businessTypes,
  businessTypesError,
  businessTypesLoading,
  categories,
  error,
  loading,
  onBrowseRetry,
  onBusinessTypesRetry,
  onBrowseToggle,
  onBrowseTypeFilterChange,
  onChange,
  onRetry,
  onSearchChange,
  onToggleCategory,
  search,
  selectedCategories,
  selectedPairs,
}) {
  const suggestedCategories = categories.filter((category) => !search.trim()
    || [category.name, category.code].some((field) => String(field || '').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))

  return (
    <fieldset className="registration-step-fields business-category-step">
      <legend className="registration-step-prompt">Choose one or more categories for your business.</legend>
      <p className="business-category-count" role="status">{selectedPairs.length} {selectedPairs.length === 1 ? 'category' : 'categories'} selected</p>
      {selectedCategories.length > 0 && (
        <div aria-label="Selected Business Categories" className="business-category-summary">
          {selectedCategories.map((category) => (
            <button
              aria-label={`Remove ${category.name}`}
              className="business-category-chip"
              key={pairKey(category.businessTypeId, category.categoryId)}
              onClick={() => onToggleCategory({ businessTypeId: category.businessTypeId, id: category.categoryId })}
              type="button"
            >
              <span>{category.name}{category.businessTypeName ? ` · ${category.businessTypeName}` : ''}</span>
              <span aria-hidden="true">x</span>
            </button>
          ))}
        </div>
      )}

      <section aria-labelledby="suggested-categories-title" className="business-category-section">
        <h3 id="suggested-categories-title">Suggested Categories</h3>
      {loading ? (
        <p className="registration-state" role="status">Loading Business Categories...</p>
      ) : error ? (
        <div className="registration-state registration-state-error" role="alert">
          <p>Business Categories could not be loaded. {error}</p>
          <button className="registration-retry-button" onClick={onRetry} type="button">Retry</button>
        </div>
      ) : categories.length === 0 ? (
        <p className="registration-state">No active categories are available for this Business Type. Browse all categories or contact the administrator.</p>
      ) : (
        <>
          {categories.length > 6 && (
            <label className="business-category-search" htmlFor="business-category-search">
              Search categories
              <input
                autoComplete="off"
                id="business-category-search"
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search by name or code"
                type="search"
                value={search}
              />
            </label>
          )}
          {suggestedCategories.length === 0 ? (
            <p className="registration-state">No categories match your search.</p>
          ) : (
            <CategoryOptions categories={suggestedCategories} onChange={onChange} selectedPairs={selectedPairs} />
          )}
        </>
      )}
      </section>

      <section aria-labelledby="browse-all-categories-title" className="business-category-browse">
        <button
          aria-controls="browse-all-categories-panel"
          aria-expanded={browseOpen}
          className="business-category-browse-toggle"
          onClick={onBrowseToggle}
          type="button"
        >
          <span id="browse-all-categories-title">Browse All Categories</span>
          <span aria-hidden="true">{browseOpen ? '-' : '+'}</span>
        </button>
        {browseOpen && (
          <div id="browse-all-categories-panel" className="business-category-browse-panel">
            <div className="business-category-browse-filters">
              <label className="business-category-search" htmlFor="all-category-type">
                Filter by Business Type
                <select
                  disabled={businessTypesLoading || Boolean(businessTypesError) || businessTypes.length === 0}
                  id="all-category-type"
                  onChange={(event) => onBrowseTypeFilterChange(event.target.value)}
                  value={browseTypeFilter}
                >
                  <option value="">Select a Business Type</option>
                  {businessTypes.map((type) => <option key={type.id} value={type.id}>{type.name || type.id}</option>)}
                </select>
              </label>
            </div>
            {businessTypesLoading ? (
              <p className="registration-state" role="status">Loading Business Types...</p>
            ) : businessTypesError ? (
              <div className="registration-state registration-state-error" role="alert">
                <p>Business Types could not be loaded. {businessTypesError}</p>
                <button className="registration-retry-button" onClick={onBusinessTypesRetry} type="button">Retry</button>
              </div>
            ) : businessTypes.length === 0 ? (
              <p className="registration-state">No Business Types are currently available.</p>
            ) : !browseTypeFilter ? (
              <p className="registration-state">Select a Business Type to view categories.</p>
            ) : browseLoading ? (
              <p className="registration-state" role="status">Loading Business Categories...</p>
            ) : browseError ? (
              <div className="registration-state registration-state-error" role="alert">
                <p>Business Categories could not be loaded. {browseError}</p>
                <button className="registration-retry-button" onClick={onBrowseRetry} type="button">Retry</button>
              </div>
            ) : browseCategories.length === 0 ? (
              <p className="registration-state">No active categories are available for this Business Type.</p>
            ) : (
              <CategoryOptions categories={browseCategories} onChange={onChange} selectedPairs={selectedPairs} />
            )}
          </div>
        )}
      </section>
    </fieldset>
  )
}