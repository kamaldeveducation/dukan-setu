import BakeryStoreView from './types/BakeryStoreView.jsx'
import ElectronicsStoreView from './types/ElectronicsStoreView.jsx'
import GarmentsStoreView from './types/GarmentsStoreView.jsx'
import KiranaStoreView from './types/KiranaStoreView.jsx'
import MedicalStoreView from './types/MedicalStoreView.jsx'

export const storeTypeViews = {
  kirana: KiranaStoreView,
  medical: MedicalStoreView,
  electronics: ElectronicsStoreView,
  garments: GarmentsStoreView,
  bakery: BakeryStoreView,
}