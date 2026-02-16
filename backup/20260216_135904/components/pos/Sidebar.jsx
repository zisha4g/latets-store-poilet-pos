
import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  ShoppingCart,
  Package,
  Users,
  FileText,
  BarChart2,
  Settings,
  Truck,
  Phone,
  Banknote,
  Wifi,
  WifiOff,
  LogOut,
  User,
  LayoutDashboard,
  Calendar,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { Button } from '@/components/ui/button';
import { useResponsive } from '@/lib/responsive';
import { prefetchRoute } from '@/lib/prefetch';

const navItems = [
  { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/app/pos', icon: ShoppingCart, label: 'POS' },
  { to: '/app/orders', icon: FileText, label: 'Orders' },
  { to: '/app/inventory', icon: Package, label: 'Inventory' },
  { to: '/app/customers', icon: Users, label: 'Customers' },
  { to: '/app/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/app/invoices', icon: FileText, label: 'Invoices', setting: 'enableInvoicing' },
  { to: '/app/purchasing', icon: Truck, label: 'Purchasing', setting: 'enableAccounting' },
  { to: '/app/reports', icon: BarChart2, label: 'Reports' },
  { to: '/app/accounting', icon: Banknote, label: 'Accounting', setting: 'enableAccounting' },
];

const Sidebar = ({ isOnline, settings, isDemo }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getNavLinkClass = (path) => {
    const isActive = location.pathname.startsWith(path);
    return `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
      isActive
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    }`;
  };

  const handleNavClick = () => {
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const SidebarContent = () => (
    <>
      <div className="flex items-center mb-8 justify-between">
        <div className="flex items-center">
          <Home className="w-6 h-6 md:w-8 md:h-8 text-primary mr-2 md:mr-3" />
          <h1 className="text-lg md:text-2xl font-bold truncate">
            {settings?.storeName?.value || 'StorePilot'}
          </h1>
        </div>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden"
          >
            <X className="w-6 h-6" />
          </Button>
        )}
      </div>
      <nav className="flex-grow space-y-1 md:space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          if (item.setting && !settings?.[item.setting]?.value) {
            return null;
          }
          return (
            <NavLink 
              key={item.to} 
              to={item.to} 
              className={getNavLinkClass(item.to)}
              onClick={handleNavClick}
              onMouseEnter={() => prefetchRoute(item.to)}
            >
              <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 space-y-2">
        <NavLink 
          to="/app/settings" 
          className={getNavLinkClass('/app/settings')}
          onClick={handleNavClick}
        >
          <Settings className="w-5 h-5 mr-3" />
          Settings
        </NavLink>
        <div className="border-t my-3"></div>
        <div className="flex items-center justify-between text-xs md:text-sm text-muted-foreground mb-3">
          <div className="flex items-center">
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 mr-2 text-green-500" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 mr-2 text-red-500" />
                <span>Offline</span>
              </>
            )}
          </div>
          {isDemo && <span className="font-bold text-yellow-500">DEMO</span>}
        </div>
        <div className="flex items-center p-2 rounded-lg bg-muted">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground mr-2 md:mr-3 flex-shrink-0">
            <User className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="flex-grow min-w-0">
            <p className="text-xs md:text-sm font-semibold truncate">{user?.email || 'Demo User'}</p>
          </div>
          {!isDemo && (
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out" className="flex-shrink-0">
              <LogOut className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
    </>
  );

  // Mobile hamburger button
  if (isMobile) {
    return (
      <>
        {/* Mobile top bar */}
        <div className="fixed top-0 left-0 right-0 z-40 bg-card border-b px-4 py-3 flex items-center justify-between lg:hidden">
          <div className="flex items-center">
            <Home className="w-6 h-6 text-primary mr-2" />
            <h1 className="text-lg font-bold truncate">
              {settings?.storeName?.value || 'StorePilot'}
            </h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="w-6 h-6" />
          </Button>
        </div>

        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="fixed top-0 left-0 bottom-0 w-64 sm:w-80 bg-card border-r z-50 flex flex-col p-4 lg:hidden animate-in slide-in-from-left">
              <SidebarContent />
            </aside>
          </>
        )}
      </>
    );
  }

  // Desktop sidebar
  return (
    <aside className="w-64 xl:w-72 2xl:w-80 bg-card border-r flex flex-col p-4 hidden lg:flex">
      <SidebarContent />
    </aside>
  );
};

export default Sidebar;
