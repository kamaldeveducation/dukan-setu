import { useEffect, useRef, useState } from 'react'

const EMPTY_VIEW = { status: 'idle', items: [], error: '' }

// Master Categories keep their image in logoUrl/logoRefs; Sub Categories and Sub-Subcategories use imageUrl.
// Code and document ID are extra search terms; the visible name is always searched.
export function toOption(item) {
  return {
    id: item.id,
    name: item.name || item.id,
    imageUrl: item.logoUrl || item.logoRefs?.[0]?.logoUrl || item.imageUrl || '',
    searchTerms: [item.code, item.id].filter(Boolean),
  }
}

// Loads options for one parent key. Results are tagged with the key they belong to, so options from a previous parent are never shown.
export function useChildOptions(key, load) {
  const [state, setState] = useState({ key: '', ...EMPTY_VIEW })
  const [reloadCount, setReloadCount] = useState(0)
  const loadRef = useRef(load)

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    if (!key) return undefined
    let active = true
    loadRef.current()
      .then((items) => {
        if (active) setState({ key, status: 'ready', items: items.map(toOption), error: '' })
      })
      .catch((error) => {
        if (active) setState({ key, status: 'error', items: [], error: error.message || 'Options could not be loaded.' })
      })
    return () => {
      active = false
    }
  }, [key, reloadCount])

  function retry() {
    setState({ key, status: 'loading', items: [], error: '' })
    setReloadCount((count) => count + 1)
  }

  let view = { ...EMPTY_VIEW }
  if (key) view = state.key === key ? state : { status: 'loading', items: [], error: '' }
  return { view, retry }
}
