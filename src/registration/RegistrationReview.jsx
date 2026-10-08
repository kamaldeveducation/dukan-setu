export default function RegistrationReview({ business, owner, businessType, category }) {
  const entries = [
    ['Business', business.businessName],
    ['Type', businessType],
    ['Category', category],
    ['Business mobile', business.businessMobile],
    ['Business email', business.businessEmail],
    ['Address', [business.address, business.city, business.state, business.pincode].filter(Boolean).join(', ')],
    ['Owner', owner.ownerName],
    ['Owner mobile', owner.ownerMobile],
    ['Owner email', owner.ownerEmail],
  ]

  return (
    <dl className="registration-review-list">
      {entries.map(([label, value]) => (
        <div className="registration-review-row" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}