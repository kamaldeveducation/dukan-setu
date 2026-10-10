import ModulePlaceholder from './ModulePlaceholder.jsx'
import { merchantNavigation } from '../navigation.js'

const item = merchantNavigation.find((entry) => entry.id === 'settings')

export default function SettingsPage() {
  return <ModulePlaceholder description={item.description} icon={item.icon} title={item.label} />
}
