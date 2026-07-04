import { useMemo, useRef, useState } from "react";
import {
    useInventoryItems,
    useAddInventoryItem,
    useUpdateInventoryItem,
    useRestockItem,
    useRecordUsage,
    useDeleteInventoryItem,
    uploadInventoryImage,
    type InventoryItem,
    type InventoryCategory,
} from "@repo/store";
import { cn, toast } from "@repo/ui";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { Label } from "@repo/ui";
import {
    Plus, RefreshCw, PackageOpen, AlertTriangle, Pencil, Trash2, X, Check,
    ArrowDownToLine, ArrowUpFromLine, Search, Coffee, Milk, Droplets,
    CupSoda, Wrench, Package, DollarSign, ImagePlus, Loader2,
} from "lucide-react";

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES: { key: InventoryCategory; label: string; Icon: typeof Coffee }[] = [
    { key: "beans",     label: "Beans",            Icon: Coffee },
    { key: "milk",      label: "Milk & Dairy",     Icon: Milk },
    { key: "syrups",    label: "Syrups",           Icon: Droplets },
    { key: "cups",      label: "Cups & Packaging", Icon: CupSoda },
    { key: "equipment", label: "Equipment",        Icon: Wrench },
    { key: "other",     label: "Other",            Icon: Package },
];

const categoryMeta = (key: string) =>
    CATEGORIES.find(c => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR = (item: InventoryItem) => {
    if (item.current_balance === 0) return "bg-red-100 text-red-700";
    if (item.is_low_stock) return "bg-amber-100 text-amber-700";
    return "bg-emerald-100 text-emerald-700";
};

const STATUS_LABEL = (item: InventoryItem) => {
    if (item.current_balance === 0) return "Out of Stock";
    if (item.is_low_stock) return "Low Stock";
    return "In Stock";
};

const stockPercent = (item: InventoryItem) => {
    if (item.starting_stock <= 0) return 0;
    return Math.min(100, Math.round((item.current_balance / item.starting_stock) * 100));
};

const BAR_COLOR = (item: InventoryItem) => {
    if (item.current_balance === 0) return "bg-red-500";
    if (item.is_low_stock) return "bg-amber-500";
    return "bg-emerald-500";
};

// ─── Quick-action modal (restock / record usage) ──────────────────────────────

interface QuickModalProps {
    item: InventoryItem;
    mode: "restock" | "usage";
    onClose: () => void;
}

function QuickModal({ item, mode, onClose }: QuickModalProps) {
    const [amount, setAmount] = useState("");
    const restock = useRestockItem();
    const recordUsage = useRecordUsage();
    const busy = restock.isPending || recordUsage.isPending;

    const submit = async () => {
        const val = parseFloat(amount);
        if (!val || val <= 0) { toast.error("Enter a valid amount"); return; }
        try {
            if (mode === "restock") {
                await restock.mutateAsync({ id: item.id, amount: val });
                toast.success(`Restocked ${val} ${item.unit} of ${item.name}`);
            } else {
                await recordUsage.mutateAsync({ id: item.id, amount: val });
                toast.success(`Recorded ${val} ${item.unit} used for ${item.name}`);
            }
            onClose();
        } catch {
            toast.error("Action failed. Try again.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-foreground text-base">
                        {mode === "restock" ? "Restock" : "Record Usage"} — {item.name}
                    </h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                    Current balance: <span className="font-bold text-foreground">{item.current_balance} {item.unit}</span>
                </p>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                        Amount ({item.unit})
                    </Label>
                    <Input
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder={`e.g. 10`}
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && submit()}
                        autoFocus
                        className="h-9 text-sm"
                    />
                </div>
                <div className="flex gap-2 mt-5">
                    <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        className={cn("flex-1", mode === "usage" ? "bg-amber-500 hover:bg-amber-600 text-white" : "")}
                        onClick={submit}
                        disabled={busy}
                    >
                        {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : mode === "restock" ? "Add Stock" : "Record Used"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Add / Edit Item Form ─────────────────────────────────────────────────────

const UNITS = ["pcs", "bags", "g", "kg", "ml", "liters", "bottles", "boxes"];

interface ItemFormProps {
    initial?: InventoryItem;
    onClose: () => void;
}

function ItemForm({ initial, onClose }: ItemFormProps) {
    const add = useAddInventoryItem();
    const update = useUpdateInventoryItem();
    const busy = add.isPending || update.isPending;

    const [name, setName] = useState(initial?.name ?? "");
    const [category, setCategory] = useState<InventoryCategory>(initial?.category ?? "other");
    const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
    const [uploading, setUploading] = useState(false);
    const [unit, setUnit] = useState(initial?.unit ?? "pcs");
    const [startingStock, setStartingStock] = useState(String(initial?.starting_stock ?? ""));
    const [used, setUsed] = useState(String(initial?.used ?? "0"));
    const [threshold, setThreshold] = useState(String(initial?.low_stock_threshold ?? ""));
    const [costPerUnit, setCostPerUnit] = useState(initial?.cost_per_unit != null ? String(initial.cost_per_unit) : "");
    const [notes, setNotes] = useState(initial?.notes ?? "");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageSelect = async (file: File | undefined) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) { toast.error("Please select an image file."); return; }
        if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB."); return; }
        setUploading(true);
        try {
            const url = await uploadInventoryImage(file);
            setImageUrl(url);
        } catch (err: any) {
            toast.error(err?.message ?? "Failed to upload image.");
        } finally {
            setUploading(false);
        }
    };

    const submit = async () => {
        if (!name.trim()) { toast.error("Item name is required"); return; }
        const ss = parseFloat(startingStock);
        if (isNaN(ss) || ss < 0) { toast.error("Starting stock must be a number ≥ 0"); return; }

        const payload = {
            name: name.trim(),
            category,
            image_url: imageUrl || null,
            unit,
            starting_stock: ss,
            used: parseFloat(used) || 0,
            low_stock_threshold: threshold ? parseFloat(threshold) : null,
            cost_per_unit: costPerUnit ? parseFloat(costPerUnit) : null,
            notes: notes.trim() || undefined,
        };

        try {
            if (initial) {
                await update.mutateAsync({ id: initial.id, ...payload });
                toast.success("Item updated");
            } else {
                await add.mutateAsync(payload);
                toast.success("Item added");
            }
            onClose();
        } catch {
            toast.error("Failed to save. Try again.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-semibold text-foreground text-base">
                        {initial ? "Edit Item" : "Add Inventory Item"}
                    </h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Image picker */}
                    <div className="flex items-center gap-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => handleImageSelect(e.target.files?.[0])}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="relative h-20 w-20 shrink-0 rounded-xl border-2 border-dashed border-border bg-muted/30 hover:border-primary/50 transition-colors overflow-hidden flex items-center justify-center"
                        >
                            {uploading ? (
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            ) : imageUrl ? (
                                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <ImagePlus className="h-5 w-5 text-muted-foreground" />
                            )}
                        </button>
                        <div className="text-left">
                            <p className="text-sm font-medium text-foreground">Item Photo</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Optional — shown on the card. Max 5MB.</p>
                            {imageUrl && (
                                <button
                                    type="button"
                                    onClick={() => setImageUrl("")}
                                    className="mt-1 text-xs text-red-500 hover:underline"
                                >
                                    Remove photo
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Item Name *</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} className="h-9 text-sm" placeholder="e.g. Coffee Beans" autoFocus />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Category *</Label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value as InventoryCategory)}
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                            >
                                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Unit *</Label>
                            <select
                                value={unit}
                                onChange={e => setUnit(e.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                            >
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Starting Stock *</Label>
                            <Input type="number" min="0" step="any" value={startingStock} onChange={e => setStartingStock(e.target.value)} className="h-9 text-sm" placeholder="0" />
                        </div>
                        {initial && (
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Used</Label>
                                <Input type="number" min="0" step="any" value={used} onChange={e => setUsed(e.target.value)} className="h-9 text-sm" placeholder="0" />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Low Stock Alert (optional)</Label>
                            <Input type="number" min="0" step="any" value={threshold} onChange={e => setThreshold(e.target.value)} className="h-9 text-sm" placeholder="e.g. 10" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Cost per Unit $ (optional)</Label>
                            <Input type="number" min="0" step="any" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value)} className="h-9 text-sm" placeholder="e.g. 12.50" />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                            <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-9 text-sm" placeholder="e.g. 1kg bag" />
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mt-5">
                    <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={busy || uploading}>Cancel</Button>
                    <Button size="sm" className="flex-1" onClick={submit} disabled={busy || uploading}>
                        {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                        {initial ? "Save Changes" : "Add Item"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

interface ItemCardProps {
    item: InventoryItem;
    onRestock: () => void;
    onUsage: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

function ItemCard({ item, onRestock, onUsage, onEdit, onDelete }: ItemCardProps) {
    const { Icon } = categoryMeta(item.category);
    const pct = stockPercent(item);

    return (
        <div className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all flex flex-col">
            {/* Image */}
            <div className="relative h-32 bg-muted/40">
                {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center">
                        <Icon className="h-10 w-10 text-muted-foreground/25" />
                    </div>
                )}
                <span className={cn(
                    "absolute top-2.5 right-2.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-sm",
                    STATUS_COLOR(item)
                )}>
                    {STATUS_LABEL(item)}
                </span>
                {/* Edit / delete — appear on hover */}
                <div className="absolute top-2.5 left-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        title="Edit"
                        onClick={onEdit}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-slate-600 shadow-sm hover:bg-white transition-colors"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                        title="Delete"
                        onClick={onDelete}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-red-500 shadow-sm hover:bg-white transition-colors"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Icon className="h-3 w-3" />
                            {categoryMeta(item.category).label}
                            {item.notes && <span className="truncate"> · {item.notes}</span>}
                        </p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-foreground leading-none tabular-nums">{item.current_balance}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.unit} left</p>
                    </div>
                </div>

                {/* Stock bar */}
                <div className="mt-3">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", BAR_COLOR(item))} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground tabular-nums">
                        <span>Used: {item.used} {item.unit}</span>
                        <span>
                            {item.stock_value != null
                                ? `Value: $${item.stock_value.toFixed(2)}`
                                : `Total: ${item.starting_stock} ${item.unit}`}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-auto pt-3 grid grid-cols-2 gap-2">
                    <button
                        onClick={onRestock}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-all active:scale-95"
                    >
                        <ArrowDownToLine className="h-3.5 w-3.5" />
                        Restock
                    </button>
                    <button
                        onClick={onUsage}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-all active:scale-95"
                    >
                        <ArrowUpFromLine className="h-3.5 w-3.5" />
                        Use
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const InventoryPage = () => {
    const { data: items = [], isLoading, refetch } = useInventoryItems();
    const deleteItem = useDeleteInventoryItem();

    const [quickModal, setQuickModal] = useState<{ item: InventoryItem; mode: "restock" | "usage" } | null>(null);
    const [formModal, setFormModal] = useState<{ item?: InventoryItem } | null>(null);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<"all" | InventoryCategory>("all");

    const lowCount = items.filter(i => i.is_low_stock && i.current_balance > 0).length;
    const outCount = items.filter(i => i.current_balance === 0).length;
    const totalValue = items.reduce((sum, i) => sum + (i.stock_value ?? 0), 0);

    const filtered = useMemo(() => {
        return items.filter(i => {
            const matchCat = activeCategory === "all" || i.category === activeCategory;
            const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
            return matchCat && matchSearch;
        });
    }, [items, activeCategory, search]);

    // Show categories that have items, in fixed order
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        items.forEach(i => { counts[i.category] = (counts[i.category] ?? 0) + 1; });
        return counts;
    }, [items]);

    const handleDelete = async (item: InventoryItem) => {
        if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
        try {
            await deleteItem.mutateAsync(item.id);
            toast.success(`"${item.name}" deleted`);
        } catch {
            toast.error("Failed to delete");
        }
    };

    const stats = [
        { label: "Total Items",  value: String(items.length),           Icon: PackageOpen,   iconClass: "bg-primary/10 text-primary" },
        { label: "Stock Value",  value: `$${totalValue.toFixed(2)}`,    Icon: DollarSign,    iconClass: "bg-emerald-100 text-emerald-600" },
        { label: "Low Stock",    value: String(lowCount),               Icon: AlertTriangle, iconClass: "bg-amber-100 text-amber-600" },
        { label: "Out of Stock", value: String(outCount),               Icon: PackageOpen,   iconClass: "bg-red-100 text-red-600" },
    ];

    return (
        <div className="space-y-6 text-left">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="font-display text-2xl font-bold text-foreground">Inventory</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Track beans, cups, milk and everything in between</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => refetch()}
                        disabled={isLoading}
                        className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted/80 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        Refresh
                    </button>
                    <button
                        onClick={() => setFormModal({})}
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
                    >
                        <Plus className="h-4 w-4" />
                        Add Item
                    </button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map(({ label, value, Icon, iconClass }) => (
                    <div key={label} className="rounded-xl border border-border bg-card p-5">
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconClass)}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <p className="mt-4 text-sm font-medium text-muted-foreground">{label}</p>
                        <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{value}</p>
                    </div>
                ))}
            </div>

            {/* Search + category filter */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 max-w-sm min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search items..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 h-11 rounded-xl"
                    />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    <button
                        onClick={() => setActiveCategory("all")}
                        className={cn(
                            "rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all border shrink-0",
                            activeCategory === "all"
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-card text-muted-foreground border-border hover:bg-muted"
                        )}
                    >
                        All ({items.length})
                    </button>
                    {CATEGORIES.map(({ key, label, Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveCategory(key)}
                            className={cn(
                                "flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all border shrink-0",
                                activeCategory === key
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                            {categoryCounts[key] ? ` (${categoryCounts[key]})` : ""}
                        </button>
                    ))}
                </div>
            </div>

            {/* Card grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
                            <div className="h-32 bg-muted animate-pulse" />
                            <div className="p-4 space-y-3">
                                <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                                <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                                <div className="h-1.5 w-full rounded bg-muted animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-muted/30 rounded-3xl border-2 border-dashed border-border text-center">
                    <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <PackageOpen className="h-8 w-8 text-primary" />
                    </div>
                    <p className="font-bold text-foreground">
                        {items.length === 0 ? "No inventory items yet" : "No items match your filters"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {items.length === 0 ? "Add your first item to start tracking stock." : "Try a different search or category."}
                    </p>
                    {items.length === 0 && (
                        <Button size="sm" className="mt-5 gap-2" onClick={() => setFormModal({})}>
                            <Plus className="h-4 w-4" /> Add Item
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map(item => (
                        <ItemCard
                            key={item.id}
                            item={item}
                            onRestock={() => setQuickModal({ item, mode: "restock" })}
                            onUsage={() => setQuickModal({ item, mode: "usage" })}
                            onEdit={() => setFormModal({ item })}
                            onDelete={() => handleDelete(item)}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            {quickModal && (
                <QuickModal
                    item={quickModal.item}
                    mode={quickModal.mode}
                    onClose={() => setQuickModal(null)}
                />
            )}
            {formModal !== null && (
                <ItemForm
                    initial={formModal.item}
                    onClose={() => setFormModal(null)}
                />
            )}
        </div>
    );
};

export default InventoryPage;
