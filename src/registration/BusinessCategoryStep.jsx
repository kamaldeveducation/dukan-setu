export default function BusinessCategoryStep({ categories, value, onChange }) {
  return (
    <div className="registration-step-fields">
      <p className="registration-step-prompt">Choose a category within your business type.</p>
      <label className="registration-input" htmlFor="businessCategory">
        Business category
        <select
          id="businessCategory"
          onChange={(event) => onChange(event.target.value)}
          required
          value={value}
        >
          <option disabled value="">Select a category</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
    </div>
  )
}