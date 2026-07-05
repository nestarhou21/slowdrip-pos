import { useState, useMemo, useRef, useEffect } from "react";
import {
    useDashboardReport,
    useDashboardComparison,
    useCafeReport,
    useApiCafeTrend,
    exportCafeOrders,
    exportCafeOrdersExcel,
} from "@repo/store";
import {
    ShoppingBag,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Tag,
    TrendingUp,
    FileDown,
    RefreshCw,
    CalendarDays,
    ChevronDown,
    BarChart3,
    LineChart as LineChartIcon,
    FileSpreadsheet,
} from "lucide-react";
import {
    BarChart,
    Bar,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
} from "recharts";
import { cn, toast } from "@repo/ui";
import { Button } from "@repo/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import { Calendar as CalendarComponent } from "@repo/ui";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
    return d.toISOString().split("T")[0];
}

type StatPreset = "today" | "week" | "month" | "custom";

function presetRange(preset: StatPreset): { from: string; to: string } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const to = toDateStr(today);

    if (preset === "today") return { from: to, to };

    if (preset === "week") {
        const d = new Date(today);
        d.setDate(d.getDate() - 6);
        return { from: toDateStr(d), to };
    }

    // month
    const d = new Date(today);
    d.setDate(1);
    return { from: toDateStr(d), to };
}

function trendRange(period: "daily" | "monthly"): { from: string; to: string } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const to = toDateStr(today);

    if (period === "daily") {
        const d = new Date(today);
        d.setDate(d.getDate() - 6);
        return { from: toDateStr(d), to };
    }

    // monthly — last 6 months
    const d = new Date(today);
    d.setMonth(d.getMonth() - 5);
    d.setDate(1);
    return { from: toDateStr(d), to };
}

function presetLabel(p: StatPreset): string {
    return p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom";
}

// ─── Component ────────────────────────────────────────────────────────────────

const Dashboard = () => {
    // ─── State ────────────────────────────────────────────────────────────────
    const [statPreset, setStatPreset] = useState<StatPreset>("today");

    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });

    const [chartRange, setChartRange] = useState<"daily" | "monthly">("daily");
    const [chartType, setChartType] = useState<"bar" | "area">("bar");
    const [exporting, setExporting] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);

    // Close export dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
                setExportOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const { from, to } = useMemo(() => {
        if (statPreset === "custom" && dateRange?.from) {
            return {
                from: toDateStr(dateRange.from),
                to: dateRange.to ? toDateStr(dateRange.to) : toDateStr(dateRange.from)
            };
        }
        return presetRange(statPreset);
    }, [statPreset, dateRange]);

    const chartDates = useMemo(() => trendRange(chartRange), [chartRange]);

    const { data: dashboardData, isLoading: loadingDashboard, refetch: refetchDashboard } =
        useDashboardReport(from, to);
    const { data: cafeData, isLoading: loadingCafe, refetch: refetchCafe } =
        useCafeReport(from, to);
    const { data: compData, isLoading: loadingComp } =
        useDashboardComparison(from, to);
    const { data: rawTrend = [], isLoading: loadingTrend } = useApiCafeTrend(
        chartRange,
        chartDates.from,
        chartDates.to
    );

    // Fill full skeleton so every day/month shows on the axis even with no data
    const trendData = useMemo(() => {
        const byKey = new Map(rawTrend.map((p) => [p.period_key, p]));
        const slots: { period_key: string; label: string; orders: number; revenue: number }[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (chartRange === "daily") {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const key = d.toISOString().split("T")[0];
                const label = d.toLocaleDateString("en-US", { weekday: "short" });
                const apiPt = byKey.get(key);
                slots.push(apiPt ? { ...apiPt, label } : { period_key: key, label, orders: 0, revenue: 0 });
            }
        } else {
            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                const label = d.toLocaleDateString("en-US", { month: "short" });
                const apiPt = byKey.get(key);
                slots.push(apiPt ? { ...apiPt, label } : { period_key: key, label, orders: 0, revenue: 0 });
            }
        }
        return slots;
    }, [rawTrend, chartRange]);

    const isLoading = loadingDashboard || loadingCafe;

    const overview = dashboardData?.overview;
    const cafeRevenue = Number(overview?.cafe_revenue ?? 0);
    const cafeOrders = Number(overview?.cafe_orders ?? 0);
    const aov = cafeOrders > 0 ? cafeRevenue / cafeOrders : 0;
    const totalDiscount = Number(cafeData?.total_discount_given ?? 0);

    const paymentStats = useMemo(() => {
        const methods: Record<string, number> = {};
        for (const m of cafeData?.revenue_by_payment_method ?? []) {
            methods[m.payment_method] = Number(m.revenue);
        }
        return methods;
    }, [cafeData]);

    const totalPaymentRevenue = Object.values(paymentStats).reduce((s, v) => s + v, 0);

    // Order type data for the donut chart
    const orderTypeData = useMemo(() => {
        return (cafeData?.revenue_by_order_type ?? []).map((t) => ({
            name: t.order_type === "dine_in" ? "Dine-in" : "Takeaway",
            value: Number(t.revenue),
            count: t.order_count,
        }));
    }, [cafeData]);

    // Order status data — hidden for now, see Order Status section below
    // const orderStatusData = useMemo(() => {
    //     return cafeData?.orders_by_status ?? [];
    // }, [cafeData]);

    const handleExport = async (format: "csv" | "excel") => {
        setExporting(true);
        try {
            if (format === "csv") await exportCafeOrders(from, to);
            else await exportCafeOrdersExcel(from, to);
            toast.success("Report exported successfully");
        } catch {
            toast.error("Failed to export report");
        } finally {
            setExporting(false);
            setExportOpen(false);
        }
    };

    const handleRefresh = () => {
        refetchDashboard();
        refetchCafe();
    };

    const DONUT_COLORS = ["hsl(142, 28%, 58%)", "hsl(210, 70%, 60%)"];
    // const STATUS_COLORS: Record<string, string> = {
    //     pending: "bg-amber-100 text-amber-700",
    //     preparing: "bg-blue-100 text-blue-600",
    //     ready: "bg-emerald-100 text-emerald-700",
    //     completed: "bg-slate-100 text-slate-600",
    //     cancelled: "bg-red-100 text-red-600",
    // };

    return (
        <div className="space-y-6">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="font-display text-2xl font-bold text-foreground">Financial Reports</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        {(["today", "week", "month"] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => {
                                    setStatPreset(p);
                                    const { from, to } = presetRange(p);
                                    setDateRange({ from: new Date(from + "T00:00:00"), to: new Date(to + "T00:00:00") });
                                }}
                                className={cn(
                                    "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                                    statPreset === p
                                        ? "bg-primary text-white"
                                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                                )}
                            >
                                {presetLabel(p)}
                            </button>
                        ))}
                        <div className="flex items-center gap-1.5 ml-1">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-2 h-8 px-3 font-medium border-border hover:border-primary/50 transition-colors text-xs">
                                        <CalendarDays className="h-3.5 w-3.5 text-primary" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>
                                                    {format(dateRange.from, "LLL dd, y")} -{" "}
                                                    {format(dateRange.to, "LLL dd, y")}
                                                </>
                                            ) : (
                                                format(dateRange.from, "LLL dd, y")
                                            )
                                        ) : (
                                            <span>Pick a date</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                        initialFocus
                                        mode="range"
                                        defaultMonth={dateRange?.from}
                                        selected={dateRange}
                                        onSelect={(range) => {
                                            setDateRange(range);
                                            setStatPreset("custom");
                                        }}
                                        numberOfMonths={2}
                                        disabled={(d) => d > new Date()}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted/80 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        Refresh
                    </button>

                    {/* ── Export dropdown ── */}
                    <div className="relative" ref={exportRef}>
                        <button
                            onClick={() => setExportOpen((o) => !o)}
                            disabled={exporting}
                            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-60"
                        >
                            <FileDown className="h-4 w-4" />
                            {exporting ? "Exporting…" : "Export"}
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", exportOpen && "rotate-180")} />
                        </button>
                        {exportOpen && (
                            <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-card shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-3 border-b border-border">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        Period: {from} → {to}
                                    </p>
                                </div>
                                <div className="p-1.5">
                                    <ExportItem icon={ShoppingBag} label="Orders CSV" onClick={() => handleExport("csv")} />
                                    <ExportItem icon={FileSpreadsheet} label="Orders Excel (.xlsx)" onClick={() => handleExport("excel")} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Cafe Stat Cards ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Revenue"
                    value={isLoading ? "—" : `$${cafeRevenue.toFixed(2)}`}
                    icon={DollarSign}
                    color="bg-primary/10 text-primary"
                    loading={isLoading}
                    change={compData?.cafe_revenue.change}
                    loadingChange={loadingComp}
                />
                <StatCard
                    title="Orders"
                    value={isLoading ? "—" : cafeOrders.toString()}
                    icon={ShoppingBag}
                    color="bg-blue-100 text-blue-600"
                    loading={isLoading}
                    change={compData?.cafe_orders.change}
                    loadingChange={loadingComp}
                />
                <StatCard
                    title="Avg. Order Value"
                    value={isLoading ? "—" : `$${aov.toFixed(2)}`}
                    icon={TrendingUp}
                    color="bg-purple-100 text-purple-600"
                    loading={isLoading}
                />
                <StatCard
                    title="Total Discounts"
                    value={isLoading ? "—" : `$${totalDiscount.toFixed(2)}`}
                    icon={Tag}
                    color="bg-orange-100 text-orange-600"
                    loading={isLoading}
                />
            </div>

            {/* ── Revenue Trend + Order Type Donut ─────────────────── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Revenue Trend Chart — spans 2 cols */}
                <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 shadow-sm">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-foreground">Revenue Trends</h3>
                            <p className="text-xs text-muted-foreground">
                                {chartRange === "daily" ? "Last 7 days" : "Last 6 months"}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Chart type toggle */}
                            <div className="flex items-center bg-muted p-0.5 rounded-lg border border-border">
                                <button
                                    onClick={() => setChartType("bar")}
                                    className={cn(
                                        "p-1.5 rounded-md transition-all",
                                        chartType === "bar" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"
                                    )}
                                    title="Bar chart"
                                >
                                    <BarChart3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    onClick={() => setChartType("area")}
                                    className={cn(
                                        "p-1.5 rounded-md transition-all",
                                        chartType === "area" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"
                                    )}
                                    title="Area chart"
                                >
                                    <LineChartIcon className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            {/* Period toggle */}
                            <div className="flex items-center bg-muted p-0.5 rounded-lg border border-border">
                                <button
                                    onClick={() => setChartRange("daily")}
                                    className={cn(
                                        "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all",
                                        chartRange === "daily" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"
                                    )}
                                >
                                    DAILY
                                </button>
                                <button
                                    onClick={() => setChartRange("monthly")}
                                    className={cn(
                                        "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all",
                                        chartRange === "monthly" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"
                                    )}
                                >
                                    MONTHLY
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        {loadingTrend ? (
                            <div className="flex h-full items-center justify-center">
                                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : chartType === "bar" ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={trendData} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(val) => `$${val}`} />
                                    <Tooltip
                                        cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                                        formatter={(val: any) => [`$${Number(val ?? 0).toFixed(2)}`, "Revenue"]}
                                    />
                                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={80}>
                                        {trendData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={index === trendData.length - 1 ? "hsl(142, 28%, 58%)" : "hsl(142, 20%, 82%)"} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(142, 28%, 58%)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(142, 28%, 58%)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(val) => `$${val}`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                                        formatter={(val: any) => [`$${Number(val ?? 0).toFixed(2)}`, "Revenue"]}
                                    />
                                    <Area type="monotone" dataKey="revenue" stroke="hsl(142, 28%, 58%)" strokeWidth={2.5} fill="url(#revGrad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Order Type Donut + Status */}
                <div className="flex flex-col gap-6">
                    {/* Dine-in vs Takeaway donut */}
                    <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex-1">
                        <h3 className="font-semibold text-foreground mb-1">By Order Type</h3>
                        <p className="text-xs text-muted-foreground mb-4">Dine-in vs Takeaway</p>
                        {isLoading ? (
                            <div className="flex h-32 items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                        ) : orderTypeData.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">No data yet</div>
                        ) : (
                            <div className="flex items-center gap-4">
                                <div className="w-28 h-28 shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={orderTypeData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={30}
                                                outerRadius={50}
                                                dataKey="value"
                                                paddingAngle={3}
                                                strokeWidth={0}
                                            >
                                                {orderTypeData.map((_, i) => (
                                                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-2 flex-1">
                                    {orderTypeData.map((t, i) => (
                                        <div key={t.name} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                                                <span className="text-xs font-medium text-muted-foreground">{t.name}</span>
                                            </div>
                                            <span className="text-xs font-bold text-foreground">${Number(t.value ?? 0).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Order Status — hidden for now, orders_by_status is hardcoded empty on the backend
                    <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex-1">
                        <h3 className="font-semibold text-foreground mb-4">Order Status</h3>
                        {isLoading ? (
                            <div className="space-y-2 animate-pulse">
                                {[...Array(4)].map((_, i) => <div key={i} className="h-7 rounded-lg bg-muted" />)}
                            </div>
                        ) : orderStatusData.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">No orders yet</div>
                        ) : (
                            <div className="space-y-2">
                                {orderStatusData.map((s) => (
                                    <div key={s.status} className="flex items-center justify-between">
                                        <span className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize", STATUS_COLORS[s.status] ?? "bg-muted text-muted-foreground")}>
                                            {s.status}
                                        </span>
                                        <span className="text-sm font-bold text-foreground">{s.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    */}
                </div>
            </div>

            {/* ── Top & Least Selling + Payment Breakdown ───────── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Top Selling Products */}
                <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="mb-6 font-semibold text-foreground">Top Selling Products</h3>
                    <div className="space-y-4">
                        {isLoading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3 animate-pulse">
                                    <div className="h-8 w-8 rounded-full bg-muted" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-3 w-32 rounded bg-muted" />
                                        <div className="h-2.5 w-16 rounded bg-muted" />
                                    </div>
                                    <div className="h-3 w-12 rounded bg-muted" />
                                </div>
                            ))
                        ) : (cafeData?.top_products ?? []).length === 0 ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">No sales data yet</div>
                        ) : (
                            (cafeData?.top_products ?? []).map((p, i) => (
                                <div key={p.product_id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                                            {p.product?.image_url ? (
                                                <img src={p.product.image_url} alt={p.product.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground">?</div>
                                            )}
                                            <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                                                {i + 1}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                {p.product?.name ?? "Unknown Product"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{p.total_qty} sold</p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold text-foreground">
                                        ${Number(p.total_revenue).toFixed(2)}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Least Selling Products */}
                <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="mb-6 font-semibold text-foreground">Least Selling Products</h3>
                    <div className="space-y-4">
                        {isLoading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3 animate-pulse">
                                    <div className="h-8 w-8 rounded-full bg-muted" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-3 w-32 rounded bg-muted" />
                                        <div className="h-2.5 w-16 rounded bg-muted" />
                                    </div>
                                    <div className="h-3 w-12 rounded bg-muted" />
                                </div>
                            ))
                        ) : (cafeData?.least_products ?? []).length === 0 ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">No sales data yet</div>
                        ) : (
                            (cafeData?.least_products ?? []).map((p, i) => (
                                <div key={p.product_id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                                            {p.product?.image_url ? (
                                                <img src={p.product.image_url} alt={p.product.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground">?</div>
                                            )}
                                            <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                                                {i + 1}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                {p.product?.name ?? "Unknown Product"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{p.total_qty} sold</p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold text-foreground">
                                        ${Number(p.total_revenue).toFixed(2)}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Payment Method Breakdown */}
                <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="mb-6 font-semibold text-foreground">Payment Method Breakdown</h3>
                    {isLoading ? (
                        <div className="space-y-4 animate-pulse">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-4 w-4 rounded-full bg-muted" />
                                        <div className="h-3 w-28 rounded bg-muted" />
                                    </div>
                                    <div className="h-3 w-14 rounded bg-muted" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Object.keys(paymentStats).length === 0 ? (
                                <div className="py-10 text-center text-sm text-muted-foreground">No payment data yet</div>
                            ) : (
                                <>
                                    {Object.entries(paymentStats).map(([method, revenue], i) => {
                                        const colors = ["bg-primary", "bg-blue-500", "bg-purple-500", "bg-orange-500"];
                                        return (
                                            <div key={method} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("h-4 w-4 rounded-full", colors[i % colors.length])} />
                                                    <span className="text-sm font-medium text-muted-foreground capitalize">
                                                        {method === "qr" ? "ABA QR" : method.charAt(0).toUpperCase() + method.slice(1)}
                                                    </span>
                                                </div>
                                                <span className="text-sm font-bold text-foreground">${revenue.toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                    <div className="pt-4 border-t border-border">
                                        <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
                                            {Object.values(paymentStats).map((revenue, i) => {
                                                const colors = ["bg-primary", "bg-blue-500", "bg-purple-500", "bg-orange-500"];
                                                const pct = totalPaymentRevenue > 0 ? (revenue / totalPaymentRevenue) * 100 : 0;
                                                return (
                                                    <div key={i} className={cn("h-full transition-all", colors[i % colors.length])} style={{ width: `${pct}%` }} />
                                                );
                                            })}
                                        </div>
                                        <div className="mt-2 flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                            {Object.entries(paymentStats).map(([method, revenue]) => (
                                                <span key={method}>
                                                    {totalPaymentRevenue > 0 ? ((revenue / totalPaymentRevenue) * 100).toFixed(0) : 0}% {method === "qr" ? "QR" : method.charAt(0).toUpperCase() + method.slice(1)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
    title: string;
    value: string;
    icon: any;
    color: string;
    loading?: boolean;
    change?: number;
    loadingChange?: boolean;
}

const StatCard = ({ title, value, icon: Icon, color, loading, change, loadingChange }: StatCardProps) => (
    <div className="rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", color)}>
                <Icon className="h-5 w-5" />
            </div>
            {change !== undefined && !loadingChange && (
                <div className={cn(
                    "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
                    change >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                )}>
                    {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(change)}%
                </div>
            )}
            {loadingChange && (
                <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
            )}
        </div>
        <div className="mt-4">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
                <div className="mt-1 h-7 w-24 animate-pulse rounded-md bg-muted" />
            ) : (
                <h4 className="mt-1 text-2xl font-bold text-foreground">{value}</h4>
            )}
        </div>
    </div>
);

// ─── Export Item ──────────────────────────────────────────────────────────────

interface ExportItemProps {
    icon: any;
    label: string;
    onClick: () => void;
}

const ExportItem = ({ icon: Icon, label, onClick }: ExportItemProps) => (
    <button
        onClick={onClick}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
    >
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
    </button>
);

export default Dashboard;
