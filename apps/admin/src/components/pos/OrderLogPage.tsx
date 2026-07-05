import { useMemo, useState } from "react";
import {
    useOrderLog,
    useOrderLogHourly,
    useOrderLogSummary,
    downloadOrderLogExport,
    ORDER_LOG_COLUMNS,
    type OrderLogColumnKey,
} from "@repo/store";
import {
    Button, Input, Checkbox, Popover, PopoverContent, PopoverTrigger,
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton,
} from "@repo/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FileText, FileSpreadsheet, Columns3, ChevronLeft, ChevronRight, ShoppingBag, Globe, Store, Package } from "lucide-react";

function today() { return new Date().toISOString().slice(0, 10); }
function thirtyDaysAgo() {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
}

const hourLabel = (h: number) => {
    const period = h < 12 ? "AM" : "PM";
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}${period}`;
};

const DEFAULT_COLUMNS: OrderLogColumnKey[] = ORDER_LOG_COLUMNS.map((c) => c.key);

export default function OrderLogPage() {
    const [from, setFrom] = useState(thirtyDaysAgo());
    const [to, setTo] = useState(today());
    const [orderType, setOrderType] = useState("");
    const [source, setSource] = useState("");
    const [page, setPage] = useState(1);
    const [columns, setColumns] = useState<OrderLogColumnKey[]>(DEFAULT_COLUMNS);
    const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

    const filters = { from, to, page, per_page: 25, order_type: orderType, source };
    const { data: logData, isLoading: loadingLog } = useOrderLog(filters);
    const { data: hourly, isLoading: loadingHourly } = useOrderLogHourly(from, to);
    const { data: summary, isLoading: loadingSummary } = useOrderLogSummary({ from, to, order_type: orderType, source });

    const chartData = useMemo(
        () => (hourly ?? []).map((h) => ({ ...h, label: hourLabel(h.hour) })),
        [hourly]
    );

    const peakHour = useMemo(() => {
        if (!hourly || hourly.length === 0) return null;
        return hourly.reduce((best, h) => (h.order_count > best.order_count ? h : best), hourly[0]);
    }, [hourly]);

    const toggleColumn = (key: OrderLogColumnKey) => {
        setColumns((prev) =>
            prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
        );
    };

    const handleExport = async (format: "csv" | "pdf") => {
        setExporting(format);
        try {
            await downloadOrderLogExport(format, { from, to, order_type: orderType, source }, columns);
        } catch {
            alert("Export failed");
        } finally {
            setExporting(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Order Log</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Every drink sold, with size and time — for peak-hour and preference analysis
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">From</label>
                    <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-36 h-9 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">To</label>
                    <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-36 h-9 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Order Type</label>
                    <Select value={orderType || "all"} onValueChange={(v) => { setOrderType(v === "all" ? "" : v); setPage(1); }}>
                        <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="dine_in">Dine In</SelectItem>
                            <SelectItem value="takeaway">Takeaway</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Source</label>
                    <Select value={source || "all"} onValueChange={(v) => { setSource(v === "all" ? "" : v); setPage(1); }}>
                        <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="pos">POS</SelectItem>
                            <SelectItem value="website">Website</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex-1" />

                {/* Column picker */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <Columns3 className="h-3.5 w-3.5" /> Columns ({columns.length})
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56" align="end">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                            Export columns
                        </p>
                        <div className="space-y-2">
                            {ORDER_LOG_COLUMNS.map((c) => (
                                <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <Checkbox checked={columns.includes(c.key)} onCheckedChange={() => toggleColumn(c.key)} />
                                    {c.label}
                                </label>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

                <Button variant="outline" size="sm" className="gap-1.5" disabled={exporting !== null} onClick={() => handleExport("csv")}>
                    <FileText className="h-3.5 w-3.5" /> {exporting === "csv" ? "Exporting…" : "Export CSV"}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={exporting !== null} onClick={() => handleExport("pdf")}>
                    <FileSpreadsheet className="h-3.5 w-3.5" /> {exporting === "pdf" ? "Exporting…" : "Export PDF"}
                </Button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Dine In",  value: summary?.dine_in,  icon: Package },
                    { label: "Takeaway", value: summary?.takeaway, icon: ShoppingBag },
                    { label: "POS",      value: summary?.pos,      icon: Store },
                    { label: "Website",  value: summary?.website,  icon: Globe },
                ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                            <s.icon className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                            <p className="text-xl font-bold text-foreground mt-0.5">
                                {loadingSummary ? "—" : (s.value ?? 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Peak hours chart */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-semibold text-foreground">Orders by Hour</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {peakHour && peakHour.order_count > 0
                                ? `Peak hour: ${hourLabel(peakHour.hour)} — ${peakHour.order_count} orders`
                                : "No data in this range yet"}
                        </p>
                    </div>
                </div>
                {loadingHourly ? (
                    <Skeleton className="h-64 w-full" />
                ) : (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={1} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                                    formatter={(val: any, name: string) => [val, name === "order_count" ? "Orders" : name]}
                                />
                                <Bar dataKey="order_count" fill="hsl(210, 70%, 60%)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/40">
                                <th className="text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider px-4 py-3">Drink</th>
                                <th className="text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider px-4 py-3">Size</th>
                                <th className="text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider px-4 py-3">Qty</th>
                                <th className="text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider px-4 py-3">Date</th>
                                <th className="text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider px-4 py-3">Time</th>
                                <th className="text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider px-4 py-3">Order #</th>
                                <th className="text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider px-4 py-3">Type</th>
                                <th className="text-left font-semibold text-xs text-muted-foreground uppercase tracking-wider px-4 py-3">Source</th>
                                <th className="text-right font-semibold text-xs text-muted-foreground uppercase tracking-wider px-4 py-3">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingLog ? (
                                [...Array(6)].map((_, i) => (
                                    <tr key={i} className="border-b border-border last:border-0">
                                        <td colSpan={9} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                                    </tr>
                                ))
                            ) : (logData?.data ?? []).length === 0 ? (
                                <tr><td colSpan={9} className="py-10 text-center text-sm text-muted-foreground">No orders in this range</td></tr>
                            ) : (
                                (logData?.data ?? []).map((row, i) => (
                                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                                                    {row.product_image && (
                                                        <img src={row.product_image} alt={row.product} className="h-full w-full object-cover" />
                                                    )}
                                                </div>
                                                <span className="font-medium text-foreground">{row.product}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">{row.size ?? "—"}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{row.quantity}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{row.date}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{row.time}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.order_number}</td>
                                        <td className="px-4 py-3 text-muted-foreground capitalize">{row.order_type.replace("_", " ")}</td>
                                        <td className="px-4 py-3 text-muted-foreground capitalize">{row.source}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-foreground">${Number(row.subtotal).toFixed(2)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {logData && logData.last_page > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                            Page {logData.current_page} of {logData.last_page} · {logData.total} items
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="outline" size="sm" disabled={page >= logData.last_page} onClick={() => setPage((p) => p + 1)}>
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
