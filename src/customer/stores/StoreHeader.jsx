export default function StoreHeader({ storeName = '' }) {
  if (!storeName) return null

  return (
    <header className="store-home-header">
      <h1>{storeName}</h1>
    </header>
  )
}