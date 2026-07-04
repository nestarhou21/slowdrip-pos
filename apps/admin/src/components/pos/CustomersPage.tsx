import { useState } from "react";
import { Search, Calendar, Loader2, Package, User, Users, CalendarCheck2, UserPlus, Trash2, AlertTriangle, Mail, Phone, Eye, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@repo/ui";
import { Input } from "@repo/ui";
import { Button } from "@repo/ui";
import { Label } from "@repo/ui";
import { Skeleton } from "@repo/ui";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@repo/ui";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@repo/ui";
import { toast } from "sonner";
import {
  useApiCustomers,
  useApiCustomerDetail,
  useApiUserPackages,
  useUpdateUserPackage,
  useRegisterCustomer,
  useCustomerDeletePreview,
  useDeleteCustomer,
  type ApiCustomerAccount,
  type ApiUserPackage,
} from "@repo/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { Pencil } from "lucide-react";

// ── Status + payment colours (mirrored from CustomerPackagesPage) ──────────
const pkgStatusColors: Record<string, string> = {
  active:    "bg-emerald-50 text-emerald-600 border-emerald-100",
  pending:   "bg-amber-50 text-amber-600 border-amber-100",
  expired:   "bg-slate-50 text-slate-500 border-slate-100",
  exhausted: "bg-rose-50 text-rose-600 border-rose-100",
  cancelled: "bg-slate-50 text-slate-400 border-slate-100",
};
const paymentColors: Record<string, string> = {
  confirmed: "text-emerald-600",
  pending:   "text-amber-600",
  failed:    "text-rose-600",
};

type DetailTab = "overview" | "classes" | "packages";

const CustomersPage = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");

  // Register customer dialog
  const [showRegister, setShowRegister] = useState(false);
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regError, setRegError] = useState("");

  // Server-side search — passes search term to the API so it searches ALL customers, not just current page
  const { data: customersPage, isLoading } = useApiCustomers(page, undefined, true, search || undefined);
  const customers = customersPage?.data ?? [];
  const totalPages = customersPage?.last_page ?? 1;
  const totalCustomers = customersPage?.total ?? 0;

  // Single delete state
  const [deletePreviewData, setDeletePreviewData] = useState<{ active_bookings: number; active_packages: number; name: string; userId: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState<"selected" | "all" | null>(null);

  const { data: customerDetail } = useApiCustomerDetail(selectedUserId);
  const registerCustomerMutation = useRegisterCustomer();
  const deletePreviewMutation = useCustomerDeletePreview();
  const deleteCustomerMutation = useDeleteCustomer();

  // Load packages for the selected customer only (server-side, all statuses)
  const { data: customerPkgsResp, isLoading: customerPkgsLoading } = useApiUserPackages(
    selectedUserId ? { userId: selectedUserId, per_page: 100 } as any : undefined,
    { enabled: !!selectedUserId }
  );
  const customerPackages: ApiUserPackage[] = (customerPkgsResp as any)?.data ?? [];

  // Package edit state
  const updateUserPkg = useUpdateUserPackage();
  const [editPkg, setEditPkg] = useState<ApiUserPackage | null>(null);
  const [editForm, setEditForm] = useState({ status: "", expiryDate: "", sessionsRemaining: "" });

  const openPkgEdit = (pkg: ApiUserPackage) => {
    setEditForm({
      status: pkg.status,
      expiryDate: pkg.expiryDate ? pkg.expiryDate.split("T")[0] : "",
      sessionsRemaining: pkg.sessionsRemaining != null ? String(pkg.sessionsRemaining) : "",
    });
    setEditPkg(pkg);
  };

  const savePkgEdit = async () => {
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
      toast.error(err?.message || "Failed to update");
    }
  };

  // No client-side filtering — search is server-side via useApiCustomers
  const filtered = customers;

  const getDisplayName = (c: ApiCustomerAccount) =>
    `${c.user.firstName ?? ""} ${c.user.lastName ?? ""}`.trim() || c.user.email;

  const getInitials = (c: ApiCustomerAccount) => {
    const first = c.user.firstName?.[0] ?? "";
    const last  = c.user.lastName?.[0]  ?? "";
    return (first + last).toUpperCase() || c.user.email[0].toUpperCase();
  };


  const openDetail = (userId: string) => {
    setSelectedUserId(userId);
    setDetailTab("overview");
  };

  // Bulk select helpers
  const allPageSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.userId));
  const somePageSelected = !allPageSelected && filtered.some(c => selectedIds.has(c.userId));
  const togglePageSelection = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) filtered.forEach(c => next.delete(c.userId));
      else filtered.forEach(c => next.add(c.userId));
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = showBulkConfirm === "all" ? filtered.map(c => c.userId) : [...selectedIds];
    setBulkDeleting(true);
    const results = await Promise.allSettled(ids.map(id => deleteCustomerMutation.mutateAsync(id)));
    const failed = results.filter(r => r.status === "rejected").length;
    const succeeded = results.length - failed;
    if (succeeded > 0) toast.success(`${succeeded} customer${succeeded !== 1 ? "s" : ""} deleted.`);
    if (failed > 0) toast.error(`${failed} could not be deleted.`);
    setSelectedIds(new Set());
    setBulkDeleting(false);
    setShowBulkConfirm(null);
  };

  const openRegisterDialog = () => {
    setRegFullName(""); setRegEmail("");
    setRegPhone(""); setRegPassword(""); setRegShowPassword(false); setRegError("");
    setShowRegister(true);
  };

  const handleRegisterCustomer = async () => {
    setRegError("");
    if (!regFullName.trim()) { setRegError("Full name is required."); return; }
    if (!regEmail.trim()) { setRegError("Email address is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) { setRegError("Please enter a valid email address."); return; }
    if (!regPassword.trim()) { setRegError("Password is required."); return; }
    if (regPassword.trim().length < 6) { setRegError("Password must be at least 6 characters."); return; }

    const parts = regFullName.trim().split(" ");
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") || undefined;

    try {
      await registerCustomerMutation.mutateAsync({
        firstName,
        lastName,
        email:    regEmail.trim(),
        phone:    regPhone.trim() || undefined,
        password: regPassword.trim(),
      });
      toast.success(`Account created for ${regFullName.trim()}.`);
      setShowRegister(false);
    } catch (err: any) {
      const msg = err?.body?.message || err?.message || "Failed to register customer.";
      setRegError(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
          <p className="text-muted-foreground text-sm">{totalCustomers} registered customer{totalCustomers !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <Button variant="outline" onClick={() => setShowBulkConfirm("all")} className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" /> Delete All ({filtered.length})
            </Button>
          )}
          <Button className="gap-2" onClick={openRegisterDialog}>
            <UserPlus className="h-4 w-4" /> New Customer
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} className="h-8 text-xs">Clear</Button>
            <Button size="sm" onClick={() => setShowBulkConfirm("selected")} className="h-8 gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs">
              <Trash2 className="h-3.5 w-3.5" /> Delete Selected ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="w-10 px-6 py-4">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={el => { if (el) el.indeterminate = somePageSelected; }}
                    onChange={togglePageSelection}
                    className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                  />
                </th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Customer</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Contact</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Member Since</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-right font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-4 rounded" /></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="space-y-1.5"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-44" /></div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><Skeleton className="h-3 w-28" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-3 w-20" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-14 rounded-full" /></td>
                      <td className="px-6 py-4"><div className="flex justify-end gap-1"><Skeleton className="h-8 w-8 rounded-lg" /><Skeleton className="h-8 w-8 rounded-lg" /></div></td>
                    </tr>
                  ))
                : filtered.map((customer) => (
                    <tr key={customer.id} className={cn("group transition-colors hover:bg-muted/30", selectedIds.has(customer.userId) && "bg-primary/5")}>
                      <td className="w-10 px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(customer.userId)}
                          onChange={() => setSelectedIds(prev => { const n = new Set(prev); n.has(customer.userId) ? n.delete(customer.userId) : n.add(customer.userId); return n; })}
                          className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xs shrink-0">
                            {getInitials(customer)}
                          </div>
                          <span className="font-medium text-foreground">{getDisplayName(customer)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span>{customer.user.email}</span>
                          </div>
                          {customer.user.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground text-xs">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{customer.user.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {new Date(customer.joinedAt).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-6 py-4">
                        <div className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          customer.user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        )}>
                          {customer.user.isActive
                            ? <><CheckCircle2 className="h-3 w-3" />Active</>
                            : <><XCircle className="h-3 w-3" />Inactive</>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="View details"
                            onClick={() => openDetail(customer.userId)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete customer"
                            disabled={deletePreviewMutation.isPending}
                            onClick={async () => {
                              try {
                                const preview = await deletePreviewMutation.mutateAsync(customer.userId);
                                setDeletePreviewData({ ...preview, userId: customer.userId });
                              } catch {
                                toast.error("Failed to load deletion details.");
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="rounded-full bg-primary/10 p-4">
                        <Users className="h-8 w-8 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-foreground">No customers found</p>
                        <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">
                          {search 
                            ? "We couldn't find any customers matching your search. Try a different name or email."
                            : "Your customer list is currently empty. Add your first customer to get started."}
                        </p>
                      </div>
                      {!search && (
                        <Button onClick={openRegisterDialog} variant="outline" className="mt-2 border-primary/20 text-primary hover:bg-primary/5">
                          <UserPlus className="mr-2 h-4 w-4" /> Add First Customer
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {totalCustomers} customers
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >Previous</button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Customer detail dialog — widened, with tabs */}
      <Dialog open={!!selectedUserId && !!customerDetail} onOpenChange={() => setSelectedUserId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {customerDetail && (() => {
            const name     = `${customerDetail.user.firstName ?? ""} ${customerDetail.user.lastName ?? ""}`.trim() || customerDetail.user.email;
            const initials = ((customerDetail.user.firstName?.[0] ?? "") + (customerDetail.user.lastName?.[0] ?? "")).toUpperCase() || customerDetail.user.email[0].toUpperCase();
            return (
              <>
                {/* ── Header ── */}
                <DialogHeader>
                  <DialogTitle>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-display font-bold shrink-0">
                        {initials}
                      </div>
                      <div>
                        <span>{name}</span>
                        <p className="text-sm font-normal text-muted-foreground">{customerDetail.user.email}</p>
                      </div>
                    </div>
                  </DialogTitle>
                </DialogHeader>

                {/* ── Tabs ── */}
                <div className="flex gap-1 border-b border-border pb-0 mt-2">
                  {(["overview", "classes", "packages"] as DetailTab[]).map((tab) => {
                    const labels: Record<DetailTab, string> = { overview: "Overview", classes: "Classes", packages: "Packages" };
                    const icons: Record<DetailTab, React.ReactNode> = {
                      overview: <User className="h-3.5 w-3.5" />,
                      classes:  <CalendarCheck2 className="h-3.5 w-3.5" />,
                      packages: <Package className="h-3.5 w-3.5" />,
                    };
                    return (
                      <button
                        key={tab}
                        onClick={() => setDetailTab(tab)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px",
                          detailTab === tab
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {icons[tab]}
                        {labels[tab]}
                        {tab === "packages" && (() => {
                          const count = customerPackages.filter(p => ['active','not_started'].includes(p.status) && p.paymentStatus === 'confirmed').length;
                          return count > 0 ? (
                            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary leading-none">{count}</span>
                          ) : null;
                        })()}
                      </button>
                    );
                  })}
                </div>

                {/* ── Tab: Overview ── */}
                {detailTab === "overview" && (
                  <div className="space-y-4 pt-2">
                    {/* Contact info */}
                    <div className="rounded-lg border border-border divide-y divide-border text-sm">
                      <div className="flex justify-between items-center px-4 py-2.5">
                        <span className="text-muted-foreground flex items-center gap-2"><Mail className="h-3.5 w-3.5" />Email</span>
                        <span className="text-foreground font-medium">{customerDetail.user.email}</span>
                      </div>
                      {customerDetail.user.phone && (
                        <div className="flex justify-between items-center px-4 py-2.5">
                          <span className="text-muted-foreground flex items-center gap-2"><Phone className="h-3.5 w-3.5" />Phone</span>
                          <span className="text-foreground font-medium">{customerDetail.user.phone}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center px-4 py-2.5">
                        <span className="text-muted-foreground flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />Member since</span>
                        <span className="text-foreground font-medium">{new Date(customerDetail.joinedAt).toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" })}</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2.5">
                        <span className="text-muted-foreground">Account status</span>
                        <span className={cn("text-xs font-bold uppercase tracking-wide", customerDetail.user.isActive ? "text-emerald-600" : "text-rose-600")}>
                          {customerDetail.user.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                    {/* Quick stats */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Active Packages", value: customerPackages.filter(p => ['active','not_started'].includes(p.status) && p.paymentStatus === 'confirmed').length },
                        { label: "Total Bookings", value: (customerDetail.user as any).wellnessBookings?.length ?? 0 },
                        { label: "Classes Attended", value: (customerDetail.user as any).wellnessBookings?.filter((b: any) => b.status === 'attended').length ?? 0 },
                      ].map(stat => (
                        <div key={stat.label} className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                          <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Tab: Classes ── */}
                {detailTab === "classes" && (
                  <div className="space-y-4 pt-2">
                    {/* Waitlist Entries */}
                    {customerDetail.user.waitlistEntries && customerDetail.user.waitlistEntries.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">In Queue</p>
                        <div className="space-y-2">
                          {customerDetail.user.waitlistEntries.map((wl: any) => (
                            <div key={wl.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">
                                    {new Date(`${wl.schedule.classDate}T${wl.schedule.startTime}`).toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{wl.schedule.serviceType?.name ?? "Class"}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={cn(
                                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                                    wl.status === "waiting" ? "bg-amber-50 text-amber-600 border-amber-100" :
                                    wl.status === "promoted" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                    "bg-slate-50 text-slate-500 border-slate-100"
                                  )}>
                                    {wl.status === "waiting" ? `Waitlist #${wl.position}` : wl.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Booked Classes */}
                    <div className="space-y-4">
                      {(() => {
                        const bookings = customerDetail.user.wellnessBookings ?? [];
                        if (bookings.length === 0) {
                          return <div className="py-8 text-center text-sm text-muted-foreground rounded-lg border border-dashed border-border">No class bookings yet</div>;
                        }

                        const now = new Date();
                        const upcoming = bookings.filter((bk: any) => {
                          const bDate = new Date(`${bk.schedule.classDate}T${bk.schedule.startTime}`);
                          return bDate >= now && !['cancelled', 'no_show', 'attended'].includes(bk.status);
                        }).sort((a: any, b: any) => new Date(`${a.schedule.classDate}T${a.schedule.startTime}`).getTime() - new Date(`${b.schedule.classDate}T${b.schedule.startTime}`).getTime());

                        const past = bookings.filter((bk: any) => {
                          const bDate = new Date(`${bk.schedule.classDate}T${bk.schedule.startTime}`);
                          return bDate < now || ['cancelled', 'no_show', 'attended'].includes(bk.status);
                        }).sort((a: any, b: any) => new Date(`${b.schedule.classDate}T${b.schedule.startTime}`).getTime() - new Date(`${a.schedule.classDate}T${a.schedule.startTime}`).getTime());

                        const renderClass = (bk: any) => (
                          <div key={bk.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-foreground">
                                  {new Date(`${bk.schedule.classDate}T${bk.schedule.startTime}`).toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                </p>
                                <p className="text-xs text-muted-foreground">{bk.schedule.serviceType?.name ?? "Class"}</p>
                              </div>
                              <span className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0",
                                bk.status === "confirmed" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                bk.status === "attended" ? "bg-blue-50 text-blue-600 border-blue-100" :
                                bk.status === "no_show" ? "bg-rose-50 text-rose-600 border-rose-100" :
                                "bg-slate-50 text-slate-500 border-slate-100"
                              )}>
                                {bk.status.replace("_", " ")}
                              </span>
                            </div>
                          </div>
                        );

                        return (
                          <>
                            <div className="space-y-3">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upcoming</p>
                              {upcoming.length > 0
                                ? <div className="space-y-2">{upcoming.map(renderClass)}</div>
                                : <div className="py-4 text-center text-xs text-muted-foreground rounded-lg border border-dashed border-border">No upcoming bookings</div>
                              }
                            </div>
                            {past.length > 0 && (
                              <div className="space-y-3">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Past</p>
                                <div className="space-y-2">{past.map(renderClass)}</div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* ── Tab: Packages ── */}
                {detailTab === "packages" && (
                  <div className="space-y-3 pt-2">
                    {customerPkgsLoading ? (
                      [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
                    ) : customerPackages.length === 0 ? (
                      <div className="py-10 text-center text-sm text-muted-foreground">No packages purchased yet</div>
                    ) : customerPackages.map((pkg) => {
                      const pkgName = pkg.package?.name ?? "—";
                      const pkgType = pkg.package?.serviceType?.name ?? (pkg.package?.packageType === "membership" ? "Membership" : "—");
                      const sessions = pkg.sessionsRemaining;
                      const totalSess = pkg.package?.sessionsIncluded;
                      return (
                        <div key={pkg.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground leading-tight">{pkgName}</p>
                              <p className="text-xs text-muted-foreground">{pkgType}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={cn("text-xs font-semibold capitalize", paymentColors[pkg.paymentStatus])}>
                                {pkg.paymentStatus}
                              </span>
                              <span className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                                pkgStatusColors[pkg.status] ?? pkgStatusColors.pending
                              )}>
                                {pkg.status === "not_started" ? "Ready" : pkg.status}
                              </span>
                              <button
                                onClick={() => openPkgEdit(pkg)}
                                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                title="Edit package"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {sessions != null && (
                              <span>Sessions: <strong className="text-foreground">{sessions}{totalSess != null ? `/${totalSess}` : ""}</strong></span>
                            )}
                            <span>Purchased: <strong className="text-foreground">{new Date(pkg.purchaseDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</strong></span>
                            {pkg.expiryDate && (
                              <span>Expires: <strong className={cn("text-foreground", new Date(pkg.expiryDate) < new Date() ? "text-rose-500" : "")}>{new Date(pkg.expiryDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</strong></span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Package Edit Dialog */}
      <Dialog open={!!editPkg} onOpenChange={() => setEditPkg(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Package</DialogTitle>
          </DialogHeader>
          {editPkg && (
            <div className="rounded-lg bg-muted/30 border border-border p-3 text-xs mb-2">
              <p className="font-bold text-foreground">{editPkg.package?.name}</p>
              <p className="text-muted-foreground">{editPkg.package?.serviceType?.name}</p>
            </div>
          )}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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
              <Label className="text-xs">Sessions Remaining</Label>
              <Input type="number" min="0" className="h-9" placeholder="Leave blank to keep current"
                value={editForm.sessionsRemaining}
                onChange={(e) => setEditForm(f => ({ ...f, sessionsRemaining: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expiry Date</Label>
              <Input type="date" className="h-9" value={editForm.expiryDate}
                onChange={(e) => setEditForm(f => ({ ...f, expiryDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" className="h-9" onClick={() => setEditPkg(null)}>Cancel</Button>
            <Button className="h-9" onClick={savePkgEdit} disabled={updateUserPkg.isPending}>
              {updateUserPkg.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={!!showBulkConfirm} onOpenChange={(o) => { if (!o && !bulkDeleting) setShowBulkConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {(() => {
                const count = showBulkConfirm === "all" ? filtered.length : selectedIds.size;
                const label = showBulkConfirm === "all" ? `all ${filtered.length}` : String(selectedIds.size);
                return `Delete ${label} customer${count !== 1 ? "s" : ""}?`;
              })()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              All bookings, packages, and account data for these customers will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <Button onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2">
              {bulkDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {bulkDeleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Customer Confirmation */}
      <AlertDialog open={!!deletePreviewData} onOpenChange={(o) => { if (!o && !deleting) setDeletePreviewData(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {`Delete ${deletePreviewData?.name ?? "customer"}?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-1">
              <span>This will permanently delete this customer account.</span>
              {(deletePreviewData?.active_bookings ?? 0) > 0 || (deletePreviewData?.active_packages ?? 0) > 0 ? (
                <span className="block rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive mt-2">
                  <strong>{deletePreviewData?.active_bookings} active booking{deletePreviewData?.active_bookings !== 1 ? "s" : ""}</strong>
                  {" and "}
                  <strong>{deletePreviewData?.active_packages} active package{deletePreviewData?.active_packages !== 1 ? "s" : ""}</strong>
                  {" will be cancelled. This cannot be undone."}
                </span>
              ) : (
                <span className="block text-sm mt-1">This cannot be undone.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              disabled={deleting}
              onClick={async () => {
                if (!deletePreviewData) return;
                setDeleting(true);
                try {
                  await deleteCustomerMutation.mutateAsync(deletePreviewData.userId);
                  toast.success(`${deletePreviewData.name} has been deleted.`);
                  setDeletePreviewData(null);
                  setSelectedUserId(null);
                } catch (err: any) {
                  toast.error(err?.body?.message || "Failed to delete customer.");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? "Deleting…" : "Delete Customer"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Register Customer Dialog */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> New Customer Account
            </DialogTitle>
            <p className="text-xs text-muted-foreground pt-1">Create an account for a walk-in customer. They can log in with these credentials.</p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                placeholder="e.g. Sokha Chan"
                onKeyDown={(e) => e.key === "Enter" && handleRegisterCustomer()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="customer@email.com"
                onKeyDown={(e) => e.key === "Enter" && handleRegisterCustomer()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+855 12 345 678"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  type={regShowPassword ? "text" : "password"}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="pr-16"
                  onKeyDown={(e) => e.key === "Enter" && handleRegisterCustomer()}
                />
                <button
                  type="button"
                  onClick={() => setRegShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  {regShowPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">Share this password with the customer so they can log in.</p>
            </div>
            {regError && (
              <p className="text-xs text-destructive bg-destructive/5 px-3 py-2 rounded-lg">{regError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegister(false)}>Cancel</Button>
            <Button onClick={handleRegisterCustomer} disabled={registerCustomerMutation.isPending}>
              {registerCustomerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomersPage;
