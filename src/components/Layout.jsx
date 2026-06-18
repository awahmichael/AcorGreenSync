import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, Package, BarChart3, 
  Settings, Wifi, WifiOff, Leaf, Menu, X, ChevronRight,
  Boxes, Truck, Clock
} from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

const navGroups = [
  {
    label: 'Operations',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/pos', label: 'POS Terminal', icon: ShoppingCart },
      { path: '/shifts', label: 'Shifts', icon: Clock },
    ]
  },
  {
    label: 'Catalogue',
    items: [
      { path: '/products', label: 'Products', icon: Package },
      { path: '/inventory', label: 'Inventory', icon: Boxes },
      { path: '/suppliers', label: 'Suppliers', icon: Truck },
    ]
  },
  {
    label: 'Reporting',
    items: [
      { path: '/reports', label: 'Reports', icon: BarChart3 },
      { path: '/settings', label: 'Settings', icon: Settings },
    ]
  },
];

export default function Layout() {
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
                {items.map(({ path, label: itemLabel, icon: Icon }) => {
                  const active = location.pathname === path;
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