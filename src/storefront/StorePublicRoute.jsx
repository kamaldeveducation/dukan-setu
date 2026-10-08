import { useEffect, useState } from 'react'
import { getStoreSnapshot } from '../services/storeService'
import '../styles/storefront/public-store.css'

export default function StorePublicRoute({ storeId }) {
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    getStoreSnapshot(storeId).then((snapshot) => {
      if (active && snapshot.exists()) setStore(snapshot.data())
    }).catch(() => {}).finally(() => {
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [storeId])

  return (
    <main className="store-public-page">
      <p className="eyebrow">DUKAN SETU STORE</p>
      {loading ? <h1>Loading store...</h1> : store?.status === 'approved'
        ? <h1>{store.storeName}</h1>
        : <h1>This store is not available yet.</h1>}
      {store?.status === 'approved' && <p>{store.city}, {store.state}</p>}
    </main>
  )
}