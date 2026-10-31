import { useEffect, useRef, useState } from 'react'
import MasterCategoryImageField, { ACCEPTED_IMAGE_TYPES, detectImageFormat } from '../../../shared/components/image-field/ImageCropEditor.jsx'

export const IMAGE_FIELD_MAX_BYTES = 200 * 1024

// Shared Image Field UI for Form Builder fields. Value is an array of { id, order, blob, ... }.
// Each image is cropped and compressed on its own. Storage/save logic belongs to the caller.
export default function ImageFormField({ label, value, onChange }) {
  const items = Array.isArray(value) ? value : []
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  })
  const nextIdRef = useRef(0)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const [pending, setPending] = useState([])
  const [error, setError] = useState('')

  useEffect(() => () => {
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
  }, [])

  function commit(next) {
    onChange(next.map((item, order) => ({ ...item, order })))
  }

  function addItem(asset) {
    nextIdRef.current += 1
    commit([...itemsRef.current, { ...asset, id: `image_${nextIdRef.current}` }])
  }

  function replaceItem(id, asset) {
    const previous = itemsRef.current.find((item) => item.id === id)
    if (previous) URL.revokeObjectURL(previous.previewUrl)
    commit(itemsRef.current.map((item) => (item.id === id ? { ...asset, id } : item)))
  }

  function removeItem(id) {
    const previous = itemsRef.current.find((item) => item.id === id)
    if (previous) URL.revokeObjectURL(previous.previewUrl)
    commit(itemsRef.current.filter((item) => item.id !== id))
  }

  function dropPending() {
    setPending((queue) => queue.slice(1))
  }

  // Gallery and camera both queue files here; the crop editor opens for one file at a time.
  async function chooseFiles(event) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    setError('')
    const accepted = []
    const rejected = []
    for (const file of files) {
      try {
        await detectImageFormat(file)
        nextIdRef.current += 1
        accepted.push({ key: `pending_${nextIdRef.current}`, file })
      } catch {
        rejected.push(file.name)
      }
    }
    if (rejected.length) setError(`Skipped unsupported file(s): ${rejected.join(', ')}. Use JPG, PNG, WebP, BMP, or GIF images.`)
    if (accepted.length) setPending((queue) => [...queue, ...accepted])
  }

  const current = pending[0]

  return (
    <div className="master-category-image-field">
      <div className="store-actions">
        <button className="store-btn" onClick={() => cameraInputRef.current?.click()} type="button">Open Camera</button>
        <button className="store-btn" onClick={() => galleryInputRef.current?.click()} type="button">Gallery</button>
      </div>
      <input
        accept={ACCEPTED_IMAGE_TYPES}
        aria-label={`${label} gallery`}
        className="master-category-file-input"
        multiple
        onChange={chooseFiles}
        ref={galleryInputRef}
        type="file"
      />
      <input
        accept="image/*"
        aria-label={`${label} camera capture`}
        capture="environment"
        className="master-category-file-input"
        onChange={chooseFiles}
        ref={cameraInputRef}
        type="file"
      />
      {error && <p className="master-category-image-error" role="alert">{error}</p>}
      <div className="master-category-image-list">
        {items.map((item) => (
          <MasterCategoryImageField
            imageAsset={item}
            imageLabel={label}
            imageNoun="product"
            key={item.id}
            listItem
            maxBytes={IMAGE_FIELD_MAX_BYTES}
            onChange={(asset) => replaceItem(item.id, asset)}
            onRemove={() => removeItem(item.id)}
            showCompressedInCropper
          />
        ))}
        {current && (
          <MasterCategoryImageField
            imageLabel={label}
            imageNoun="product"
            initialFile={current.file}
            key={current.key}
            listItem
            maxBytes={IMAGE_FIELD_MAX_BYTES}
            onChange={(asset) => {
              addItem(asset)
              dropPending()
            }}
            onEditorClose={dropPending}
            showCompressedInCropper
          />
        )}
      </div>
      {pending.length > 1 && <small>{pending.length - 1} more image(s) waiting to be cropped.</small>}
    </div>
  )
}
