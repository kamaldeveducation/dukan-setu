import ModulePlaceholder from './ModulePlaceholder.jsx'
import { merchantNavigation } from '../navigation.js'

const item = merchantNavigation.find((entry) => entry.id === 'orders')

export default function OrdersPage() {
  return <ModulePlaceholder description={item.description} icon={item.icon} title={item.label} />
}
