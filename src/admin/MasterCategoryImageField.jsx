import { useEffect, useRef, useState } from 'react'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'

const MAX_BYTES = 102400
const QUALITIES = [0.9, 0.78, 0.66, 0.54, 0.42, 0.3]
const SCALES = [1, 0.82, 0.68, 0.54, 0.4, 0.28]

async function detectImageFormat(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const startsWith = (...signature) => signature.every((byte, index) => bytes[index] === byte)
  if (startsWith(0xff, 0xd8, 0xff)) return 'jpeg'
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png'
  if (String.fromCharCode(...bytes.slice(0, 6)) === 'GIF87a' || String.fromCharCode(...bytes.slice(0, 6)) === 'GIF89a') return 'gif'
  if (startsWith(0x42, 0x4d)) return 'bmp'
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'webp'
  throw new Error('This file is not a supported JPG, PNG, WebP, BMP, or GIF image.')
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function compressCanvas(sourceCanvas, webpOnly) {
  const baseWidth = sourceCanvas.width
  const baseHeight = sourceCanvas.height
  for (const type of (webpOnly ? ['image/webp'] : ['image/webp', 'image/jpeg'])) {
    for (const scale of SCALES) {
      const width = Math.max(1, Math.round(baseWidth * scale))
      const height = Math.max(1, Math.round(baseHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Your browser could not prepare the cropped image.')
      if (type === 'image/jpeg') {
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, width, height)
      }
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(sourceCanvas, 0, 0, width, height)
      for (const quality of QUALITIES) {
        const blob = await canvasBlob(canvas, type, quality)
        if (blob?.type === type && blob.size > 0 && blob.size < MAX_BYTES) {
          return {
            blob,
            contentType: type,
            extension: type === 'image/webp' ? 'webp' : 'jpg',
            width,
            height,
            size: blob.size,
          }
        }
      }
    }
  }
  throw new Error('This crop could not be compressed below 100 KB. Try a smaller crop or a simpler image.')
}

export default function MasterCategoryImageField({ savedUrl = '', imageAsset, onChange, onRemove, webpOnly = false, showCompressedInCropper = false, imageLabel = 'Category logo / image', imageNoun = 'category' }) {
  const fileInputRef = useRef(null)
  const imageRef = useRef(null)
  const cropperRef = useRef(null)
  const objectUrlsRef = useRef(new Set())
  const [source, setSource] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [square, setSquare] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processedAsset, setProcessedAsset] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => () => {
    cropperRef.current?.destroy()
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  useEffect(() => {
    if (!editorOpen || !imageLoaded || !imageRef.current) return undefined
    cropperRef.current = new Cropper(imageRef.current, {
      aspectRatio: Number.NaN,
      autoCropArea: 0.82,
      background: false,
      checkOrientation: true,
      cropBoxMovable: true,
      cropBoxResizable: true,
      dragMode: 'crop',
      guides: true,
      movable: false,
      responsive: true,
      restore: false,
      rotatable: true,
      toggleDragModeOnDblclick: false,
      viewMode: 1,
      zoomOnTouch: true,
      zoomOnWheel: true,
    })
    return () => {
      cropperRef.current?.destroy()
      cropperRef.current = null
    }
  }, [editorOpen, imageLoaded])

  function createObjectUrl(blob) {
    const url = URL.createObjectURL(blob)
    objectUrlsRef.current.add(url)
    return url
  }

  function revokeObjectUrl(url) {
    if (!url || !objectUrlsRef.current.delete(url)) return
    URL.revokeObjectURL(url)
  }

  async function chooseFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    try {
      const detectedFormat = await detectImageFormat(file)
      revokeObjectUrl(source?.url)
      revokeObjectUrl(processedAsset?.previewUrl)
      const url = createObjectUrl(file)
      setSource({ url, name: file.name, detectedFormat })
      setImageLoaded(false)
      setSquare(false)
      setProcessedAsset(null)
      setEditorOpen(true)
    } catch (imageError) {
      setError(imageError.message || 'The selected image could not be opened.')
    }
  }

  function openCropEditor() {
    if (!source && imageAsset?.blob) {
      setSource({
        url: createObjectUrl(imageAsset.blob),
        name: 'Current cropped image',
        detectedFormat: imageAsset.extension,
      })
    }
    setError('')
    setImageLoaded(false)
    setSquare(false)
    setProcessedAsset(null)
    setEditorOpen(true)
  }

  async function applyCrop() {
    const cropper = cropperRef.current
    if (!cropper || processing) return
    setProcessing(true)
    setError('')
    try {
      const canvas = cropper.getCroppedCanvas({
        maxHeight: 2048,
        maxWidth: 2048,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      })
      if (!canvas) throw new Error('The crop could not be created. Adjust the selection and try again.')
      const result = await compressCanvas(canvas, webpOnly)
      revokeObjectUrl(processedAsset?.previewUrl)
      const asset = { ...result, previewUrl: createObjectUrl(result.blob) }
      if (showCompressedInCropper) {
        setProcessedAsset(asset)
      } else {
        onChange(asset)
        setEditorOpen(false)
      }
    } catch (imageError) {
      setError(imageError.message || 'The cropped image could not be processed.')
    } finally {
      setProcessing(false)
    }
  }

  function resetCrop() {
    cropperRef.current?.reset()
    cropperRef.current?.setAspectRatio(Number.NaN)
    setSquare(false)
    setProcessedAsset(null)
  }

  function useProcessedCrop() {
    if (!processedAsset) return
    revokeObjectUrl(imageAsset?.previewUrl)
    onChange(processedAsset)
    setEditorOpen(false)
  }

  function toggleSquare() {
    const next = !square
    setSquare(next)
    cropperRef.current?.setAspectRatio(next ? 1 : Number.NaN)
  }

  function removeImage() {
    setError('')
    revokeObjectUrl(imageAsset?.previewUrl)
    revokeObjectUrl(source?.url)
    revokeObjectUrl(processedAsset?.previewUrl)
    setSource(null)
    setProcessedAsset(null)
    onRemove()
  }

  const previewUrl = imageAsset?.previewUrl || savedUrl

  return (
    <div className="master-category-image-field">
      <label htmlFor="master-category-image-upload">{imageLabel}</label>
      <input
        accept="image/jpeg,image/png,image/webp,image/bmp,image/gif,.jpg,.jpeg,.png,.webp,.bmp,.gif"
        className="master-category-file-input"
        id="master-category-image-upload"
        onChange={chooseFile}
        ref={fileInputRef}
        type="file"
      />
      <div className="master-category-image-row">
        {previewUrl ? (
          <img alt="Master Category preview" className="master-category-image-preview" src={previewUrl} />
        ) : (
          <span aria-label="No category image selected" className="master-category-image-placeholder" role="img" />
        )}
        <div className="master-category-image-details">
          {imageAsset ? (
            <small>
              {(imageAsset.size / 1024).toFixed(1)} KB · {imageAsset.width} × {imageAsset.height} px · {imageAsset.extension.toUpperCase()}
              {' · Under 100 KB'}
            </small>
          ) : (
            <small>{savedUrl ? 'Current category image' : 'No image selected'}</small>
          )}
          <div className="store-actions">
            <button className="store-btn" onClick={() => fileInputRef.current?.click()} type="button">
              {previewUrl ? 'Change Image' : 'Upload Image'}
            </button>
            {(source || imageAsset) && <button className="store-btn" onClick={openCropEditor} type="button">Crop Image</button>}
            {previewUrl && <button className="store-btn" onClick={removeImage} type="button">Remove Image</button>}
          </div>
        </div>
      </div>
      {error && <p className="master-category-image-error" role="alert">{error}</p>}
      {editorOpen && source && (
        <div className="master-category-crop-backdrop" onClick={() => !processing && setEditorOpen(false)} role="presentation">
          <section aria-labelledby="master-category-crop-title" aria-modal="true" className="master-category-crop-dialog" onClick={(event) => event.stopPropagation()} role="dialog">
              <h3 id="master-category-crop-title">Crop {imageNoun} image</h3>
            {source.detectedFormat === 'gif' && <p className="master-category-gif-note">Animated GIFs are converted to a static image when cropped.</p>}
            <div className="master-category-crop-stage">
              <img alt="Image to crop" onError={() => setError('This image format could not be decoded by your browser. Try JPG, PNG, WebP, BMP, or GIF.')} onLoad={() => setImageLoaded(true)} ref={imageRef} src={source.url} />
            </div>
            <div aria-label="Crop controls" className="master-category-crop-controls">
              <button className="store-btn" onClick={() => cropperRef.current?.zoom(-0.1)} type="button">Zoom out</button>
              <button className="store-btn" onClick={() => cropperRef.current?.zoom(0.1)} type="button">Zoom in</button>
              <button className="store-btn" onClick={() => cropperRef.current?.rotate(-90)} type="button">Rotate left</button>
              <button className="store-btn" onClick={() => cropperRef.current?.rotate(90)} type="button">Rotate right</button>
              <button aria-pressed={square} className={`store-btn${square ? ' active' : ''}`} onClick={toggleSquare} type="button">Square</button>
              <button className="store-btn" onClick={resetCrop} type="button">Reset crop</button>
            </div>
            {showCompressedInCropper && processedAsset && (
              <p className="master-category-compressed-result" role="status">
                Final compressed image: {(processedAsset.size / 1024).toFixed(1)} KB · {processedAsset.extension.toUpperCase()}
              </p>
            )}
            <div className="store-actions">
              <button className="store-btn" disabled={processing} onClick={() => setEditorOpen(false)} type="button">Cancel</button>
              {showCompressedInCropper && processedAsset && <button className="store-btn store-btn-approve" disabled={processing} onClick={useProcessedCrop} type="button">Use Cropped Image</button>}
              <button className="store-btn store-btn-approve" disabled={processing || !imageLoaded} onClick={applyCrop} type="button">{processing ? 'Compressing...' : showCompressedInCropper ? 'Compress Crop' : 'Apply Crop'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}