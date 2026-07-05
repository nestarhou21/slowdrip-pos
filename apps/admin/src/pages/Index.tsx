import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { blePrintReceiptDouble, isBleSupported } from "@/lib/blePrinter";
import Sidebar from "@/components/pos/Sidebar";
import TopBar from "@/components/pos/TopBar";
import CategoryTabs from "@/components/pos/CategoryTabs";
import ProductCard from "@/components/pos/ProductCard";
import CartPanel from "@/components/pos/CartPanel";
import Dashboard from "@/components/pos/Dashboard";
import OrdersPage from "@/components/pos/OrdersPage";
import ProductManagement from "@/components/pos/ProductManagement";
import SettingsPage from "@/components/pos/SettingsPage";
import RegisterPage from "@/components/pos/RegisterPage";
import StaffManagement from "@/components/pos/StaffManagement";
import TransactionsPage from "@/components/pos/TransactionsPage";
import InventoryPage from "@/components/pos/InventoryPage";
import OrderLogPage from "@/components/pos/OrderLogPage";
import { useAdminNotifications, useMarkAdminNotificationRead, useCurrentRegisterSession, useApiProducts, useApiCategories, usePlaceOrder, useCheckBakongStatus, useRegenerateBakongQr, useUpdateOrderStatus, useApiPosOrders, useSettings, type ApiProduct, type ApiProductVariant, type ApiOrder, type BakongQrData, type PosCartItem, type AdminNotification, type ApiCategory } from "@repo/store";
import { cn, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input, Label, toast, Checkbox, Skeleton } from "@repo/ui";
import { CheckCircle2, ShoppingBag, Printer, Plus, Lock, ScanLine, Loader2 } from "lucide-react";
import { buildReceiptHtmls } from "@/lib/receiptTemplates";
import { playNewOrderChime } from "@/lib/notificationSound";



interface IndexProps {
  onLogout: () => void;
  userRole: string;
  staffPortal?: boolean;
  userName?: string;
  currentUserId?: string | null;
}





const Index = ({ onLogout, userRole, staffPortal = false, userName = "", currentUserId = null }: IndexProps) => {
  const defaultTab = userRole === "admin" ? "dashboard" : userRole === "operator" ? "inventory" : "menu";
  const storageKey = staffPortal ? "sd_staff_tab" : "sd_admin_tab";

  // Tabs allowed for each role — mirrors Sidebar navItems
  const ALLOWED_TABS: Record<string, string[]> = {
    admin:    ["dashboard", "menu", "orders", "register", "products", "staff-management", "transactions", "order-log", "inventory", "settings"],
    barista:  ["menu", "orders", "register"],
    operator: ["inventory"],
  };
  const allowedTabs = ALLOWED_TABS[userRole] ?? ALLOWED_TABS["barista"];

  // Restore tab from localStorage but only if it's allowed for this role.
  // Discards stale tabs from a previous user's session.
  const [activeTab, setActiveTabRaw] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && allowedTabs.includes(saved)) return saved;
    } catch { /* ignore */ }
    return defaultTab;
  });

  // Wrap setActiveTab to persist to localStorage
  const setActiveTab = useCallback((tab: string) => {
    setActiveTabRaw(tab);
    try { localStorage.setItem(storageKey, tab); } catch { /* ignore */ }
  }, [storageKey]);

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<ApiOrder | null>(null);
  const [bakongQrData, setBakongQrData] = useState<BakongQrData | null>(null);
  const [pendingBakongOrder, setPendingBakongOrder] = useState<ApiOrder | null>(null);

  // Customization dialog states
  const [customizing, setCustomizing] = useState<ApiProduct | null>(null);
  const [customVariant, setCustomVariant] = useState<ApiProductVariant | null>(null);
  const [customAddons, setCustomAddons] = useState<string[]>([]); // addon product IDs
  const [customSugar, setCustomSugar] = useState("100%");
  const [customIce, setCustomIce] = useState("Normal");
  const [customNotes, setCustomNotes] = useState("");

  const isBarista = userRole === "barista";
  const isReceptionist = userRole === "receptionist";
  const isAdmin = userRole === "admin";

  // Role-based fetch control
  const canFetchPos = isAdmin || isBarista;

  const productsQuery = useApiProducts(undefined, { enabled: canFetchPos });
  const apiProducts: ApiProduct[] = (productsQuery.data as any)?.data ?? (Array.isArray(productsQuery.data) ? productsQuery.data : []);
  const categoriesQuery = useApiCategories({ enabled: canFetchPos });
  const apiCategories = (categoriesQuery.data as any)?.data ?? (Array.isArray(categoriesQuery.data) ? categoriesQuery.data : []);
  const placeOrderMutation = usePlaceOrder();
  const checkBakongStatus = useCheckBakongStatus();
  const regenerateBakongQr = useRegenerateBakongQr();
  const cancelOrderMutation = useUpdateOrderStatus();
  // Poll every 15s so new website orders show up without a manual refresh
  const ordersQuery = useApiPosOrders(undefined, { enabled: canFetchPos, refetchInterval: 15 * 1000 });
  const ordersList: ApiOrder[] = (ordersQuery.data as any)?.data ?? (Array.isArray(ordersQuery.data) ? ordersQuery.data : []);

  // Alert (chime + toast) when a new online order arrives
  const seenOnlineOrderIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!canFetchPos) return;
    const pendingOnline = ordersList.filter((o) => o.source === "website" && o.status === "pending");
    // First successful load: remember what's already there without alerting
    if (seenOnlineOrderIds.current === null) {
      if (ordersQuery.isSuccess) {
        seenOnlineOrderIds.current = new Set(pendingOnline.map((o) => o.id));
      }
      return;
    }
    const fresh = pendingOnline.filter((o) => !seenOnlineOrderIds.current!.has(o.id));
    if (fresh.length === 0) return;
    fresh.forEach((o) => seenOnlineOrderIds.current!.add(o.id));
    playNewOrderChime();
    fresh.forEach((o) => {
      toast.success(
        `New online order ${o.order_number} — ${o.customer_name ?? "Customer"} · $${parseFloat(o.total_amount).toFixed(2)}`,
        { duration: 10000 }
      );
    });
  }, [ordersList, canFetchPos, ordersQuery.isSuccess]);
  const { data: notificationsData = [] } = useAdminNotifications(undefined, { staleTime: 30 * 1000, refetchInterval: 30 * 1000 });
  const notificationsList: AdminNotification[] = (notificationsData as any)?.data ?? (Array.isArray(notificationsData) ? notificationsData : []);
  const markAsRead = useMarkAdminNotificationRead();
  const session = useCurrentRegisterSession({ enabled: canFetchPos });
  const { data: settings } = useSettings();

  const KHR_RATE = settings?.khr_rate || 4010;
  const fmtKHR = (usd: number) => `${Math.round(usd * KHR_RATE).toLocaleString()} ៛`;

  const handleNotificationClick = (n: AdminNotification) => {
    if (!n.read) markAsRead.mutate(n.id);
    if (n.type === "order") setActiveTab("orders");
  };

  const isRegisterOpen = (session.data as any)?.status === 'open';
  const isRegisterLoading = session.isLoading;

  const handlePrintApiOrder = async (o: ApiOrder) => {
    let logoSrc = "";
    const logoUrl = settings?.logo_url || "/images/sd-logo.jpg";
    try {
      const resp = await fetch(logoUrl);
      const blob = await resp.blob();
      logoSrc = await new Promise<string>((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { /* skip logo if unavailable */ }

    const [merchantHtml, customerHtml] = buildReceiptHtmls({
      order: o,
      logoSrc,
      cafeName:    settings?.cafe_name     ?? "Slow Drip",
      cafeTagline: settings?.cafe_tagline  ?? "",
      addrLine1:   settings?.address_line1 ?? "",
      addrLine2:   settings?.address_line2 ?? "",
      phone:       settings?.phone         ?? "",
      wifiName:    settings?.wifi_name     ?? "",
      wifiPass:    settings?.wifi_password ?? "",
      footer:      settings?.receipt_footer ?? "Thank you for your visit!",
      paymentLabel: o.payment_method === 'qr' ? 'ABA QR' : o.payment_method.toUpperCase(),
      khrRate:     KHR_RATE,
    });
    const printHtml = (html: string) => {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open(); doc.write(html); doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 300);
      }
    };

    printHtml(merchantHtml);
    printHtml(customerHtml);
  };



  const pendingOrdersCount = useMemo(
    () => ordersList.filter((o) => o.status === "pending" || o.status === "preparing" || o.status === "ready").length,
    [ordersList]
  );

  const unreadInboxCount = useMemo(
    () => notificationsList.filter((n) => !n.read).length,
    [notificationsList]
  );

  const filteredProducts = useMemo(() => {
    return apiProducts.filter((p) => {
      if (p.type === 'addon') return false;
      const matchesCat = activeCategory === "all" || p.category_id === activeCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [activeCategory, searchQuery, apiProducts]);

  const openCustomize = (product: ApiProduct) => {
    setCustomizing(product);
    setCustomVariant(product.has_variants ? (product.variants[0] ?? null) : null);
    setCustomAddons([]);
    setCustomSugar("100%");
    setCustomIce("Normal");
    setCustomNotes("");
  };

  const addItemToCart = (
    product: ApiProduct,
    variant: ApiProductVariant | null,
    addons: ApiProduct[],
    notes: string
  ) => {
    const addonIds = addons.map((a) => a.id).sort();
    const cartKey = `${product.id}-${variant?.id ?? "base"}-${addonIds.join(",")}`;
    const variantPrice = variant ? parseFloat(variant.price) : parseFloat(product.base_price);
    const addonPrice = addons.reduce((s, a) => s + parseFloat(a.base_price), 0);
    const unitPrice = variantPrice + addonPrice;
    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey);
      if (existing) {
        return prev.map((i) => i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { cartKey, product, variant, selectedAddons: addons, quantity: 1, notes, unitPrice }];
    });
  };

  const confirmCustomize = () => {
    if (!customizing) return;
    const selectedAddons = customizing.linked_addons.filter((a) => customAddons.includes(a.id));
    // Build customisation string from sugar + ice + freeform notes
    const parts = [];
    if (customizing.type === 'drink') {
      parts.push(`Sugar: ${customSugar}`);
      parts.push(`Ice: ${customIce}`);
    }
    if (customNotes.trim()) parts.push(customNotes.trim());
    const customisation = parts.join(" | ");
    addItemToCart(customizing, customVariant, selectedAddons, customisation);
    setCustomizing(null);
  };

  const updateQty = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => (item.cartKey === id ? { ...item, quantity: item.quantity + delta } : item)).filter((item) => item.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart((prev) => prev.filter((item) => item.cartKey !== id));
  }, []);

  const clearOrder = useCallback(() => {
    setCart([]);
    toast.info("Cart cleared");
  }, []);

  const placeOrder = useCallback(async (params: {
    orderType: "dine_in" | "takeaway";
    paymentMethod: "cash" | "online";
    receivedAmount: number;
    discountCode: string;
    discountPercent: number;
    baristaName?: string;
  }) => {
    if (cart.length === 0) return;
    try {
      const response = await placeOrderMutation.mutateAsync({
        order_type: params.orderType,
        payment_method: params.paymentMethod === "online" ? "bakong" : "cash",
        received_amount: params.paymentMethod === "cash" ? params.receivedAmount : null,
        items: cart.map((item) => ({
          product_id: item.product.id,
          variant_id: item.variant?.id ?? null,
          quantity: item.quantity,
          customisation: item.notes || null,
          addon_ids: item.selectedAddons.map((a) => a.id),
        })),
        discount_code: params.discountCode || null,
        discount_percent: params.discountPercent > 0 ? params.discountPercent : null,
        notes: params.baristaName ? `Served by: ${params.baristaName}` : null,
      });
      setCart([]);
      if (params.paymentMethod === "online") {
        if (response.bakong_qr) {
          setPendingBakongOrder(response.data);
          setBakongQrData(response.bakong_qr);
        } else {
          toast.error("Failed to generate Bakong QR. Check BAKONG_ACCOUNT_ID in backend .env.");
        }
      } else {
        setLastPlacedOrder(response.data);
        toast.success("Order Placed Successfully");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed to place order";
      toast.error(msg);
    }
  }, [cart, placeOrderMutation]);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        ordersBadge={pendingOrdersCount}
        inboxBadge={unreadInboxCount}
        onLogout={onLogout}
        userRole={userRole}
        staffPortal={staffPortal}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          unreadCount={unreadInboxCount}
          notifications={notificationsList}
          onShowAll={() => setActiveTab("orders")}
          onNotificationClick={handleNotificationClick}
          userRole={userRole}
          userName={userName}
        />

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            {activeTab === "dashboard" && <Dashboard />}
            {activeTab === "menu" && (
              <div className="space-y-6 text-left">
                {isRegisterLoading ? (
                  /* ── Loading skeleton while checking register status ── */
                  <>
                    <div className="flex gap-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-9 w-24 rounded-full" />
                      ))}
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                          <Skeleton className="h-36 w-full rounded-xl" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                          <div className="flex items-center justify-between pt-1">
                            <Skeleton className="h-5 w-16" />
                            <Skeleton className="h-8 w-8 rounded-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : !isRegisterOpen ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-muted/30 rounded-3xl border-2 border-dashed border-border text-center">
                    <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                      <Lock className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">Register is Closed</h3>
                    <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed px-4 text-sm font-normal">
                      You must open a register session with your shift details and opening balance before you can start taking orders.
                    </p>
                    <Button
                      size="lg"
                      onClick={() => setActiveTab("register")}
                      className="rounded-2xl px-10 h-14 text-base font-bold shadow-lg shadow-primary/20"
                    >
                      Go to Register
                    </Button>
                  </div>
                ) : (
                  <>
                    <CategoryTabs
                      active={activeCategory}
                      onChange={setActiveCategory}
                      categories={apiCategories}
                      isLoading={categoriesQuery.isLoading}
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {filteredProducts.map((product) => (
                        <ProductCard key={product.id} product={product} onAdd={() => openCustomize(product)} />
                      ))}
                      {filteredProducts.length === 0 && !productsQuery.isLoading && (
                        <div className="col-span-full flex h-64 flex-col items-center justify-center text-center opacity-50">
                          <ShoppingBag className="mb-4 h-12 w-12" />
                          <p className="text-lg font-medium">No products found</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "orders" && <OrdersPage onPrintReceipt={handlePrintApiOrder} />}
            {activeTab === "products" && <ProductManagement />}
            {activeTab === "transactions" && <TransactionsPage />}
            {activeTab === "order-log" && <OrderLogPage />}
            {activeTab === "inventory" && <InventoryPage />}
            {activeTab === "settings" && <SettingsPage />}
            {activeTab === "register" && <RegisterPage userName={userName} userRole={userRole} />}
            {activeTab === "staff-management" && <StaffManagement currentUserId={currentUserId} />}
          </div>

          {activeTab === "menu" && (
            <div className="w-96 border-l border-border bg-card">
              <CartPanel
                items={cart}
                onUpdateQty={updateQty}
                onRemove={removeItem}
                onClear={clearOrder}
                isSubmitting={placeOrderMutation.isPending}
                onPlaceOrder={placeOrder}
                currentUserName={userName}
              />
            </div>
          )}
        </div>
      </main>

      {/* Product Customization Dialog */}
      <Dialog open={!!customizing} onOpenChange={() => setCustomizing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {customizing?.image_url && (
                <img src={customizing.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
              )}
              <div>
                <p className="text-base">{customizing?.name}</p>
                <p className="text-sm font-normal text-muted-foreground">{customizing?.category.name}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2 text-left">
            {/* Variant selector */}
            {customizing?.has_variants && customizing.variants.length > 0 && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Size</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {customizing.variants.filter((v) => v.is_available).map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setCustomVariant(v)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        customVariant?.id === v.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {v.size.name} — ${parseFloat(v.price).toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sugar level — drinks only */}
            {customizing?.type === 'drink' && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sugar Level</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["No Sugar", "25%", "50%", "75%", "100%"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setCustomSugar(s)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        customSugar === s
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ice level — drinks only */}
            {customizing?.type === 'drink' && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ice Level</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["No Ice", "Less Ice", "Normal", "Extra Ice"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setCustomIce(s)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        customIce === s
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add-ons */}
            {customizing && customizing.linked_addons.length > 0 && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add-ons</Label>
                <div className="mt-2 space-y-2">
                  {customizing.linked_addons.map((addon) => (
                    <label key={addon.id} className="flex items-center gap-2.5 cursor-pointer group">
                      <Checkbox
                        checked={customAddons.includes(addon.id)}
                        onCheckedChange={(checked) =>
                          setCustomAddons((prev) =>
                            checked ? [...prev, addon.id] : prev.filter((id) => id !== addon.id)
                          )
                        }
                      />
                      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {addon.name}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        +${parseFloat(addon.base_price).toFixed(2)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Special Notes */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Special Notes</Label>
              <Input
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="e.g. oat milk, extra hot, no ice..."
                className="mt-2 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomizing(null)}>Cancel</Button>
            <Button onClick={confirmCustomize} className="gap-2">
              <Plus className="h-4 w-4" />
              {(() => {
                if (!customizing) return "Add";
                const basePrice = customVariant ? parseFloat(customVariant.price) : parseFloat(customizing.base_price);
                const addonPrice = customizing.linked_addons
                  .filter((a) => customAddons.includes(a.id))
                  .reduce((s, a) => s + parseFloat(a.base_price), 0);
                return `Add — $${(basePrice + addonPrice).toFixed(2)}`;
              })()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bakong KHQR Payment Dialog */}
      {bakongQrData && pendingBakongOrder && (
        <BakongQrDialog
          qrData={bakongQrData}
          order={pendingBakongOrder}
          onConfirmed={() => {
            setBakongQrData(null);
            setLastPlacedOrder(pendingBakongOrder);
            setPendingBakongOrder(null);
          }}
          onCancel={() => {
            if (pendingBakongOrder) {
              cancelOrderMutation.mutate({ id: pendingBakongOrder.id, status: "cancelled" });
            }
            setBakongQrData(null);
            setPendingBakongOrder(null);
          }}
          onRetry={async () => {
            if (!pendingBakongOrder) return;
            const res = await regenerateBakongQr.mutateAsync(pendingBakongOrder.id);
            setBakongQrData(res.bakong_qr);
          }}
          checkBakongStatus={checkBakongStatus}
        />
      )}

      {/* Receipt Modal */}
      <Dialog open={!!lastPlacedOrder} onOpenChange={() => setLastPlacedOrder(null)}>
        <DialogContent className="max-w-[320px] p-0 overflow-hidden bg-white text-slate-800">
          <div className="p-6">
            <div className="text-center mb-4">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="font-bold text-xl uppercase tracking-widest leading-none">Slow Drip</h2>
              <p className="text-[10px] text-muted-foreground uppercase mt-1">Coffee • Matcha • Tea</p>
              <div className="mt-2 border-y border-dashed border-slate-200 py-1">
                <p className="text-[10px]">{new Date().toLocaleString()}</p>
                <p className="text-xs font-bold">{lastPlacedOrder?.order_number}</p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {lastPlacedOrder?.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs gap-2">
                  <span className="flex-1">
                    {item.quantity}x {item.product?.name ?? item.item_name ?? "Item"}
                    {item.variant && <span className="text-muted-foreground"> ({item.variant.size.name})</span>}
                    {item.customisation && (
                      <span className="block text-[10px] italic text-muted-foreground mt-0.5">{item.customisation}</span>
                    )}
                  </span>
                  <span className="font-medium shrink-0">${parseFloat(item.subtotal).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-dashed border-slate-200 pt-3 space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span>Subtotal</span>
                  <span>${parseFloat(lastPlacedOrder?.subtotal || "0").toFixed(2)}</span>
                </div>
                {parseFloat(lastPlacedOrder?.discount_amount || "0") > 0 && (
                  <div className="flex justify-between text-xs font-medium text-red-500">
                    <span>Discount</span>
                    <span>-${parseFloat(lastPlacedOrder?.discount_amount || "0").toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-2">
                  <span>TOTAL</span>
                  <div className="text-right">
                    <div>${parseFloat(lastPlacedOrder?.total_amount || "0").toFixed(2)}</div>
                    <div className="text-[10px] font-medium text-muted-foreground">{fmtKHR(parseFloat(lastPlacedOrder?.total_amount || "0"))}</div>
                  </div>
                </div>

                {lastPlacedOrder?.payment_method === 'cash' && (
                  <div className="border-t border-dotted border-slate-100 mt-3 pt-3 space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider font-extrabold">
                      <span>Cash Received</span>
                      <span>${parseFloat(lastPlacedOrder?.received_amount || "0").toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-emerald-600 uppercase tracking-wider font-extrabold">
                      <span>Change</span>
                      <span>${parseFloat(lastPlacedOrder?.change_amount || "0").toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 text-center space-y-2">
                <p className="text-[10px] text-muted-foreground italic mb-5 leading-none">Thank you for your visit!</p>
                <Button
                  onClick={async () => {
                    if (!lastPlacedOrder) return;
                    if (!isBleSupported()) {
                      toast.error("Bluetooth printing requires Chrome on Android.");
                      return;
                    }
                    try {
                      await blePrintReceiptDouble(lastPlacedOrder, settings as any);
                      toast.success("Printed 2 copies");
                      setLastPlacedOrder(null);
                    } catch (err: any) {
                      const msg: string = err?.message ?? "";
                      if (msg.includes("cancelled") || msg.includes("chosen")) {
                        // user dismissed the BLE picker — do nothing
                      } else {
                        toast.error("Printer error: " + (msg || "Unknown error"));
                      }
                    }
                  }}
                  className="w-full h-12 gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold transition-all shadow-lg hover:shadow-slate-200"
                >
                  <Printer className="w-4 h-4" />
                  Print Receipt &amp; Done
                </Button>
                <button
                  onClick={() => { handlePrintApiOrder(lastPlacedOrder!); setLastPlacedOrder(null); }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 py-1 transition-colors"
                >
                  Browser Print (PDF)
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Bakong QR Dialog ─────────────────────────────────────────────────────────

interface BakongQrDialogProps {
  qrData: BakongQrData;
  order: ApiOrder;
  onConfirmed: () => void;
  onCancel: () => void;
  onRetry: () => Promise<void>;
  checkBakongStatus: ReturnType<typeof useCheckBakongStatus>;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function BakongQrDialog({ qrData, order, onConfirmed, onCancel, onRetry, checkBakongStatus }: BakongQrDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [expired, setExpired] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(POLL_TIMEOUT_MS / 1000));
  const startedAt = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset all state and restart timers whenever the QR (md5) changes
  useEffect(() => {
    startedAt.current = Date.now();
    setConfirmed(false);
    setExpired(false);
    setRetrying(false);
    setSecondsLeft(Math.floor(POLL_TIMEOUT_MS / 1000));

    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((POLL_TIMEOUT_MS - (Date.now() - startedAt.current)) / 1000));
      setSecondsLeft(remaining);
    }, 1000);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
        setExpired(true);
        clearInterval(intervalRef.current!);
        clearInterval(countdownRef.current!);
        return;
      }
      try {
        const res = await checkBakongStatus.mutateAsync(qrData.order_id);
        if (res.status === "confirmed") {
          setConfirmed(true);
          clearInterval(intervalRef.current!);
          clearInterval(countdownRef.current!);
          setTimeout(onConfirmed, 1200);
        }
      } catch { /* ignore poll errors */ }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current!);
      clearInterval(countdownRef.current!);
    };
  }, [qrData.md5]);

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrData.qr_string)}`;

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-[680px] p-0 overflow-hidden">
        <div className="flex h-full">

          {/* ── Left: Order Summary ── */}
          <div className="w-[300px] shrink-0 flex flex-col bg-slate-50 border-r border-slate-100">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Order</p>
              <p className="text-lg font-bold text-foreground leading-tight">{order.order_number}</p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{order.order_type === "dine_in" ? "Dine-in" : "Takeaway"}</p>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  {item.product?.image_url ? (
                    <img src={item.product.image_url} alt={item.product.name} className="h-9 w-9 rounded-lg object-cover shrink-0 bg-muted mt-0.5" />
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-muted shrink-0 mt-0.5 flex items-center justify-center">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground leading-snug">
                      <span className="text-muted-foreground">{item.quantity}×</span> {item.product?.name ?? item.item_name ?? "Item"}
                    </p>
                    {item.variant && (
                      <p className="text-[10px] text-muted-foreground">{item.variant.size?.name}</p>
                    )}
                    {item.addons?.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        + {item.addons.map((a: any) => a.addon?.name).filter(Boolean).join(", ")}
                      </p>
                    )}
                    {item.customisation && (
                      <p className="text-[10px] italic text-muted-foreground">{item.customisation}</p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-foreground shrink-0">${parseFloat(item.subtotal).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="px-5 py-3 border-t border-slate-200 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span>${parseFloat(order.subtotal).toFixed(2)}</span>
              </div>
              {parseFloat(order.discount_amount) > 0 && (
                <div className="flex justify-between text-xs text-red-500">
                  <span>Discount</span>
                  <span>-${parseFloat(order.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-slate-200">
                <span>Total</span>
                <div className="text-right">
                  <div>${parseFloat(order.total_amount).toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: QR Code ── */}
          <div className="flex-1 flex flex-col">
            {/* Bakong header */}
            <div className="bg-red-600 px-6 py-4 text-white flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <ScanLine className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-sm leading-none">Bakong KHQR</p>
                <p className="text-red-200 text-[11px] mt-0.5">Scan with any Bakong-supported app</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 relative">
              {confirmed ? (
                <div className="flex flex-col items-center gap-3 text-center animate-in fade-in duration-300">
                  <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="font-bold text-base text-foreground">Payment Confirmed!</p>
                  <p className="text-xs text-muted-foreground">Opening receipt…</p>
                </div>
              ) : expired ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  {retrying ? (
                    <>
                      <div className="h-[180px] w-[180px] rounded-2xl bg-muted animate-pulse" />
                      <div className="h-4 w-32 rounded-full bg-muted animate-pulse" />
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-foreground">QR Expired</p>
                      <p className="text-xs text-muted-foreground">No payment received within 5 minutes.</p>
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        onClick={async () => {
                          setRetrying(true);
                          try { await onRetry(); } catch { setRetrying(false); }
                        }}
                      >
                        Generate New QR
                      </Button>
                      <Button variant="outline" size="sm" onClick={onCancel} className="w-full">Close</Button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* QR image */}
                  <div className="rounded-2xl overflow-hidden border-2 border-slate-100 shadow-md p-2 bg-white">
                    <img src={qrImageUrl} alt="Bakong KHQR" className="w-[200px] h-[200px] block" />
                  </div>

                  {/* Amount */}
                  <div className="text-center">
                    <p className="text-3xl font-bold text-foreground">${Number(qrData.amount ?? 0).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wider">USD</p>
                  </div>

                  {/* Waiting indicator + countdown */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Waiting for payment…</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      Expires in <span className={secondsLeft < 60 ? "text-red-500 font-semibold" : ""}>{mins}:{secs}</span>
                    </p>
                  </div>

                  <button onClick={onCancel} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                    Close
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Index;
