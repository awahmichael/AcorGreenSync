import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, Package, BarChart3, 
  Settings, Wifi, WifiOff, Leaf, Menu, X, ChevronRight, ChevronDown,
  Boxes, Truck, Clock, ShieldCheck, Users, Tag, RotateCcw,
  TrendingUp, UserCog, DollarSign
} from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

// roles: undefined = all, 'admin' = admin only, 'cashier' = cashier can access
const navGroups = [
  {
    label: 'Operations',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'user'] },
      { path: '/pos', label: 'POS Terminal', icon: ShoppingCart, roles: ['admin', 'manager', 'user'] },
      { path: '/shifts', label: 'Shifts', icon: Clock, roles: ['admin', 'manager', 'user'] },
    ]
  },
  {
    label: 'Catalogue',
    items: [
      { path: '/products', label: 'Products', icon: Package, roles: ['admin', 'manager'] },
      { path: '/inventory', label: 'Inventory', icon: Boxes, roles: ['admin', 'manager'] },
      { path: '/suppliers', label: 'Suppliers', icon: Truck, roles: ['admin', 'manager'] },
      { path: '/customers', label: 'Customers', icon: Users, roles: ['admin', 'manager', 'user'] },
      { path: '/promotions', label: 'Promotions', icon: Tag, roles: ['admin', 'manager'] },
    ]
  },
  {
    label: 'Reporting',
    items: [
      { path: '/returns', label: 'Returns', icon: RotateCcw, roles: ['admin', 'manager', 'user'] },
      { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'manager'], children: [
        { path: '/reports?cat=sales', label: 'Sales & Revenue', icon: TrendingUp },
        { path: '/reports?cat=inventory', label: 'Inventory', icon: Package },
        { path: '/reports?cat=customer', label: 'Customer & CRM', icon: Users },
        { path: '/reports?cat=staff', label: 'Staff & Employees', icon: UserCog },
        { path: '/reports?cat=financial', label: 'Financial', icon: DollarSign },
        { path: '/reports?cat=promotions', label: 'Promotions', icon: Tag },
        { path: '/reports?cat=operational', label: 'Operational', icon: Settings },
        { path: '/reports?cat=carbon', label: 'Carbon & Sustainability', icon: Leaf },
      ] },
      { path: '/compliance', label: 'Compliance', icon: ShieldCheck, roles: ['admin', 'manager'] },
      { path: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
    ]
  },
];

export default function Layout() {
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const { queue, syncQueue } = useOfflineQueue();
  const { user } = useAuth();
  const userRole = user?.role || 'user';

  const canAccess = (roles) => !roles || roles.includes(userRole);

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
        "fixed lg:relative z-30 h-full flex flex-col transition-transform duration-300",
        "bg-[hsl(220,15%,12%)] w-64 flex-shrink-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[hsl(220,15%,18%)]">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">AcorCloud</div>
            <div className="text-primary text-xs font-medium">Green-Sync</div>
          </div>
          <button className="lg:hidden ml-auto text-white/60" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {navGroups.map(({ label, items }) => (
            <div key={label}>
              <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[hsl(210,20%,45%)]">{label}</div>
              <div className="space-y-0.5">
                {items.filter(item => canAccess(item.roles)).map(({ path, label: itemLabel, icon: Icon, children }) => {
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
        {/* Top bar */}
        <header className="bg-white border-b border-border px-4 lg:px-6 h-14 flex items-center gap-4 flex-shrink-0">
          <button 
            className="lg:hidden text-muted-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          {user && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline font-medium text-foreground">{user.full_name || user.email}</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full font-medium capitalize",
                userRole === 'admin' ? "bg-purple-100 text-purple-700" :
                userRole === 'manager' ? "bg-blue-100 text-blue-700" :
                "bg-gray-100 text-gray-600"
              )}>
                {userRole}
              </span>
            </div>
          )}
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