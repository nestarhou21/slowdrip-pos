import { useState, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Minus, Plus, ShoppingBag, Receipt, XCircle, Trash2, Tag, Loader2, User } from "lucide-react";
import { useSettings, type PosCartItem } from "@repo/store";
import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui";
import { Button, Input, Label } from "@repo/ui";

interface CartPanelProps {
  items: PosCartItem[];
  onUpdateQty: (cartKey: string, delta: number) => void;
  onRemove: (cartKey: string) => void;
  onClear: () => void;
  isSubmitting?: boolean;
  currentUserName?: string;
  onPlaceOrder: (params: {
    orderType: "dine_in" | "takeaway";
    paymentMethod: "cash" | "online";
    receivedAmount: number;
    discountCode: string;
    discountPercent: number;
    baristaName?: string;
  }) => Promise<void>;
}

const CartPanel = ({
  items, onUpdateQty, onRemove, onClear, onPlaceOrder,
  isSubmitting = false, currentUserName = "",
}: CartPanelProps) => {
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [receivedCurrency, setReceivedCurrency] = useState<"USD" | "KHR">("USD");
  const [memberDiscountPercent, setMemberDiscountPercent] = useState("");
  const [showDiscount, setShowDiscount] = useState(false);
  const [baristaName, setBaristaName] = useState(currentUserName);
  // Payment panel: expanded by default on larger screens, collapsed on small
  const [paymentExpanded, setPaymentExpanded] = useState(true);
  const { data: settings } = useSettings();
  const khrRate = settings?.khr_rate || 4010;
  const fmtKHR = (usd: number) => `${Math.round(usd * khrRate).toLocaleString()} ៛`;

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const memberPercent = showDiscount ? Math.max(0, Math.min(100, parseFloat(memberDiscountPercent) || 0)) : 0;
  const discountAmount = Math.round(subtotal * (memberPercent / 100) * 100) / 100;
  const total = Math.max(0, subtotal - discountAmount);

  // Received amount — convert KHR input to USD for backend
  const receivedRaw = parseFloat(receivedAmount) || 0;
  const receivedUSD = receivedCurrency === "KHR" ? receivedRaw / khrRate : receivedRaw;
  const receivedKHR = receivedCurrency === "KHR" ? receivedRaw : receivedRaw * khrRate;
  const change = Math.max(0, receivedUSD - total);
  const changeKHR = change * khrRate;

  const orderTypes = [
    { id: "dine_in" as const, label: "Dine in" },
    { id: "takeaway" as const, label: "Take away" },
  ];

  const discountCode = memberPercent > 0 ? `MEMBER${memberPercent}` : "";

  // Derive what's blocking order completion — used in both expanded and collapsed state
  const cashNotEnough = paymentMethod === "cash" && receivedUSD < total;
  const canComplete = items.length > 0 && total > 0 && !cashNotEnough;

  const blockerLabel = (() => {
    if (items.length === 0) return null;
    if (paymentMethod === "cash" && receivedUSD === 0) return "Enter received amount";
    if (cashNotEnough) return "Received amount too low";
    return null;
  })();

  const handlePlaceOrder = async () => {
    await onPlaceOrder({
      orderType, paymentMethod,
      receivedAmount: receivedUSD,
      discountCode, discountPercent: memberPercent,
      baristaName: baristaName.trim() || undefined,
    });
    setReceivedAmount("");
    setMemberDiscountPercent("");
    setShowDiscount(false);
  };

  return (
    <aside className="flex h-full w-96 flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">Current Order</h2>
          <button
            onClick={onClear}
            className="text-[10px] font-bold text-destructive hover:text-destructive flex items-center gap-1 uppercase tracking-widest transition-colors"
          >
            <XCircle className="h-3 w-3" />
            Clear
          </button>
        </div>
        {/* Order type tabs */}
        <div className="mt-3 flex gap-1.5">
          {orderTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setOrderType(type.id)}
              className={cn(
                "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
                orderType === type.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-hide">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <ShoppingBag className="mb-3 h-12 w-12 opacity-10" />
            <p className="text-sm font-medium">Cart is empty</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const itemKey = item.cartKey;
              const variantLabel = item.variant ? ` · ${item.variant.size.name}` : "";
              const addonLabel = item.selectedAddons.length > 0 ? ` + ${item.selectedAddons.map((a: { name: string }) => a.name).join(", ")}` : "";
              return (
                <div key={itemKey} className="group flex items-center gap-3 rounded-xl border border-transparent hover:border-border hover:bg-muted/30 p-2 transition-all">
                  {item.product.image_url ? (
                    <img src={item.product.image_url} alt={item.product.name} className="h-10 w-10 rounded-lg object-cover bg-muted" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.product.name}{variantLabel}</p>
                    <p className="text-xs font-medium text-muted-foreground">${item.unitPrice.toFixed(2)}{addonLabel && <span className="ml-1 italic">{addonLabel}</span>}</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted rounded-lg p-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onUpdateQty(itemKey, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-card text-foreground transition-colors hover:bg-white border border-transparent active:scale-95"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Decrease quantity</TooltipContent>
                    </Tooltip>
                    <span className="w-5 text-center text-xs font-bold text-foreground">{item.quantity}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onUpdateQty(itemKey, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-card text-foreground transition-colors hover:bg-white border border-transparent active:scale-95"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Increase quantity</TooltipContent>
                    </Tooltip>
                  </div>
                  <button
                    onClick={() => onRemove(itemKey)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Collapsible payment panel */}
      <div className="border-t border-border bg-muted/20 flex-shrink-0">
        {/* Toggle tab — styled like a clickable tab so it's obviously interactive */}
        <button
          onClick={() => setPaymentExpanded(v => !v)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3 transition-colors group",
            paymentExpanded ? "hover:bg-muted/40" : "bg-primary/5 hover:bg-primary/10"
          )}
        >
          <div className="flex items-center gap-2">
            {paymentExpanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronUp className="h-4 w-4 text-primary" />}
            <span className={cn(
              "text-[11px] font-black uppercase tracking-widest",
              paymentExpanded ? "text-muted-foreground" : "text-primary"
            )}>
              {paymentExpanded ? "Payment details" : "Tap to enter payment"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!paymentExpanded && total > 0 && (
              <>
                <span className="text-sm font-black text-foreground">${total.toFixed(2)}</span>
                <span className="text-[10px] text-muted-foreground">{fmtKHR(total)}</span>
              </>
            )}
            {paymentExpanded && (
              <span className="text-[9px] text-muted-foreground/50 font-medium normal-case tracking-normal">hide</span>
            )}
          </div>
        </button>

        {/* Collapsible content */}
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          paymentExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        )}>
        <div className="px-4 pb-4 space-y-4">
        {/* Compact Payment Method Header */}
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payment</Label>
          <div className="flex p-1 bg-muted rounded-xl gap-1">
            {(["cash", "online"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                  paymentMethod === m
                    ? "bg-card text-primary shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "cash" ? "Cash" : "Online"}
              </button>
            ))}
          </div>
        </div>

        {/* Barista name — for performance tracking */}
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <User className="h-3 w-3" /> Served By
          </Label>
          <Input
            placeholder="Barista name..."
            value={baristaName}
            onChange={e => setBaristaName(e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        {/* Dynamic Payment Inputs */}
        <div className="space-y-3">
          {paymentMethod === "cash" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
              {/* Received header: label + currency toggle + quick amounts */}
              <div className="flex justify-between items-center gap-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Received</Label>
                <div className="flex items-center gap-1">
                  {/* Currency toggle */}
                  <div className="flex p-0.5 bg-muted rounded-md gap-0.5 border border-border">
                    {(["USD", "KHR"] as const).map(c => (
                      <button
                        key={c}
                        onClick={() => { setReceivedCurrency(c); setReceivedAmount(""); }}
                        className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold transition-all",
                          receivedCurrency === c
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >{c}</button>
                    ))}
                  </div>
                  {/* Quick-fill buttons */}
                  {receivedCurrency === "USD" && total > 0 && [5, 10, 20].map(amt => (
                    <button key={amt}
                      onClick={() => setReceivedAmount(amt.toString())}
                      className="text-[9px] font-bold bg-muted px-2 py-0.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                    >${amt}</button>
                  ))}
                  {receivedCurrency === "KHR" && total > 0 && [10000, 20000, 50000].map(amt => (
                    <button key={amt}
                      onClick={() => setReceivedAmount(amt.toString())}
                      className="text-[9px] font-bold bg-muted px-1.5 py-0.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                    >{(amt / 1000).toFixed(0)}k</button>
                  ))}
                </div>
              </div>

              {/* Amount input */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  {receivedCurrency === "USD" ? "$" : "៛"}
                </span>
                <Input
                  type="number"
                  placeholder="0"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  className="pl-7 h-10 text-sm font-bold bg-card"
                />
              </div>

              {/* Equivalent in the other currency */}
              {receivedRaw > 0 && (
                <p className="text-[10px] font-bold text-muted-foreground text-right animate-in fade-in">
                  {receivedCurrency === "USD"
                    ? <>≈ <span className="text-primary">{fmtKHR(receivedUSD)}</span></>
                    : <>≈ <span className="text-primary">${receivedUSD.toFixed(2)} USD</span></>}
                </p>
              )}
            </div>
          )}

          {paymentMethod === "online" && (
            <div className="animate-in fade-in duration-300">
              <div className="rounded-xl bg-red-50/60 p-3 border border-red-100 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                    <rect x="2" y="2" width="9" height="9" rx="1.5" stroke="#dc2626" strokeWidth="2"/>
                    <rect x="13" y="2" width="9" height="9" rx="1.5" stroke="#dc2626" strokeWidth="2"/>
                    <rect x="2" y="13" width="9" height="9" rx="1.5" stroke="#dc2626" strokeWidth="2"/>
                    <rect x="15" y="15" width="5" height="5" rx="0.5" fill="#dc2626"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-red-800 uppercase tracking-widest leading-none">Online Payment (KHQR)</p>
                  <p className="text-[11px] text-red-600 font-medium leading-none mt-1">QR will appear after placing order · ${total.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pricing + Discount */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          {items.length > 0 && (
            <div className="space-y-2 pt-1 pb-2 border-b border-dashed border-border animate-in fade-in duration-200">
              <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                <span>Subtotal</span>
                <div className="flex flex-col items-end">
                  <span>${subtotal.toFixed(2)}</span>
                  <span className="text-[9px] opacity-60">{fmtKHR(subtotal)}</span>
                </div>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-[11px] text-primary font-semibold">
                  <span>Discount ({memberPercent}%)</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              {/* Collapsible discount controls */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => { setShowDiscount((v) => !v); if (showDiscount) setMemberDiscountPercent(""); }}
                  className={cn(
                    "flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-widest border rounded-lg px-3 py-2 transition-colors",
                    showDiscount
                      ? "bg-primary/10 border-primary text-primary shadow-sm"
                      : "border-border text-primary hover:bg-primary/5 hover:border-primary"
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <Tag className="h-3 w-3" />
                    Member Discount
                  </span>
                  {showDiscount && memberPercent > 0
                    ? <span className="text-[10px] font-bold text-emerald-600">-${discountAmount.toFixed(2)}</span>
                    : <span className="text-[9px] font-semibold opacity-60">{showDiscount ? "Hide" : "Apply"}</span>
                  }
                </button>
                {showDiscount && (
                  <div className="flex items-center gap-2 mt-2 animate-in fade-in slide-in-from-top-1 duration-150 border border-primary/30 bg-primary/5 rounded-lg px-3 py-2.5">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={memberDiscountPercent}
                      onChange={(e) => setMemberDiscountPercent(e.target.value)}
                      className="w-20 h-8 text-sm font-bold bg-white border-primary/40 focus-visible:ring-primary"
                      placeholder="0"
                      autoFocus
                    />
                    <span className="text-sm font-bold text-primary">%</span>
                    {memberPercent > 0 && (
                      <span className="text-xs text-emerald-600 font-semibold ml-1">
                        −${discountAmount.toFixed(2)} off
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Total Amount</span>
              {paymentMethod === "cash" && receivedUSD > total && change > 0 && (
                <div className="mt-1 space-y-0.5">
                  <span className="text-[10px] font-bold text-emerald-600 block">
                    Change: ${change.toFixed(2)}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-500 opacity-80 block">
                    ≈ {Math.round(changeKHR).toLocaleString()} ៛
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end">
              <span className="text-2xl font-bold text-foreground">${total.toFixed(2)}</span>
              <span className="text-xs font-bold text-muted-foreground -mt-1">{fmtKHR(total)}</span>
            </div>
          </div>
        </div>

        <Button
          onClick={handlePlaceOrder}
          disabled={isSubmitting || !canComplete}
          className="w-full h-12 text-sm font-bold uppercase tracking-widest shadow-md hover:shadow-lg active:scale-[0.98] transition-all bg-primary hover:bg-primary/90"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Receipt className="mr-2 h-4 w-4" />
          )}
          {isSubmitting ? "Placing Order..." : "Complete Order"}
        </Button>
        </div>{/* end collapsible content */}
        </div>{/* end collapsible panel */}

        {/* When collapsed: show blocker hint or complete button */}
        {!paymentExpanded && items.length > 0 && total > 0 && (
          <div className="px-4 pb-3 space-y-2">
            {blockerLabel ? (
              /* Something still needed — tap to open payment details */
              <button
                onClick={() => setPaymentExpanded(true)}
                className="w-full h-11 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors"
              >
                <ChevronUp className="h-4 w-4" />
                {blockerLabel} — tap to fill in
              </button>
            ) : (
              <Button
                onClick={handlePlaceOrder}
                disabled={isSubmitting || !canComplete}
                className="w-full h-11 text-sm font-bold uppercase tracking-widest shadow-md"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Placing..." : `Complete · $${total.toFixed(2)}`}
              </Button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default CartPanel;
