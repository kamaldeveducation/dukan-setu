import ModulePlaceholder from './ModulePlaceholder.jsx'
import { merchantNavigation } from '../navigation.js'

const item = merchantNavigation.find((entry) => entry.id === 'wishlist')

export default function WishlistPage() {
  return <ModulePlaceholder description={item.description} icon={item.icon} title={item.label} />
}
