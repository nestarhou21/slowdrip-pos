import { useState, useMemo } from "react";
import { Clock, Users, ChevronLeft, ChevronRight, Key, Loader2 } from "lucide-react";
import { Button, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Skeleton, toast, cn } from "@repo/ui";
import { useAdminAttendance, useAttendanceSummary, useApiStaff, api } from "@repo/store";

const PER_PAGE = 15;

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgo() {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
}

function fmt(iso: string) {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function fmtDate(d: string) {
    return new Date(d).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// ─── PIN Management Dialog ────────────────────────────────────────────────────

function SetPinDialog({ instructor, onClose }: {
    instructor: { id: string; first_name: string | null; last_name: string | null };
    onClose: () => void;
}) {
    const [pin, setPin] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!pin || pin.length < 4) { toast.error("PIN must be at least 4 digits"); return; }
        setSaving(true);
        try {
            await api.post(`/admin/attendance/instructors/${instructor.id}/pin`, { pin });
            toast.success("PIN updated successfully");
            onClose();
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to set PIN");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Set Instructor PIN</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <p className="text-sm text-muted-foreground">
                        Setting PIN for <strong>{instructor.first_name} {instructor.last_name}</strong>
                    </p>
                    <div className="space-y-1.5">
                        <Label>New PIN</Label>
                        <Input
                            type="password"
                            inputMode="numeric"
                            value={pin}
                            onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
                            placeholder="••••"
                            maxLength={8}
                            className="tracking-widest text-center text-lg"
                        />
                        <p className="text-xs text-muted-foreground">4–8 digits</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : "Save PIN"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AttendancePage() {
    const [view, setView] = useState<"log" | "summary">("log");
    const [from, setFrom] = useState(thirtyDaysAgo());
    const [to, setTo] = useState(todayStr());
    const [instructorFilter, setInstructorFilter] = useState("");
    const [page, setPage] = useState(1);
    const [pinTarget, setPinTarget] = useState<{ id: string; first_name: string | null; last_name: string | null } | null>(null);

    const { data: staffData } = useApiStaff();
    const instructors = useMemo(() =>
        (staffData ?? []).filter(s => s.role === "instructor"),
        [staffData]
    );

    const attendanceQuery = useAdminAttendance({
        from, to,
        instructor_id: instructorFilter || undefined,
        per_page: PER_PAGE,
        page,
    });
    const summaryQuery = useAttendanceSummary(from, to);

    const records = attendanceQuery.data?.data ?? [];
    const meta = attendanceQuery.data?.meta;
    const summaryRows = summaryQuery.data?.data ?? [];

    const totalPages = meta?.last_page ?? 1;

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Instructor Attendance</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Track clock-in/out records and hours per instructor</p>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-border gap-6">
                {([["log", "Attendance Log", Clock], ["summary", "Hours Summary", Users]] as const).map(([id, label, Icon]) => (
                    <button
                        key={id}
                        onClick={() => setView(id)}
                        className={cn(
                            "flex items-center gap-2 pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px",
                            view === id
                                ? "border-foreground text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <Input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} className="h-9 text-sm" />
                </div>
                <div className="space-y-1 min-w-[200px]">
                    <Label className="text-xs text-muted-foreground">Instructor</Label>
                    <select
                        value={instructorFilter}
                        onChange={e => { setInstructorFilter(e.target.value); setPage(1); }}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="">All instructors</option>
                        {instructors.map(i => (
                            <option key={i.id} value={i.id}>
                                {i.first_name} {i.last_name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Attendance Log ── */}
            {view === "log" && (
                <div className="rounded-2xl border border-border overflow-hidden bg-card">
                    <div className="max-h-[calc(100vh-440px)] overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
                                <tr className="border-b border-border">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instructor</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clock In</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clock Out</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hours</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">IP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {attendanceQuery.isLoading ? (
                                    [...Array(8)].map((_, i) => (
                                        <tr key={i}>
                                            {[...Array(7)].map((_, j) => (
                                                <td key={j} className="px-4 py-3">
                                                    <Skeleton className="h-4 w-full" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : records.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground text-sm">
                                            No attendance records found for this period.
                                        </td>
                                    </tr>
                                ) : records.map(r => (
                                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            {r.instructor.first_name} {r.instructor.last_name}
                                            <div className="text-xs text-muted-foreground">{r.instructor.email}</div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.date)}</td>
                                        <td className="px-4 py-3">{fmt(r.clock_in_at)}</td>
                                        <td className="px-4 py-3">{r.clock_out_at ? fmt(r.clock_out_at) : <span className="text-muted-foreground">—</span>}</td>
                                        <td className="px-4 py-3 text-right font-semibold">
                                            {r.hours_worked ? `${r.hours_worked}h` : <span className="text-muted-foreground">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {r.status === "open" ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                                                    Done
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{r.clock_in_ip ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {meta && meta.total > PER_PAGE && (
                        <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-background">
                            <p className="text-xs text-muted-foreground">
                                {meta.total} records
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="h-8 px-2"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-xs text-muted-foreground px-2">
                                    Page {page} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="h-8 px-2"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Hours Summary ── */}
            {view === "summary" && (
                <div className="space-y-4">
                    {/* Instructor PIN management */}
                    <div className="rounded-2xl border border-border bg-card overflow-hidden">
                        <div className="px-4 py-3 border-b border-border bg-muted/30">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instructors</p>
                        </div>
                        <div className="divide-y divide-border">
                            {instructors.length === 0 ? (
                                <p className="px-4 py-8 text-center text-sm text-muted-foreground">No instructors found.</p>
                            ) : instructors.map(i => {
                                const summary = summaryRows.find(s => s.id === i.id);
                                return (
                                    <div key={i.id} className="flex items-center justify-between px-4 py-3">
                                        <div>
                                            <p className="font-medium text-sm text-foreground">{i.first_name} {i.last_name}</p>
                                            <p className="text-xs text-muted-foreground">{i.email}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {summary ? (
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-foreground">{summary.total_hours}h</p>
                                                    <p className="text-xs text-muted-foreground">{summary.days_worked} days</p>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">No records</p>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5 h-8 text-xs"
                                                onClick={() => setPinTarget({ id: i.id, first_name: i.first_name, last_name: i.last_name })}
                                            >
                                                <Key className="h-3.5 w-3.5" />
                                                Set PIN
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Summary table */}
                    {summaryQuery.isLoading ? (
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                        </div>
                    ) : summaryRows.length === 0 ? (
                        <div className="rounded-2xl border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
                            No attendance data for this period.
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-border bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b border-border bg-muted/30">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Hours Summary · {from} to {to}
                                </p>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="border-b border-border">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instructor</th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Days Worked</th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Hours</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {summaryRows.map(s => (
                                        <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 font-medium text-foreground">
                                                {s.name}
                                                <div className="text-xs text-muted-foreground">{s.email}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-muted-foreground">{s.days_worked}</td>
                                            <td className="px-4 py-3 text-right font-bold text-foreground text-base">{s.total_hours}h</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {pinTarget && (
                <SetPinDialog
                    instructor={pinTarget}
                    onClose={() => setPinTarget(null)}
                />
            )}
        </div>
    );
}
