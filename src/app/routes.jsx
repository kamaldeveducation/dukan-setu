import AdminLayout from '../admin/AdminLayout.jsx'
import CustomerRegistration from '../auth/CustomerRegistration.jsx'
import LoginPage from '../auth/LoginPage.jsx'
import Loading from '../components/Loading.jsx'
import CustomerLayout from '../customer/layout/CustomerLayout.jsx'
import MerchantLayout from '../merchant/MerchantLayout.jsx'
import StoreRegistration from '../registration/StoreRegistration.jsx'
import StorePublicRoute from '../storefront/StorePublicRoute.jsx'

export default function AppRoutes(controller) {
  if (controller.authChecking) return <Loading />

  if (controller.currentPath === '/register/store') {
    return (
      <StoreRegistration
        currentUser={controller.currentUser}
        handleGoogleSignIn={controller.handleGoogleSignIn}
        navigateTo={controller.navigateTo}
        onRegistrationComplete={controller.handleMerchantRegistration}
        platformRole={controller.platformRole}
        signingIn={controller.signingIn}
      />
      )
  }


  const publicStoreMatch = controller.currentPath.match(/^\/store\/([^/]+)\/?$/)
  if (publicStoreMatch) return <StorePublicRoute storeId={decodeURIComponent(publicStoreMatch[1])} />
  if (controller.currentPath === '/register/customer') {
    return (
      <CustomerRegistration
        currentUser={controller.currentUser}
        customerAccount={controller.customerAccount}
        customerError={controller.customerError}
        customerSaving={controller.customerSaving}
        handleCustomerRegistration={controller.handleCustomerRegistration}
        handleGoogleSignIn={controller.handleGoogleSignIn}
        navigateTo={controller.navigateTo}
        platformRole={controller.platformRole}
        returnFromCustomerRegistration={controller.returnFromCustomerRegistration}
        setCustomerCheckVersion={controller.setCustomerCheckVersion}
        signingIn={controller.signingIn}
      />
    )
  }

  if (controller.currentUser && controller.platformRole === 'superAdmin') {
    return (
      <AdminLayout
        activePage={controller.activePage}
        currentUser={controller.currentUser}
        drawerOpen={controller.drawerOpen}
        handleLogout={controller.handleLogout}
        setActivePage={controller.setActivePage}
        setDrawerOpen={controller.setDrawerOpen}
      />
    )
  }

  if (controller.currentUser && controller.platformRole === 'merchant') {
    return <MerchantLayout handleLogout={controller.handleLogout} store={controller.merchantStore} />
  }

  if (controller.currentUser && controller.platformRole === 'customer') {
    return <CustomerLayout handleLogout={controller.handleLogout} />
  }

  return (
    <LoginPage
      errorMessage={controller.errorMessage}
      handlePasswordReset={controller.handlePasswordReset}
      handleSubmit={controller.handleSubmit}
      navigateTo={controller.navigateTo}
      passwordResetError={controller.passwordResetError}
      passwordResetMessage={controller.passwordResetMessage}
      passwordResetSaving={controller.passwordResetSaving}
      signingIn={controller.signingIn}
    />
  )
}