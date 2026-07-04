import { useState, useMemo, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Package, X, ToggleLeft, ToggleRight, AlertCircle, Upload, Loader2, Tag, Globe } from "lucide-react";
import {
  useApiCategories, useApiProducts, useApiProduct, useCreateProduct, useUpdateProduct, useDeleteProduct, useCreateCategory,
  useUpdateCategory, useDeleteCategory,
  useApiSizes, useCreateSize, useUpdateSize, useDeleteSize, useSyncProductVariants,
  useSyncProductAddons,
  uploadProductImage, deleteProductImage,
  productQueryKeys, categoryQueryKeys, sizeQueryKeys,
  type ApiProduct, type ApiCategory, type CafeSize,
} from "@repo/store";
import { cn, Skeleton, Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui";
import { Input } from "@repo/ui";
import { Button } from "@repo/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@repo/ui";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@repo/ui";
import { Label } from "@repo/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { toast } from "sonner";

interface FormData {
  name: string;
  price: string;
  categoryId: string;
  description: string;
  imageUrl: string;
  isAvailable: boolean;
  showOnWebsite: boolean;
}

interface SelectedVariant {
  size_id: string;
  price: string;
  is_available: boolean;
}

const DEFAULT_FORM: FormData = {
  name: "", price: "", categoryId: "", description: "", imageUrl: "", isAvailable: true, showOnWebsite: true,
};

const ProductManagement = () => {
  const { data: categoriesRaw = [], isLoading: catsLoading } = useApiCategories();
  const categories = categoriesRaw as ApiCategory[];
  const [catFilter, setCatFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const { data: allProductsRaw = [], isLoading: prodsLoading, error: prodsError } = useApiProducts();
  const allProducts = allProductsRaw as ApiProduct[];

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { data: allSizesRaw = [] } = useApiSizes();
  const allSizes = allSizesRaw as CafeSize[];
  const createSize = useCreateSize();
  const updateSize = useUpdateSize();
  const deleteSize = useDeleteSize();
  const syncProductVariants = useSyncProductVariants();
  const syncProductAddons = useSyncProductAddons();
  const qc = useQueryClient();

  // ── Product dialog state ──
  const [editItem, setEditItem] = useState<ApiProduct | null>(null);
  const [isNewDialog, setIsNewDialog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ApiProduct | null>(null);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [newCatName, setNewCatName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Variant / addon draft state ──
  const [hasVariants, setHasVariants] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<SelectedVariant[]>([]);
  const [productType, setProductType] = useState<'drink' | 'snack' | 'addon'>('drink');
  const [selectedAddonProductIds, setSelectedAddonProductIds] = useState<string[]>([]);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const { data: freshProduct } = useApiProduct(editProductId);

  // ── Category management dialog state ──
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ApiCategory | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<ApiCategory | null>(null);
  const [deletingCat, setDeletingCat] = useState(false);
  const [savingCat, setSavingCat] = useState(false);

  // ── Size management dialog state ──
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<CafeSize | null>(null);
  const [editingSizeName, setEditingSizeName] = useState("");
  const [confirmDeleteSize, setConfirmDeleteSize] = useState<CafeSize | null>(null);
  const [deletingSize, setDeletingSize] = useState(false);
  const [savingSize, setSavingSize] = useState(false);
  const [newSizeName, setNewSizeName] = useState("");
  const [addingSize, setAddingSize] = useState(false);

  // ── Bulk select state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState<"selected" | "all" | null>(null);

  const filtered = useMemo(() => {
    return allProducts.filter((p) => {
      if (p.type === 'addon') return false; // addon type no longer used
      const matchCat = catFilter === "all" || p.category_id === catFilter;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allProducts, search, catFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedProducts = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const allPageSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedIds.has(p.id));
  const somePageSelected = !allPageSelected && paginatedProducts.some(p => selectedIds.has(p.id));

  const togglePageSelection = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) paginatedProducts.forEach(p => next.delete(p.id));
      else paginatedProducts.forEach(p => next.add(p.id));
      return next;
    });
  };

  // Reset page when filters change
  const handleCatFilterChange = (val: string) => { setCatFilter(val); setCurrentPage(1); setSelectedIds(new Set()); };
  const handleSearchChange = (val: string) => { setSearch(val); setCurrentPage(1); setSelectedIds(new Set()); };

  // ── Variant helpers ──
  const toggleVariantSize = (sizeId: string) => {
    setSelectedVariants(vs => {
      const exists = vs.find(v => v.size_id === sizeId);
      if (exists) return vs.filter(v => v.size_id !== sizeId);
      return [...vs, { size_id: sizeId, price: "", is_available: true }];
    });
  };
  const updateVariantField = (sizeId: string, changes: Partial<SelectedVariant>) =>
    setSelectedVariants(vs => vs.map(v => v.size_id === sizeId ? { ...v, ...changes } : v));

  // When fresh product loads (edit mode), populate variants + selected addons
  useEffect(() => {
    if (!freshProduct) return;
    setHasVariants(freshProduct.has_variants);
    setProductType(freshProduct.type);
    setSelectedVariants(freshProduct.variants.map(v => ({
      size_id: v.size_id,
      price: v.price,
      is_available: v.is_available,
    })));
    setSelectedAddonProductIds(freshProduct.linked_addons.map(a => a.id));
  }, [freshProduct]);

  const openNew = () => {
    const firstCat = categories.find((c) => c.is_active);
    setFormData({ ...DEFAULT_FORM, categoryId: firstCat?.id ?? "" });
    setShowNewCat(false);
    setNewCatName("");
    setUploading(false);
    setHasVariants(false);
    setSelectedVariants([]);
    setProductType('drink');
    setSelectedAddonProductIds([]);
    setEditProductId(null);
    setIsNewDialog(true);
  };

  const openEdit = (p: ApiProduct) => {
    setFormData({
      name: p.name,
      price: p.base_price,
      categoryId: p.category_id,
      description: p.description ?? "",
      imageUrl: p.image_url ?? "",
      isAvailable: p.is_available,
      showOnWebsite: p.show_on_website ?? true,
    });
    setShowNewCat(false);
    setNewCatName("");
    setUploading(false);
    // Seed from list data immediately; useEffect will overwrite with fresh data
    setHasVariants(p.has_variants);
    setProductType(p.type);
    setSelectedVariants(p.variants.map(v => ({ size_id: v.size_id, price: v.price, is_available: v.is_available })));
    setSelectedAddonProductIds(p.linked_addons.map(a => a.id));
    setEditProductId(p.id);
    setEditItem(p);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate type and size (<5 MB)
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be smaller than 5 MB."); return; }
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      setFormData((f) => ({ ...f, imageUrl: url }));
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to upload image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = async () => {
    if (formData.imageUrl) {
      // Best-effort delete from storage; don't block the user if it fails
      deleteProductImage(formData.imageUrl).catch(() => { });
    }
    setFormData((f) => ({ ...f, imageUrl: "" }));
  };

  const closeDialog = () => {
    setEditItem(null); setIsNewDialog(false); setShowNewCat(false); setUploading(false);
    setHasVariants(false); setSelectedVariants([]); setProductType('drink'); setSelectedAddonProductIds([]); setEditProductId(null);
  };

  const saveItem = async () => {
    const finalPrice = parseFloat(formData.price);

    if (isNaN(finalPrice) || finalPrice < 0) {
      toast.error("Please enter a valid price."); return;
    }

    let categoryId = formData.categoryId;

    if (showNewCat) {
      if (!newCatName.trim()) { toast.error("Enter a category name."); return; }
      setSaving(true);
      try {
        const res = await createCategory.mutateAsync({ name: newCatName.trim() });
        categoryId = res.data.id;
      } catch {
        toast.error("Failed to create category.");
        setSaving(false);
        return;
      }
    }

    if (!categoryId) { toast.error("Please select a category."); setSaving(false); return; }

    const body = {
      name: formData.name.trim(),
      category_id: categoryId,
      type: productType,
      description: formData.description.trim() || undefined,
      image_url: formData.imageUrl.trim() || undefined,
      base_price: finalPrice,
      is_available: formData.isAvailable,
      show_on_website: formData.showOnWebsite,
      has_variants: false,
    };

    setSaving(true);
    try {
      let productId: string;
      const isEdit = !!editItem;
      if (editItem) {
        await updateProduct.mutateAsync({ id: editItem.id, ...body });
        productId = editItem.id;
      } else {
        const res = await createProduct.mutateAsync(body);
        productId = res.data.id;
      }

      // Determine what actually needs syncing and fire in parallel
      const hadVariants = editItem?.has_variants ?? false;
      const hadAddons = (editItem?.linked_addons.length ?? 0) > 0;
      const needsVariantSync = hasVariants || hadVariants;
      const needsAddonSync = productType === 'drink' && (selectedAddonProductIds.length > 0 || hadAddons);

      const syncs: Promise<unknown>[] = [];
      if (needsVariantSync) {
        syncs.push(syncProductVariants.mutateAsync({
          productId,
          variants: selectedVariants.map(v => ({
            size_id: v.size_id,
            price: parseFloat(v.price),
            is_available: v.is_available,
          })),
        }));
      }
      if (needsAddonSync) {
        syncs.push(syncProductAddons.mutateAsync({ productId, addonProductIds: selectedAddonProductIds }));
      }
      if (syncs.length > 0) await Promise.all(syncs);

      // Invalidate queries in background and close immediately for 'instant' feel
      qc.invalidateQueries({ queryKey: productQueryKeys.all });
      toast.success(isEdit ? "Product updated." : "Product created.");
      closeDialog();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      // Delete image from storage before removing the DB record
      if (confirmDelete.image_url) {
        try {
          await deleteProductImage(confirmDelete.image_url);
        } catch (imgErr: any) {
          // Log but don't block — product still gets deleted from DB
          console.error("Storage delete failed:", imgErr?.message, "URL:", confirmDelete.image_url);
          toast.warning("Product deleted but image removal failed: " + (imgErr?.message ?? "unknown error"));
        }
      }
      await deleteProduct.mutateAsync(confirmDelete.id);
      await qc.refetchQueries({ queryKey: productQueryKeys.all });
      toast.success("Product deleted.");
      setConfirmDelete(null);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete product.");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = showBulkConfirm === "all" ? filtered.map(p => p.id) : [...selectedIds];
    setBulkDeleting(true);
    const results = await Promise.allSettled(ids.map(async id => {
      const prod = allProducts.find(p => p.id === id);
      if (prod?.image_url) { try { await deleteProductImage(prod.image_url); } catch { } }
      return deleteProduct.mutateAsync(id);
    }));
    const failed = results.filter(r => r.status === "rejected").length;
    const succeeded = results.length - failed;
    await qc.refetchQueries({ queryKey: productQueryKeys.all });
    if (succeeded > 0) toast.success(`${succeeded} product${succeeded !== 1 ? "s" : ""} deleted.`);
    if (failed > 0) toast.error(`${failed} failed to delete.`);
    setSelectedIds(new Set());
    setBulkDeleting(false);
    setShowBulkConfirm(null);
  };

  const handleDeleteCategory = async () => {
    if (!confirmDeleteCat) return;
    setDeletingCat(true);
    try {
      await deleteCategory.mutateAsync(confirmDeleteCat.id);
      await Promise.all([
        qc.refetchQueries({ queryKey: categoryQueryKeys.all }),
        qc.refetchQueries({ queryKey: productQueryKeys.all }),
      ]);
      toast.success(`"${confirmDeleteCat.name}" deleted.`);
      setConfirmDeleteCat(null);
      if (catFilter === confirmDeleteCat.id) setCatFilter("all");
    } catch (err: any) {
      // Backend returns 422 when the category still has products
      const msg = err?.body?.message ?? err?.message ?? "Failed to delete category.";
      toast.error(msg);
    } finally {
      setDeletingCat(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!editingCat || !editingCatName.trim()) return;
    setSavingCat(true);
    try {
      await updateCategory.mutateAsync({ id: editingCat.id, name: editingCatName.trim() });
      await qc.refetchQueries({ queryKey: categoryQueryKeys.all });
      toast.success("Category renamed.");
      setEditingCat(null);
    } catch (err: any) {
      toast.error(err?.body?.message ?? err?.message ?? "Failed to rename category.");
    } finally {
      setSavingCat(false);
    }
  };

  const handleAddSize = async () => {
    if (!newSizeName.trim()) { toast.error("Enter a size name."); return; }
    setAddingSize(true);
    try {
      await createSize.mutateAsync({ name: newSizeName.trim(), sort_order: allSizes.length });
      await qc.refetchQueries({ queryKey: sizeQueryKeys.all });
      setNewSizeName("");
      toast.success("Size created.");
    } catch (err: any) {
      toast.error(err?.body?.message ?? err?.message ?? "Failed to create size.");
    } finally {
      setAddingSize(false);
    }
  };

  const handleSaveSize = async () => {
    if (!editingSize || !editingSizeName.trim()) return;
    setSavingSize(true);
    try {
      await updateSize.mutateAsync({ id: editingSize.id, name: editingSizeName.trim() });
      await qc.refetchQueries({ queryKey: sizeQueryKeys.all });
      toast.success("Size updated.");
      setEditingSize(null);
    } catch (err: any) {
      toast.error(err?.body?.message ?? err?.message ?? "Failed to update size.");
    } finally {
      setSavingSize(false);
    }
  };

  const handleDeleteSize = async () => {
    if (!confirmDeleteSize) return;
    setDeletingSize(true);
    try {
      await deleteSize.mutateAsync(confirmDeleteSize.id);
      await qc.refetchQueries({ queryKey: sizeQueryKeys.all });
      // Deselect from active product variants if open
      setSelectedVariants(vs => vs.filter(v => v.size_id !== confirmDeleteSize.id));
      toast.success(`"${confirmDeleteSize.name}" deleted.`);
      setConfirmDeleteSize(null);
    } catch (err: any) {
      toast.error(err?.body?.message ?? err?.message ?? "Failed to delete size.");
    } finally {
      setDeletingSize(false);
    }
  };

  const isLoading = catsLoading || prodsLoading;
  const dialogOpen = !!editItem || isNewDialog;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Product Management</h2>
          <p className="text-sm text-muted-foreground">{allProducts.length} product{allProducts.length !== 1 ? 's' : ''} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" onClick={() => setCatDialogOpen(true)} className="gap-2" disabled={isLoading}>
            <Tag className="h-4 w-4" />
            Categories
          </Button>
          {filtered.length > 0 && (
            <Button variant="outline" onClick={() => setShowBulkConfirm("all")} className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10" disabled={isLoading}>
              <Trash2 className="h-4 w-4" />
              Delete All ({filtered.length})
            </Button>
          )}
          <Button onClick={openNew} className="gap-2" disabled={isLoading}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Search + category filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => handleCatFilterChange("all")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors border",
              catFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"
            )}
          >
            All Menu
          </button>
          {categories.filter((c) => c.is_active).map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCatFilterChange(cat.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors border",
                catFilter === cat.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {prodsError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load products. Please refresh or check your connection.
        </div>
      )}

      {/* Bulk action bar */}
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

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={el => { if (el) el.indeterminate = somePageSelected; }}
                  onChange={togglePageSelection}
                  className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-36 rounded" />
                        <Skeleton className="h-3 w-24 rounded" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-12 rounded" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1"><Skeleton className="h-8 w-8 rounded-lg" /><Skeleton className="h-8 w-8 rounded-lg" /></div></td>
                </tr>
              ))
              : paginatedProducts.map((product) => (
                <tr key={product.id} className={cn("border-b border-border last:border-0 hover:bg-muted/20 transition-colors", selectedIds.has(product.id) && "bg-primary/5")}>
                  <td className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(product.id)}
                      onChange={() => setSelectedIds(prev => { const n = new Set(prev); n.has(product.id) ? n.delete(product.id) : n.add(product.id); return n; })}
                      className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          {product.name}
                          {product.type !== 'addon' && product.show_on_website && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Globe className="h-3 w-3 text-sky-500 shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>Visible on website</TooltipContent>
                            </Tooltip>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {product.type === 'addon' && (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Add-on</span>
                    )}
                    {product.type === 'drink' && (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Drink</span>
                    )}
                    {product.type === 'snack' && (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Snack</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {product.category?.name ?? "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {product.has_variants ? (
                      <div className="flex flex-wrap gap-1">
                        {product.variants.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">No sizes set</span>
                        ) : (
                          product.variants.map(v => (
                            <span
                              key={v.id}
                              className={cn(
                                "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                                v.is_available
                                  ? "border-border bg-muted text-foreground"
                                  : "border-border/50 bg-muted/40 text-muted-foreground line-through"
                              )}
                            >
                              <span className="text-muted-foreground font-normal">{v.size?.name ?? "?"}</span>
                              <span>${parseFloat(v.price).toFixed(2)}</span>
                            </span>
                          ))
                        )}
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-foreground">
                        ${parseFloat(product.base_price).toFixed(2)}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button onClick={() => openEdit(product)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <Pencil className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Edit product</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button onClick={() => setConfirmDelete(product)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Delete product</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!isLoading && filtered.length === 0 && !prodsError && (
          <div className="py-12 text-center text-sm text-muted-foreground">No products found</div>
        )}
        {/* Pagination */}
        {!isLoading && filtered.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>

          <div className="max-h-[65vh] overflow-y-auto scrollbar-thin px-1 pt-1 -mx-1 space-y-4">
            {/* Product Type */}
            <div className="space-y-1.5">
              <Label>Product Type</Label>
              <Select
                value={productType === 'addon' ? 'drink' : productType}
                onValueChange={(val: 'drink' | 'snack') => {
                  setProductType(val);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="drink">Drink</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder="Product name" />
            </div>

            {/* Price + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price ($)</Label>
                <Input type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData((f) => ({ ...f, price: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                {showNewCat ? (
                  <div className="flex gap-2">
                    <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Category name" className="flex-1" autoFocus />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => setShowNewCat(false)} className="shrink-0"><X className="h-4 w-4" /></Button>
                      </TooltipTrigger>
                      <TooltipContent>Cancel</TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  <Select value={formData.categoryId} onValueChange={(v) => { if (v === "__new__") { setShowNewCat(true); } else setFormData((f) => ({ ...f, categoryId: v })); }}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {categories.filter((c) => c.is_active).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                      <SelectItem value="__new__" className="text-primary font-medium">+ Add New Category</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} placeholder="Short description (optional)" />
            </div>

            {/* Image */}
            <div className="space-y-1.5">
              <Label>Product Image</Label>
              <div className="flex items-center gap-4">
                {formData.imageUrl ? (
                  <div className="relative shrink-0">
                    <img src={formData.imageUrl} alt="Preview" className="h-20 w-20 rounded-xl object-cover border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" onClick={handleRemoveImage} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow">
                          <X className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Remove image</TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  <label className={cn("flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors", uploading ? "opacity-60 cursor-not-allowed" : "hover:border-primary hover:bg-primary/5 hover:text-primary")}>
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    <span className="text-[9px] font-medium">{uploading ? "Uploading" : "Upload"}</span>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleImageUpload} />
                  </label>
                )}
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className="font-medium text-foreground">JPG, PNG, WebP</p>
                  <p>Max size: 5 MB</p>
                  <p>Recommended: 400 × 400 px</p>
                </div>
              </div>
            </div>

            {/* Show on Website */}
            {productType !== 'addon' && (
              <button
                type="button"
                onClick={() => setFormData((f) => ({ ...f, showOnWebsite: !f.showOnWebsite }))}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  formData.showOnWebsite
                    ? "border-sky-200 bg-sky-50/60"
                    : "border-border bg-muted/30"
                )}
              >
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  formData.showOnWebsite ? "bg-sky-100 text-sky-600" : "bg-muted text-muted-foreground"
                )}>
                  <Globe className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Show on Website</p>
                  <p className="text-xs text-muted-foreground">
                    {formData.showOnWebsite
                      ? "Customers can see and order this on the Slow Drip website."
                      : "Hidden from the website — POS only."}
                  </p>
                </div>
                {formData.showOnWebsite
                  ? <ToggleRight className="h-6 w-6 text-sky-600 shrink-0" />
                  : <ToggleLeft className="h-6 w-6 text-muted-foreground shrink-0" />}
              </button>
            )}

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving || uploading}>Cancel</Button>
            <Button onClick={saveItem} disabled={saving || uploading}>
              {saving ? "Saving..." : editItem ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o && !deleting) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name}" will be permanently deleted along with its variants and addons. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Bulk Delete Confirm Dialog */}
      <AlertDialog open={!!showBulkConfirm} onOpenChange={(o) => { if (!o && !bulkDeleting) setShowBulkConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {showBulkConfirm === "all" ? `all ${filtered.length}` : selectedIds.size} product{(showBulkConfirm === "all" ? filtered.length : selectedIds.size) !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {showBulkConfirm === "all" ? "all matching products" : `${selectedIds.size} selected product${selectedIds.size !== 1 ? "s" : ""}`} along with their variants and images. This cannot be undone.
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

      {/* ── Category Management Dialog ── */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin pr-1">
            {categories.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No categories yet.</p>
            )}
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                {editingCat?.id === cat.id ? (
                  <>
                    <Input
                      value={editingCatName}
                      onChange={(e) => setEditingCatName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveCategory(); if (e.key === "Escape") setEditingCat(null); }}
                      className="h-7 flex-1 text-sm"
                      autoFocus
                    />
                    <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSaveCategory} disabled={savingCat}>
                      {savingCat ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingCat(null)} disabled={savingCat}>
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{cat.name}</span>
                    <span className="text-xs text-muted-foreground mr-1">{cat.products_count ?? 0} products</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => { setEditingCat(cat); setEditingCatName(cat.name); }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Rename category</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setConfirmDeleteCat(cat)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Delete category</TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Category Confirm ── */}
      <AlertDialog open={!!confirmDeleteCat} onOpenChange={(o) => { if (!o && !deletingCat) setConfirmDeleteCat(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              {(confirmDeleteCat?.products_count ?? 0) > 0
                ? `"${confirmDeleteCat?.name}" still has ${confirmDeleteCat?.products_count} product(s). Move or delete those products first.`
                : `"${confirmDeleteCat?.name}" will be permanently deleted. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingCat}>Cancel</AlertDialogCancel>
            {(confirmDeleteCat?.products_count ?? 0) === 0 && (
              <Button
                onClick={handleDeleteCategory}
                disabled={deletingCat}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              >
                {deletingCat && <Loader2 className="h-4 w-4 animate-spin" />}
                {deletingCat ? "Deleting..." : "Delete"}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductManagement;
