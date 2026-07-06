import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, Package, BarChart3, 
  Settings, Wifi, WifiOff, Leaf, Menu, X, ChevronRight, ChevronDown,
  Boxes, Truck, Clock, ShieldCheck, Users, Tag, RotateCcw,
  TrendingUp, UserCog, DollarSign, ClipboardList, ArrowLeftRight, Gift,
  Star, Megaphone, Globe, Wrench, FileText, Layers,
  Tags, Banknote, Monitor, BarChart, Shield, KeyRound, CreditCard, Building2,
  ClipboardCheck, Receipt, Crown
} from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useAuth } from '@/lib/AuthContext';
import { OrgProvider, useOrganization } from '@/hooks/useOrganization.jsx';
import OrgSwitcher from '@/components/OrgSwitcher';
import UserMenu from '@/components/UserMenu';
import TrialBanner from '@/components/TrialBanner';
import { cn } from '@/lib/utils';

// roles: undefined = all, 'admin' = admin only, 'cashier' = cashier can access
const navGroups = [
  {
    label: 'Operations',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'user'] },
      { path: '/pos', label: 'POS Terminal', icon: ShoppingCart, roles: ['admin', 'manager', 'user'] },
      { path: '/shifts', label: 'Shifts', icon: Clock, roles: ['admin', 'manager', 'user'] },
      { path: '/cash-management', label: 'Cash Management', icon: Banknote, roles: ['admin', 'manager', 'user'] },
      { path: '/customer-display', label: 'Customer Display', icon: Monitor, roles: ['admin', 'manager', 'user'] },
      { path: '/special-orders', label: 'Special Orders', icon: ShoppingCart, roles: ['admin', 'manager', 'user'] },
      { path: '/work-orders', label: 'Work Orders', icon: Wrench, roles: ['admin', 'manager', 'user'] },
    ]
  },
  {
    label: 'Catalogue & Inventory',
    items: [
      { path: '/products', label: 'Products', icon: Package, roles: ['admin', 'manager'] },
      { path: '/bundles', label: 'Kits & Bundles', icon: Layers, roles: ['admin', 'manager'] },
      { path: '/price-books', label: 'Price Books', icon: Tags, roles: ['admin', 'manager'] },
      { path: '/inventory', label: 'Inventory', icon: Boxes, roles: ['admin', 'manager'] },
      { path: '/stock-counts', label: 'Stock Counts', icon: ClipboardCheck, roles: ['admin', 'manager'] },
      { path: '/stock-transfers', label: 'Stock Transfers', icon: ArrowLeftRight, roles: ['admin', 'manager'] },
      { path: '/suppliers', label: 'Suppliers', icon: Truck, roles: ['admin', 'manager'] },
      { path: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList, roles: ['admin', 'manager'] },
    ]
  },
  {
    label: 'Customer & CRM',
    items: [
      { path: '/customers', label: 'Customers', icon: Users, roles: ['admin', 'manager', 'user'] },
      { path: '/loyalty', label: 'Loyalty Program', icon: Star, roles: ['admin', 'manager'] },
      { path: '/promotions', label: 'Promotions', icon: Tag, roles: ['admin', 'manager'] },
      { path: '/gift-cards', label: 'Gift Cards', icon: Gift, roles: ['admin', 'manager'] },
      { path: '/ecommerce', label: 'E-commerce Orders', icon: Globe, roles: ['admin', 'manager'] },
      { path: '/marketing', label: 'Marketing Campaigns', icon: Megaphone, roles: ['admin', 'manager'] },
    ]
  },
  {
    label: 'Sustainability & Reporting',
    items: [
      { path: '/returns', label: 'Returns', icon: RotateCcw, roles: ['admin', 'manager', 'user'] },
      { path: '/compliance', label: 'Compliance', icon: ShieldCheck, roles: ['admin', 'manager'] },
      { path: '/demand-forecasting', label: 'Demand Forecasting', icon: BarChart, roles: ['admin', 'manager'] },
      { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'manager'], children: [
        { path: '/reports?cat=store_close', label: 'Store Close Reports', icon: DollarSign },
        { path: '/reports?cat=sales', label: 'Sales & Revenue', icon: TrendingUp },
        { path: '/reports?cat=inventory', label: 'Inventory', icon: Package },
        { path: '/reports?cat=customer', label: 'Customer & CRM', icon: Users },
        { path: '/reports?cat=staff', label: 'Staff & Employees', icon: UserCog },
        { path: '/reports?cat=financial', label: 'Financial', icon: DollarSign },
        { path: '/reports?cat=promotions', label: 'Promotions', icon: Tag },
        { path: '/reports?cat=operational', label: 'Operational', icon: Settings },
        { path: '/reports?cat=carbon', label: 'Carbon & Sustainability', icon: Leaf },
      ] },
    ]
  },
  {
    label: 'Finance & Platform',
    items: [
      { path: '/invoices', label: 'B2B Invoices', icon: FileText, roles: ['admin', 'manager'] },
      { path: '/tax-reports', label: 'Tax Reports', icon: Receipt, roles: ['admin', 'manager'] },
      { path: '/accounting-export', label: 'Accounting Export', icon: FileText, roles: ['admin', 'manager'] },
      { path: '/currencies', label: 'Multi-Currency', icon: Globe, roles: ['admin', 'manager'] },
      { path: '/payment-terminals', label: 'Payment Terminals', icon: CreditCard, roles: ['admin'] },
      { path: '/subscription', label: 'Subscription', icon: Crown, roles: ['admin', 'manager', 'user'] },
      { path: '/saas-admin', label: 'SaaS Platform Admin', icon: Building2, roles: ['admin'], superAdminOnly: true },
      { path: '/staff-permissions', label: 'Staff Permissions', icon: KeyRound, roles: ['admin'] },
      { path: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
    ]
  },
];

export default function Layout() {
  return (
    <OrgProvider>
      <LayoutInner />
    </OrgProvider>
  );
}

function LayoutInner() {
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [expandedSections, setExpandedSections] = useState({});
  const { queue, syncQueue } = useOfflineQueue();
  const { user } = useAuth();
  const { currentOrg, loading: orgLoading } = useOrganization();
  const userRole = user?.role || 'user';
  const navigate = useNavigate();

  const isSuperAdmin = !!user?.collaborator_role;
  const canAccess = (item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    return !item.roles || item.roles.includes(userRole);
  };

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      syncQueue();
    }
  }, [isOnline]);

  useEffect(() => {
    if (location.pathname === '/reports') {
      setExpandedSections(prev => ({ ...prev, '/reports': true }));
    }
  }, [location.pathname]);

  // Redirect to onboarding wizard if not yet completed
  useEffect(() => {
    if (!orgLoading && currentOrg && !currentOrg.onboarding_completed && location.pathname !== '/onboarding') {
      navigate('/onboarding');
    }
  }, [currentOrg, orgLoading, location.pathname, navigate]);

  return (
    <div className="flex h-screen bg-muted overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:relative z-30 h-full flex-col transition-all duration-300 bg-[hsl(220,15%,12%)] w-64 flex-shrink-0",
        sidebarOpen ? "translate-x-0 flex" : "-translate-x-full lg:w-0 lg:overflow-hidden"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[hsl(220,15%,18%)]">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div className="overflow-hidden">
            <div className="text-white font-bold text-sm leading-tight">AcorCloud</div>
            <div className="text-primary text-xs font-medium">Green-Sync</div>
          </div>
          <button className="ml-auto text-white/60 hover:text-white p-1 rounded hover:bg-white/10" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {navGroups.map(({ label, items }) => (
            <div key={label}>
              <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[hsl(210,20%,45%)]">{label}</div>
              <div className="space-y-0.5">
                {items.filter(item => canAccess(item)).map(({ path, label: itemLabel, icon: Icon, children }) => {
                  const active = location.pathname === path;
                  const hasChildren = children && children.length > 0;
                  const isExpanded = hasChildren && (expandedSections[path] || active);

                  if (hasChildren) {
                    return (
                      <div key={path}>
                        <button
                          onClick={() => setExpandedSections(prev => ({ ...prev, [path]: !prev[path] }))}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                            active
                              ? "bg-primary text-white shadow-sm"
                              : "text-[hsl(210,20%,70%)] hover:bg-[hsl(220,15%,18%)] hover:text-white"
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {itemLabel}
                          <ChevronDown className={cn("w-3.5 h-3.5 ml-auto transition-transform", isExpanded && "rotate-180")} />
                        </button>
                        {isExpanded && (
                          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[hsl(220,15%,22%)] pl-3">
                            {children.map(({ path: childPath, label: childLabel, icon: ChildIcon }) => {
                              const currentUrl = location.pathname + location.search;
                              const childActive = currentUrl === childPath;
                              return (
                                <Link
                                  key={childPath}
                                  to={childPath}
                                  onClick={() => setSidebarOpen(false)}
                                  className={cn(
                                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                                    childActive
                                      ? "bg-primary/20 text-primary"
                                      : "text-[hsl(210,20%,60%)] hover:bg-[hsl(220,15%,18%)] hover:text-white"
                                  )}
                                >
                                  <ChildIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                  {childLabel}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={path}
                      to={path}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                        active
                          ? "bg-primary text-white shadow-sm"
                          : "text-[hsl(210,20%,70%)] hover:bg-[hsl(220,15%,18%)] hover:text-white"
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {itemLabel}
                      {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Connectivity status */}
        <div className="px-4 py-4 border-t border-[hsl(220,15%,18%)]">
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
            isOnline ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"
          )}>
            {isOnline ? (
              <><Wifi className="w-3.5 h-3.5" /><span>Online — Synced</span></>
            ) : (
              <><WifiOff className="w-3.5 h-3.5 sync-pulse" /><span>Offline Mode</span></>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Trial banner */}
        <TrialBanner />

        {/* Top bar */}
        <header className="bg-white border-b border-border px-4 lg:px-6 h-14 flex items-center gap-4 flex-shrink-0">
          <button 
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          {currentOrg && !user?.collaborator_role && <OrgSwitcher />}
          {user && <UserMenu />}
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
            isOnline ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              isOnline ? "bg-green-500" : "bg-amber-500 sync-pulse"
            )} />
            {isOnline ? "Online" : "Offline"}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}