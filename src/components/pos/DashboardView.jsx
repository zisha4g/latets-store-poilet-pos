import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, PlusCircle, Settings2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { useIsAdmin } from '@/hooks/useIsAdmin.js';
import { useDashboardMetrics } from './dashboard/useDashboardMetrics';
import { useDashboardLayout } from './dashboard/useDashboardLayout';
import { dashboardWidgetCatalog, SECTIONS } from './dashboard/widgets';
import CustomizeDashboardDialog from './dashboard/CustomizeDashboardDialog';

const greetingFor = (date = new Date()) => {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const firstNameOf = (user) => {
  if (!user) return '';
  const md = user.user_metadata || {};
  const full = md.full_name || md.name || '';
  if (full) return full.split(' ')[0];
  if (user.email) return user.email.split('@')[0];
  return '';
};

// Map widget size to Tailwind column-span classes for the Activity grid.
const sizeColSpan = (size) => {
  if (size === 'lg') return 'lg:col-span-3';
  if (size === 'md') return 'lg:col-span-2';
  return 'lg:col-span-1';
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const itemVariants = {
  hidden: { y: 12, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

const DashboardView = ({ data, handlers }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin(user);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const metrics = useDashboardMetrics(data);

  // Filter admin-only widgets out of the catalog entirely for non-admins so
  // they can't even toggle them on in the Customize dialog.
  const catalog = useMemo(
    () => dashboardWidgetCatalog.filter((w) => !w.adminOnly || isAdmin),
    [isAdmin],
  );

  const { grouped, setVisible, move, reset } = useDashboardLayout(
    catalog,
    data?.settings,
    handlers?.settings,
  );

  const today = new Date();
  const dateLabel = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const renderSection = (section) => {
    const items = (grouped[section.id] || []).filter((w) => w.visible);
    if (items.length === 0) return null;

    // Action Center & Overview: 4-col grid of compact cards.
    // Activity: 3-col grid of taller list cards that respect widget size.
    const gridClass =
      section.id === 'activity'
        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4'
        : 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4';

    return (
      <section key={section.id} className="mb-6 md:mb-8">
        <div className="mb-3">
          <h2 className="text-lg sm:text-xl font-semibold">{section.title}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">{section.subtitle}</p>
        </div>
        <motion.div
          className={gridClass}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {items.map((widget) => {
            const Component = widget.Component;
            return (
              <motion.div
                key={widget.id}
                variants={itemVariants}
                className={section.id === 'activity' ? sizeColSpan(widget.defaultSize) : ''}
              >
                <Component metrics={metrics} navigate={navigate} isAdmin={isAdmin} />
              </motion.div>
            );
          })}
        </motion.div>
      </section>
    );
  };

  const anyVisible = SECTIONS.some((s) => (grouped[s.id] || []).some((w) => w.visible));

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="h-full p-3 sm:p-4 md:p-6 flex flex-col overflow-y-auto"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-5 md:mb-6 gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">
            {greetingFor()}{firstNameOf(user) ? `, ${firstNameOf(user)}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate('/app/pos')}>
            <ShoppingCart className="w-4 h-4 mr-2" /> New Sale
          </Button>
          <Button variant="outline" onClick={() => navigate('/app/inventory')}>
            <PlusCircle className="w-4 h-4 mr-2" /> Add Product
          </Button>
          <Button variant="ghost" onClick={() => setCustomizeOpen(true)} title="Customize dashboard">
            <Settings2 className="w-4 h-4 mr-2" /> Customize
          </Button>
        </div>
      </div>

      {/* ── Sections ───────────────────────────────────────────────────── */}
      {anyVisible ? (
        SECTIONS.map(renderSection)
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-1">Your dashboard is empty</h2>
            <p className="text-sm text-muted-foreground mb-4">
              You&apos;ve hidden every widget. Open Customize to bring some back.
            </p>
            <Button onClick={() => setCustomizeOpen(true)}>
              <Settings2 className="w-4 h-4 mr-2" /> Customize dashboard
            </Button>
          </div>
        </div>
      )}

      <CustomizeDashboardDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        grouped={grouped}
        setVisible={setVisible}
        move={move}
        reset={reset}
      />
    </motion.div>
  );
};

export default DashboardView;
