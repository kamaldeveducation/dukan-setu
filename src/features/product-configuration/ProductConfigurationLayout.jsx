import BusinessCategoryMappingPage from './BusinessCategoryMappingPage.jsx'
import DynamicMasterProductPage from './DynamicMasterProductPage.jsx'
import FieldGroupsPage from './FieldGroupsPage.jsx'
import FormBuilderPage from './FormBuilderPage.jsx'
import GlobalFieldLibraryPage from './GlobalFieldLibraryPage.jsx'
import ProductTypeConfigurationPage from './ProductTypeConfigurationPage.jsx'
import './styles/product-configuration.css'

const pages = {
  'Field Groups': FieldGroupsPage,
  'Global Field Library': GlobalFieldLibraryPage,
  'Product Type Configuration': ProductTypeConfigurationPage,
  'Business Category Mapping': BusinessCategoryMappingPage,
  'Form Builder': FormBuilderPage,
  'Dynamic Master Product': DynamicMasterProductPage,
}

export default function ProductConfigurationLayout({ activePage, onNavigate }) {
  const Page = pages[activePage]
  return Page ? <Page onNavigate={onNavigate} /> : null
}
