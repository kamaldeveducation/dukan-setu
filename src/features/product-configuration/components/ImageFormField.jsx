import MasterCategoryImageField from '../../../admin/MasterCategoryImageField.jsx'

export const IMAGE_FIELD_MAX_BYTES = 200 * 1024

// Shared Image Field UI for Form Builder fields. Storage/save logic belongs to the caller.
export default function ImageFormField({ label, value, onChange }) {
  return (
    <MasterCategoryImageField
      enableCamera
      imageAsset={value}
      imageLabel={label}
      imageNoun="product"
      maxBytes={IMAGE_FIELD_MAX_BYTES}
      onChange={onChange}
      onRemove={() => onChange(undefined)}
      showCompressedInCropper
    />
  )
}
