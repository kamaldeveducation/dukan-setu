import AdvertisementsPage from './AdvertisementsPage.jsx'
import BarcodesPage from './BarcodesPage.jsx'
import CalculatorsPage from './CalculatorsPage.jsx'
import CategoriesPage from './CategoriesPage.jsx'
import DashboardPage from './DashboardPage.jsx'
import OrdersPage from './OrdersPage.jsx'
import ProductsPage from './ProductsPage.jsx'
import ProfilePage from './ProfilePage.jsx'
import PurchaseBillsPage from './PurchaseBillsPage.jsx'
import SettingsPage from './SettingsPage.jsx'
import TutorialsPage from './TutorialsPage.jsx'
import UsersPage from './UsersPage.jsx'
import WishlistPage from './WishlistPage.jsx'

// Keyed by navigation item id; add a module by adding a page and one entry here.
export const merchantPages = {
  dashboard: DashboardPage,
  products: ProductsPage,
  barcodes: BarcodesPage,
  categories: CategoriesPage,
  orders: OrdersPage,
  'purchase-bills': PurchaseBillsPage,
  users: UsersPage,
  wishlist: WishlistPage,
  advertisements: AdvertisementsPage,
  tutorials: TutorialsPage,
  calculators: CalculatorsPage,
  settings: SettingsPage,
  profile: ProfilePage,
}
