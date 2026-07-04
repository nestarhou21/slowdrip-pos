import { useState, useMemo } from "react";
import { Inbox, ShoppingBag, Info, CheckCircle2, Circle, Trash2, Search, RefreshCw, Package, ExternalLink, Calendar, Ticket, Clock } from "lucide-react";
import {
  useAdminNotifications,
  useMarkAdminNotificationRead,
  useMarkAllAdminNotificationsRead,
  useDeleteAdminNotification,
  type AdminNotificationType,
  type AdminNotification,
} from "@repo/store";
import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui";
import { Input } from "@repo/ui";

const ITEMS_PER_PAGE = 10;
const CUTOFF_DAYS = 7;

const typeIcon: Record<AdminNotificationType, typeof Inbox> = {
  order: ShoppingBag,
  system: Info,
  package_purchase: Package,
  booking: Calendar,
  booking_cancelled: Calendar,
  booking_rescheduled: Calendar,
};

const typeColor: Record<AdminNotificationType, string> = {
  order: "bg-amber-100 text-amber-700",
  system: "bg-muted text-muted-foreground",
  package_purchase: "bg-primary/20 text-primary",
  booking: "bg-blue-100 text-blue-700",
  booking_cancelled: "bg-rose-100 text-rose-700",
  booking_rescheduled: "bg-violet-100 text-violet-700",
};

const typeLabel: Record<AdminNotificationType, string> = {
  order: "Order",
  system: "System",
  package_purchase: "Purchase",
  booking: "Booking",
  booking_cancelled: "Cancelled",
  booking_rescheduled: "Rescheduled",
};

const quickActions: Partial<Record<AdminNotificationType, { label: string; tab: string; icon: typeof ExternalLink }>> = {
  order: { label: "View Orders", tab: "orders", icon: ShoppingBag },
  package_purchase: { label: "View Customer Packages", tab: "customer-packages", icon: Ticket },
  booking: { label: "View Schedule", tab: "schedule", icon: Calendar },
  booking_cancelled: { label: "View Schedule", tab: "schedule", icon: Calendar },
  booking_rescheduled: { label: "View Schedule", tab: "schedule", icon: Calendar },
};

const ROLE_ALLOWED_TYPES: Record<string, AdminNotificationType[]> = {
  barista: ["order", "system"],
  receptionist: ["booking", "booking_cancelled", "booking_rescheduled", "package_purchase", "system"],
};

interface InboxPageProps {
  onNavigate?: (tab: string) => void;
  userRole?: string;
}

const InboxPage = ({ onNavigate, userRole }: InboxPageProps) => {
  const { data: rawItemsUnknown = [], isLoading, refetch } = useAdminNotifications();
  const rawItems = rawItemsUnknown as AdminNotification[];
  const allowedTypes = userRole ? ROLE_ALLOWED_TYPES[userRole] ?? null : null;
  const items = allowedTypes ? rawItems.filter((n) => allowedTypes.includes(n.type)) : rawItems;
  const markRead = useMarkAdminNotificationRead();
  const markAllRead = useMarkAllAdminNotificationsRead();
  const deleteNotif = useDeleteAdminNotification();

  const [filter, setFilter] = useState<"all" | AdminNotificationType>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const cutoffDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - CUTOFF_DAYS);
    return d;
  }, []);

  // First apply the 7-day cutoff
  const recentItems = useMemo(() => {
    if (showAll) return items;
    return items.filter((n) => new Date(n.created_at) >= cutoffDate);
  }, [items, showAll, cutoffDate]);

  const olderCount = useMemo(
    () => items.filter((n) => new Date(n.created_at) < cutoffDate).length,
    [items, cutoffDate]
  );

  // Then apply type + search filters
  const filtered = useMemo(() => {
    return recentItems.filter((n) => {
      const matchType = filter === "all" || n.type === filter;
      const matchSearch =
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.message.toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [recentItems, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const unreadCount = items.filter((n) => !n.read).length;
  const selected = items.find((n) => n.id === selectedId);

  const resetPage = () => setCurrentPage(1);

  const handleSelect = (n: AdminNotification) => {
    setSelectedId(n.id);
    if (!n.read) markRead.mutate(n.id);
  };

  const handleDelete = (id: string) => {
    deleteNotif.mutate(id);
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Inbox</h2>
          <p className="text-sm text-muted-foreground">
            {unreadCount} unread · {showAll ? "all time" : `last ${CUTOFF_DAYS} days`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              Mark all as read
            </button>
          )}
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search inbox..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "order", "system", "package_purchase", "booking", "booking_cancelled", "booking_rescheduled"] as const).filter((t) => t === "all" || !allowedTypes || allowedTypes.includes(t)).map((t) => (
            <button
              key={t}
              onClick={() => { setFilter(t); resetPage(); }}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors border",
                filter === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {t === "all" ? "All" : typeLabel[t]}
            </button>
          ))}
        </div>

        {/* 7-day toggle */}
        {olderCount > 0 && (
          <button
            onClick={() => { setShowAll((v) => !v); resetPage(); }}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
              showAll
                ? "bg-muted text-foreground border-border"
                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            )}
          >
            <Clock className="h-3 w-3" />
            {showAll ? "Showing all" : `+${olderCount} older hidden`}
          </button>
        )}
      </div>

      <div className="flex gap-4 min-h-[500px]">
        {/* Notification list */}
        <div className="w-1/2 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {paginated.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                {filtered.length === 0 && !showAll && olderCount > 0
                  ? "No recent notifications. Click the orange badge to show older ones."
                  : "No messages"}
              </div>
            ) : (
              paginated.map((n) => {
                const Icon = typeIcon[n.type];
                const isOld = new Date(n.created_at) < cutoffDate;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleSelect(n)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-0 cursor-pointer transition-colors",
                      selectedId === n.id ? "bg-accent/50" : "hover:bg-muted/50",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", typeColor[n.type])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm truncate", !n.read ? "font-bold text-foreground" : "font-medium text-foreground")}>{n.title}</p>
                        {!n.read && <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        {isOld && <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Old</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {filtered.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-card shrink-0">
              <p className="text-xs text-muted-foreground">
                {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs font-medium text-foreground">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="w-1/2 rounded-xl border border-border bg-card p-6 overflow-y-auto max-h-[700px]">
          {selected ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", typeColor[selected.type])}>
                    {(() => { const Icon = typeIcon[selected.type]; return <Icon className="h-5 w-5" />; })()}
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">{selected.title}</h3>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", typeColor[selected.type])}>
                      {typeLabel[selected.type]}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {!selected.read ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => markRead.mutate(selected.id)} disabled={markRead.isPending} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50">
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Mark as read</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => refetch()} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                          <Circle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Refresh</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => handleDelete(selected.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Delete notification</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Message */}
              <div className="border-t border-border pt-4">
                <p className="text-sm text-foreground leading-relaxed">{selected.message}</p>
              </div>

              {/* Details block */}
              {selected.data && Object.keys(selected.data).length > 0 && (() => {
                const d = selected.data;

                if (selected.type === "package_purchase") {
                  const paymentLabel: Record<string, string> = { qr_paynow: "QR / PayNow", cash: "Cash", card: "Card", qr_scan: "QR / ABA" };
                  const packageTypeLabel: Record<string, string> = { membership: "Membership", class_package: "Class Package", service: "Service" };
                  const rows: { label: string; value: string }[] = [];
                  if (d.customer_name)        rows.push({ label: "Customer", value: String(d.customer_name) });
                  if (d.customer_email)       rows.push({ label: "Email",    value: String(d.customer_email) });
                  if (d.card_number)          rows.push({ label: "Card #",   value: String(d.card_number) });
                  if (d.package_name)         rows.push({ label: "Package",  value: String(d.package_name) });
                  if (d.package_type)         rows.push({ label: "Type",     value: packageTypeLabel[String(d.package_type)] ?? String(d.package_type) });
                  if (d.package_category)     rows.push({ label: "Category", value: String(d.package_category) });
                  if (d.package_price != null) rows.push({ label: "Price",   value: `$${parseFloat(String(d.package_price)).toFixed(2)}` });
                  if (d.payment_method)       rows.push({ label: "Payment",  value: paymentLabel[String(d.payment_method)] ?? String(d.payment_method) });
                  return (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Purchase Details</p>
                      {rows.map(({ label, value }) => (
                        <p key={label} className="text-sm text-foreground flex justify-between gap-4">
                          <span className="font-medium text-muted-foreground shrink-0">{label}</span>
                          <span className="text-right font-mono text-xs break-all">{value}</span>
                        </p>
                      ))}
                    </div>
                  );
                }

                if (selected.type === "order") {
                  const rows: { label: string; value: string }[] = [];
                  if (d.order_number)       rows.push({ label: "Order #",  value: String(d.order_number) });
                  if (d.order_type)         rows.push({ label: "Type",     value: String(d.order_type).replace("_", " ") });
                  if (d.total_amount != null) rows.push({ label: "Total",  value: `$${parseFloat(String(d.total_amount)).toFixed(2)}` });
                  if (d.payment_method)     rows.push({ label: "Payment",  value: String(d.payment_method) });
                  if (d.items_count != null) rows.push({ label: "Items",   value: String(d.items_count) });
                  return (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order Details</p>
                      {rows.map(({ label, value }) => (
                        <p key={label} className="text-sm text-foreground flex justify-between gap-4">
                          <span className="font-medium text-muted-foreground shrink-0">{label}</span>
                          <span className="text-right font-mono text-xs break-all">{value}</span>
                        </p>
                      ))}
                    </div>
                  );
                }

                if (selected.type === "booking" || selected.type === "booking_cancelled" || selected.type === "booking_rescheduled") {
                  const rows: { label: string; value: string }[] = [];
                  if (d.customer_name)      rows.push({ label: "Customer", value: String(d.customer_name) });
                  if (d.customer_email)     rows.push({ label: "Email",    value: String(d.customer_email) });
                  if (d.class_name)         rows.push({ label: "Class",    value: String(d.class_name) });
                  if (d.class_date)         rows.push({ label: "Date",     value: String(d.class_date) });
                  if (d.class_time)         rows.push({ label: "Time",     value: String(d.class_time) });
                  if (d.booking_reference)  rows.push({ label: "Ref #",    value: String(d.booking_reference) });
                  return (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booking Details</p>
                      {rows.map(({ label, value }) => (
                        <p key={label} className="text-sm text-foreground flex justify-between gap-4">
                          <span className="font-medium text-muted-foreground shrink-0">{label}</span>
                          <span className="text-right font-mono text-xs break-all">{value}</span>
                        </p>
                      ))}
                    </div>
                  );
                }

                const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
                const visibleEntries = Object.entries(d).filter(([, v]) => !isUuid(v));
                if (visibleEntries.length === 0) return null;
                return (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</p>
                    {visibleEntries.map(([key, value]) => (
                      <p key={key} className="text-sm text-foreground">
                        <span className="font-medium capitalize">{key.replace(/_/g, " ")}:</span>{" "}
                        <span className="text-muted-foreground">{String(value)}</span>
                      </p>
                    ))}
                  </div>
                );
              })()}

              {/* Quick Action Button */}
              {onNavigate && quickActions[selected.type] && (() => {
                const action = quickActions[selected.type]!;
                const ActionIcon = action.icon;
                return (
                  <button
                    onClick={() => onNavigate(action.tab)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition-colors"
                  >
                    <ActionIcon className="h-4 w-4" />
                    {action.label}
                    <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-60" />
                  </button>
                );
              })()}

              <p className="text-xs text-muted-foreground">
                {new Date(selected.created_at).toLocaleString([], { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Inbox className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Select a message</p>
              <p className="text-xs mt-1">Click on a notification to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InboxPage;
