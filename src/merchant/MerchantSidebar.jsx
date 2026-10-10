import MerchantIcon from './MerchantIcon.jsx'

export function MerchantNavLink({ collapsed = false, currentPath, item, navigateTo }) {
  const active = currentPath === item.path
  return (
    <a
      aria-current={active ? 'page' : undefined}
      className={`merchant-nav-link${active ? ' is-active' : ''}`}
      href={item.path}
      onClick={(event) => {
        event.preventDefault()
        navigateTo(item.path)
      }}
      title={collapsed ? item.label : undefined}
    >
      <MerchantIcon name={item.icon} />
      <span className="merchant-nav-label">{item.label}</span>
    </a>
  )
}

export default function MerchantSidebar({ collapsed, currentPath, items, navigateTo, onToggle }) {
  return (
    <aside className={`merchant-sidebar${collapsed ? ' is-collapsed' : ''}`}>
      <nav aria-label="Merchant navigation">
        {items.map((item) => (
          <MerchantNavLink collapsed={collapsed} currentPath={currentPath} item={item} key={item.id} navigateTo={navigateTo} />
        ))}
      </nav>
      <button aria-expanded={!collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="merchant-collapse" onClick={onToggle} type="button">
        <span className={collapsed ? 'is-flipped' : undefined}><MerchantIcon name="chevron" /></span>
        <span className="merchant-nav-label">Collapse</span>
      </button>
    </aside>
  )
}
