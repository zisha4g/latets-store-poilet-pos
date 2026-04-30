import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

import AppLayout from '@/pages/AppLayout.jsx';
import LandingPage from '@/pages/LandingPage.jsx';
import PricingPage from '@/pages/PricingPage.jsx';
import DemoPage from '@/pages/DemoPage.jsx';
import LoginPage from '@/pages/LoginPage.jsx';
import SignupPage from '@/pages/SignupPage.jsx';
import AccountingApp from '@/AccountingApp.jsx';
import DashboardPage from '@/pages/app/DashboardPage.jsx';
import PosPage from '@/pages/app/PosPage.jsx';
import InventoryPage from '@/pages/app/InventoryPage.jsx';
import CustomersPage from '@/pages/app/CustomersPage.jsx';
import OrdersPage from '@/pages/app/OrdersPage.jsx';
import InvoicesPage from '@/pages/app/InvoicesPage.jsx';
import PurchasingPage from '@/pages/app/PurchasingPage.jsx';
import ReportsPage from '@/pages/app/ReportsPage.jsx';
import SettingsPage from '@/pages/app/SettingsPage.jsx';
import PbxPage from '@/pages/app/PbxPage.jsx';
import CalendarPage from '@/pages/app/CalendarPage.jsx';
import StripeCallbackPage from '@/pages/StripeCallbackPage.jsx';
import StoreLayout from '@/pages/StoreLayout.jsx';
import PbxStandalonePage from '@/pages/PbxStandalonePage.jsx';
import ProductsListPage from '@/pages/ProductsListPage.jsx';
import ProductDetailPage from '@/pages/ProductDetailPage.jsx';
import SelfCheckoutPage from '@/pages/SelfCheckoutPage.jsx';
import SuccessPage from '@/pages/SuccessPage.jsx';
import KioskSetupPage from '@/pages/KioskSetupPage.jsx';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute.jsx';


import '@/index.css';
import { Toaster } from "@/components/ui/toaster.jsx";
import { AuthProvider } from '@/contexts/SupabaseAuthContext.jsx';
import { CartProvider } from '@/hooks/useCart.jsx';

const isElectron = !!(window.electronAPI);
const createRouter = isElectron ? createHashRouter : createBrowserRouter;

const electronRoutes = [
  {
    path: "/",
    element: <Navigate to="/selfcheckout" replace />,
  },
  {
    path: "/kiosk-setup",
    element: <KioskSetupPage />,
  },
  {
    path: "/selfcheckout",
    element: <ProtectedRoute><StoreLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <SelfCheckoutPage /> },
    ]
  },
  {
    path: "/selfchecout",
    element: <Navigate to="/selfcheckout" replace />,
  },
  {
    path: "/success",
    element: <StoreLayout />,
    children: [
      { index: true, element: <SuccessPage /> },
    ]
  },
];

const webRoutes = [
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/pricing",
    element: <PricingPage />,
  },
  {
    path: "/demo",
    element: <DemoPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/signup",
    element: <SignupPage />,
  },
  {
    path: "/stripe/callback",
    element: <StripeCallbackPage />,
  },
  {
    path: "/app",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "pos", element: <PosPage /> },
      { path: "orders", element: <OrdersPage /> },
      { path: "inventory", element: <InventoryPage /> },
      { path: "customers", element: <CustomersPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "invoices", element: <InvoicesPage /> },
      { path: "purchasing", element: <PurchasingPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "settings/:section", element: <SettingsPage /> },
      { path: "pbx", element: <PbxPage /> },
      { path: "accounting/*", element: <AccountingApp /> }
    ]
  },
  {
    path: "/pbx",
    element: <PbxStandalonePage />,
  },
  {
    path: "/store",
    element: <StoreLayout />,
    children: [
        { index: true, element: <ProductsListPage /> },
    ]
  },
  {
    path: "/product/:id",
    element: <StoreLayout />,
    children: [
      { index: true, element: <ProductDetailPage /> },
    ]
  },
  {
    path: "/success",
    element: <StoreLayout />,
    children: [
      { index: true, element: <SuccessPage /> },
    ]
  },
  {
    path: "/kiosk-setup",
    element: <KioskSetupPage />,
  },
  {
    path: "/selfcheckout",
    element: <ProtectedRoute><StoreLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <SelfCheckoutPage /> },
    ]
  },
  {
    path: "/selfchecout",
    element: <ProtectedRoute><StoreLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <SelfCheckoutPage /> },
    ]
  },
  {
    path: "/s/:storeId/selfcheckout",
    element: <StoreLayout />,
    children: [
      { index: true, element: <SelfCheckoutPage /> },
    ]
  },
  {
    path: "/s/:storeId/selfchecout",
    element: <StoreLayout />,
    children: [
      { index: true, element: <SelfCheckoutPage /> },
    ]
  },
  {
    path: "/s/:storeId/success",
    element: <StoreLayout />,
    children: [
      { index: true, element: <SuccessPage /> },
    ]
  },
];

const router = createRouter(isElectron ? electronRoutes : webRoutes);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <AuthProvider>
        <CartProvider>
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
          <Toaster />
        </CartProvider>
      </AuthProvider>
    </HelmetProvider>
  </React.StrictMode>
);