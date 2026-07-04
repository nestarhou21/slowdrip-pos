import { useState, useMemo } from "react";
import { useApiPosOrders, type ApiOrder, useCurrentRegisterSession, useOpenRegister, useCloseRegister, useAddRegisterCash, useRegisterSessions, useSettings, type RegisterSession, useDeleteOrder, useDeleteRegisterCash } from "@repo/store";
import { ArrowDownRight, Printer, Sun, Moon, Clock, ArrowUpRight, ArrowDownLeft, History, AlertCircle, Coins, Loader2, Download, ArrowLeft, Filter, Calendar, X, Trash2 } from "lucide-react";
import {
  Button,
  Input,
  Label,
  toast,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Calendar as CalendarComponent,
} from "@repo/ui";
import { cn } from "@repo/ui";
import { format } from "date-fns";

type ShiftType = "morning" | "afternoon";

const SHIFTS = [
  {
    type: "morning" as ShiftType,
    label: "Morning Shift",
    icon: Sun,
    defaultStart: "06:00",
    defaultEnd: "14:00",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    activeBg: "bg-amber-500",
  },
  {
    type: "afternoon" as ShiftType,
    label: "Afternoon / Evening",
    icon: Moon,
    defaultStart: "14:00",
    defaultEnd: "22:00",
    color: "text-indigo-600",
    bg: "bg-indigo-50 border-indigo-200",
    activeBg: "bg-indigo-500",
  },
];

const RegisterPage = ({ userName = "", userRole = "barista" }: { userName?: string; userRole?: string }) => {
  const isAdmin = userRole === "admin";
  const { data: apiOrdersRaw = [] } = useApiPosOrders();
  const apiOrders = apiOrdersRaw as ApiOrder[];
  const { data: sessionRaw, isLoading } = useCurrentRegisterSession();
  const session = sessionRaw as RegisterSession | null | undefined;
  const { data: settingsRaw } = useSettings();
  const settings = settingsRaw as any;
  const openRegister    = useOpenRegister();
  const closeRegister   = useCloseRegister();
  const addCash         = useAddRegisterCash();
  const deleteOrder     = useDeleteOrder();
  const deleteCash      = useDeleteRegisterCash();

  // Opening fields
  const [selectedShift, setSelectedShift] = useState<ShiftType>("morning");
  const [shiftStart, setShiftStart] = useState("06:00");
  const [shiftEnd, setShiftEnd] = useState("14:00");
  const [inputBalance, setInputBalance] = useState("");
  const [openingCurrency, setOpeningCurrency] = useState<"USD" | "KHR">("USD");
  const [openingName, setOpeningName] = useState(userName || "");
  const [closingName, setClosingName] = useState("");
  const [view, setView] = useState<"register" | "sessions">("register");
  const [sessionShiftFilter, setSessionShiftFilter] = useState<"all" | "morning" | "afternoon">("all");
  const [sessionStatusFilter, setSessionStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [sessionDateFrom, setSessionDateFrom] = useState<string | undefined>(undefined);
  const [sessionDateTo, setSessionDateTo] = useState<string | undefined>(undefined);

  const { data: historyDataRaw, isLoading: sessionsLoading } = useRegisterSessions(1, sessionDateFrom, sessionDateTo);
  const historyData = historyDataRaw as any;

  // Running fields
  const [inputActualCash, setInputActualCash] = useState("");
  const [closingCurrency, setClosingCurrency] = useState<"USD" | "KHR">("USD");
  const [inputReason, setInputReason] = useState("");
  const [inputAmount, setInputAmount] = useState("");
  const [manualCurrency, setManualCurrency] = useState<"USD" | "KHR">("USD");
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [selectedActivityOrder, setSelectedActivityOrder] = useState<ApiOrder | null>(null);

  const shiftOrders = useMemo<ApiOrder[]>(() => {
    if (!session?.opened_at) return [];
    return apiOrders.filter(o =>
      o.created_at > session.opened_at! &&
      (!session.closed_at || o.created_at < session.closed_at!)
    );
  }, [apiOrders, session?.opened_at, session?.closed_at]);

  const cashOrders = shiftOrders.filter(o => o.payment_method === "cash");
  const digitalOrders = shiftOrders.filter(o => o.payment_method === "qr" || o.payment_method === "bakong");

  // Use server-tracked totals (incremented atomically by OrderController on each order)
  const cashSales = session?.cash_sales ?? 0;
  const digitalSales = session?.digital_sales ?? 0;
  const totalShiftSales = cashSales + digitalSales;
  const expectedInDrawer = (session?.opening_balance ?? 0) + cashSales + (session?.cash_in ?? 0) - (session?.cash_out ?? 0);

  const activeShiftMeta = SHIFTS.find(s => s.type === selectedShift)!;
  const khrRate = settings?.khr_rate || 4010;

  const handleShiftChange = (type: ShiftType) => {
    setSelectedShift(type);
    const meta = SHIFTS.find(s => s.type === type)!;
    setShiftStart(meta.defaultStart);
    setShiftEnd(meta.defaultEnd);
  };

  const openRegisterHandler = async () => {
    if (!openingName.trim()) {
      toast.error("Please enter your name before opening the register.");
      return;
    }
    const rawAmt = parseFloat(inputBalance) || 0;
    if (rawAmt < 0) return;

    const finalUsdAmount = openingCurrency === "KHR" ? rawAmt / khrRate : rawAmt;
    const nowHour = new Date().getHours();
    const autoShift: ShiftType = nowHour < 14 ? "morning" : "afternoon";
    const autoMeta = SHIFTS.find(s => s.type === autoShift)!;

    try {
      await openRegister.mutateAsync({
        staff_name:       openingName.trim(),
        shift_type:       autoShift,
        shift_start_time: autoMeta.defaultStart,
        shift_end_time:   autoMeta.defaultEnd,
        opening_balance:  finalUsdAmount,
      });
      setInputBalance("");
      toast.success("Register opened");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to open register");
    }
  };

  const confirmCloseRegisterHandler = async () => {
    if (!closingName.trim()) {
      toast.error("Please enter your name before closing the register.");
      return;
    }
    if (!session?.id) {
      toast.error("No open register session found.");
      return;
    }

    // If no amount entered → use expectedInDrawer (balanced assumption)
    let finalUsdAmount: number;
    if (!inputActualCash.trim()) {
      finalUsdAmount = expectedInDrawer;
    } else {
      const rawAmt = parseFloat(inputActualCash);
      if (rawAmt < 0) { toast.error("Closing balance cannot be negative."); return; }
      finalUsdAmount = closingCurrency === "KHR" ? rawAmt / khrRate : rawAmt;
    }

    try {
      // Store the closing person's name in the session by updating staff_name to show both
      await closeRegister.mutateAsync({ sessionId: session.id, closingBalance: finalUsdAmount });
      setShowCloseDialog(false);
      setInputActualCash("");
      setClosingName("");
      const diff = finalUsdAmount - expectedInDrawer;
      if (!inputActualCash.trim()) {
        toast.success("Register closed. Closing balance matched expected drawer amount.");
      } else if (Math.abs(diff) > 0.01) {
        toast.warning(`Register closed. Difference: $${diff.toFixed(2)}`);
      } else {
        toast.success("Register closed. Balanced!");
      }
    } catch (err: any) {
      toast.error(err?.body?.message ?? err?.message ?? "Failed to close register");
    }
  };

  const fmtKHR = (usd: number) => `${Math.round(usd * khrRate).toLocaleString()} ៛`;

  const handleCashIn = async () => {
    const rawAmt = parseFloat(inputAmount);
    if (isNaN(rawAmt) || rawAmt <= 0 || !session?.id) return;

    let finalUsdAmount = rawAmt;
    let originalAmount = rawAmt;
    let originalCurrency = manualCurrency;

    if (manualCurrency === "KHR") {
      finalUsdAmount = rawAmt / khrRate;
    }

    try {
      await addCash.mutateAsync({
        sessionId: session.id,
        type: 'in',
        amount: finalUsdAmount,
        currency: originalCurrency,
        original_amount: originalAmount,
        exchange_rate: khrRate,
        reason: inputReason || `Manual Cash In (${manualCurrency})`
      });
      setInputAmount("");
      setInputReason("");
      toast.success(`Cash in recorded (${manualCurrency})`);
    } catch (err: any) { toast.error(err?.message ?? "Failed to record"); }
  };

  const handleCashOut = async () => {
    const rawAmt = parseFloat(inputAmount);
    if (isNaN(rawAmt) || rawAmt <= 0 || !session?.id) return;

    let finalUsdAmount = rawAmt;
    let originalAmount = rawAmt;
    let originalCurrency = manualCurrency;

    if (manualCurrency === "KHR") {
      finalUsdAmount = rawAmt / khrRate;
    }

    try {
      await addCash.mutateAsync({
        sessionId: session.id,
        type: 'out',
        amount: finalUsdAmount,
        currency: originalCurrency,
        original_amount: originalAmount,
        exchange_rate: khrRate,
        reason: inputReason || `Manual Cash Out (${manualCurrency})`
      });
      setInputAmount("");
      setInputReason("");
      toast.success(`Cash out recorded (${manualCurrency})`);
    } catch (err: any) { toast.error(err?.message ?? "Failed to record"); }
  };

  const startCashBackHelper = (order: ApiOrder) => {
    setSelectedActivityOrder(null);
    setInputReason(`Cash change for ${order.order_number}`);
    // Scroll and focus helper
    const amountInput = document.getElementById('manual-amount-input');
    amountInput?.focus();
    toast.info("Manual entry pre-filled for cash back");
  };

  const handleDeleteOrder = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    if (!isAdmin) return;
    if (!confirm("Are you sure you want to delete this order? This will adjust shift totals.")) return;

    try {
      await deleteOrder.mutateAsync(orderId);
      toast.success("Order deleted and totals adjusted");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete order");
    }
  };

  const handleDeleteCash = async (e: React.MouseEvent, entryId: number) => {
    e.stopPropagation();
    if (!isAdmin) return;
    if (!confirm("Are you sure you want to delete this manual adjustment? This will adjust shift totals.")) return;

    try {
      await deleteCash.mutateAsync(entryId);
      toast.success("Cash entry deleted and totals adjusted");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete cash entry");
    }
  };


  const printDailySummary = () => {
    const sCafeName = settings?.cafe_name ?? "Slow Drip";
    const sTagline  = settings?.cafe_tagline ?? "Artisanal Coffee & Tea";
    const dateStr   = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const khr       = settings?.khr_rate || 4010;
    const fmt       = (v: number) => `$${v.toFixed(2)}`;
    const fmtK      = (v: number) => `${Math.round(v * khr).toLocaleString()} ៛`;

    const openedAt  = session?.opened_at
      ? new Date(session.opened_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      : "—";
    const closedAt  = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const opening   = session?.opening_balance ?? 0;
    const closing   = session?.closing_balance ?? null;

    const validOrders = shiftOrders.filter(o => o.status !== "cancelled");
    const cashTotal   = validOrders.filter(o => o.payment_method === "cash").reduce((s, o) => s + parseFloat(o.total_amount), 0);
    const abaTotal    = validOrders.filter(o => o.payment_method !== "cash").reduce((s, o) => s + parseFloat(o.total_amount), 0);
    const grandTotal  = cashTotal + abaTotal;

    // Extract barista name from "Served by: Name" stored in order notes
    const getBarista = (o: ApiOrder) => {
      const n = (o.notes ?? "").trim();
      return n.startsWith("Served by:") ? n.replace("Served by:", "").trim() : null;
    };

    // Group orders by barista for the audit section
    const byBarista: Record<string, { orders: number; total: number }> = {};
    validOrders.forEach(o => {
      const name = getBarista(o) || session?.staff_name || "Unknown";
      if (!byBarista[name]) byBarista[name] = { orders: 0, total: 0 };
      byBarista[name].orders++;
      byBarista[name].total += parseFloat(o.total_amount);
    });

    const entries = session?.cash_entries ?? [];
    const cashIn  = entries.filter((e: any) => e.type === "in").reduce((s: number, e: any) => s + e.amount, 0);
    const cashOut = entries.filter((e: any) => e.type === "out").reduce((s: number, e: any) => s + e.amount, 0);

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Daily Summary</title>
<style>
  @page { margin: 16mm 14mm; size: A4; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; font-size: 12px; color: #18181b; background:#fff; line-height:1.6; }
  .wrap { max-width: 560px; margin: 0 auto; }
  h1 { font-size: 20px; font-weight: 300; letter-spacing: 3px; text-transform: uppercase; }
  .sub { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #71717a; margin-top: 3px; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 14px; border-bottom: 1px solid #18181b; margin-bottom: 28px; }
  .hdr-right { text-align: right; }
  .lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #71717a; }
  .val { font-size: 13px; font-weight: 500; margin-top: 1px; }

  /* meta strip */
  .meta { display: flex; gap: 28px; padding-bottom: 20px; border-bottom: 1px solid #e4e4e7; margin-bottom: 24px; }
  .meta-item .lbl { margin-bottom: 2px; }

  /* summary boxes */
  .boxes { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px; background: #e4e4e7; border: 1px solid #e4e4e7; border-radius: 6px; overflow: hidden; margin-bottom: 28px; }
  .box { background: #fff; padding: 14px 16px; }
  .box.dark { background: #18181b; }
  .box .lbl { color: #71717a; }
  .box.dark .lbl { color: #71717a; }
  .box .big { font-size: 18px; font-weight: 600; margin-top: 4px; }
  .box.dark .big { color: #fff; }
  .box .small { font-size: 10px; color: #a1a1aa; margin-top: 1px; }
  .box.dark .small { color: #52525b; }

  /* balance row */
  .bal { display: flex; gap: 1px; background: #e4e4e7; border: 1px solid #e4e4e7; border-radius: 6px; overflow: hidden; margin-bottom: 28px; }
  .bal-box { flex: 1; background: #fff; padding: 14px 16px; }

  /* section */
  .sec { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #71717a; margin-bottom: 10px; }

  /* staff audit table */
  .staff-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 12px; }
  .staff-row:last-child { border-bottom: none; }
  .staff-name { font-weight: 500; }
  .staff-meta { color: #71717a; font-size: 11px; }

  /* activity */
  .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f4f4f5; font-size: 12px; }
  .row:last-child { border-bottom: none; }
  .row .reason { color: #3f3f46; }
  .in  { color: #16a34a; font-weight: 600; }
  .out { color: #dc2626; font-weight: 600; }
  .empty { font-size: 11px; color: #a1a1aa; padding: 8px 0; }

  /* sig */
  .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 44px; padding-top: 28px; border-top: 1px solid #e4e4e7; }
  .sig-line { border-top: 1px solid #18181b; padding-top: 6px; margin-top: 28px; }
  .sig-name { font-size: 10px; font-weight: 600; }
  .sig-role { font-size: 9px; color: #71717a; text-transform: uppercase; letter-spacing: 1px; }

  /* footer */
  .foot { margin-top: 28px; padding-top: 10px; border-top: 1px solid #f4f4f5; font-size: 9px; color: #a1a1aa; display: flex; justify-content: space-between; }
</style>
</head><body>
<div class="wrap">

  <div class="hdr">
    <div>
      <h1>${sCafeName}</h1>
      <div class="sub">${sTagline}</div>
    </div>
    <div class="hdr-right">
      <div class="lbl">Daily Summary</div>
      <div class="val">${dateStr}</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-item"><div class="lbl">Opened by</div><div class="val">${session?.staff_name || "—"}</div></div>
    <div class="meta-item"><div class="lbl">Opened at</div><div class="val">${openedAt}</div></div>
    <div class="meta-item"><div class="lbl">Closed by</div><div class="val">${closingName.trim() || "—"}</div></div>
    <div class="meta-item"><div class="lbl">Closed at</div><div class="val">${closedAt}</div></div>
    <div class="meta-item"><div class="lbl">Orders</div><div class="val">${validOrders.length}</div></div>
  </div>

  <div class="sec">Sales Breakdown</div>
  <div class="boxes">
    <div class="box">
      <div class="lbl">Cash</div>
      <div class="big">${fmt(cashTotal)}</div>
      <div class="small">${fmtK(cashTotal)}</div>
    </div>
    <div class="box">
      <div class="lbl">Online (ABA)</div>
      <div class="big">${fmt(abaTotal)}</div>
      <div class="small">${fmtK(abaTotal)}</div>
    </div>
    <div class="box dark">
      <div class="lbl">Total</div>
      <div class="big">${fmt(grandTotal)}</div>
      <div class="small">${fmtK(grandTotal)}</div>
    </div>
  </div>

  <div class="sec">Orders by Staff</div>
  ${Object.entries(byBarista).length > 0
    ? Object.entries(byBarista).map(([name, data]) => `
    <div class="staff-row">
      <div>
        <div class="staff-name">${name}</div>
        <div class="staff-meta">${data.orders} order${data.orders !== 1 ? "s" : ""}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:600;">${fmt(data.total)}</div>
        <div class="staff-meta">${fmtK(data.total)}</div>
      </div>
    </div>`).join("")
    : '<div class="empty">No orders this session</div>'}

  <div class="sec" style="margin-top:24px;">Register Balance</div>
  <div class="bal">
    <div class="bal-box">
      <div class="lbl">Opening Balance</div>
      <div class="val">${fmt(opening)} <span style="color:#a1a1aa;font-size:10px;">${fmtK(opening)}</span></div>
    </div>
    <div class="bal-box">
      <div class="lbl">Closing Balance</div>
      <div class="val">${closing !== null ? fmt(closing) + ' <span style="color:#a1a1aa;font-size:10px;">' + fmtK(closing) + '</span>' : '<span style="color:#a1a1aa;">Not recorded</span>'}</div>
    </div>
  </div>

  <div class="sec">Manual Cash Entries</div>
  ${entries.length > 0 ? entries.map((e: any) => `
    <div class="row">
      <span class="reason">${e.reason || (e.type === "in" ? "Cash In" : "Cash Out")}</span>
      <span class="${e.type === "in" ? "in" : "out"}">${e.type === "in" ? "+" : "−"}${fmt(e.amount)}</span>
    </div>`).join("") : '<div class="empty">No manual entries</div>'}

  ${entries.length > 0 ? `
  <div class="row" style="margin-top:4px;border-top:1px solid #e4e4e7;padding-top:8px;">
    <span style="font-size:10px;color:#71717a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Net Cash Movement</span>
    <span style="font-weight:600;color:${cashIn - cashOut >= 0 ? "#16a34a" : "#dc2626"};">${cashIn - cashOut >= 0 ? "+" : ""}${fmt(cashIn - cashOut)}</span>
  </div>` : ""}

  <div class="sigs">
    <div>
      <div class="sig-line"></div>
      <div class="sig-name">${session?.staff_name || "Staff"}</div>
      <div class="sig-role">Prepared by</div>
    </div>
    <div>
      <div class="sig-line"></div>
      <div class="sig-name">Manager</div>
      <div class="sig-role">Verified by</div>
    </div>
  </div>

  <div class="foot">
    <span>${sCafeName}</span>
    <span>Printed ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</span>
  </div>

</div>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); w.addEventListener("afterprint", () => w.close()); }, 300);
    }
  };

  // Keep a single alias so existing references to printShiftReport still work
  const printShiftReport = printDailySummary;


  const currentShiftMeta = session?.shift_type
    ? SHIFTS.find(s => s.type === session.shift_type)
    : null;

  /* ── Sessions Screen Logic ── */
  const allSessions: RegisterSession[] = historyData?.data ?? [];
  const filteredSessions = allSessions.filter((s: RegisterSession) => {
    if (sessionShiftFilter !== "all" && s.shift_type !== sessionShiftFilter) return false;
    if (sessionStatusFilter !== "all" && s.status !== sessionStatusFilter) return false;
    return true;
  });

  const sessionTotals = filteredSessions.reduce(
    (acc: { cashSales: number; digitalSales: number }, s: RegisterSession) => ({
      cashSales: acc.cashSales + (s.cash_sales ?? 0),
      digitalSales: acc.digitalSales + (s.digital_sales ?? 0),
    }),
    { cashSales: 0, digitalSales: 0 }
  );

  const downloadSessionsCSV = () => {
    const header = ["Date", "Staff", "Shift", "Opening", "Closing", "Cash Sales", "Digital Sales", "Cash In", "Cash Out", "Diff", "Status"];
    const rows = filteredSessions.map((s: RegisterSession) => {
      const diff = s.closing_balance != null
        ? (s.closing_balance - (s.opening_balance + (s.cash_sales ?? 0) - (s.cash_out ?? 0))).toFixed(2)
        : "";
      return [
        new Date(s.opened_at).toLocaleDateString("en-GB"),
        s.staff_name,
        s.shift_type,
        s.opening_balance.toFixed(2),
        s.closing_balance != null ? s.closing_balance.toFixed(2) : "",
        (s.cash_sales ?? 0).toFixed(2),
        (s.digital_sales ?? 0).toFixed(2),
        (s.cash_in ?? 0).toFixed(2),
        (s.cash_out ?? 0).toFixed(2),
        diff,
        s.status,
      ].join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (view === "sessions") {
    return (
      <div className="space-y-5">
        {/* Sessions Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setView("register")}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Session History</h2>
              <p className="text-sm text-muted-foreground">{filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={downloadSessionsCSV} disabled={filteredSessions.length === 0}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

          {/* Date range pickers */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8 px-3 text-[11px] font-bold border-border hover:border-primary/50 transition-colors">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                {sessionDateFrom ? format(new Date(sessionDateFrom + "T00:00:00"), "MMM d, yyyy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={sessionDateFrom ? new Date(sessionDateFrom + "T00:00:00") : undefined}
                onSelect={(d) => d && setSessionDateFrom(format(d, "yyyy-MM-dd"))}
                disabled={(d) => d > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8 px-3 text-[11px] font-bold border-border hover:border-primary/50 transition-colors">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                {sessionDateTo ? format(new Date(sessionDateTo + "T00:00:00"), "MMM d, yyyy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={sessionDateTo ? new Date(sessionDateTo + "T00:00:00") : undefined}
                onSelect={(d) => d && setSessionDateTo(format(d, "yyyy-MM-dd"))}
                disabled={(d) => d > new Date() || (sessionDateFrom ? d < new Date(sessionDateFrom + "T00:00:00") : false)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {(sessionDateFrom || sessionDateTo) && (
            <button
              onClick={() => { setSessionDateFrom(undefined); setSessionDateTo(undefined); }}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              <X className="w-3 h-3" /> Clear dates
            </button>
          )}

          <span className="w-px h-4 bg-border mx-0.5" />

          {(["all", "morning", "afternoon"] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setSessionShiftFilter(opt)}
              className={cn(
                "px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-colors",
                sessionShiftFilter === opt
                  ? opt === "morning"
                    ? "bg-amber-100 border-amber-300 text-amber-700"
                    : opt === "afternoon"
                      ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                      : "bg-foreground text-background border-foreground"
                  : "bg-transparent border-border text-muted-foreground hover:bg-muted/40"
              )}
            >
              {opt === "all" ? "All Shifts" : opt === "morning" ? "Morning" : "Afternoon"}
            </button>
          ))}
          <span className="w-px h-4 bg-border mx-1" />
          {(["all", "open", "closed"] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setSessionStatusFilter(opt)}
              className={cn(
                "px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-colors",
                sessionStatusFilter === opt
                  ? opt === "open"
                    ? "bg-green-100 border-green-300 text-green-700"
                    : opt === "closed"
                      ? "bg-muted border-border text-foreground"
                      : "bg-foreground text-background border-foreground"
                  : "bg-transparent border-border text-muted-foreground hover:bg-muted/40"
              )}
            >
              {opt === "all" ? "All Status" : opt}
            </button>
          ))}
        </div>

        {/* Summary Stats */}
        {filteredSessions.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Shifts</p>
              <p className="text-2xl font-display font-bold mt-0.5">{filteredSessions.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Cash Sales</p>
              <p className="text-2xl font-display font-bold mt-0.5">${sessionTotals.cashSales.toFixed(2)}</p>
              <p className="text-[10px] font-bold text-muted-foreground opacity-70 mt-1">{fmtKHR(sessionTotals.cashSales)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Total Sales</p>
              <p className="text-2xl font-display font-bold mt-0.5">${(sessionTotals.cashSales + sessionTotals.digitalSales).toFixed(2)}</p>
              <p className="text-[10px] font-bold text-muted-foreground opacity-70 mt-1">{fmtKHR(sessionTotals.cashSales + sessionTotals.digitalSales)}</p>
            </div>
          </div>
        )}

        {/* Session Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center px-5 py-2.5 bg-muted/50 border-b border-border">
            <div className="flex-1 min-w-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Staff / Shift</div>
            <div className="w-[84px] text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Opened With</div>
            <div className="w-[84px] text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Closed With</div>
            <div className="w-[76px] text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Cash</div>
            <div className="w-[76px] text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Online</div>
            <div className="w-[84px] text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Total Sales</div>
            <div className="w-[72px] text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Status</div>
          </div>

          <div className="divide-y divide-border">
            {sessionsLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
              </div>
            ) : filteredSessions.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground opacity-50">No sessions found.</p>
            )}
            {filteredSessions.map((s: RegisterSession) => {
              const shiftMeta = SHIFTS.find(sh => sh.type === s.shift_type);
              const ShiftIcon = shiftMeta?.icon ?? Sun;
              const shiftSales = (s.cash_sales ?? 0) + (s.digital_sales ?? 0);
              const isMorning = s.shift_type === "morning";

              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center px-5 py-3.5 hover:bg-muted/20 transition-colors",
                    isMorning ? "border-l-2 border-l-amber-400" : "border-l-2 border-l-indigo-400"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center border shrink-0", shiftMeta?.bg)}>
                      <ShiftIcon className={cn("w-4 h-4", shiftMeta?.color)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{s.staff_name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(s.opened_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}{s.shift_start_time}–{s.shift_end_time}
                      </p>
                    </div>
                  </div>

                   <div className="w-[84px] text-right shrink-0">
                     <p className="text-sm font-mono">${s.opening_balance.toFixed(2)}</p>
                     <p className="text-[9px] font-semibold text-muted-foreground opacity-60">{fmtKHR(s.opening_balance)}</p>
                   </div>
                   <div className="w-[84px] text-right shrink-0">
                     <p className="text-sm font-mono">{s.closing_balance != null ? `$${s.closing_balance.toFixed(2)}` : "—"}</p>
                     {s.closing_balance != null && (
                       <p className="text-[9px] font-semibold text-muted-foreground opacity-60">{fmtKHR(s.closing_balance)}</p>
                     )}
                   </div>
                  <div className="w-[76px] text-right shrink-0">
                    <p className="text-sm font-mono text-muted-foreground">${(s.cash_sales ?? 0).toFixed(2)}</p>
                  </div>
                  <div className="w-[76px] text-right shrink-0">
                    <p className="text-sm font-mono text-muted-foreground">${(s.digital_sales ?? 0).toFixed(2)}</p>
                  </div>
                   <div className="w-[84px] text-right shrink-0">
                     <p className="text-sm font-mono font-bold">${shiftSales.toFixed(2)}</p>
                     <p className="text-[9px] font-semibold text-muted-foreground opacity-60">{fmtKHR(shiftSales)}</p>
                   </div>
                  <div className="w-[72px] flex justify-end shrink-0">
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border",
                      s.status === "open"
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-muted border-border text-muted-foreground"
                    )}>
                      {s.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Register & Cash Drawer</h2>
          <p className="text-sm text-muted-foreground">Manage cash flow and shift summaries</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs font-bold uppercase tracking-widest"
              onClick={() => setView("sessions")}
            >
              <History className="w-3.5 h-3.5" />
              Session History
              {historyData?.total != null && (
                <span className="bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{historyData.total}</span>
              )}
            </Button>
          )}
          {session?.status === 'open' && (
            <div className="text-xs text-muted-foreground font-medium">
              Opened {session.opened_at ? new Date(session.opened_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : ""}
              {session.staff_name && <> · {session.staff_name}</>}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        /* â"€â"€ LOADING SKELETON â"€â"€ */
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
            <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 space-y-3">
              <Skeleton className="h-4 w-28" />
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
      ) : !session || session?.status !== 'open' ? (
        /* â"€â"€ OPEN REGISTER SCREEN â"€â"€ */
        <div className="max-w-lg mx-auto space-y-5">

          {/* Open register form */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            {/* Name — required */}
            <div className="space-y-2">
              <Label className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Your Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Bong Fang Fang"
                value={openingName}
                onChange={e => setOpeningName(e.target.value)}
                className="h-11"
              />
            </div>

            <div className="border-t border-border pt-5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Opening Balance <span className="text-muted-foreground/50 font-normal normal-case text-xs">(optional)</span></h3>
              <div className="flex items-center gap-1.5 p-0.5 bg-muted rounded-md border border-border">
                <button
                  onClick={() => setOpeningCurrency("USD")}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all",
                    openingCurrency === "USD" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground opacity-60"
                  )}
                >
                  USD
                </button>
                <button
                  onClick={() => setOpeningCurrency("KHR")}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all",
                    openingCurrency === "KHR" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground opacity-60"
                  )}
                >
                  KHR
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Count the cash currently in the drawer and enter the exact amount below.
            </p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                {openingCurrency === "USD" ? "$" : "៛"}
              </span>
              <Input
                type="number"
                placeholder="0.00"
                value={inputBalance}
                onChange={e => setInputBalance(e.target.value)}
                className="pl-9 h-14 text-xl font-bold"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-right italic font-medium bg-muted/30 py-1.5 px-3 rounded-lg border border-border/50">
              {openingCurrency === "KHR" ? (
                <>Equivalent: <span className="text-foreground font-bold">${((parseFloat(inputBalance) || 0) / khrRate).toFixed(2)} USD</span></>
              ) : (
                <>Equivalent: <span className="text-foreground font-bold">{fmtKHR(parseFloat(inputBalance) || 0)}</span></>
              )}
            </p>
            </div>{/* end border-t section */}
            <Button
              onClick={openRegisterHandler}
              disabled={openRegister.isPending || !openingName.trim()}
              className="w-full h-11 font-bold gap-2"
            >
              {openRegister.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Opening...</>
              ) : "Open Register"}
            </Button>
          </div>
        </div>
      ) : (
        /* â"€â"€ REGISTER OPEN SCREEN â"€â"€ */
        <>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Opening Balance</p>
              <h4 className="mt-2 text-2xl font-bold">${(session?.opening_balance ?? 0).toFixed(2)}</h4>
              <p className="text-[10px] font-bold text-muted-foreground mt-1 opacity-70">{fmtKHR(session?.opening_balance ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Digital Sales (ABA)</p>
              <h4 className="mt-2 text-2xl font-bold text-blue-600">${digitalSales.toFixed(2)}</h4>
              <p className="text-[10px] font-bold text-muted-foreground mt-1 opacity-70">{fmtKHR(digitalSales)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cash Sales</p>
              <h4 className="mt-2 text-2xl font-bold text-primary">${cashSales.toFixed(2)}</h4>
              <p className="text-[10px] font-bold text-muted-foreground mt-1 opacity-70">{fmtKHR(cashSales)}</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 shadow-sm">
              <p className="text-xs font-bold text-primary uppercase tracking-widest">Expected in Drawer</p>
              <h4 className="mt-2 text-2xl font-bold text-primary">${expectedInDrawer.toFixed(2)}</h4>
              <p className="text-[10px] font-bold text-primary/60 mt-1">{fmtKHR(expectedInDrawer)}</p>
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Left — manual entry + totals */}
            <div className="space-y-4 lg:col-span-1">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h3 className="font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-primary" />
                  Manual Entry
                </h3>
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-xs">Amount</Label>
                    <div className="flex items-center gap-1.5 p-0.5 bg-muted rounded-md border border-border">
                      <button
                        onClick={() => setManualCurrency("USD")}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all",
                          manualCurrency === "USD" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground opacity-60"
                        )}
                      >
                        USD
                      </button>
                      <button
                        onClick={() => setManualCurrency("KHR")}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all",
                          manualCurrency === "KHR" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground opacity-60"
                        )}
                      >
                        KHR
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">
                      {manualCurrency === "USD" ? "$" : "៛"}
                    </span>
                    <Input
                      id="manual-amount-input"
                      type="number"
                      placeholder="0.00"
                      value={inputAmount}
                      onChange={e => setInputAmount(e.target.value)}
                      className="pl-9 h-11"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 text-right italic bg-muted/40 py-1 px-2.5 rounded border border-border/40">
                    {manualCurrency === "KHR" ? (
                      <>Equivalent: <span className="text-foreground font-bold">${((parseFloat(inputAmount) || 0) / khrRate).toFixed(2)} USD</span></>
                    ) : (
                      <>Equivalent: <span className="text-foreground font-bold">{fmtKHR(parseFloat(inputAmount) || 0)}</span></>
                    )}
                  </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reason (Optional)</Label>
                  <Input
                    placeholder="e.g. Petty cash, Refund"
                    value={inputReason}
                    onChange={e => setInputReason(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="text-green-600 border-green-200 hover:bg-green-50 gap-1.5"
                      onClick={handleCashIn}
                      disabled={addCash.isPending}
                    >
                      {addCash.isPending && addCash.variables?.type === 'in' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Cash In
                    </Button>
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                      onClick={handleCashOut}
                      disabled={addCash.isPending}
                    >
                      {addCash.isPending && addCash.variables?.type === 'out' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Cash Out
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex justify-between items-center text-sm font-bold border-b border-border pb-2 uppercase tracking-widest">
                  <div className="flex flex-col">
                    <span>Total Shift Sales</span>
                    <span className="text-[10px] font-semibold text-muted-foreground opacity-70 mt-0.5">{fmtKHR(totalShiftSales)}</span>
                  </div>
                  <span className="text-primary">${totalShiftSales.toFixed(2)}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <div className="flex flex-col">
                      <span>Cash Portion</span>
                      <span className="text-[9px] opacity-60">{fmtKHR(cashSales)}</span>
                    </div>
                    <span>${cashSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <div className="flex flex-col">
                      <span>Digital Portion</span>
                      <span className="text-[9px] opacity-60">{fmtKHR(digitalSales)}</span>
                    </div>
                    <span>${digitalSales.toFixed(2)}</span>
                  </div>
                </div>
                <Button variant="destructive" className="w-full mt-4 no-print" onClick={() => setShowCloseDialog(true)}>
                  Close Register & End Shift
                </Button>
              </div>
            </div>

            {/* Right — shift sales list */}
            <div className="lg:col-span-2 no-print">
              <div className="rounded-xl border border-border bg-card p-5 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                    <History className="w-4 h-4 text-muted-foreground" />
                    Shift Activity
                  </h3>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                    {session.opened_at ? new Date(session.opened_at).toLocaleTimeString() : ""}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-1">
                  {/* Combine Orders and Manual Entries into one chronological list */}
                  {[
                    ...shiftOrders.filter(o => o.status !== 'cancelled').map(o => ({ ...o, activityType: 'order' as const })),
                    ...(session?.cash_entries ?? []).map(e => ({ ...e, activityType: 'adjustment' as const, createdAt: e.created_at }))
                  ]
                    .sort((a, b) => new Date((b as any).created_at ?? (b as any).createdAt).getTime() - new Date((a as any).created_at ?? (a as any).createdAt).getTime())
                    .map((item) => {
                      if (item.activityType === 'order') {
                        const order = item as ApiOrder & { activityType: 'order' };
                        return (
                          <div
                            key={order.id}
                            onClick={() => setSelectedActivityOrder(order)}
                            className="flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-muted/30 px-3 rounded-lg transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0",
                                order.payment_method === "cash"
                                  ? "bg-primary/5 text-primary border-primary/10"
                                  : "bg-blue-50 text-blue-600 border-blue-100"
                              )}>
                                {order.payment_method === "qr" || order.payment_method === "bakong" ? "QR" : "C"}
                              </div>
                              <div>
                                <p className="text-sm font-bold group-hover:text-primary transition-colors">{order.order_number}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-tight">
                                  {new Date(order.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })} · {order.payment_method.toUpperCase()}
                                  {order.notes?.startsWith("Served by:") && (
                                    <span className="ml-1 normal-case">· {order.notes}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                             <div className="text-right flex items-center gap-3">
                               <div className="text-right">
                                 <p className="text-sm font-bold font-mono">${parseFloat(order.total_amount).toFixed(2)}</p>
                                 <p className="text-[10px] font-semibold text-muted-foreground opacity-70">{fmtKHR(parseFloat(order.total_amount))}</p>
                               </div>
                               {isAdmin && (
                                 <Button
                                   variant="ghost"
                                   size="icon"
                                   className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                   onClick={(e) => handleDeleteOrder(e, order.id)}
                                   disabled={deleteOrder.isPending}
                                 >
                                   <Trash2 className="w-4 h-4" />
                                 </Button>
                               )}
                             </div>
                          </div>
                        );
                      } else {
                        const entry = item as any;
                        return (
                          <div key={entry.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-muted/30 px-3 rounded-lg transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center border shrink-0",
                                entry.type === 'in' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                              )}>
                                {entry.type === 'in' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-foreground leading-tight">{entry.reason}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-tight">
                                  {new Date(entry.created_at ?? entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {entry.type === 'in' ? "Cash In" : "Cash Out"}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-3">
                              <div className="text-right">
                                <p className={cn("text-sm font-bold font-mono", entry.type === 'in' ? "text-emerald-600" : "text-amber-600")}>
                                  {entry.type === 'in' ? '+' : '-'}${entry.amount.toFixed(2)}
                                </p>
                                <p className="text-[10px] font-semibold text-muted-foreground opacity-70">
                                  {entry.type === 'in' ? '+' : '-'}{fmtKHR(entry.amount)}
                                </p>
                              </div>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                  onClick={(e) => handleDeleteCash(e, entry.id)}
                                  disabled={deleteCash.isPending}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      }
                    })}

                  {(shiftOrders.length === 0 && (!session?.cash_entries || session.cash_entries.length === 0)) && (
                    <div className="py-20 text-center text-muted-foreground text-sm opacity-50 flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8" />
                      <p>No activity recorded in this shift.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Close Register Dialog */}
          <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Close Register</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your name and optionally count the cash. If left blank, the expected drawer amount will be used.
                </p>
              </DialogHeader>

              <div className="space-y-5 py-3">
                {/* Opened by info */}
                <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-sm text-muted-foreground">
                  Opened by <span className="font-semibold text-foreground">{session?.staff_name}</span>
                  {session?.opened_at && <> at <span className="font-semibold text-foreground">{new Date(session.opened_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</span></>}
                </div>

                {/* Closing person — required */}
                <div className="space-y-1.5">
                  <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">
                    Closing Staff Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Bong Srey Laut"
                    value={closingName}
                    onChange={e => setClosingName(e.target.value)}
                    className="h-10"
                    autoFocus
                  />
                </div>

                {/* Expected in drawer */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 p-3 rounded-lg border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Expected in Drawer</p>
                    <p className="text-xl font-bold mt-1">${expectedInDrawer.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fmtKHR(expectedInDrawer)}</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Digital Sales</p>
                    <p className="text-xl font-bold mt-1">${digitalSales.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fmtKHR(digitalSales)}</p>
                  </div>
                </div>

                {/* Closing balance — optional */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Actual Cash in Drawer <span className="font-normal normal-case text-muted-foreground/60">(optional)</span>
                    </Label>
                    <div className="flex items-center gap-1 p-0.5 bg-muted rounded-md border border-border">
                      {(["USD", "KHR"] as const).map(c => (
                        <button key={c} onClick={() => setClosingCurrency(c)}
                          className={cn("px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                            closingCurrency === c ? "bg-card text-foreground shadow-sm" : "text-muted-foreground opacity-60"
                          )}>{c}</button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                      {closingCurrency === "USD" ? "$" : "៛"}
                    </span>
                    <Input
                      type="number"
                      placeholder={closingCurrency === "USD" ? `${expectedInDrawer.toFixed(2)} (auto)` : `${Math.round(expectedInDrawer * khrRate).toLocaleString()} (auto)`}
                      className="pl-9 h-12 text-lg font-bold"
                      value={inputActualCash}
                      onChange={e => setInputActualCash(e.target.value)}
                    />
                  </div>
                  {!inputActualCash && (
                    <p className="text-xs text-muted-foreground italic">
                      Left blank → closing balance will be set to the expected amount (${expectedInDrawer.toFixed(2)})
                    </p>
                  )}
                  {inputActualCash && (() => {
                    const actual = closingCurrency === "KHR" ? parseFloat(inputActualCash) / khrRate : parseFloat(inputActualCash);
                    const diff = actual - expectedInDrawer;
                    const balanced = Math.abs(diff) < 0.05;
                    return (
                      <div className={cn("p-3 rounded-lg border flex justify-between items-center text-sm font-bold",
                        balanced ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
                      )}>
                        <span>{balanced ? "Balanced ✓" : `Difference: $${diff.toFixed(2)}`}</span>
                        {!balanced && <span className="text-xs opacity-70">{fmtKHR(diff)}</span>}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setShowCloseDialog(false); setClosingName(""); setInputActualCash(""); }}>Cancel</Button>
                <Button
                  variant="outline"
                  disabled={closeRegister.isPending || !closingName.trim()}
                  onClick={confirmCloseRegisterHandler}
                >
                  {closeRegister.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Closing...</>
                    : "End Shift"
                  }
                </Button>
                <Button
                  disabled={closeRegister.isPending || !closingName.trim()}
                  className="gap-2"
                  onClick={() => {
                    printDailySummary();
                    confirmCloseRegisterHandler();
                  }}
                >
                  {closeRegister.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Closing...</>
                    : <><Printer className="h-4 w-4" />Print & End Shift</>
                  }
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
      {/* Activity Order Details Dialog */}
      <Dialog open={!!selectedActivityOrder} onOpenChange={() => setSelectedActivityOrder(null)}>
        <DialogContent className="max-w-md">
          {selectedActivityOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Activity Detail: {selectedActivityOrder.order_number}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Order placed at {new Date(selectedActivityOrder.created_at).toLocaleString()}
                </p>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 items-stretch">
                  <div className="bg-muted px-4 py-3 rounded-xl flex flex-col justify-center">
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-60">Order Total</p>
                    <p className="font-bold text-lg">${parseFloat(selectedActivityOrder.total_amount).toFixed(2)}</p>
                  </div>
                  <div className="bg-primary/5 border border-primary/10 px-4 py-3 rounded-xl flex flex-col justify-center">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-primary opacity-60">Amount Received</p>
                    <p className="font-bold text-lg text-primary">${(parseFloat(selectedActivityOrder.received_amount ?? '0') || parseFloat(selectedActivityOrder.total_amount)).toFixed(2)}</p>
                  </div>
                </div>

                {parseFloat(selectedActivityOrder.received_amount ?? '0') > parseFloat(selectedActivityOrder.total_amount) && (
                  <div className="bg-amber-50 border border-amber-100 px-4 py-2.5 rounded-xl flex justify-between items-center animate-in zoom-in-95 duration-200">
                    <p className="text-xs font-bold text-amber-900 flex items-center gap-2">
                      <Coins className="w-3.5 h-3.5" />
                      Cash Change Given
                    </p>
                    <p className="font-bold text-amber-700 font-mono">${parseFloat(selectedActivityOrder.change_amount ?? '0').toFixed(2)}</p>
                  </div>
                )}

                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-40">Items Summary</p>
                  {selectedActivityOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-border/50">
                      <span className="font-medium">{item.quantity}x {item.product?.name ?? 'Unknown'}</span>
                      <span className="font-mono">${parseFloat(item.subtotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {selectedActivityOrder.payment_method === 'qr' && (
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl space-y-3">
                    <div className="flex gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                        <Coins className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-blue-900 leading-tight">Need to give cash back?</p>
                        <p className="text-[11px] text-blue-700 leading-relaxed">
                          If the customer overpaid via bank transfer to get parking change, record it as a cash-out adjustment.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => startCashBackHelper(selectedActivityOrder)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold h-11 shadow-sm"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      Record Cash Back Adjustment
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" className="w-full gap-2" onClick={() => setSelectedActivityOrder(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default RegisterPage;
