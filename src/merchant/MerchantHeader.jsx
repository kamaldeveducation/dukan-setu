export default function MerchantHeader({ handleLogout }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">D</span>
        <span>Dukan Setu</span>
      </div>
      <button className="logout-button" type="button" onClick={handleLogout}>Log out</button>
    </header>
  )
}