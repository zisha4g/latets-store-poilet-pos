import { useMemo, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { useIsAdmin } from '@/hooks/useIsAdmin.js';

// Derives all dashboard-relevant counts and short lists from the data already
// loaded by useDataManagement, plus tiny live fetches for tables that aren't
// part of the global data context (SMS / email / approvals).
export function useDashboardMetrics(data) {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin(user);
  const [asyncCounts, setAsyncCounts] = useState({
    unreadSms: 0,
    unreadEmail: 0,
    recentSms: [],
    recentEmail: [],
    pendingApprovals: 0,
  });

  // Fetch SMS + email unread counts and tiny recent samples. These tables are
  // not part of useDataManagement; keep the queries small.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const load = async () => {
      const [sms, smsRecent, email, emailRecent, approvals] = await Promise.all([
        supabase
          .from('pbx_sms_messages')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('direction', 'inbound')
          .eq('is_read', false),
        supabase
          .from('pbx_sms_messages')
          .select('id, from_number, body, created_at, direction, is_read, thread_key')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('pbx_email_messages')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('direction', 'inbound')
          .eq('is_read', false),
        supabase
          .from('pbx_email_messages')
          .select('id, from_addr, from_name, subject, snippet, internal_date, created_at, is_read, direction')
          .eq('user_id', user.id)
          .order('internal_date', { ascending: false })
          .limit(5),
        isAdmin
          ? supabase
              .from('user_profiles')
              .select('user_id', { count: 'exact', head: true })
              .eq('approval_status', 'pending')
          : Promise.resolve({ count: 0, error: null }),
      ]);

      if (cancelled) return;
      setAsyncCounts({
        unreadSms: sms.error ? 0 : (sms.count || 0),
        unreadEmail: email.error ? 0 : (email.count || 0),
        recentSms: smsRecent.error ? [] : (smsRecent.data || []),
        recentEmail: emailRecent.error ? [] : (emailRecent.data || []),
        pendingApprovals: approvals?.error ? 0 : (approvals?.count || 0),
      });
    };

    load();

    // Realtime: refresh on insert/update of SMS or email for this user.
    const channel = supabase
      .channel(`dashboard-metrics-${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pbx_sms_messages', filter: `user_id=eq.${user.id}` },
        () => load())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pbx_email_messages', filter: `user_id=eq.${user.id}` },
        () => load())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id, isAdmin]);

  return useMemo(() => {
    const {
      products = [],
      sales = [],
      customers = [],
      settings = {},
      tasks = [],
      deliveries = [],
      appointments = [],
      invoices = [],
      pbxData = {},
    } = data || {};

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStr = startOfToday.toISOString().split('T')[0];

    // ── Sales / revenue ────────────────────────────────────────────────────
    const salesToday = sales.filter((s) => new Date(s.timestamp) >= startOfToday);
    const salesWeek = sales.filter((s) => new Date(s.timestamp) >= startOfWeek);
    const salesMonth = sales.filter((s) => new Date(s.timestamp) >= startOfMonth);
    const revenueToday = salesToday.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const revenueWeek = salesWeek.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const revenueMonth = salesMonth.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const avgOrderValueWeek = salesWeek.length > 0 ? revenueWeek / salesWeek.length : 0;
    const recentSales = [...sales]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);

    // ── New customers this week ────────────────────────────────────────────
    const newCustomersWeek = customers.filter((c) => {
      const created = c.created_at ? new Date(c.created_at) : null;
      return created && created >= startOfWeek;
    }).length;

    // ── Tasks ──────────────────────────────────────────────────────────────
    const pendingTasks = tasks.filter((t) => t.status !== 'completed');
    const overdueTasks = pendingTasks.filter((t) => {
      if (!t.due_date) return false;
      const due = new Date(t.due_date + 'T00:00:00');
      return due < startOfToday;
    });
    const todayTasks = pendingTasks.filter((t) => {
      if (!t.due_date) return false;
      return t.due_date.split('T')[0] === todayStr;
    });
    const upcomingTasks = [...pendingTasks]
      .sort((a, b) => {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return da - db;
      })
      .slice(0, 5);

    // ── Orders / deliveries ────────────────────────────────────────────────
    const pendingOrderStatuses = new Set(['pending', 'processing', 'new', 'preparing', 'ready']);
    const pendingOrders = deliveries.filter((d) =>
      pendingOrderStatuses.has((d.status || '').toLowerCase()),
    );
    const recentOrders = [...pendingOrders]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    // ── Appointments ───────────────────────────────────────────────────────
    const todayAppointments = appointments
      .filter((a) => {
        if (!a.date) return false;
        return a.date.split('T')[0] === todayStr;
      })
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    // ── Invoices ───────────────────────────────────────────────────────────
    const overdueInvoices = invoices.filter((inv) => {
      if (!inv.due_date) return false;
      const status = (inv.status || '').toLowerCase();
      if (status === 'paid' || status === 'void' || status === 'voided') return false;
      const due = new Date(inv.due_date);
      const balance = Number(inv.balance_due ?? (Number(inv.total || 0) - Number(inv.paid_amount || 0)));
      return due < startOfToday && balance > 0;
    });
    const overdueInvoicesTotal = overdueInvoices.reduce(
      (sum, inv) => sum + Number(inv.balance_due ?? (Number(inv.total || 0) - Number(inv.paid_amount || 0))),
      0,
    );

    // ── Inventory ──────────────────────────────────────────────────────────
    const lowStockThreshold = settings?.lowStockThreshold?.value ?? 10;
    const lowStockProducts = products.filter((p) => (p.stock ?? 0) <= lowStockThreshold);

    // ── PBX: voicemails + missed calls ─────────────────────────────────────
    const voicemails = pbxData?.voicemails || [];
    const newVoicemails = voicemails.filter((v) => v.is_new !== false);
    const callLogs = pbxData?.callLogs || [];
    const missedCallStatuses = new Set(['missed', 'no-answer', 'busy', 'failed', 'canceled', 'declined']);
    const missedCallsToday = callLogs.filter((c) => {
      if (!missedCallStatuses.has((c.status || '').toLowerCase())) return false;
      const created = new Date(c.created_at);
      return created >= startOfToday && created < endOfToday;
    });
    const recentCalls = [...callLogs].slice(0, 5);

    // ── Duplicate customers ────────────────────────────────────────────────
    const normalizePhone = (p) => (p || '').replace(/\D/g, '');
    const byPhone = new Map();
    const byEmail = new Map();
    for (const c of customers) {
      const phone = normalizePhone(c.phone);
      if (phone && phone.length >= 7) {
        const arr = byPhone.get(phone) || [];
        arr.push(c);
        byPhone.set(phone, arr);
      }
      const email = (c.email || '').trim().toLowerCase();
      if (email) {
        const arr = byEmail.get(email) || [];
        arr.push(c);
        byEmail.set(email, arr);
      }
    }
    const duplicateGroups = [];
    for (const [key, arr] of byPhone.entries()) if (arr.length > 1) duplicateGroups.push({ type: 'phone', key, customers: arr });
    for (const [key, arr] of byEmail.entries()) if (arr.length > 1) duplicateGroups.push({ type: 'email', key, customers: arr });

    return {
      // counts
      revenueToday,
      revenueWeek,
      revenueMonth,
      salesTodayCount: salesToday.length,
      avgOrderValueWeek,
      newCustomersWeek,
      pendingTasksCount: pendingTasks.length,
      overdueTasksCount: overdueTasks.length,
      todayTasksCount: todayTasks.length,
      pendingOrdersCount: pendingOrders.length,
      todayAppointmentsCount: todayAppointments.length,
      overdueInvoicesCount: overdueInvoices.length,
      overdueInvoicesTotal,
      lowStockCount: lowStockProducts.length,
      newVoicemailsCount: newVoicemails.length,
      missedCallsTodayCount: missedCallsToday.length,
      unreadSmsCount: asyncCounts.unreadSms,
      unreadEmailCount: asyncCounts.unreadEmail,
      pendingApprovalsCount: asyncCounts.pendingApprovals,
      duplicateGroupsCount: duplicateGroups.length,
      totalProducts: products.length,
      totalCustomers: customers.length,

      // lists (for activity / mini-preview widgets)
      recentSales,
      recentOrders,
      upcomingTasks,
      todayAppointments,
      overdueInvoices,
      lowStockProducts,
      newVoicemails,
      recentCalls,
      recentSms: asyncCounts.recentSms,
      recentEmail: asyncCounts.recentEmail,
      duplicateGroups,
    };
  }, [data, asyncCounts]);
}
