import { useState } from "react";
import { Search, Pencil, Users, AlertCircle, CheckCircle2, Clock, Loader2, Trash2, Package, CreditCard, XCircle } from "lucide-react";
import { cn } from "@repo/ui";
import { Input } from "@repo/ui";
import { Button } from "@repo/ui";
import { Label } from "@repo/ui";
import { Skeleton } from "@repo/ui";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@repo/ui";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@repo/ui";
import { toast } from "sonner";
import {
  useApiUserPackages,
  useUpdateUserPackage,
  useDeleteUserPackage,
  useUserPackageDeletePreview,
  type ApiUserPackage,
} from "@repo/store";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@repo/ui";
import { format, parseISO } from "date-fns";

// "all" excludes pending (incomplete Bakong QR payments) so staff see only real confirmed packages.
// "pending" has its own tab so staff can follow up on abandoned QR payments.
const STATUS_TABS = [
  { value: "all",         label: "All Confirmed" },
  { value: "active",      label: "Active" },
  { value: "not_started", label: "Ready to Use" },
  { value: "exhausted",   label: "Exhausted" },
  { value: "expired",     label: "Expired" },
  { value: "pending",     label: "Pending Payment" },
  { value: "cancelled",   label: "Cancelled" },
];

const statusColors: Record<string, string> = {
  active:      "bg-emerald-50 text-emerald-600 border-emerald-100",
  not_started: "bg-blue-50 text-blue-600 border-blue-100",
  pending:     "bg-amber-50 text-amber-600 border-amber-100",
  expired:     "bg-slate-50 text-slate-500 border-slate-100",
  exhausted:   "bg-rose-50 text-rose-600 border-rose-100",
  cancelled:   "bg-slate-50 text-slate-400 border-slate-100",
};

const statusLabel: Record<string, string> = {
  active:      "Active",
  not_started: "Ready to Use",
  pending:     "Pending",
  expired:     "Expired",
  exhausted:   "Exhausted",
  cancelled:   "Cancelled",
};

const fmtDate = (d?: string | null) =>
  d ? format(parseISO(d), "d MMM yyyy") : "—";

const fmtMethod = (method?: string | null) => {
  if (!method) return "—";
  if (method === "qr_scan" || method === "bakong") return "Bakong QR";
  if (method === "cash") return "Cash";
  if (method.startsWith("baray_")) return `${method.replace("baray_", "").toUpperCase()} (Baray)`;
  return method.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
};

const CustomerPackagesPage = ({ userRole = "receptionist" }: { userRole?: string }) => {
  const isAdmin = userRole === "admin";

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch]             = useState("");
  const [currentPage, setCurrentPage]   = useState(1);

  const packagesQuery = useApiUserPackages({
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
    page: currentPage,
  });

  const userPackages: ApiUserPackage[] = (packagesQuery.data as any)?.data ?? [];
  const meta                           = (packagesQuery.data as any)?.meta;
  const packagesLoading                = packagesQuery.isLoading || packagesQuery.isFetching;
  const totalPages                     = meta?.last_page ?? 1;

  const updateUserPkg    = useUpdateUserPackage();
  const deleteUserPkg    = useDeleteUserPackage();
  const pkgDeletePreview = useUserPackageDeletePreview();

  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting]       = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState<"selected" | "all" | null>(null);
  const [deletePreviewData, setDeletePreviewData] = useState<{ id: string; active_bookings: number; package_name: string } | null>(null);
  const [singleDeleting, setSingleDeleting]   = useState(false);

  const [editPkg, setEditPkg]         = useState<ApiUserPackage | null>(null);
  const [editForm, setEditForm]       = useState({ status: "", expiryDate: "", sessionsRemaining: "" });
  const [confirmCancel, setConfirmCancel] = useState(false);

  const getUserName = (pkg: ApiUserPackage) => {
    if (!pkg.user) return "—";
    return `${pkg.user.firstName ?? ""} ${pkg.user.lastName ?? ""}`.trim() || pkg.user.email;
  };

  const openEdit = (pkg: ApiUserPackage) => {
    setEditForm({
      status: pkg.status,
      expiryDate: pkg.expiryDate ? pkg.expiryDate.split("T")[0] : "",
      sessionsRemaining: pkg.sessionsRemaining != null ? String(pkg.sessionsRemaining) : "",
    });
    setEditPkg(pkg);
    setConfirmCancel(false);
  };

  const saveEdit = async () => {
    if (!editPkg) return;
    try {
      const sessionsVal = editForm.sessionsRemaining.trim();
      await updateUserPkg.mutateAsync({
        id: editPkg.id,
        status: editForm.status as ApiUserPackage["status"],
        expiryDate: editForm.expiryDate || null,
        ...(sessionsVal !== "" ? { sessionsRemaining: parseInt(sessionsVal) } : {}),
      });
      setEditPkg(null);
      toast.success("Package updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update package");
    }
  };

  const handleCancelPackage = async () => {
    if (!editPkg) return;
    try {
      await updateUserPkg.mutateAsync({ id: editPkg.id, status: "cancelled" });
      setConfirmCancel(false);
      setEditPkg(null);
      toast.success("Package cancelled");
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel package");
    }
  };

  const handleBulkDelete = async () => {
    const ids = showBulkConfirm === "all" ? userPackages.map(p => p.id) : [...selectedIds];
    setBulkDeleting(true);
    const results = await Promise.allSettled(ids.map(id => deleteUserPkg.mutateAsync(id)));
    const failed    = results.filter(r => r.status === "rejected").length;
    const succeeded = results.length - failed;
    if (succeeded > 0) toast.success(`${succeeded} package${succeeded !== 1 ? "s" : ""} deleted.`);
    if (failed > 0) toast.error(`${failed} failed to delete.`);
    setSelectedIds(new Set());
    setBulkDeleting(false);
    setShowBulkConfirm(null);
  };

  const allPageSelected  = userPackages.length > 0 && userPackages.every(p => selectedIds.has(p.id));
  const somePageSelected = !allPageSelected && userPackages.some(p => selectedIds.has(p.id));

  return (
    <div className="space-y-5">

      {/* Search + status tabs row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by customer name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9 w-72 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && selectedIds.size > 0 && (
            <Button size="sm" onClick={() => setShowBulkConfirm("selected")} className="h-8 gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs">
              <Trash2 className="h-3.5 w-3.5" /> Delete Selected ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Status filter tabs */}
      {statusFilter === "pending" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <strong>Pending Payment</strong> — these are Bakong QR payments the customer started but hasn't completed. Staff can follow up or delete stale records.
        </div>
      )}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setCurrentPage(1); setSelectedIds(new Set()); }}
            className={cn(
              "rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all border",
              statusFilter === tab.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {tab.label}
          </button>
        ))}
        {meta && (
          <span className="ml-2 self-center text-[11px] text-muted-foreground font-medium">
            {meta.total} record{meta.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {isAdmin && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={el => { if (el) el.indeterminate = somePageSelected; }}
                    onChange={() => {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (allPageSelected) userPackages.forEach(p => next.delete(p.id));
                        else userPackages.forEach(p => next.add(p.id));
                        return next;
                      });
                    }}
                    className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Package</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sessions</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Purchased</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiry</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {packagesLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : userPackages.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 9 : 8} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-4">
                      <Package className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-base font-semibold text-foreground">No packages found</p>
                    <p className="text-sm text-muted-foreground">
                      {search || statusFilter !== "all" ? "Try adjusting your filters or search." : "No customer packages recorded yet."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : userPackages.map((pkg) => {
              const payment = pkg.paymentTransactions?.[0];
              const sessionsRemaining = pkg.sessionsRemaining;
              const sessionsIncluded  = pkg.package?.sessionsIncluded;

              return (
                <tr key={pkg.id} className={cn("border-b border-border last:border-0 hover:bg-muted/20 transition-colors", selectedIds.has(pkg.id) && "bg-primary/5")}>
                  {isAdmin && (
                    <td className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(pkg.id)}
                        onChange={() => setSelectedIds(prev => { const n = new Set(prev); n.has(pkg.id) ? n.delete(pkg.id) : n.add(pkg.id); return n; })}
                        className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground leading-tight">{getUserName(pkg)}</p>
                    <p className="text-xs text-muted-foreground">{pkg.user?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground leading-tight">{pkg.package?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{pkg.package?.serviceType?.name ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {sessionsRemaining != null ? (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground">
                          {sessionsRemaining}{sessionsIncluded != null ? `/${sessionsIncluded}` : ""}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(pkg.purchaseDate)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {pkg.expiryDate ? (
                      <span className={cn(new Date(pkg.expiryDate) < new Date() ? "text-rose-500 font-semibold" : "")}>
                        {fmtDate(pkg.expiryDate)}
                      </span>
                    ) : pkg.package?.validityDays ? (
                      <span className="text-muted-foreground/60">{pkg.package.validityDays}d after start</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className={cn("text-xs font-semibold",
                      pkg.paymentStatus === "confirmed" ? "text-emerald-600" :
                      pkg.paymentStatus === "pending"   ? "text-amber-600"  : "text-rose-600"
                    )}>
                      {pkg.paymentStatus === "confirmed" ? "Paid" : pkg.paymentStatus === "pending" ? "Pending" : "Failed"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{fmtMethod(payment?.paymentMethod)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      statusColors[pkg.status] ?? statusColors.active
                    )}>
                      {statusLabel[pkg.status] ?? pkg.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(pkg)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {isAdmin && (
                        <button
                          disabled={pkgDeletePreview.isPending}
                          onClick={async () => {
                            try {
                              const preview = await pkgDeletePreview.mutateAsync(pkg.id);
                              setDeletePreviewData({ id: pkg.id, ...preview });
                            } catch {
                              toast.error("Failed to load deletion details.");
                            }
                          }}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {meta && meta.total > meta.per_page && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {((currentPage - 1) * meta.per_page) + 1}–{Math.min(currentPage * meta.per_page, meta.total)} of {meta.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs font-medium text-foreground">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editPkg} onOpenChange={() => { setEditPkg(null); setConfirmCancel(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Package — {editPkg ? getUserName(editPkg) : ""}</DialogTitle>
          </DialogHeader>
          {editPkg && (
            <div className="rounded-lg bg-muted/30 border border-border p-3 text-xs space-y-1 mb-2">
              <p className="font-bold text-foreground">{editPkg.package?.name}</p>
              <p className="text-muted-foreground">{editPkg.package?.serviceType?.name} · Purchased {fmtDate(editPkg.purchaseDate)}</p>
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Ready to Use</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="exhausted">Exhausted</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sessions Remaining</Label>
              <Input
                type="number"
                min="0"
                placeholder="Leave blank to keep current"
                value={editForm.sessionsRemaining}
                onChange={(e) => setEditForm(f => ({ ...f, sessionsRemaining: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={editForm.expiryDate}
                onChange={(e) => setEditForm(f => ({ ...f, expiryDate: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">Leave empty to clear expiry.</p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {!confirmCancel ? (
              <>
                {editPkg?.status !== "cancelled" && (
                  <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5 sm:mr-auto gap-1.5" onClick={() => setConfirmCancel(true)}>
                    <XCircle className="h-4 w-4" /> Cancel Package
                  </Button>
                )}
                <Button variant="outline" onClick={() => setEditPkg(null)}>Close</Button>
                <Button onClick={saveEdit} disabled={updateUserPkg.isPending}>
                  {updateUserPkg.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </>
            ) : (
              <div className="flex w-full flex-col gap-2">
                <p className="text-sm text-destructive font-medium text-center">Cancel this package? Cannot be undone.</p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => setConfirmCancel(false)}>Go Back</Button>
                  <Button variant="destructive" onClick={handleCancelPackage} disabled={updateUserPkg.isPending}>
                    {updateUserPkg.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Yes, Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single delete confirm */}
      <AlertDialog open={!!deletePreviewData} onOpenChange={(o) => { if (!o && !singleDeleting) setDeletePreviewData(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete "{deletePreviewData?.package_name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(deletePreviewData?.active_bookings ?? 0) > 0 ? (
                <span className="block rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive mt-1">
                  <strong>{deletePreviewData?.active_bookings} active booking{deletePreviewData?.active_bookings !== 1 ? "s" : ""}</strong>
                  {" will be cancelled. This cannot be undone."}
                </span>
              ) : "This record will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={singleDeleting}>Cancel</AlertDialogCancel>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2" disabled={singleDeleting}
              onClick={async () => {
                if (!deletePreviewData) return;
                setSingleDeleting(true);
                try {
                  await deleteUserPkg.mutateAsync(deletePreviewData.id);
                  toast.success("Package deleted.");
                  setDeletePreviewData(null);
                } catch (err: any) {
                  toast.error(err?.body?.message || "Failed to delete.");
                } finally { setSingleDeleting(false); }
              }}>
              {singleDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {singleDeleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={!!showBulkConfirm} onOpenChange={(o) => { if (!o && !bulkDeleting) setShowBulkConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} package{selectedIds.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the selected packages.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <Button onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2">
              {bulkDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {bulkDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomerPackagesPage;
