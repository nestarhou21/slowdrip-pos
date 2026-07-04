import { useState } from "react";
import {
    UserPlus,
    Search,
    Mail,
    Phone,
    Shield,
    ShieldCheck,
    Edit2,
    CheckCircle2,
    XCircle,
    Loader2,
    Eye,
    EyeOff,
    AlertTriangle,
    UserCircle2,
    ShoppingBag,
    Calendar,
    Trash2,
} from "lucide-react";
import {
    Button,
    Input,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Label,
    Skeleton,
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
    cn,
    toast,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@repo/ui";
import { type ApiStaffMember, useApiStaff, useDeleteStaffMember, staffQueryKeys, api } from "@repo/store";
import { useQueryClient } from "@tanstack/react-query";


interface StaffManagementProps {
    currentUserId?: string | null;
}

const StaffManagement = ({ currentUserId = null }: StaffManagementProps) => {
    const qc = useQueryClient();
    const { data: staff = [], isLoading: loading } = useApiStaff();
    const deleteStaff = useDeleteStaffMember();

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<ApiStaffMember | null>(null);
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [confirmMember, setConfirmMember] = useState<ApiStaffMember | null>(null);

    // ── Bulk select state ──
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [showBulkConfirm, setShowBulkConfirm] = useState<"selected" | "all" | null>(null);

    // Form states
    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        password: "",
        role: "barista" as "admin" | "barista" | "receptionist" | "instructor"
    });


    const filteredStaff = staff.filter(s => {
        const fullName = `${s.first_name ?? ""} ${s.last_name ?? ""}`.toLowerCase();
        const q = searchQuery.toLowerCase();
        const matchesSearch = fullName.includes(q) || s.email.toLowerCase().includes(q);

        const matchesStatus = statusFilter === "all"
            || (statusFilter === "active" && s.is_active)
            || (statusFilter === "inactive" && !s.is_active);

        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.max(1, Math.ceil(filteredStaff.length / ITEMS_PER_PAGE));
    const paginatedStaff = filteredStaff.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // Count active admins so we can protect the last one
    const activeAdminCount = staff.filter(s => s.role === "admin" && s.is_active).length;
    const isLastActiveAdmin = (member: ApiStaffMember) =>
        member.role === "admin" && member.is_active && activeAdminCount <= 1;
    const isSelf = (member: ApiStaffMember) => member.id === currentUserId;

    // Deletable = not self, not last active admin
    const isDeletable = (member: ApiStaffMember) => !isSelf(member) && !isLastActiveAdmin(member);
    const deletableOnPage = paginatedStaff.filter(isDeletable);
    const allPageSelected = deletableOnPage.length > 0 && deletableOnPage.every(m => selectedIds.has(m.id));
    const somePageSelected = !allPageSelected && deletableOnPage.some(m => selectedIds.has(m.id));
    const togglePageSelection = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allPageSelected) deletableOnPage.forEach(m => next.delete(m.id));
            else deletableOnPage.forEach(m => next.add(m.id));
            return next;
        });
    };
    // All deletable staff across all filter results
    const allDeletableStaff = filteredStaff.filter(isDeletable);

    const handleBulkDelete = async () => {
        const ids = showBulkConfirm === "all"
            ? allDeletableStaff.map(m => m.id)
            : [...selectedIds];
        setBulkDeleting(true);
        const results = await Promise.allSettled(ids.map(id => deleteStaff.mutateAsync(id)));
        const failed = results.filter(r => r.status === "rejected").length;
        const succeeded = results.length - failed;
        await qc.invalidateQueries({ queryKey: staffQueryKeys.all });
        if (succeeded > 0) toast.success(`${succeeded} staff member${succeeded !== 1 ? "s" : ""} deleted.`);
        if (failed > 0) toast.error(`${failed} could not be deleted.`);
        setSelectedIds(new Set());
        setBulkDeleting(false);
        setShowBulkConfirm(null);
    };

    const getInitials = (firstName: string | null, lastName: string | null) => {
        return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
    };

    const handleOpenAdd = () => {
        setEditingStaff(null);
        setFormData({ first_name: "", last_name: "", email: "", phone: "", password: "", role: "barista" });
        setShowPassword(false);
        setIsStaffDialogOpen(true);
    };

    const handleOpenEdit = (member: ApiStaffMember) => {
        setEditingStaff(member);
        setFormData({
            first_name: member.first_name ?? "",
            last_name: member.last_name ?? "",
            email: member.email,
            phone: member.phone ?? "",
            password: "",
            role: member.role
        });
        setIsStaffDialogOpen(true);
    };

    const handleSaveStaff = async () => {
        if (!formData.first_name) {
            toast.error("First name is required");
            return;
        }

        if (formData.role !== 'instructor' && !formData.email) {
            toast.error("Email is required");
            return;
        }

        setSaving(true);

        try {
            if (editingStaff) {
                // Update existing user
                await api.put(`/admin/users/${editingStaff.id}`, {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    phone: formData.phone || null,
                    role: formData.role,
                });
                toast.success("Staff updated successfully");
            } else {
                // Create new staff/instructor user
                if (formData.role !== 'instructor' && (!formData.password || formData.password.length < 6)) {
                    toast.error("Password must be at least 6 characters");
                    setSaving(false);
                    return;
                }

                await api.post("/admin/users", {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    email: formData.email || `${formData.first_name.toLowerCase()}.${Date.now()}@instructor.local`, // dummy email for instructors if empty
                    phone: formData.phone || null,
                    password: formData.role === 'instructor' ? undefined : formData.password,
                    role: formData.role,
                });
                toast.success("Staff member created successfully");
            }
            setIsStaffDialogOpen(false);
            qc.invalidateQueries({ queryKey: staffQueryKeys.all });
        } catch (err: any) {
            const message = err?.body?.message ?? "Failed to save staff member";
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (member: ApiStaffMember) => {
        // For deactivation, show confirmation first
        if (member.is_active) {
            setConfirmMember(member);
            return;
        }
        // Activation is instant — no confirmation needed
        try {
            await api.post(`/admin/users/${member.id}/activate`);
            toast.success("Staff member activated");
            qc.invalidateQueries({ queryKey: staffQueryKeys.all });
        } catch (err: any) {
            toast.error(err?.body?.message ?? "Failed to activate staff member");
        }
    };

    const handleConfirmDeactivate = async () => {
        if (!confirmMember) return;
        const member = confirmMember;
        setConfirmMember(null);
        try {
            await api.post(`/admin/users/${member.id}/deactivate`);
            toast.success(`${member.first_name} ${member.last_name} has been deactivated`);
            qc.invalidateQueries({ queryKey: staffQueryKeys.all });
        } catch (err: any) {
            toast.error(err?.body?.message ?? "Failed to deactivate staff member");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Staff Management</h2>
                    <p className="text-muted-foreground">Manage your team members and their roles in a clear list view.</p>
                </div>
                <div className="flex items-center gap-2">
                    {allDeletableStaff.length > 0 && (
                        <Button variant="outline" onClick={() => setShowBulkConfirm("all")} className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                            Delete All ({allDeletableStaff.length})
                        </Button>
                    )}
                    <Button onClick={handleOpenAdd} className="gap-2">
                        <UserPlus className="h-4 w-4" />
                        Add New Staff
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search staff by name or email..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/30">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setStatusFilter("active"); setCurrentPage(1); }}
                        className={cn(
                            "h-8 px-3 text-xs font-medium transition-all",
                            statusFilter === "active" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Active
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setStatusFilter("inactive"); setCurrentPage(1); }}
                        className={cn(
                            "h-8 px-3 text-xs font-medium transition-all",
                            statusFilter === "inactive" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Inactive
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}
                        className={cn(
                            "h-8 px-3 text-xs font-medium transition-all",
                            statusFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        All
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-border bg-muted/30">
                                <tr>
                                    <th className="px-6 py-4"><Skeleton className="h-4 w-16" /></th>
                                    <th className="px-6 py-4"><Skeleton className="h-4 w-20" /></th>
                                    <th className="px-6 py-4"><Skeleton className="h-4 w-12" /></th>
                                    <th className="px-6 py-4"><Skeleton className="h-4 w-14" /></th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <Skeleton className="h-10 w-10 rounded-full" />
                                                <Skeleton className="h-4 w-32" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-2">
                                                <Skeleton className="h-3 w-40" />
                                                <Skeleton className="h-3 w-28" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4"><Skeleton className="h-4 w-14" /></td>
                                        <td className="px-6 py-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-1">
                                                <Skeleton className="h-8 w-8 rounded-md" />
                                                <Skeleton className="h-8 w-8 rounded-md" />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
            <>
            {selectedIds.size > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
                    <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} className="h-8 text-xs">Clear</Button>
                        <Button size="sm" onClick={() => setShowBulkConfirm("selected")} className="h-8 gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs">
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Selected ({selectedIds.size})
                        </Button>
                    </div>
                </div>
            )}
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
                                <th className="px-6 py-4 font-semibold text-muted-foreground">Name</th>
                                <th className="px-6 py-4 font-semibold text-muted-foreground">Contact</th>
                                <th className="px-6 py-4 font-semibold text-muted-foreground">Role</th>
                                <th className="px-6 py-4 font-semibold text-muted-foreground">Status</th>
                                <th className="px-6 py-4 text-right font-semibold text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {paginatedStaff.map((member) => (
                                <tr key={member.id} className={cn("group transition-colors hover:bg-muted/30", selectedIds.has(member.id) && "bg-primary/5")}>
                                    <td className="w-10 px-6 py-4">
                                        {isDeletable(member) ? (
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(member.id)}
                                                onChange={() => setSelectedIds(prev => { const n = new Set(prev); n.has(member.id) ? n.delete(member.id) : n.add(member.id); return n; })}
                                                className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                                            />
                                        ) : (
                                            <span className="block h-4 w-4" />
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xs">
                                                {getInitials(member.first_name, member.last_name)}
                                            </div>
                                            <span className="font-medium text-foreground">{member.first_name} {member.last_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                                <Mail className="h-3 w-3" />
                                                <span>{member.role === 'instructor' ? 'No Login Access' : member.email}</span>
                                            </div>
                                            {member.phone && (
                                            <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                                <Phone className="h-3 w-3" />
                                                <span>{member.phone}</span>
                                            </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 font-medium">
                                            {member.role === "admin" ? (
                                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                                            ) : member.role === "barista" ? (
                                                <ShoppingBag className="h-3.5 w-3.5 text-amber-500" />
                                            ) : member.role === "receptionist" ? (
                                                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                                            ) : (
                                                <UserCircle2 className="h-3.5 w-3.5 text-violet-400" />
                                            )}
                                            <span className="capitalize">{member.role}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={cn(
                                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                            member.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {member.is_active ? "active" : "inactive"}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            {/* Deactivate / Activate */}
                                            {(() => {
                                                const locked = member.is_active && (isSelf(member) || isLastActiveAdmin(member));
                                                const title = isSelf(member)
                                                    ? "You cannot deactivate your own account"
                                                    : isLastActiveAdmin(member)
                                                    ? "Cannot deactivate the last active admin"
                                                    : member.is_active ? "Deactivate" : "Activate";
                                                return (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className={cn(
                                                                    "h-8 w-8",
                                                                    locked
                                                                        ? "cursor-not-allowed text-muted-foreground/30"
                                                                        : "text-muted-foreground hover:text-foreground"
                                                                )}
                                                                disabled={locked}
                                                                onClick={() => !locked && handleToggleStatus(member)}
                                                            >
                                                                {member.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>{title}</TooltipContent>
                                                    </Tooltip>
                                                );
                                            })()}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        onClick={() => handleOpenEdit(member)}
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Edit staff</TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredStaff.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        No staff members found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {filteredStaff.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-between border-t border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredStaff.length)} of {filteredStaff.length}
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
            </>
            )}

            {/* Bulk Delete Confirm */}
            <AlertDialog open={!!showBulkConfirm} onOpenChange={(o) => { if (!o && !bulkDeleting) setShowBulkConfirm(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete {showBulkConfirm === "all" ? `all ${allDeletableStaff.length}` : selectedIds.size} staff member{(showBulkConfirm === "all" ? allDeletableStaff.length : selectedIds.size) !== 1 ? "s" : ""}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete {showBulkConfirm === "all" ? "all deletable staff members" : `${selectedIds.size} selected member${selectedIds.size !== 1 ? "s" : ""}`} and remove their login access. This cannot be undone.
                        </AlertDialogDescription>
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

            {/* Staff Dialog (Add/Edit) */}
            <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add New Staff Member"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>First Name</Label>
                                <Input
                                    placeholder="John"
                                    value={formData.first_name}
                                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Last Name</Label>
                                <Input
                                    placeholder="Doe"
                                    value={formData.last_name}
                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                />
                            </div>
                        </div>
                        {formData.role !== 'instructor' && (
                            <div className="space-y-2">
                                <Label>Email Address</Label>
                                <Input
                                    type="email"
                                    placeholder="john@slowdrip.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    disabled={!!editingStaff}
                                />
                            </div>
                        )}
                        {(!editingStaff && formData.role !== 'instructor') && (
                        <div className="space-y-2">
                            <Label>Password</Label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Min 6 characters"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        )}
                        <div className="space-y-2">
                            <Label>Phone Number</Label>
                            <Input
                                placeholder="012-345-678"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            {editingStaff && isLastActiveAdmin(editingStaff) ? (
                                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    <span>Cannot demote — this is the last active admin.</span>
                                </div>
                            ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setFormData({ ...formData, role: "barista" })}
                                    disabled={!!(editingStaff && isSelf(editingStaff))}
                                    className={cn(
                                        "rounded-lg border p-3 text-center transition-all",
                                        formData.role === "barista" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-border text-muted-foreground hover:bg-muted",
                                        editingStaff && isSelf(editingStaff) && "cursor-not-allowed opacity-40"
                                    )}
                                >
                                    <ShoppingBag className="mx-auto mb-1 h-4 w-4" />
                                    <div className="text-sm font-medium">Barista</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">POS access</div>
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, role: "receptionist" })}
                                    disabled={!!(editingStaff && isSelf(editingStaff))}
                                    className={cn(
                                        "rounded-lg border p-3 text-center transition-all",
                                        formData.role === "receptionist" ? "border-blue-400 bg-blue-50 text-blue-700" : "border-border text-muted-foreground hover:bg-muted",
                                        editingStaff && isSelf(editingStaff) && "cursor-not-allowed opacity-40"
                                    )}
                                >
                                    <Calendar className="mx-auto mb-1 h-4 w-4" />
                                    <div className="text-sm font-medium">Receptionist</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">Wellness access</div>
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, role: "instructor" })}
                                    disabled={!!(editingStaff && isSelf(editingStaff))}
                                    className={cn(
                                        "rounded-lg border p-3 text-center transition-all",
                                        formData.role === "instructor" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted",
                                        editingStaff && isSelf(editingStaff) && "cursor-not-allowed opacity-40"
                                    )}
                                >
                                    <UserCircle2 className="mx-auto mb-1 h-4 w-4" />
                                    <div className="text-sm font-medium">Instructor</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">No login</div>
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, role: "admin" })}
                                    className={cn(
                                        "rounded-lg border p-3 text-center transition-all",
                                        formData.role === "admin" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    <ShieldCheck className="mx-auto mb-1 h-4 w-4" />
                                    <div className="text-sm font-medium">Admin</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">Full access</div>
                                </button>
                            </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsStaffDialogOpen(false)} disabled={saving}>Cancel</Button>
                        <Button onClick={handleSaveStaff} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingStaff ? "Save Changes" : "Add Staff Member"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Deactivate confirmation dialog */}
            <AlertDialog open={!!confirmMember} onOpenChange={(open) => !open && setConfirmMember(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate Staff Member?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-medium text-foreground">
                                {confirmMember?.first_name} {confirmMember?.last_name}
                            </span>{" "}
                            will no longer be able to log in. You can reactivate them at any time.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleConfirmDeactivate}
                        >
                            Deactivate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default StaffManagement;
