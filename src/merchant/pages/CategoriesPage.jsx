import ModulePlaceholder from './ModulePlaceholder.jsx'
import { merchantNavigation } from '../navigation.js'

const item = merchantNavigation.find((entry) => entry.id === 'categories')

export default function CategoriesPage() {
  return <ModulePlaceholder description={item.description} icon={item.icon} title={item.label} />
}
