import { useState, useMemo } from "react";
import { Search, Plus, Pencil, Trash2, Package, Crown, Loader2, Dumbbell } from "lucide-react";
import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui";
import { Input } from "@repo/ui";
import { Button } from "@repo/ui";
import { Label } from "@repo/ui";
import { Skeleton } from "@repo/ui";
import {
  useApiServiceTypes,
  useCreateServiceType,
  useUpdateServiceType,
  useDeleteServiceType,
  useApiWellnessPackages,
  useCreateWellnessPackage,
  useUpdateWellnessPackage,
  useDeleteWellnessPackage,
  useBulkDeleteWellnessPackages,
  type ApiWellnessPackage,
  type ApiServiceType,
} from "@repo/store";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@repo/ui";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@repo/ui";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@repo/ui";
import { toast } from "sonner";

type Tab = "class-packages" | "memberships" | "service-types";

type PkgForm = {
  name: string; serviceTypeId: string; sessions: string; totalPrice: string;
  validityDays: string; discountPercent: string; benefits: string[]; remarks: string; isActive: boolean;
  recoveryDiscountPercent: string; groupRecoveryDiscountPercent: string; freeRecoverySessions: string;
};
const emptyPkgForm: PkgForm = {
  name: "", serviceTypeId: "", sessions: "1", totalPrice: "",
  validityDays: "30", discountPercent: "0", benefits: [], remarks: "", isActive: true,
  recoveryDiscountPercent: "", groupRecoveryDiscountPercent: "", freeRecoverySessions: "",
};

type MemForm = {
  name: string; serviceTypeId: string; price: string;
  validityDays: string; sessions: string; benefits: string[]; remarks: string; isActive: boolean;
  recoveryDiscountPercent: string; groupRecoveryDiscountPercent: string; freeRecoverySessions: string;
};
const emptyMemForm: MemForm = {
  name: "", serviceTypeId: "", price: "", validityDays: "30", sessions: "", benefits: [], remarks: "", isActive: true,
  recoveryDiscountPercent: "", groupRecoveryDiscountPercent: "", freeRecoverySessions: "",
};

const ITEMS_PER_PAGE = 10;

const PackageManagement = () => {
  const [tab, setTab] = useState<Tab>("class-packages");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [pkgPage, setPkgPage] = useState(1);
  const [memPage, setMemPage] = useState(1);
  const [svcPage, setSvcPage] = useState(1);
  const [selectedPkgIds, setSelectedPkgIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState<"selected" | "all" | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Service type CRUD
  const createSvcType = useCreateServiceType();
  const updateSvcType = useUpdateServiceType();
  const deleteSvcType = useDeleteServiceType();
  const [editSvcType, setEditSvcType] = useState<ApiServiceType | null>(null);
  const [isNewSvcType, setIsNewSvcType] = useState(false);
  const [svcForm, setSvcForm] = useState({ name: "", description: "", isActive: true });

  const openNewSvcType = () => { setSvcForm({ name: "", description: "", isActive: true }); setIsNewSvcType(true); };
  const openEditSvcType = (t: ApiServiceType) => { setSvcForm({ name: t.name, description: t.description || "", isActive: t.isActive }); setEditSvcType(t); };
  const closeSvcTypeDialog = () => { setEditSvcType(null); setIsNewSvcType(false); };

  const saveSvcType = async () => {
    if (!svcForm.name.trim()) return;
    try {
      if (editSvcType) {
        await updateSvcType.mutateAsync({ id: editSvcType.id, name: svcForm.name, description: svcForm.description || undefined, isActive: svcForm.isActive });
        toast.success("Service type updated");
      } else {
        await createSvcType.mutateAsync({ name: svcForm.name, description: svcForm.description || undefined, isActive: svcForm.isActive });
        toast.success("Service type created");
      }
      closeSvcTypeDialog();
    } catch (err: any) { toast.error(err?.message || "Failed to save"); }
  };

  const handleDeleteSvcType = async (t: ApiServiceType) => {
    try { await deleteSvcType.mutateAsync(t.id); toast.success("Service type deleted"); }
    catch (err: any) { toast.error(err?.message || "Failed to delete"); }
  };

  // API data
  const { data: serviceTypesRaw = [], isLoading: typesLoading } = useApiServiceTypes();
  const serviceTypes = serviceTypesRaw as ApiServiceType[];
  const { data: allPackagesRaw = [], isLoading: packagesLoading } = useApiWellnessPackages();
  const allPackages = allPackagesRaw as ApiWellnessPackage[];

  // Mutations
  const createPkg = useCreateWellnessPackage();
  const updatePkg = useUpdateWellnessPackage();
  const deletePkg = useDeleteWellnessPackage();
  const bulkDeletePkgs = useBulkDeleteWellnessPackages();

  // Split packages by type - using both camelCase and snake_case for maximum resilience during transition
  const classPackages = useMemo(() => {
    return allPackages.filter(p => (p.packageType || (p as any).package_type) === "class_pack");
  }, [allPackages]);

  const membershipPlans = useMemo(() => {
    return allPackages.filter(p => (p.packageType || (p as any).package_type) === "membership");
  }, [allPackages]);

  const [pkgForm, setPkgForm] = useState<PkgForm>(emptyPkgForm);
  const [pkgBenefitInput, setPkgBenefitInput] = useState("");
  const [editPkg, setEditPkg] = useState<ApiWellnessPackage | null>(null);
  const [showPkgDialog, setShowPkgDialog] = useState(false);

  const [memForm, setMemForm] = useState<MemForm>(emptyMemForm);
  const [memBenefitInput, setMemBenefitInput] = useState("");
  const [editMem, setEditMem] = useState<ApiWellnessPackage | null>(null);
  const [showMemDialog, setShowMemDialog] = useState(false);

  const isLoading = typesLoading || packagesLoading;

  const filteredPackages = useMemo(() => {
    return classPackages.filter(p => {
      const sTypeId = p.serviceTypeId || (p as any).service_type_id;
      const matchType = typeFilter === "all" || sTypeId === typeFilter;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [classPackages, search, typeFilter]);

  const stats = useMemo(() => ({
    totalPackages: classPackages.length,
    totalMemberships: membershipPlans.length,
    avgPrice: classPackages.length > 0 ? Math.round(classPackages.reduce((s, p) => s + parseFloat(p.price || (p as any).price || "0"), 0) / classPackages.length) : 0,
  }), [classPackages, membershipPlans]);

  const getServiceTypeName = (id: string) => serviceTypes.find(st => st.id === id)?.name ?? "—";

  // ── Package CRUD ──

  const openNewPkg = () => {
    setPkgForm({ ...emptyPkgForm, serviceTypeId: serviceTypes[0]?.id || "" });
    setPkgBenefitInput("");
    setEditPkg(null);
    setShowPkgDialog(true);
  };

  const openEditPkg = (pkg: ApiWellnessPackage) => {
    setPkgForm({
      name: pkg.name,
      serviceTypeId: pkg.serviceTypeId,
      sessions: String(pkg.sessionsIncluded ?? 1),
      totalPrice: String(pkg.price),
      validityDays: String(pkg.validityDays),
      discountPercent: String(pkg.discountPercent ?? 0),
      benefits: pkg.benefits ?? [],
      remarks: pkg.remarks || "",
      isActive: pkg.isActive,
      recoveryDiscountPercent: pkg.recoveryDiscountPercent != null ? String(pkg.recoveryDiscountPercent) : "",
      groupRecoveryDiscountPercent: pkg.groupRecoveryDiscountPercent != null ? String(pkg.groupRecoveryDiscountPercent) : "",
      freeRecoverySessions: pkg.freeRecoverySessions != null ? String(pkg.freeRecoverySessions) : "",
    });
    setPkgBenefitInput("");
    setEditPkg(pkg);
    setShowPkgDialog(true);
  };

  const savePkg = async () => {
    const sessions = parseInt(pkgForm.sessions);
    const price = parseFloat(pkgForm.totalPrice);
    const validityDays = parseInt(pkgForm.validityDays);
    const discountPercent = parseFloat(pkgForm.discountPercent) || 0;
    if (!pkgForm.name || isNaN(sessions) || isNaN(price) || isNaN(validityDays)) return;

    const recoveryDiscountPercent = pkgForm.recoveryDiscountPercent !== "" ? parseInt(pkgForm.recoveryDiscountPercent) : null;
    const groupRecoveryDiscountPercent = pkgForm.groupRecoveryDiscountPercent !== "" ? parseInt(pkgForm.groupRecoveryDiscountPercent) : null;
    const freeRecoverySessions = pkgForm.freeRecoverySessions !== "" ? parseInt(pkgForm.freeRecoverySessions) : null;

    try {
      if (editPkg) {
        await updatePkg.mutateAsync({
          id: editPkg.id,
          name: pkgForm.name,
          serviceTypeId: pkgForm.serviceTypeId,
          packageType: "class_pack",
          sessionsIncluded: sessions,
          price,
          discountPercent: discountPercent > 0 ? discountPercent : null,
          validityDays: validityDays,
          benefits: pkgForm.benefits.length > 0 ? pkgForm.benefits : null,
          remarks: pkgForm.remarks || null,
          isActive: pkgForm.isActive,
          recoveryDiscountPercent,
          groupRecoveryDiscountPercent,
          freeRecoverySessions,
        });
        toast.success("Package updated");
      } else {
        await createPkg.mutateAsync({
          name: pkgForm.name,
          serviceTypeId: pkgForm.serviceTypeId,
          packageType: "class_pack",
          sessionsIncluded: sessions,
          price,
          discountPercent: discountPercent > 0 ? discountPercent : null,
          validityDays: validityDays,
          benefits: pkgForm.benefits.length > 0 ? pkgForm.benefits : undefined,
          remarks: pkgForm.remarks || undefined,
          isActive: pkgForm.isActive,
          recoveryDiscountPercent: recoveryDiscountPercent ?? undefined,
          groupRecoveryDiscountPercent: groupRecoveryDiscountPercent ?? undefined,
          freeRecoverySessions: freeRecoverySessions ?? undefined,
        });
        toast.success("Package created");
      }
      setShowPkgDialog(false);
      setEditPkg(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save package");
    }
  };

  const handleDeletePkg = async (id: string) => {
    try {
      await deletePkg.mutateAsync(id);
      toast.success("Package deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete package");
    }
  };

  const handleBulkDeletePkgs = async () => {
    const ids = showBulkDeleteConfirm === "all"
      ? (tab === "class-packages" ? filteredPackages.map(p => p.id) : membershipPlans.map(p => p.id))
      : Array.from(selectedPkgIds);

    if (ids.length === 0) return;

    setIsBulkDeleting(true);
    try {
      const res = await bulkDeletePkgs.mutateAsync(ids);
      toast.success(res.message);
      setSelectedPkgIds(new Set());
    } catch (err: any) {
      toast.error(err?.body?.message || "Failed to delete packages");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(null);
    }
  };

  const toggleSelectPkg = (id: string) => {
    const next = new Set(selectedPkgIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPkgIds(next);
  };

  const toggleSelectAllPkgs = (currentBatch: ApiWellnessPackage[]) => {
    if (selectedPkgIds.size >= currentBatch.length) {
      setSelectedPkgIds(new Set());
    } else {
      setSelectedPkgIds(new Set(currentBatch.map(p => p.id)));
    }
  };

  // ── Membership CRUD ──

  const openNewMem = () => {
    setMemForm({ ...emptyMemForm, serviceTypeId: serviceTypes[0]?.id || "" });
    setMemBenefitInput("");
    setEditMem(null);
    setShowMemDialog(true);
  };

  const openEditMem = (plan: ApiWellnessPackage) => {
    setMemForm({
      name: plan.name,
      serviceTypeId: plan.serviceTypeId,
      price: String(plan.price),
      sessions: plan.sessionsIncluded ? String(plan.sessionsIncluded) : "",
      benefits: plan.benefits ?? [],
      validityDays: String(plan.validityDays),
      remarks: plan.remarks || "",
      isActive: plan.isActive,
      recoveryDiscountPercent: plan.recoveryDiscountPercent != null ? String(plan.recoveryDiscountPercent) : "",
      groupRecoveryDiscountPercent: plan.groupRecoveryDiscountPercent != null ? String(plan.groupRecoveryDiscountPercent) : "",
      freeRecoverySessions: plan.freeRecoverySessions != null ? String(plan.freeRecoverySessions) : "",
    });
    setMemBenefitInput("");
    setEditMem(plan);
    setShowMemDialog(true);
  };

  const saveMem = async () => {
    const price = parseFloat(memForm.price);
    const validityDays = parseInt(memForm.validityDays);
    const sessionsIncluded = parseInt(memForm.sessions);
    if (!memForm.name || isNaN(price) || isNaN(validityDays) || isNaN(sessionsIncluded) || sessionsIncluded < 1) return;

    const recoveryDiscountPercent = memForm.recoveryDiscountPercent !== "" ? parseInt(memForm.recoveryDiscountPercent) : null;
    const groupRecoveryDiscountPercent = memForm.groupRecoveryDiscountPercent !== "" ? parseInt(memForm.groupRecoveryDiscountPercent) : null;
    const freeRecoverySessions = memForm.freeRecoverySessions !== "" ? parseInt(memForm.freeRecoverySessions) : null;

    try {
      if (editMem) {
        await updatePkg.mutateAsync({
          id: editMem.id,
          name: memForm.name,
          serviceTypeId: memForm.serviceTypeId,
          packageType: "membership",
          sessionsIncluded,
          price,
          validityDays: validityDays,
          benefits: memForm.benefits.length > 0 ? memForm.benefits : null,
          remarks: memForm.remarks || null,
          isActive: memForm.isActive,
          recoveryDiscountPercent,
          groupRecoveryDiscountPercent,
          freeRecoverySessions,
        });
        toast.success("Membership updated");
      } else {
        await createPkg.mutateAsync({
          name: memForm.name,
          serviceTypeId: memForm.serviceTypeId,
          packageType: "membership",
          sessionsIncluded,
          price,
          validityDays: validityDays,
          benefits: memForm.benefits.length > 0 ? memForm.benefits : undefined,
          remarks: memForm.remarks || undefined,
          isActive: memForm.isActive,
          recoveryDiscountPercent: recoveryDiscountPercent ?? undefined,
          groupRecoveryDiscountPercent: groupRecoveryDiscountPercent ?? undefined,
          freeRecoverySessions: freeRecoverySessions ?? undefined,
        });
        toast.success("Membership created");
      }
      setShowMemDialog(false);
      setEditMem(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save membership");
    }
  };

  const handleDeleteMem = async (id: string) => {
    try {
      await deletePkg.mutateAsync(id);
      toast.success("Membership deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete membership");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-36 rounded-full" />
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-card border border-border p-4">
          <p className="text-sm text-muted-foreground">Class Packages</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{stats.totalPackages}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <p className="text-sm text-muted-foreground">Membership Plans</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{stats.totalMemberships}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <p className="text-sm text-muted-foreground">Avg. Package Price</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">${stats.avgPrice}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          <button onClick={() => { setTab("class-packages"); setPkgPage(1); }} className={cn("rounded-full px-4 py-1.5 text-xs font-medium transition-colors border", tab === "class-packages" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted")}>
            <Package className="inline h-3 w-3 mr-1" /> Class Packages
          </button>
          <button onClick={() => { setTab("memberships"); setMemPage(1); }} className={cn("rounded-full px-4 py-1.5 text-xs font-medium transition-colors border", tab === "memberships" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted")}>
            <Crown className="inline h-3 w-3 mr-1" /> Memberships
          </button>
          <button onClick={() => { setTab("service-types"); setSvcPage(1); setSelectedPkgIds(new Set()); }} className={cn("rounded-full px-4 py-1.5 text-xs font-medium transition-colors border", tab === "service-types" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted")}>
            <Dumbbell className="inline h-3 w-3 mr-1" /> Class Types
          </button>
        </div>
        <div className="flex items-center gap-2">
          {tab !== "service-types" && selectedPkgIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setShowBulkDeleteConfirm("selected")}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Selected ({selectedPkgIds.size})
            </Button>
          )}
          {tab !== "service-types" && (
            <Button onClick={tab === "class-packages" ? openNewPkg : openNewMem} className="gap-2">
              <Plus className="h-4 w-4" /> {tab === "class-packages" ? "Add Package" : "Add Plan"}
            </Button>
          )}
          {tab === "service-types" && (
            <Button onClick={openNewSvcType} className="gap-2">
              <Plus className="h-4 w-4" /> Add Class Type
            </Button>
          )}
        </div>
      </div>

      {/* Class Packages Tab */}
      {tab === "class-packages" && (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search packages..." value={search} onChange={(e) => { setSearch(e.target.value); setPkgPage(1); }} className="pl-9" />
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => { setTypeFilter("all"); setPkgPage(1); }} className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors border", typeFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted")}>All</button>
              {serviceTypes.filter(st => !st.name.toLowerCase().includes("membership")).map(st => (
                <button key={st.id} onClick={() => { setTypeFilter(st.id); setPkgPage(1); }} className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors border", typeFilter === st.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted")}>{st.name}</button>
              ))}
            </div>
            {filteredPackages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto gap-1.5 border-destructive/20 text-destructive hover:bg-destructive/5"
                onClick={() => setShowBulkDeleteConfirm("all")}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete All ({filteredPackages.length})
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={filteredPackages.length > 0 && selectedPkgIds.size === filteredPackages.length}
                      onChange={() => toggleSelectAllPkgs(filteredPackages)}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Package</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sessions</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Validity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPackages.slice((pkgPage - 1) * ITEMS_PER_PAGE, pkgPage * ITEMS_PER_PAGE).map(pkg => {
                  const sessions = pkg.sessionsIncluded ?? (pkg as any).sessions_included ?? 0;
                  const priceVal = parseFloat(pkg.price || (pkg as any).price || "0");
                  const isActive = pkg.isActive ?? (pkg as any).is_active;
                  return (
                    <tr key={pkg.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedPkgIds.has(pkg.id)}
                          onChange={() => toggleSelectPkg(pkg.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{pkg.name}</p>
                          {pkg.remarks && <p className="text-[10px] text-muted-foreground line-clamp-1">{pkg.remarks}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs font-medium text-muted-foreground">{getServiceTypeName(pkg.serviceTypeId || (pkg as any).service_type_id)}</span></td>
                      <td className="px-4 py-3"><span className="text-sm font-bold text-foreground">{sessions}×</span></td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-foreground">${priceVal}</p>
                        <p className="text-[10px] text-muted-foreground">${sessions > 0 ? Math.round(priceVal / sessions) : priceVal}/session</p>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs text-muted-foreground">{pkg.validityDays ?? (pkg as any).validity_days} days</span></td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          isActive ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-100")}>
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild>
                            <button onClick={() => openEditPkg(pkg)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"><Pencil className="h-4 w-4" /></button>
                          </TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                          <AlertDialog>
                            <Tooltip><TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <button className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                              </AlertDialogTrigger>
                            </TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Package</AlertDialogTitle>
                                <AlertDialogDescription>Are you sure you want to delete "{pkg.name}"? This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeletePkg(pkg.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredPackages.length === 0 && <div className="py-16 text-center text-sm text-muted-foreground">No packages found</div>}
          </div>
          {filteredPackages.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-card rounded-xl">
              <p className="text-xs text-muted-foreground">
                Showing {((pkgPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(pkgPage * ITEMS_PER_PAGE, filteredPackages.length)} of {filteredPackages.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPkgPage(p => Math.max(1, p - 1))}
                  disabled={pkgPage <= 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs font-medium text-foreground">Page {pkgPage} of {Math.max(1, Math.ceil(filteredPackages.length / ITEMS_PER_PAGE))}</span>
                <button
                  onClick={() => setPkgPage(p => Math.min(Math.ceil(filteredPackages.length / ITEMS_PER_PAGE), p + 1))}
                  disabled={pkgPage >= Math.ceil(filteredPackages.length / ITEMS_PER_PAGE)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Memberships Tab */}
      {tab === "memberships" && (
        <>
          {membershipPlans.length > 0 && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-destructive/20 text-destructive hover:bg-destructive/5"
                onClick={() => setShowBulkDeleteConfirm("all")}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete All ({membershipPlans.length})
              </Button>
            </div>
          )}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={membershipPlans.length > 0 && selectedPkgIds.size === membershipPlans.length}
                      onChange={() => toggleSelectAllPkgs(membershipPlans)}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Validity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Benefits</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {membershipPlans.slice((memPage - 1) * ITEMS_PER_PAGE, memPage * ITEMS_PER_PAGE).map(plan => {
                  const priceVal = parseFloat(plan.price || (plan as any).price || "0");
                  const isActive = plan.isActive ?? (plan as any).is_active;
                  return (
                    <tr key={plan.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedPkgIds.has(plan.id)}
                          onChange={() => toggleSelectPkg(plan.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                        {plan.remarks && <p className="text-[10px] text-muted-foreground line-clamp-1">{plan.remarks}</p>}
                      </td>
                      <td className="px-4 py-3"><span className="text-xs font-medium text-muted-foreground">{getServiceTypeName(plan.serviceTypeId || (plan as any).service_type_id)}</span></td>
                      <td className="px-4 py-3"><span className="text-sm font-bold text-foreground">${priceVal}</span></td>
                      <td className="px-4 py-3"><span className="text-xs text-muted-foreground">{plan.validityDays ?? (plan as any).validity_days} days</span></td>
                      <td className="px-4 py-3"><p className="text-xs text-muted-foreground max-w-xs truncate">{plan.benefits?.join(", ") || "—"}</p></td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          isActive ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-100")}>
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild>
                            <button onClick={() => openEditMem(plan)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"><Pencil className="h-4 w-4" /></button>
                          </TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                          <AlertDialog>
                            <Tooltip><TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <button className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                              </AlertDialogTrigger>
                            </TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Membership</AlertDialogTitle>
                                <AlertDialogDescription>Are you sure you want to delete "{plan.name}"? This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteMem(plan.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {membershipPlans.length === 0 && <div className="py-16 text-center text-sm text-muted-foreground">No membership plans found</div>}
          </div>
          {membershipPlans.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-card rounded-xl">
              <p className="text-xs text-muted-foreground">
                Showing {((memPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(memPage * ITEMS_PER_PAGE, membershipPlans.length)} of {membershipPlans.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMemPage(p => Math.max(1, p - 1))}
                  disabled={memPage <= 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs font-medium text-foreground">Page {memPage} of {Math.max(1, Math.ceil(membershipPlans.length / ITEMS_PER_PAGE))}</span>
                <button
                  onClick={() => setMemPage(p => Math.min(Math.ceil(membershipPlans.length / ITEMS_PER_PAGE), p + 1))}
                  disabled={memPage >= Math.ceil(membershipPlans.length / ITEMS_PER_PAGE)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Service Types Tab */}
      {tab === "service-types" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Packages</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {serviceTypes.slice((svcPage - 1) * ITEMS_PER_PAGE, svcPage * ITEMS_PER_PAGE).map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3"><p className="text-sm font-semibold text-foreground">{t.name}</p></td>
                  <td className="px-4 py-3"><p className="text-sm text-muted-foreground max-w-xs truncate">{t.description || "—"}</p></td>
                  <td className="px-4 py-3"><span className="text-sm font-medium text-foreground">{t.packagesCount ?? (t as any).packages_count ?? "—"}</span></td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      (t.isActive ?? (t as any).is_active) ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-100")}>
                      {(t.isActive ?? (t as any).is_active) ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip><TooltipTrigger asChild>
                        <button onClick={() => openEditSvcType(t)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"><Pencil className="h-4 w-4" /></button>
                      </TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                      <AlertDialog>
                        <Tooltip><TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <button className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                          </AlertDialogTrigger>
                        </TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Service Type</AlertDialogTitle>
                            <AlertDialogDescription>Delete "{t.name}"? This will also remove all associated packages.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteSvcType(t)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {serviceTypes.length === 0 && <div className="py-16 text-center text-sm text-muted-foreground">No service types found</div>}
          {serviceTypes.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {((svcPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(svcPage * ITEMS_PER_PAGE, serviceTypes.length)} of {serviceTypes.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSvcPage(p => Math.max(1, p - 1))}
                  disabled={svcPage <= 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs font-medium text-foreground">Page {svcPage} of {Math.max(1, Math.ceil(serviceTypes.length / ITEMS_PER_PAGE))}</span>
                <button
                  onClick={() => setSvcPage(p => Math.min(Math.ceil(serviceTypes.length / ITEMS_PER_PAGE), p + 1))}
                  disabled={svcPage >= Math.ceil(serviceTypes.length / ITEMS_PER_PAGE)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Package Dialog */}
      <Dialog open={showPkgDialog} onOpenChange={setShowPkgDialog}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh] p-0">
          <DialogHeader className="px-8 pt-8 pb-2 shrink-0">
            <DialogTitle className="text-2xl font-display">{editPkg ? "Edit Package" : "Add New Package"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 overflow-y-auto flex-1 px-8 py-2">
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Package Name</Label><Input value={pkgForm.name} onChange={e => setPkgForm(f => ({ ...f, name: e.target.value }))} placeholder="Move 6" className="h-11" /></div>
              <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Class Type</Label>
                <Select value={pkgForm.serviceTypeId} onValueChange={v => setPkgForm(f => ({ ...f, serviceTypeId: v }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{serviceTypes.map(st => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sessions</Label><Input type="number" value={pkgForm.sessions} onChange={e => setPkgForm(f => ({ ...f, sessions: e.target.value }))} className="h-11" /></div>
              <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total ($)</Label><Input type="number" value={pkgForm.totalPrice} onChange={e => setPkgForm(f => ({ ...f, totalPrice: e.target.value }))} className="h-11" /></div>
              <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Validity (days)</Label><Input type="number" value={pkgForm.validityDays} onChange={e => setPkgForm(f => ({ ...f, validityDays: e.target.value }))} className="h-11" /></div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Promo Discount (%)</Label>
                <Input type="number" min="0" max="100" value={pkgForm.discountPercent} onChange={e => setPkgForm(f => ({ ...f, discountPercent: e.target.value }))} placeholder="0" className="h-11" />
                {parseFloat(pkgForm.discountPercent) > 0 && parseFloat(pkgForm.totalPrice) > 0 && (
                  <p className="text-xs text-emerald-600 font-medium">Sale price: ${(parseFloat(pkgForm.totalPrice) * (1 - parseFloat(pkgForm.discountPercent) / 100)).toFixed(2)}</p>
                )}
              </div>
            </div>
            {/* Recovery Privileges — structured inputs, machine-readable */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recovery Privileges</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recovery Discount</Label>
                  <div className="relative">
                    <Input type="number" min="0" max="100" value={pkgForm.recoveryDiscountPercent} onChange={e => setPkgForm(f => ({ ...f, recoveryDiscountPercent: e.target.value }))} placeholder="—" className="h-9 pr-6 text-sm" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">Individual recovery session discount</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Group Recovery Discount</Label>
                  <div className="relative">
                    <Input type="number" min="0" max="100" value={pkgForm.groupRecoveryDiscountPercent} onChange={e => setPkgForm(f => ({ ...f, groupRecoveryDiscountPercent: e.target.value }))} placeholder="—" className="h-9 pr-6 text-sm" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">Group recovery lounge (4–6 pax) discount</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Free Recovery Sessions</Label>
                  <Input type="number" min="0" max="99" value={pkgForm.freeRecoverySessions} onChange={e => setPkgForm(f => ({ ...f, freeRecoverySessions: e.target.value }))} placeholder="—" className="h-9 text-sm" />
                  <p className="text-[10px] text-muted-foreground leading-tight">Complimentary recovery sessions included</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Display Benefits (shown to customer)</Label>
              <div className="min-h-[2.5rem] flex flex-wrap gap-1.5 rounded-md border border-border bg-background px-3 py-2">
                {pkgForm.benefits.map((b, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1 font-medium">
                    {b}
                    <button type="button" onClick={() => setPkgForm(f => ({ ...f, benefits: f.benefits.filter((_, j) => j !== i) }))} className="hover:text-destructive leading-none">×</button>
                  </span>
                ))}
                <input
                  className="flex-1 min-w-[12rem] bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  value={pkgBenefitInput}
                  onChange={e => setPkgBenefitInput(e.target.value)}
                  onKeyDown={e => {
                    if ((e.key === "Enter" || e.key === ",") && pkgBenefitInput.trim()) {
                      e.preventDefault();
                      setPkgForm(f => ({ ...f, benefits: [...f.benefits, pkgBenefitInput.trim()] }));
                      setPkgBenefitInput("");
                    } else if (e.key === "Backspace" && !pkgBenefitInput && pkgForm.benefits.length > 0) {
                      setPkgForm(f => ({ ...f, benefits: f.benefits.slice(0, -1) }));
                    }
                  }}
                  placeholder={pkgForm.benefits.length === 0 ? "Type a benefit and press Enter or comma..." : ""}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Press Enter or comma to add each benefit. Backspace removes the last tag.</p>
            </div>
            <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remarks / Terms</Label><textarea className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none transition-all" rows={2} value={pkgForm.remarks} onChange={e => setPkgForm(f => ({ ...f, remarks: e.target.value }))} placeholder="e.g. Non-transferrable, non-refundable, non-sharable" /></div>
            <label className="flex items-center gap-3 text-sm font-medium text-foreground cursor-pointer select-none">
              <input type="checkbox" checked={pkgForm.isActive} onChange={e => setPkgForm(f => ({ ...f, isActive: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              Active (visible to customers)
            </label>
          </div>
          <DialogFooter className="px-8 pb-8 pt-4 shrink-0 border-t border-border">
            <Button variant="outline" onClick={() => setShowPkgDialog(false)}>Cancel</Button>
            <Button onClick={savePkg} disabled={createPkg.isPending || updatePkg.isPending}>
              {(createPkg.isPending || updatePkg.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editPkg ? "Save Changes" : "Create Package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Membership Dialog */}
      <Dialog open={showMemDialog} onOpenChange={setShowMemDialog}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh] p-0">
          <DialogHeader className="px-8 pt-8 pb-2 shrink-0">
            <DialogTitle className="text-2xl font-display">{editMem ? "Edit Membership" : "Add New Membership"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 overflow-y-auto flex-1 px-8 py-2">
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan Name</Label><Input value={memForm.name} onChange={e => setMemForm(f => ({ ...f, name: e.target.value }))} placeholder="Move & Recover" className="h-11" /></div>
              <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Class Type</Label>
                <Select value={memForm.serviceTypeId} onValueChange={v => setMemForm(f => ({ ...f, serviceTypeId: v }))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{serviceTypes.map(st => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price ($)</Label><Input type="number" value={memForm.price} onChange={e => setMemForm(f => ({ ...f, price: e.target.value }))} className="h-11" /></div>
              <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Validity (days)</Label><Input type="number" value={memForm.validityDays} onChange={e => setMemForm(f => ({ ...f, validityDays: e.target.value }))} className="h-11" /></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sessions <span className="text-destructive">*</span></Label>
              <Input type="number" min="1" value={memForm.sessions} onChange={e => setMemForm(f => ({ ...f, sessions: e.target.value }))} placeholder="e.g. 4, 8, 12" className="h-11" required />
              <p className="text-[10px] text-muted-foreground">Number of class sessions included. Benefits (free recovery, discounts) are tracked separately from this count.</p>
            </div>
            {/* Recovery Privileges — structured inputs, machine-readable */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recovery Privileges</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recovery Discount</Label>
                  <div className="relative">
                    <Input type="number" min="0" max="100" value={memForm.recoveryDiscountPercent} onChange={e => setMemForm(f => ({ ...f, recoveryDiscountPercent: e.target.value }))} placeholder="—" className="h-9 pr-6 text-sm" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">Individual recovery session discount</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Group Recovery Discount</Label>
                  <div className="relative">
                    <Input type="number" min="0" max="100" value={memForm.groupRecoveryDiscountPercent} onChange={e => setMemForm(f => ({ ...f, groupRecoveryDiscountPercent: e.target.value }))} placeholder="—" className="h-9 pr-6 text-sm" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">Group recovery lounge (4–6 pax) discount</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Free Recovery Sessions</Label>
                  <Input type="number" min="0" max="99" value={memForm.freeRecoverySessions} onChange={e => setMemForm(f => ({ ...f, freeRecoverySessions: e.target.value }))} placeholder="—" className="h-9 text-sm" />
                  <p className="text-[10px] text-muted-foreground leading-tight">Complimentary recovery sessions included</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Benefits (shown to customer)</Label>
              <div className="min-h-[2.5rem] flex flex-wrap gap-1.5 rounded-md border border-border bg-background px-3 py-2">
                {memForm.benefits.map((b, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-1 font-medium">
                    {b}
                    <button type="button" onClick={() => setMemForm(f => ({ ...f, benefits: f.benefits.filter((_, j) => j !== i) }))} className="hover:text-destructive leading-none">×</button>
                  </span>
                ))}
                <input
                  className="flex-1 min-w-[12rem] bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  value={memBenefitInput}
                  onChange={e => setMemBenefitInput(e.target.value)}
                  onKeyDown={e => {
                    if ((e.key === "Enter" || e.key === ",") && memBenefitInput.trim()) {
                      e.preventDefault();
                      setMemForm(f => ({ ...f, benefits: [...f.benefits, memBenefitInput.trim()] }));
                      setMemBenefitInput("");
                    } else if (e.key === "Backspace" && !memBenefitInput && memForm.benefits.length > 0) {
                      setMemForm(f => ({ ...f, benefits: f.benefits.slice(0, -1) }));
                    }
                  }}
                  placeholder={memForm.benefits.length === 0 ? "Type a benefit and press Enter or comma..." : ""}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Press Enter or comma to add each benefit. Backspace removes the last tag.</p>
            </div>
            <div className="space-y-2"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remarks / Terms</Label><textarea className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none transition-all" rows={2} value={memForm.remarks} onChange={e => setMemForm(f => ({ ...f, remarks: e.target.value }))} placeholder="e.g. Non-transferrable, non-refundable, non-sharable" /></div>
            <label className="flex items-center gap-3 text-sm font-medium text-foreground cursor-pointer select-none">
              <input type="checkbox" checked={memForm.isActive} onChange={e => setMemForm(f => ({ ...f, isActive: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              Active (visible to customers)
            </label>
          </div>
          <DialogFooter className="px-8 pb-8 pt-4 shrink-0 border-t border-border">
            <Button variant="outline" onClick={() => setShowMemDialog(false)}>Cancel</Button>
            <Button onClick={saveMem} disabled={createPkg.isPending || updatePkg.isPending || !memForm.name || !memForm.sessions || isNaN(parseInt(memForm.sessions)) || parseInt(memForm.sessions) < 1}>
              {(createPkg.isPending || updatePkg.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editMem ? "Save Changes" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Service Type Dialog */}
      <Dialog open={!!editSvcType || isNewSvcType} onOpenChange={closeSvcTypeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editSvcType ? "Edit Class Type" : "Add Class Type"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={svcForm.name} onChange={(e) => setSvcForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Reformer, Hot Pilates..." />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                rows={2}
                value={svcForm.description}
                onChange={(e) => setSvcForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this class type..."
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={svcForm.isActive} onChange={(e) => setSvcForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              Active (visible to customers)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeSvcTypeDialog}>Cancel</Button>
            <Button onClick={saveSvcType} disabled={createSvcType.isPending || updateSvcType.isPending}>
              {(createSvcType.isPending || updateSvcType.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editSvcType ? "Save Changes" : "Add Service Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirm */}
      <AlertDialog open={!!showBulkDeleteConfirm} onOpenChange={(o) => { if (!o && !isBulkDeleting) setShowBulkDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {showBulkDeleteConfirm === "all"
                ? `Delete all ${tab === "class-packages" ? filteredPackages.length : membershipPlans.length} ${tab === "class-packages" ? "packages" : "plans"}?`
                : `Delete ${selectedPkgIds.size} selected ${tab === "class-packages" ? "package" : "plan"}${selectedPkgIds.size !== 1 ? "s" : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Packages that have already been purchased by customers cannot be deleted and will be skipped. All others will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <Button
              onClick={handleBulkDeletePkgs}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {isBulkDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isBulkDeleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PackageManagement;
