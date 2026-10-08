import { storeTypeViews } from './storeTypeRegistry.js'

export default function StoreTypeRenderer({ storeType }) {
  const StoreTypeView = storeTypeViews[storeType]
  return StoreTypeView ? <StoreTypeView /> : null
}