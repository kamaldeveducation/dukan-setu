export const productConfigurationNavigation = {
  label: 'Product Configuration Studio',
  items: [
    { label: 'Field Groups' },
    { label: 'Global Field Library' },
    { label: 'Product Type Configuration' },
    { label: 'Business Category Mapping' },
    { label: 'Form Builder' },
  ],
}

export function isProductConfigurationPage(label) {
  return productConfigurationNavigation.items.some((item) => item.label === label)
}
