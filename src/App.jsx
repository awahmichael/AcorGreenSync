import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { Toaster as Sonner } from 'sonner';

// Layout
import Layout from '@/components/Layout';

// Pages
import Dashboard from '@/pages/Dashboard';
import POS from '@/pages/POS';
import Products from '@/pages/Products';
import Reports from '@/pages/Reports';
import Compliance from '@/pages/Compliance';
import Settings from '@/pages/Settings';
import Inventory from '@/pages/Inventory';
import Suppliers from '@/pages/Suppliers';
import Shifts from '@/pages/Shifts';
import Customers from '@/pages/Customers';
import Promotions from '@/pages/Promotions';
import Returns from '@/pages/Returns';
import PurchaseOrders from '@/pages/PurchaseOrders';
import StockTransfers from '@/pages/StockTransfers';
import GiftCards from '@/pages/GiftCards';
import Loyalty from '@/pages/Loyalty';
import Marketing from '@/pages/Marketing';
import Ecommerce from '@/pages/Ecommerce';
import StaffPermissions from '@/pages/StaffPermissions';
import SpecialOrders from '@/pages/SpecialOrders';
import WorkOrders from '@/pages/WorkOrders';
import Invoices from '@/pages/Invoices';
import PriceBooks from '@/pages/PriceBooks';
import Bundles from '@/pages/Bundles';
import AccountingExport from '@/pages/AccountingExport';
import CashManagement from '@/pages/CashManagement';
import CustomerDisplay from '@/pages/CustomerDisplay';
import DemandForecasting from '@/pages/DemandForecasting';
import Currencies from '@/pages/Currencies';
import PaymentTerminals from '@/pages/PaymentTerminals';
import SaaSAdmin from '@/pages/SaaSAdmin';
import StockCounts from '@/pages/StockCounts';
import TaxReports from '@/pages/TaxReports';
import Onboarding from '@/pages/Onboarding';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-green-100 border-t-green-600 rounded-full animate-spin"></div>
          <span className="text-sm text-muted-foreground font-medium">AcorCloud Green-Sync</span>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/products" element={<Products />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/shifts" element={<Shifts />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/stock-transfers" element={<StockTransfers />} />
        <Route path="/gift-cards" element={<GiftCards />} />
        <Route path="/loyalty" element={<Loyalty />} />
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/ecommerce" element={<Ecommerce />} />
        <Route path="/staff-permissions" element={<StaffPermissions />} />
        <Route path="/special-orders" element={<SpecialOrders />} />
        <Route path="/work-orders" element={<WorkOrders />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/price-books" element={<PriceBooks />} />
        <Route path="/bundles" element={<Bundles />} />
        <Route path="/accounting-export" element={<AccountingExport />} />
        <Route path="/cash-management" element={<CashManagement />} />
        <Route path="/customer-display" element={<CustomerDisplay />} />
        <Route path="/demand-forecasting" element={<DemandForecasting />} />
        <Route path="/currencies" element={<Currencies />} />
        <Route path="/payment-terminals" element={<PaymentTerminals />} />
        <Route path="/saas-admin" element={<SaaSAdmin />} />
        <Route path="/stock-counts" element={<StockCounts />} />
        <Route path="/tax-reports" element={<TaxReports />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <Sonner richColors position="top-right" />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;