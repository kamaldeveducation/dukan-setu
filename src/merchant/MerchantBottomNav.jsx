import MerchantIcon from './MerchantIcon.jsx'
import { merchantBottomNavigation } from './navigation.js'

export default function MerchantBottomNav({ currentPath, navigateTo }) {
  return (
    <nav className="merchant-bottom-nav" aria-label="Merchant primary navigation">
      {merchantBottomNavigation.map((item) => {
        const active = currentPath === item.path
        return (
          <a
            aria-current={active ? 'page' : undefined}
            className={active ? 'is-active' : undefined}
            href={item.path}
            key={item.id}
            onClick={(event) => {
              event.preventDefault()
              navigateTo(item.path)
            }}
          >
            <MerchantIcon name={item.icon} />
            <small>{item.label}</small>
          </a>
        )
      })}
    </nav>
  )
}
