import AdminLayout from '../admin/AdminLayout.jsx'
import CustomerRegistration from '../auth/CustomerRegistration.jsx'
import LoginPage from '../auth/LoginPage.jsx'
import WorkspaceNotRegistered from '../auth/WorkspaceNotRegistered.jsx'
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
        authError={controller.customerError}
        currentUser={controller.currentUser}
        handleGoogleSignIn={controller.handleGoogleSignIn}
        merchantStore={controller.merchantStore}
        navigateTo={controller.navigateTo}
        onRegistrationComplete={controller.handleMerchantRegistration}
        platformRole={controller.capabilities?.isSuperAdmin ? 'superAdmin' : controller.capabilities?.isMerchant ? 'merchant' : null}
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
        handleLogout={controller.handleLogout}
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

  if (controller.currentUser && controller.capabilities?.isSuperAdmin) {
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

  if (controller.currentUser && controller.capabilities && controller.loginIntent === 'merchant') {
    if (!controller.capabilities.isMerchant) {
      return <WorkspaceNotRegistered capabilities={controller.capabilities} handleLogout={controller.handleLogout} kind="merchant" navigateTo={controller.navigateTo} />
    }
    return <MerchantLayout currentPath={controller.currentPath} currentUser={controller.currentUser} handleLogout={controller.handleLogout} navigateTo={controller.navigateTo} store={controller.merchantStore} />
  }

  if (controller.currentUser && controller.capabilities) {
    if (!controller.capabilities.isCustomer) {
      return <WorkspaceNotRegistered capabilities={controller.capabilities} handleLogout={controller.handleLogout} kind="customer" navigateTo={controller.navigateTo} />
    }
    return <CustomerLayout handleLogout={controller.handleLogout} />
  }

  return (
    <LoginPage
      errorMessage={controller.errorMessage}
      handlePasswordReset={controller.handlePasswordReset}
      handleSubmit={controller.handleSubmit}
      loginIntent={controller.loginIntent}
      navigateTo={controller.navigateTo}
      passwordResetError={controller.passwordResetError}
      passwordResetMessage={controller.passwordResetMessage}
      passwordResetSaving={controller.passwordResetSaving}
      setLoginIntent={controller.setLoginIntent}
      signingIn={controller.signingIn}
    />
  )
}