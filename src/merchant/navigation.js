// Single source of truth for sidebar, mobile navigation, routing and page titles.
export const merchantNavigation = [
  { id: 'dashboard', label: 'Dashboard', path: '/merchant', icon: 'dashboard', description: 'A snapshot of your store activity, orders and shortcuts.' },
  { id: 'products', label: 'Products', path: '/merchant/products', icon: 'box', mobilePrimary: true, description: 'Manage the products available in your store.' },
  { id: 'barcodes', label: 'Barcode Management', path: '/merchant/barcodes', icon: 'barcode', description: 'Assign and manage barcodes for your products.' },
  { id: 'categories', label: 'Categories', path: '/merchant/categories', icon: 'grid', mobilePrimary: true, description: 'Organise your products into categories.' },
  { id: 'orders', label: 'Orders', path: '/merchant/orders', icon: 'receipt', mobilePrimary: true, description: 'Track and process customer orders.' },
  { id: 'purchase-bills', label: 'Purchase Bills', path: '/merchant/purchase-bills', icon: 'bill', description: 'Record and review bills from your suppliers.' },
  { id: 'users', label: 'Users', path: '/merchant/users', icon: 'people', mobilePrimary: true, description: 'Manage the people who work with your store.' },
  { id: 'wishlist', label: 'Wishlist Management', path: '/merchant/wishlist', icon: 'heart', description: 'See and respond to products customers are asking for.' },
  { id: 'advertisements', label: 'Advertisements', path: '/merchant/advertisements', icon: 'megaphone', description: 'Promote your store and offers to nearby customers.' },
  { id: 'tutorials', label: 'Video Tutorials', path: '/merchant/tutorials', icon: 'play', description: 'Learn how to get the most from Dukan Setu.' },
  { id: 'calculators', label: 'Calculators', path: '/merchant/calculators', icon: 'calculator', description: 'Everyday business calculators for your store.' },
  { id: 'settings', label: 'Settings', path: '/merchant/settings', icon: 'settings', description: 'Configure your store preferences.' },
]

export const merchantProfileItem = {
  id: 'profile',
  label: 'Profile',
  path: '/merchant/profile',
  icon: 'person',
  mobilePrimary: true,
  description: 'Your account and store details.',
}

export const merchantAllItems = [...merchantNavigation, merchantProfileItem]

export const merchantBottomNavigation = merchantAllItems.filter((item) => item.mobilePrimary)

export function resolveMerchantItem(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/'
  return merchantAllItems.find((item) => item.path === clean) ?? merchantNavigation[0]
}