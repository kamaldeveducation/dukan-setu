import ModulePlaceholder from './ModulePlaceholder.jsx'
import { merchantNavigation } from '../navigation.js'

const item = merchantNavigation.find((entry) => entry.id === 'tutorials')

export default function TutorialsPage() {
  return <ModulePlaceholder description={item.description} icon={item.icon} title={item.label} />
}
