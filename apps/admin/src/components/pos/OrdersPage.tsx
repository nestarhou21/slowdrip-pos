import { useState, useMemo } from "react";
import { Search, ChevronRight, Printer, CheckCircle2, XCircle, AlertCircle, RefreshCw, Calendar, Globe, User, Phone, ChefHat, Bell } from "lucide-react";
import { useApiPosOrders, useUpdateOrderStatus, useSettings, type ApiOrder, type ApiOrderStatus } from "@repo/store";
import { cn } from "@repo/ui";
import { Input } from "@repo/ui";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, toast } from "@repo/ui";
import { blePrintReceiptDouble, isBleSupported } from "@/lib/blePrinter";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import { Calendar as CalendarComponent } from "@repo/ui";
import { format } from "date-fns";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:    { label: "New Order",   className: "bg-rose-100 text-rose-700 border-rose-200" },
  confirmed:  { label: "Processing",  className: "bg-amber-100 text-amber-700 border-amber-200" },
  preparing:  { label: "Preparing",   className: "bg-blue-100 text-blue-700 border-blue-200" },
  ready:      { label: "Ready",       className: "bg-purple-100 text-purple-700 border-purple-200" },
  completed:  { label: "Completed",   className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelled:  { label: "Cancelled",   className: "bg-red-100 text-red-600 border-red-200" },
};

const typeLabels: Record<string, string> = {
  dine_in:  "Dine In",
  takeaway: "Take Away",
};

interface OrdersPageProps {
  onPrintReceipt: (order: ApiOrder) => void;
}

const OrdersPage = ({ onPrintReceipt }: OrdersPageProps) => {
  const { data: settings } = useSettings();
  const [selectedDate, setSelectedDate] = useState<string | null>(format(new Date(), "yyyy-MM-dd"));
  const [allDay, setAllDay] = useState<boolean>(false);
  const { data: ordersRaw = [], isLoading, refetch } = useApiPosOrders(undefined);
  const orders = ordersRaw as ApiOrder[];
  const updateStatus = useUpdateOrderStatus();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ApiOrderStatus | "active">("all");
  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null);

  const changeStatus = async (order: ApiOrder, status: ApiOrderStatus) => {
    try {
      await updateStatus.mutateAsync({ id: order.id, status });
      setSelectedOrder(null);
      toast.success(`Order ${order.order_number} → ${statusConfig[status].label}`);
    } catch {
      toast.error("Failed to update order status");
    }
  };

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (!allDay && selectedDate) {
        const localDate = new Date(o.created_at).toLocaleDateString("en-CA");
        if (localDate !== selectedDate) return false;
      }
      const matchStatus =
        statusFilter === "all"
          ? o.status !== "cancelled"
          : statusFilter === "active"
          ? ["pending", "confirmed", "preparing", "ready"].includes(o.status)
          : o.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch =
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_name ?? "").toLowerCase().includes(q) ||
        (o.customer_phone ?? "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [orders, search, statusFilter, allDay, selectedDate]);

  const stats = useMemo(() => ({
    newOnline: orders.filter((o) => o.status === "pending" && o.source === "website").length,
    active: orders.filter((o) => ["confirmed", "preparing", "ready"].includes(o.status)).length,
    completed: orders.filter((o) => o.status === "completed").length,
  }), [orders]);

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Orders Inbox</h2>
          <p className="text-sm text-muted-foreground">{orders.length} order{orders.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-9 px-4 font-medium border-border hover:border-primary/50 transition-colors" disabled={allDay}>
                <Calendar className="h-4 w-4 text-primary" />
                {selectedDate ? format(new Date(selectedDate + "T00:00:00"), "EEEE, MMM d, yyyy") : "All Day"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="single"
                selected={selectedDate ? new Date(selectedDate + "T00:00:00") : undefined}
                onSelect={(d) => d && setSelectedDate(format(d, "yyyy-MM-dd"))}
                disabled={(d) => d > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button
            variant={allDay ? "default" : "outline"}
            size="sm"
            className="gap-2 h-9 px-4 font-medium border-border hover:border-primary/50 transition-colors"
            onClick={() => {
              setAllDay((prev) => !prev);
              if (!allDay) setSelectedDate(null);
              else setSelectedDate(format(new Date(), "yyyy-MM-dd"));
            }}
          >
            All Day
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 h-9">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className={cn(
          "rounded-xl border p-4 transition-colors",
          stats.newOnline > 0 ? "border-rose-200 bg-rose-50" : "border-border bg-card"
        )}>
          <div className="flex items-center gap-2">
            <p className={cn("text-2xl font-bold", stats.newOnline > 0 ? "text-rose-600" : "text-foreground")}>{stats.newOnline}</p>
            {stats.newOnline > 0 && <Bell className="h-4 w-4 text-rose-500 animate-pulse" />}
          </div>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-bold opacity-70">New Online Orders</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground">{stats.active}</p>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-bold opacity-70">Active / Processing</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-bold opacity-70">Completed Today</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search order number..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-11 rounded-xl" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["active", "all", "completed", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all border shrink-0",
                statusFilter === s ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {s === "active" ? "Active" : s === "all" ? "All" : statusConfig[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 opacity-20 animate-spin" />
            <p>Loading orders...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <AlertCircle className="h-8 w-8 opacity-20" />
            <p>No orders found</p>
          </div>
        ) : (
          filtered.map((order) => (
            <div
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="flex items-center gap-4 border-b border-border last:border-0 px-4 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-foreground">{order.order_number}</p>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", statusConfig[order.status]?.className)}>
                    {statusConfig[order.status]?.label}
                  </span>
                  {order.source === "website" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                      <Globe className="h-2.5 w-2.5" /> Online
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{typeLabels[order.order_type]}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(order.customer_name || order.customer_phone) ? `${order.customer_name || order.customer_phone} · ` : ""}
                  {(order.items || []).length} item{(order.items || []).length !== 1 ? "s" : ""} · {(order.payment_method || "").toUpperCase() === "QR" ? "ABA QR" : (order.payment_method || "N/A").toUpperCase()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">${parseFloat(order.total_amount).toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))
        )}
      </div>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedOrder.order_number}
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", statusConfig[selectedOrder.status]?.className)}>
                    {statusConfig[selectedOrder.status]?.label}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 text-left">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Type</span>
                    <p className="font-medium text-foreground">{typeLabels[selectedOrder.order_type]}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Payment</span>
                    <p className="font-medium text-foreground">
                      {(selectedOrder.payment_method || "").toUpperCase() === "QR" ? "ABA QR" : (selectedOrder.payment_method || "N/A").toUpperCase()}
                      {selectedOrder.source === "website" && selectedOrder.payment_status === "pending" && (
                        <span className="ml-1.5 text-[10px] font-bold text-amber-600 uppercase">Pay at pickup</span>
                      )}
                    </p>
                  </div>
                </div>

                {selectedOrder.source === "website" && (
                  <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 space-y-1.5">
                    <p className="text-[10px] text-sky-700 uppercase tracking-wider font-bold flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Online Order — Customer
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {selectedOrder.customer_name || "—"}
                      </span>
                      {selectedOrder.customer_phone && (
                        <a href={`tel:${selectedOrder.customer_phone}`} className="flex items-center gap-1.5 text-primary hover:underline">
                          <Phone className="h-3.5 w-3.5" />
                          {selectedOrder.customer_phone}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Order Items</span>
                  {(selectedOrder.items || []).map((item, i) => (
                    <div key={i} className="text-sm">
                      <div className="flex justify-between items-start py-1.5">
                        <div>
                          <p className="font-medium text-foreground">
                            {item.quantity}× {item.product?.name || item.item_name || "Deleted Product"}
                            {item.variant && <span className="text-muted-foreground ml-1 text-xs">({item.variant.size?.name || "Standard"})</span>}
                          </p>
                          {(item.addons || []).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">+ {(item.addons || []).map(a => a.addon?.name).filter(Boolean).join(", ")}</p>
                          )}
                          {item.customisation && (
                            <p className="text-xs text-muted-foreground italic mt-0.5">"{item.customisation}"</p>
                          )}
                        </div>
                        <span className="font-medium text-foreground ml-2">${parseFloat(item.subtotal).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 mt-1 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>${parseFloat(selectedOrder.subtotal).toFixed(2)}</span>
                    </div>
                    {parseFloat(selectedOrder.discount_amount) > 0 && (
                      <div className="flex justify-between text-red-500">
                        <span>Discount</span>
                        <span>-${parseFloat(selectedOrder.discount_amount).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg text-foreground pt-1">
                      <span>Total</span>
                      <span>${parseFloat(selectedOrder.total_amount).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div className="bg-muted/50 p-3 rounded-lg border border-border/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Notes</p>
                    <p className="text-sm text-foreground italic">"{selectedOrder.notes}"</p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <div className="flex-1 flex flex-col gap-1">
                    <Button
                      onClick={async () => {
                        try {
                          await blePrintReceiptDouble(selectedOrder, settings as any);
                          toast.success("Printed 2 copies");
                        } catch (err: any) {
                          const msg: string = err?.message ?? "";
                          if (!msg.includes("cancelled") && !msg.includes("chosen")) {
                            toast.error("Printer error: " + (msg || "Unknown error"));
                          }
                        }
                      }}
                      variant="outline"
                      className="w-full gap-2 border-primary/20 text-primary hover:bg-primary/5 h-12"
                    >
                      <Printer className="h-4 w-4" /> Print Receipt
                    </Button>
                    <button
                      onClick={() => onPrintReceipt(selectedOrder)}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 text-center transition-colors"
                    >
                      Browser Print (fallback)
                    </button>
                  </div>

                  {selectedOrder.status === "pending" && (
                    <Button
                      onClick={() => changeStatus(selectedOrder, "preparing")}
                      disabled={updateStatus.isPending}
                      className="flex-1 gap-2 h-12 shadow-md bg-primary hover:bg-primary/90 transition-all active:scale-95"
                    >
                      <ChefHat className="h-4 w-4" /> Accept Order
                    </Button>
                  )}

                  {selectedOrder.status === "preparing" && (
                    <Button
                      onClick={() => changeStatus(selectedOrder, "ready")}
                      disabled={updateStatus.isPending}
                      className="flex-1 gap-2 h-12 shadow-md bg-purple-600 hover:bg-purple-700 text-white transition-all active:scale-95"
                    >
                      <Bell className="h-4 w-4" /> Mark Ready
                    </Button>
                  )}

                  {["confirmed", "ready"].includes(selectedOrder.status) && (
                    <Button
                      onClick={() => changeStatus(selectedOrder, "completed")}
                      disabled={updateStatus.isPending}
                      className="flex-1 gap-2 h-12 shadow-md bg-primary hover:bg-primary/90 transition-all active:scale-95"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Complete
                    </Button>
                  )}

                  {selectedOrder.status === "completed" && (
                    <Button
                      onClick={() => changeStatus(selectedOrder, "confirmed")}
                      disabled={updateStatus.isPending}
                      variant="outline"
                      className="flex-1 gap-2 h-12"
                    >
                      <AlertCircle className="h-4 w-4" /> Undo
                    </Button>
                  )}

                  {["pending", "confirmed", "preparing"].includes(selectedOrder.status) && (
                    <Button
                      onClick={() => changeStatus(selectedOrder, "cancelled")}
                      disabled={updateStatus.isPending}
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 h-12 px-3 rounded-xl"
                      title={selectedOrder.status === "pending" ? "Reject Order" : "Cancel Order"}
                    >
                      <XCircle className="h-6 w-6" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersPage;
