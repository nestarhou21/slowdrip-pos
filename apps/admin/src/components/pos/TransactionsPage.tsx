import { useState, useMemo } from "react";
import { useAdminTransactions, type AdminTransaction, getAccessToken } from "@repo/store";
import { cn, Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@repo/ui";
import { FileText, Search, FileSpreadsheet } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const statusColors: Record<string, string> = {
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    paid:      "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending:   "bg-amber-50  text-amber-700  border-amber-200",
    failed:    "bg-rose-50   text-rose-700   border-rose-200",
    cancelled: "bg-slate-50  text-slate-500  border-slate-200",
};

const moduleLabel: Record<string, string> = { wellness: "Wellness", cafe: "Cafe" };

const methodLabel = (m: string) => {
    if (m === "bakong" || m === "khqr") return "Bakong KHQR";
    if (m === "qr" || m === "aba_qr")  return "ABA QR";
    if (m === "cash")                   return "Cash";
    if (m?.startsWith("baray_"))        return m.replace("baray_", "").toUpperCase() + " (Baray)";
    return m?.toUpperCase() ?? "—";
};

const userName = (u: AdminTransaction["user"]) =>
    u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email : "—";

function today()       { return new Date().toISOString().slice(0, 10); }
function thirtyDaysAgo() {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
}

async function downloadExport(path: string, filename: string) {
    const token = await getAccessToken();
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token ?? ""}`, Accept: "*/*" },
    });
    if (!res.ok) { alert("Export failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}


// ─── Component ────────────────────────────────────────────────────────────────

const PER_PAGE = 50;

export default function TransactionsPage() {
    const [from, setFrom]             = useState(thirtyDaysAgo());
    const [to, setTo]                 = useState(today());
    const [module, setModule]         = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch]         = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const { data, isLoading } = useAdminTransactions({
        from, to,
        module: module || undefined,
        search: search || undefined,
        per_page: PER_PAGE,
        page:     currentPage,
    });

    const transactions = data?.data  ?? [];
    const total        = data?.total ?? 0;
    const totalPages   = data?.pages ?? 1;

    const stats = useMemo(() => {
        const confirmed = transactions.filter(t => t.payment_status === "confirmed" || t.payment_status === "paid");
        return {
            revenue: confirmed.reduce((s, t) => s + parseFloat(t.amount), 0),
            cafe:    transactions.filter(t => t.module === "cafe").length,
        };
    }, [transactions]);

    const exportParams = new URLSearchParams({ from, to }).toString();

    const handleSearch = () => { setSearch(searchInput); setCurrentPage(1); };
    const resetPage    = () => setCurrentPage(1);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Transaction Logs</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">All payment transactions across Cafe &amp; Wellness</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="gap-1.5"
                        onClick={() => downloadExport(`/admin/export/payments?${exportParams}`, `payments-${from}-to-${to}.csv`)}>
                        <FileText className="h-3.5 w-3.5" /> Export CSV
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5"
                        onClick={() => downloadExport(`/admin/export/payments/excel?${exportParams}`, `payments-${from}-to-${to}.xlsx`)}>
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    { label: "Total Records",     value: total.toLocaleString() },
                    { label: "Confirmed Revenue", value: `$${stats.revenue.toFixed(2)}` },
                    { label: "Cafe",              value: stats.cafe.toLocaleString() },
                ].map(s => (
                    <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                        <p className="text-xl font-bold text-foreground mt-0.5">{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">From</label>
                    <Input type="date" value={from} onChange={e => { setFrom(e.target.value); resetPage(); }} className="w-36 h-9 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">To</label>
                    <Input type="date" value={to} onChange={e => { setTo(e.target.value); resetPage(); }} className="w-36 h-9 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Module</label>
                    <Select value={module || "all"} onValueChange={v => { setModule(v === "all" ? "" : v); resetPage(); }}>
                        <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="wellness">Wellness</SelectItem>
                            <SelectItem value="cafe">Cafe</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Search</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Ref, name, or email…"
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleSearch()}
                                className="pl-9 h-9 text-sm"
                            />
                        </div>
                        <Button size="sm" variant="outline" className="h-9 px-3 shrink-0" onClick={handleSearch}>
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
                <div className="overflow-auto max-h-[calc(100vh-420px)]">
                    <table className="w-full">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-border bg-muted/30">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Reference</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Customer</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Module</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Amount</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Method</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 10 }).map((_, i) => (
                                    <tr key={i} className="border-b border-border last:border-0">
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <td key={j} className="px-4 py-3.5">
                                                <Skeleton className="h-4 rounded" style={{ width: `${45 + (j * 17) % 45}%` }} />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                                        No transactions found for the selected filters.
                                    </td>
                                </tr>
                            ) : transactions.map(t => (
                                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                        <p className="text-sm text-foreground">{new Date(t.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</p>
                                        <p className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                                    </td>
                                    <td className="px-4 py-3.5 font-mono text-xs text-foreground whitespace-nowrap">{t.transaction_ref}</td>
                                    <td className="px-4 py-3.5">
                                        <p className="text-sm font-semibold text-foreground">{userName(t.user)}</p>
                                        {t.user?.email && <p className="text-[11px] text-muted-foreground">{t.user.email}</p>}
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <span className={cn(
                                            "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                            t.module === "wellness"
                                                ? "bg-violet-50 text-violet-700 border-violet-200"
                                                : "bg-sky-50 text-sky-700 border-sky-200"
                                        )}>
                                            {moduleLabel[t.module] ?? t.module}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-foreground whitespace-nowrap">
                                        ${parseFloat(t.amount).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{methodLabel(t.payment_method)}</td>
                                    <td className="px-4 py-3.5">
                                        <span className={cn(
                                            "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                            statusColors[t.payment_status] ?? statusColors.pending
                                        )}>
                                            {t.payment_status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {total > PER_PAGE && (
                    <div className="flex items-center justify-between border-t border-border px-4 py-3">
                        <p className="text-xs text-muted-foreground">
                            Showing {((currentPage - 1) * PER_PAGE) + 1}–{Math.min(currentPage * PER_PAGE, total)} of {total.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage <= 1}
                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="text-xs font-medium text-foreground">Page {currentPage} of {totalPages}</span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages}
                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
