import React, { useState } from 'react';
import { Palette, Building, Percent, Puzzle, Keyboard, Users, CreditCard, Menu, X, Calendar } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useResponsive } from '@/lib/responsive';
import { Button } from '@/components/ui/button';

const SettingsLayout = ({ children, settings }) => {
  const { section: activeSection = 'general' } = useParams();
  const { isMobile } = useResponsive();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const settingsSections = [
    { id: 'general', label: 'Store Profile', icon: Building },
    { id: 'users', label: 'Users & Permissions', icon: Users },
    { id: 'payment-gateway', label: 'Payment Gateway', icon: CreditCard },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'financials', label: 'Financials', icon: Percent },
    { id: 'modules', label: 'Modules', icon: Puzzle },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
  ].filter(section => section.condition !== false);

  const currentSection = settingsSections.find(s => s.id === activeSection);

  const NavLinks = () => (
    <>
      {settingsSections.map(section => (
        <Link
          key={section.id}
          to={`/app/settings/${section.id}`}
          onClick={() => setMobileMenuOpen(false)}
          className={cn('flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            activeSection === section.id
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent'
          )}
        >
          <section.icon className="w-5 h-5" />
          <span>{section.label}</span>
        </Link>
      ))}
    </>
  );

  return (
    <div className="flex h-full relative">
      {/* Mobile Header with Menu Button */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-30 bg-background border-b border-border p-4 flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-3">
            {currentSection && <currentSection.icon className="w-5 h-5" />}
            <h2 className="text-lg font-semibold">{currentSection?.label || 'Settings'}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {isMobile && mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar / Mobile Drawer */}
      <aside className={cn(
        "border-r border-border p-4 bg-background z-50",
        "lg:w-64 lg:relative",
        "fixed inset-y-0 left-0 w-64 transition-transform duration-300",
        isMobile && !mobileMenuOpen && "-translate-x-full",
        isMobile && mobileMenuOpen && "translate-x-0"
      )}>
        <h2 className="text-lg font-semibold mb-4 px-2 hidden lg:block">Settings</h2>
        <nav className="flex flex-col space-y-1 mt-16 lg:mt-0">
          <NavLinks />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto pt-20 lg:pt-6">
        {children}
      </main>
    </div>
  );
};

export default SettingsLayout;