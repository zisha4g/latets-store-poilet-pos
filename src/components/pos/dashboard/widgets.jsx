import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2,
  ClipboardList,
  Truck,
  Voicemail,
  MessageSquare,
  Mail,
  PhoneMissed,
  CalendarClock,
  FileWarning,
  AlertTriangle,
  Users,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  CalendarDays,
  Package,
  UserPlus,
  ShoppingBag,
  History,
  Receipt,
  PhoneIncoming,
  PhoneOutgoing,
  Send,
} from 'lucide-react';

const fmtMoney = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmtCount = (n) => Number(n || 0).toLocaleString();
const fmtTime = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
};
const fmtDateTime = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
};

// ─── Action card primitive ──────────────────────────────────────────────────
//
// Compact card with an icon, a label, a count badge, an optional sub-line,
// and a severity-colored left border. Clicking anywhere on the card navigates.
const SEVERITY = {
  critical: 'border-l-red-500 bg-red-50/40 dark:bg-red-950/20',
  warning: 'border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20',
  info: 'border-l-blue-500 bg-blue-50/40 dark:bg-blue-950/20',
  ok: 'border-l-green-500 bg-green-50/30 dark:bg-green-950/20',
  muted: 'border-l-muted-foreground/30',
};

const BADGE_TONE = {
  critical: 'bg-red-500 text-white hover:bg-red-500',
  warning: 'bg-amber-500 text-white hover:bg-amber-500',
  info: 'bg-blue-500 text-white hover:bg-blue-500',
  ok: 'bg-green-500/15 text-green-700 dark:text-green-400',
  muted: '',
};

const ActionCard = ({ icon: Icon, title, count, severity = 'info', subline, onClick, disabled }) => {
  const effectiveSeverity = count > 0 ? severity : 'ok';
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`group text-left w-full rounded-lg border bg-card border-l-4 ${SEVERITY[effectiveSeverity]} p-3 sm:p-4 transition-all hover:shadow-md hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none focus:outline-none focus:ring-2 focus:ring-primary/40`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
            <span className="truncate">{title}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {count > 0 ? (
              <span className="text-2xl sm:text-3xl font-bold text-foreground">{fmtCount(count)}</span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                All caught up
              </span>
            )}
            {count > 0 && (
              <Badge className={BADGE_TONE[effectiveSeverity]} variant="secondary">
                {effectiveSeverity === 'critical' ? 'Action needed' : effectiveSeverity === 'warning' ? 'Review' : 'New'}
              </Badge>
            )}
          </div>
          {subline && (
            <p className="mt-1.5 text-xs text-muted-foreground truncate">{subline}</p>
          )}
        </div>
      </div>
    </button>
  );
};

const KpiCard = ({ icon: Icon, title, value, description, trend }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</CardTitle>
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
    </CardHeader>
    <CardContent>
      <div className="text-xl sm:text-2xl font-bold">{value}</div>
      {description && <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{description}</p>}
      {trend && <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 mt-1">{trend}</p>}
    </CardContent>
  </Card>
);

const ListCard = ({ icon: Icon, title, viewAllLabel, onViewAll, empty, children }) => (
  <Card className="h-full flex flex-col">
    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
      <CardTitle className="flex items-center text-base sm:text-lg">
        {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-muted-foreground" />}
        {title}
      </CardTitle>
      {onViewAll && (
        <Button variant="ghost" size="sm" className="text-xs" onClick={onViewAll}>
          {viewAllLabel || 'View all'}
        </Button>
      )}
    </CardHeader>
    <CardContent className="flex-grow overflow-hidden pb-3">
      <ScrollArea className="h-[260px] pr-3">
        {React.Children.count(children) > 0 ? (
          <div className="space-y-2">{children}</div>
        ) : (
          <div className="text-center text-muted-foreground py-10 text-sm">{empty || 'Nothing to show.'}</div>
        )}
      </ScrollArea>
    </CardContent>
  </Card>
);

// ─── Widget catalog ─────────────────────────────────────────────────────────
//
// Each entry: { id, title, defaultSection, defaultSize, defaultVisible, icon,
//               adminOnly?, Component({ metrics, navigate, isAdmin }) }.
//
// Sizes used by the grid: 'sm' (1 col on lg), 'md' (2 cols), 'lg' (3 cols).
export const dashboardWidgetCatalog = [
  // ── Action Center ────────────────────────────────────────────────────────
  {
    id: 'pendingTasks',
    title: 'Pending Tasks',
    defaultSection: 'action',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: ClipboardList,
    Component: ({ metrics, navigate }) => (
      <ActionCard
        icon={ClipboardList}
        title="Pending tasks"
        count={metrics.pendingTasksCount}
        severity={metrics.overdueTasksCount > 0 ? 'critical' : 'info'}
        subline={
          metrics.overdueTasksCount > 0
            ? `${metrics.overdueTasksCount} overdue · ${metrics.todayTasksCount} due today`
            : metrics.todayTasksCount > 0
              ? `${metrics.todayTasksCount} due today`
              : 'No overdue or due today'
        }
        onClick={() => navigate('/app/calendar')}
      />
    ),
  },
  {
    id: 'pendingOrders',
    title: 'Pending Orders',
    defaultSection: 'action',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: Truck,
    Component: ({ metrics, navigate }) => (
      <ActionCard
        icon={Truck}
        title="Pending orders"
        count={metrics.pendingOrdersCount}
        severity={metrics.pendingOrdersCount > 5 ? 'warning' : 'info'}
        subline="Awaiting processing or delivery"
        onClick={() => navigate('/app/orders')}
      />
    ),
  },
  {
    id: 'newVoicemails',
    title: 'New Voicemails',
    defaultSection: 'action',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: Voicemail,
    Component: ({ metrics, navigate }) => (
      <ActionCard
        icon={Voicemail}
        title="New voicemails"
        count={metrics.newVoicemailsCount}
        severity="warning"
        subline={metrics.newVoicemailsCount > 0 ? 'Unheard messages' : undefined}
        onClick={() => navigate('/pbx/voicemails')}
      />
    ),
  },
  {
    id: 'unreadSms',
    title: 'Unread SMS',
    defaultSection: 'action',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: MessageSquare,
    Component: ({ metrics, navigate }) => (
      <ActionCard
        icon={MessageSquare}
        title="Unread SMS / MMS"
        count={metrics.unreadSmsCount}
        severity="info"
        subline="From customers and contacts"
        onClick={() => navigate('/pbx/sms')}
      />
    ),
  },
  {
    id: 'unreadEmail',
    title: 'Unread Email',
    defaultSection: 'action',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: Mail,
    Component: ({ metrics, navigate }) => (
      <ActionCard
        icon={Mail}
        title="Unread email"
        count={metrics.unreadEmailCount}
        severity="info"
        subline="From your connected inbox"
        onClick={() => navigate('/pbx/email')}
      />
    ),
  },
  {
    id: 'missedCalls',
    title: 'Missed Calls Today',
    defaultSection: 'action',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: PhoneMissed,
    Component: ({ metrics, navigate }) => (
      <ActionCard
        icon={PhoneMissed}
        title="Missed calls today"
        count={metrics.missedCallsTodayCount}
        severity={metrics.missedCallsTodayCount > 0 ? 'warning' : 'info'}
        subline="Callers who didn't get through"
        onClick={() => navigate('/pbx/logs')}
      />
    ),
  },
  {
    id: 'todayAppointments',
    title: "Today's Appointments",
    defaultSection: 'action',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: CalendarClock,
    Component: ({ metrics, navigate }) => {
      const next = metrics.todayAppointments[0];
      return (
        <ActionCard
          icon={CalendarClock}
          title="Today's appointments"
          count={metrics.todayAppointmentsCount}
          severity="info"
          subline={
            next
              ? `Next: ${next.time || ''} · ${next.title || ''}`
              : undefined
          }
          onClick={() => navigate('/app/calendar')}
        />
      );
    },
  },
  {
    id: 'overdueInvoices',
    title: 'Overdue Invoices',
    defaultSection: 'action',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: FileWarning,
    Component: ({ metrics, navigate }) => (
      <ActionCard
        icon={FileWarning}
        title="Overdue invoices"
        count={metrics.overdueInvoicesCount}
        severity="critical"
        subline={
          metrics.overdueInvoicesCount > 0
            ? `${fmtMoney(metrics.overdueInvoicesTotal)} outstanding`
            : undefined
        }
        onClick={() => navigate('/app/invoices')}
      />
    ),
  },
  {
    id: 'lowStock',
    title: 'Low Stock',
    defaultSection: 'action',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: AlertTriangle,
    Component: ({ metrics, navigate }) => (
      <ActionCard
        icon={AlertTriangle}
        title="Low stock items"
        count={metrics.lowStockCount}
        severity={metrics.lowStockCount > 0 ? 'warning' : 'info'}
        subline="At or below threshold"
        onClick={() => navigate('/app/inventory')}
      />
    ),
  },
  {
    id: 'duplicateCustomers',
    title: 'Duplicate Customers',
    defaultSection: 'action',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: Users,
    Component: ({ metrics, navigate }) => (
      <ActionCard
        icon={Users}
        title="Possible duplicate customers"
        count={metrics.duplicateGroupsCount}
        severity="warning"
        subline="Matched by phone or email"
        onClick={() => navigate('/app/customers')}
      />
    ),
  },
  {
    id: 'pendingApprovals',
    title: 'Users Pending Approval',
    defaultSection: 'action',
    defaultSize: 'sm',
    defaultVisible: true,
    adminOnly: true,
    icon: ShieldCheck,
    Component: ({ metrics, navigate }) => (
      <ActionCard
        icon={ShieldCheck}
        title="Users pending approval"
        count={metrics.pendingApprovalsCount}
        severity="info"
        subline="Review new sign-ups"
        onClick={() => navigate('/admin/users')}
      />
    ),
  },

  // ── Business Overview ────────────────────────────────────────────────────
  {
    id: 'revenueToday',
    title: "Today's Revenue",
    defaultSection: 'overview',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: DollarSign,
    Component: ({ metrics }) => (
      <KpiCard
        icon={DollarSign}
        title="Today's revenue"
        value={fmtMoney(metrics.revenueToday)}
        description={`${metrics.salesTodayCount} sale${metrics.salesTodayCount === 1 ? '' : 's'} today`}
      />
    ),
  },
  {
    id: 'revenueWeek',
    title: 'Week Revenue',
    defaultSection: 'overview',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: TrendingUp,
    Component: ({ metrics }) => (
      <KpiCard
        icon={TrendingUp}
        title="This week"
        value={fmtMoney(metrics.revenueWeek)}
        description={`Avg order ${fmtMoney(metrics.avgOrderValueWeek)}`}
      />
    ),
  },
  {
    id: 'revenueMonth',
    title: 'Month Revenue',
    defaultSection: 'overview',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: CalendarDays,
    Component: ({ metrics }) => (
      <KpiCard
        icon={CalendarDays}
        title="This month"
        value={fmtMoney(metrics.revenueMonth)}
        description="Gross sales month-to-date"
      />
    ),
  },
  {
    id: 'newCustomers',
    title: 'New Customers (week)',
    defaultSection: 'overview',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: UserPlus,
    Component: ({ metrics }) => (
      <KpiCard
        icon={UserPlus}
        title="New customers (week)"
        value={fmtCount(metrics.newCustomersWeek)}
        description={`${fmtCount(metrics.totalCustomers)} total customers`}
      />
    ),
  },
  {
    id: 'totalProducts',
    title: 'Total Products',
    defaultSection: 'overview',
    defaultSize: 'sm',
    defaultVisible: false,
    icon: Package,
    Component: ({ metrics }) => (
      <KpiCard
        icon={Package}
        title="Total products"
        value={fmtCount(metrics.totalProducts)}
        description="Across all categories"
      />
    ),
  },
  {
    id: 'totalCustomers',
    title: 'Total Customers',
    defaultSection: 'overview',
    defaultSize: 'sm',
    defaultVisible: false,
    icon: Users,
    Component: ({ metrics }) => (
      <KpiCard
        icon={Users}
        title="Total customers"
        value={fmtCount(metrics.totalCustomers)}
        description="All registered customers"
      />
    ),
  },

  // ── Recent Activity ──────────────────────────────────────────────────────
  {
    id: 'recentSales',
    title: 'Recent Sales',
    defaultSection: 'activity',
    defaultSize: 'md',
    defaultVisible: true,
    icon: ShoppingBag,
    Component: ({ metrics, navigate }) => (
      <ListCard
        icon={ShoppingBag}
        title="Recent sales"
        onViewAll={() => navigate('/app/reports')}
        empty="No recent sales."
      >
        {metrics.recentSales.map((sale) => (
          <div
            key={sale.id}
            className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-secondary/60"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">Sale #{String(sale.id).substring(0, 8)}</p>
              <p className="text-xs text-muted-foreground">{fmtDateTime(sale.timestamp)}</p>
            </div>
            <div className="text-right ml-2 flex-shrink-0">
              <p className="font-semibold text-sm">{fmtMoney(sale.total)}</p>
              <p className="text-xs text-muted-foreground">
                {Array.isArray(sale.items) ? `${sale.items.length} items` : ''}
              </p>
            </div>
          </div>
        ))}
      </ListCard>
    ),
  },
  {
    id: 'upcomingTasks',
    title: 'Upcoming Tasks',
    defaultSection: 'activity',
    defaultSize: 'md',
    defaultVisible: true,
    icon: ClipboardList,
    Component: ({ metrics, navigate }) => (
      <ListCard
        icon={ClipboardList}
        title="Upcoming tasks"
        onViewAll={() => navigate('/app/calendar')}
        empty="No pending tasks."
      >
        {metrics.upcomingTasks.map((task) => {
          const due = task.due_date ? new Date(task.due_date + 'T00:00:00') : null;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isOverdue = due && due < today;
          return (
            <div
              key={task.id}
              className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-secondary/60"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{task.title || 'Untitled task'}</p>
                <p className={`text-xs ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                  {due ? `Due ${due.toLocaleDateString()}` : 'No due date'}
                  {isOverdue ? ' · Overdue' : ''}
                </p>
              </div>
              {task.priority && (
                <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                  {task.priority}
                </Badge>
              )}
            </div>
          );
        })}
      </ListCard>
    ),
  },
  {
    id: 'todaySchedule',
    title: "Today's Schedule",
    defaultSection: 'activity',
    defaultSize: 'md',
    defaultVisible: false,
    icon: CalendarClock,
    Component: ({ metrics, navigate }) => (
      <ListCard
        icon={CalendarClock}
        title="Today's schedule"
        onViewAll={() => navigate('/app/calendar')}
        empty="Nothing on the calendar today."
      >
        {metrics.todayAppointments.map((appt) => (
          <div
            key={appt.id}
            className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-secondary/60"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{appt.title || 'Appointment'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {appt.time || ''}
                {appt.location ? ` · ${appt.location}` : ''}
              </p>
            </div>
            {appt.type && (
              <Badge variant="outline" className="ml-2 text-[10px] capitalize">
                {appt.type}
              </Badge>
            )}
          </div>
        ))}
      </ListCard>
    ),
  },
  {
    id: 'recentOrders',
    title: 'Pending Orders',
    defaultSection: 'activity',
    defaultSize: 'md',
    defaultVisible: true,
    icon: Truck,
    Component: ({ metrics, navigate }) => (
      <ListCard
        icon={Truck}
        title="Pending orders"
        onViewAll={() => navigate('/app/orders')}
        empty="No pending orders."
      >
        {metrics.recentOrders.map((order) => (
          <div
            key={order.id}
            className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-secondary/60"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">Order #{String(order.id).substring(0, 8)}</p>
              <p className="text-xs text-muted-foreground truncate">
                {order.address || 'No address'} · {fmtDateTime(order.created_at)}
              </p>
            </div>
            <Badge variant="outline" className="ml-2 text-[10px] capitalize">
              {order.status || 'pending'}
            </Badge>
          </div>
        ))}
      </ListCard>
    ),
  },
  {
    id: 'lowStockList',
    title: 'Low Stock Items',
    defaultSection: 'activity',
    defaultSize: 'sm',
    defaultVisible: true,
    icon: AlertTriangle,
    Component: ({ metrics, navigate }) => (
      <ListCard
        icon={AlertTriangle}
        title="Low stock items"
        onViewAll={() => navigate('/app/inventory')}
        empty="Inventory is well-stocked!"
      >
        {metrics.lowStockProducts.slice(0, 20).map((product) => (
          <div
            key={product.id}
            className="flex items-center justify-between text-xs sm:text-sm px-2 py-1.5 rounded-md hover:bg-secondary/60"
          >
            <span className="font-medium truncate pr-2">{product.name}</span>
            <span className="font-semibold text-destructive flex-shrink-0">{product.stock} left</span>
          </div>
        ))}
      </ListCard>
    ),
  },
  {
    id: 'recentCalls',
    title: 'Recent Calls',
    defaultSection: 'activity',
    defaultSize: 'sm',
    defaultVisible: false,
    icon: History,
    Component: ({ metrics, navigate }) => (
      <ListCard
        icon={History}
        title="Recent calls"
        onViewAll={() => navigate('/pbx/logs')}
        empty="No recent calls."
      >
        {metrics.recentCalls.map((call) => {
          const isOut = (call.direction || '').toLowerCase() === 'outbound';
          const Icon = isOut ? PhoneOutgoing : PhoneIncoming;
          return (
            <div
              key={call.id}
              className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-secondary/60"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {(isOut ? call.to_number : call.from_number) || 'Unknown'}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(call.created_at)}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] capitalize ml-2">
                {call.status || 'completed'}
              </Badge>
            </div>
          );
        })}
      </ListCard>
    ),
  },
  {
    id: 'recentSms',
    title: 'Recent SMS',
    defaultSection: 'activity',
    defaultSize: 'sm',
    defaultVisible: false,
    icon: MessageSquare,
    Component: ({ metrics, navigate }) => (
      <ListCard
        icon={MessageSquare}
        title="Recent SMS"
        onViewAll={() => navigate('/pbx/sms')}
        empty="No recent messages."
      >
        {metrics.recentSms.map((m) => {
          const isOut = m.direction === 'outbound';
          const Icon = isOut ? Send : MessageSquare;
          return (
            <div
              key={m.id}
              className="flex items-start gap-2 px-2 py-2 rounded-md hover:bg-secondary/60"
            >
              <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className={`text-sm truncate ${!m.is_read && !isOut ? 'font-semibold' : 'font-medium'}`}>
                  {m.from_number}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-1">{m.body || '(media)'}</p>
                <p className="text-[10px] text-muted-foreground">{fmtDateTime(m.created_at)}</p>
              </div>
            </div>
          );
        })}
      </ListCard>
    ),
  },
  {
    id: 'recentEmail',
    title: 'Recent Email',
    defaultSection: 'activity',
    defaultSize: 'sm',
    defaultVisible: false,
    icon: Mail,
    Component: ({ metrics, navigate }) => (
      <ListCard
        icon={Mail}
        title="Recent email"
        onViewAll={() => navigate('/pbx/email')}
        empty="No recent email."
      >
        {metrics.recentEmail.map((m) => (
          <div
            key={m.id}
            className="flex items-start gap-2 px-2 py-2 rounded-md hover:bg-secondary/60"
          >
            <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className={`text-sm truncate ${!m.is_read && m.direction === 'inbound' ? 'font-semibold' : 'font-medium'}`}>
                {m.from_name || m.from_addr || 'Unknown sender'}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-1">{m.subject || m.snippet || ''}</p>
              <p className="text-[10px] text-muted-foreground">{fmtDateTime(m.internal_date || m.created_at)}</p>
            </div>
          </div>
        ))}
      </ListCard>
    ),
  },
  {
    id: 'overdueInvoicesList',
    title: 'Overdue Invoices',
    defaultSection: 'activity',
    defaultSize: 'sm',
    defaultVisible: false,
    icon: Receipt,
    Component: ({ metrics, navigate }) => (
      <ListCard
        icon={Receipt}
        title="Overdue invoices"
        onViewAll={() => navigate('/app/invoices')}
        empty="No overdue invoices."
      >
        {metrics.overdueInvoices.slice(0, 20).map((inv) => {
          const balance = Number(inv.balance_due ?? (Number(inv.total || 0) - Number(inv.paid_amount || 0)));
          return (
            <div
              key={inv.id}
              className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-secondary/60"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">
                  Invoice #{inv.invoice_number_seq || String(inv.id).substring(0, 8)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Due {new Date(inv.due_date).toLocaleDateString()}
                </p>
              </div>
              <span className="font-semibold text-destructive text-sm ml-2 flex-shrink-0">{fmtMoney(balance)}</span>
            </div>
          );
        })}
      </ListCard>
    ),
  },
];

export const SECTIONS = [
  { id: 'action', title: 'Action Center', subtitle: 'Things that need your attention' },
  { id: 'overview', title: 'Business Overview', subtitle: 'How the business is doing' },
  { id: 'activity', title: 'Recent Activity', subtitle: 'What\u2019s been happening' },
];
