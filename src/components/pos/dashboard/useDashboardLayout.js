import { useCallback, useMemo, useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';

const SETTINGS_KEY = 'dashboardLayout';
const LAYOUT_VERSION = 1;

// Merge the user's saved layout with the catalog defaults. New widgets that
// have appeared since the user last saved show up at the end of their section
// with their default visibility.
function mergeLayout(saved, catalog) {
  const byId = new Map();
  for (const w of catalog) {
    byId.set(w.id, {
      id: w.id,
      visible: w.defaultVisible,
      section: w.defaultSection,
      order: 0,
    });
  }
  if (saved && Array.isArray(saved.widgets)) {
    saved.widgets.forEach((entry, idx) => {
      if (!entry || !byId.has(entry.id)) return;
      const existing = byId.get(entry.id);
      byId.set(entry.id, {
        ...existing,
        visible: typeof entry.visible === 'boolean' ? entry.visible : existing.visible,
        order: typeof entry.order === 'number' ? entry.order : idx,
      });
    });
  }
  // Stable initial order: by saved order, then by catalog index.
  const catalogIndex = new Map(catalog.map((w, i) => [w.id, i]));
  return Array.from(byId.values()).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return (catalogIndex.get(a.id) ?? 0) - (catalogIndex.get(b.id) ?? 0);
  });
}

export function useDashboardLayout(catalog, settings, settingsHandler) {
  const saved = settings?.[SETTINGS_KEY]?.value || null;
  const settingsRowId = settings?.[SETTINGS_KEY]?.id;

  const [layout, setLayout] = useState(() => mergeLayout(saved, catalog));

  // Re-merge when catalog or saved settings change (e.g. on refreshData).
  // Stringify saved so we re-run on deep change without ref churn.
  const savedKey = JSON.stringify(saved);
  useEffect(() => {
    setLayout(mergeLayout(saved, catalog));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey, catalog]);

  const persist = useCallback(
    async (next) => {
      if (!settingsHandler?.update) return;
      try {
        await settingsHandler.update({
          ...(settingsRowId ? { id: settingsRowId } : {}),
          key: SETTINGS_KEY,
          value: { widgets: next, version: LAYOUT_VERSION },
        });
      } catch (err) {
        console.error('Failed to save dashboard layout', err);
        toast({
          title: 'Could not save dashboard layout',
          description: err.message || 'Please try again.',
          variant: 'destructive',
        });
      }
    },
    [settingsHandler, settingsRowId],
  );

  const setVisible = useCallback(
    (id, visible) => {
      setLayout((prev) => {
        const next = prev.map((w) => (w.id === id ? { ...w, visible } : w));
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const move = useCallback(
    (id, direction) => {
      setLayout((prev) => {
        const target = prev.find((w) => w.id === id);
        if (!target) return prev;
        const sameSection = prev.filter((w) => w.section === target.section);
        const idx = sameSection.findIndex((w) => w.id === id);
        const swapWith = direction === 'up' ? sameSection[idx - 1] : sameSection[idx + 1];
        if (!swapWith) return prev;
        const a = target.order;
        const b = swapWith.order === a ? a + 1 : swapWith.order;
        // Reassign orders within section to a clean 0..n-1.
        const newOrders = new Map();
        sameSection.forEach((w, i) => newOrders.set(w.id, i));
        const ia = newOrders.get(target.id);
        const ib = newOrders.get(swapWith.id);
        newOrders.set(target.id, ib);
        newOrders.set(swapWith.id, ia);
        const next = prev
          .map((w) => (newOrders.has(w.id) ? { ...w, order: newOrders.get(w.id) } : w))
          .sort((x, y) => x.order - y.order);
        persist(next);
        // Silence unused-var lint about a/b in case of cleanup.
        void a; void b;
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    const next = catalog.map((w, i) => ({
      id: w.id,
      visible: w.defaultVisible,
      section: w.defaultSection,
      order: i,
    }));
    setLayout(next);
    persist(next);
  }, [catalog, persist]);

  // Group widgets by section in current visual order.
  const grouped = useMemo(() => {
    const groups = { action: [], overview: [], activity: [] };
    layout.forEach((entry) => {
      const widget = catalog.find((w) => w.id === entry.id);
      if (!widget) return;
      const section = entry.section || widget.defaultSection;
      if (!groups[section]) groups[section] = [];
      groups[section].push({ ...widget, ...entry });
    });
    return groups;
  }, [layout, catalog]);

  return { layout, grouped, setVisible, move, reset };
}
