import React, { useState, useEffect, useRef } from "react";
import { Store, DollarSign, Receipt, Wifi, MapPin, Phone, Loader2, Save, ImagePlus, X, Clock, Plus } from "lucide-react";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { Label } from "@repo/ui";

import { toast } from "sonner";
import { useSettings, useUpdateSettings, uploadLogoImage } from "@repo/store";
const STORAGE_KEY = "slow_drip_store";

const SettingsPage = () => {
  // --- Cafe / Receipt info (API-backed) ---
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [cafeName, setCafeName]             = useState("");
  const [cafeTagline, setCafeTagline]       = useState("");
  const [addrLine1, setAddrLine1]           = useState("");
  const [addrLine2, setAddrLine2]           = useState("");
  const [phone, setPhone]                   = useState("");
  const [email, setEmail]                   = useState("");
  const [website, setWebsite]               = useState("");
  const [wifiName, setWifiName]             = useState("");
  const [wifiPass, setWifiPass]             = useState("");
  const [receiptFooter, setReceiptFooter]   = useState("");
  const [logoUrl, setLogoUrl]               = useState("");
  const [currency, setCurrency]             = useState("USD");
  const [studioHours, setStudioHours]       = useState<{ day: string; hours: string }[]>([]);
  const [logoUploading, setLogoUploading]   = useState(false);
  const [logoPreview, setLogoPreview]       = useState<string>("");
  const [khrRate, setKhrRate]               = useState("4010");
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Populate form when settings load
  useEffect(() => {
    if (!settings) return;
    setCafeName(settings.cafe_name ?? "");
    setCafeTagline(settings.cafe_tagline ?? "");
    setAddrLine1(settings.address_line1 ?? "");
    setAddrLine2(settings.address_line2 ?? "");
    setPhone(settings.phone ?? "");
    setEmail(settings.email ?? "");
    setWebsite(settings.website ?? "");
    setWifiName(settings.wifi_name ?? "");
    setWifiPass(settings.wifi_password ?? "");
    setReceiptFooter(settings.receipt_footer ?? "");
    setLogoUrl(settings.logo_url ?? "");
    setLogoPreview(settings.logo_url ?? "");
    setCurrency(settings.currency ?? "USD");
    setKhrRate(String(settings.khr_rate ?? 4010));
    setStudioHours(settings.studio_hours ?? [
      { day: "Mon – Fri", hours: "6:00 AM – 9:00 PM" },
      { day: "Saturday", hours: "7:00 AM – 6:00 PM" },
      { day: "Sunday", hours: "8:00 AM – 4:00 PM" },
    ]);
  }, [settings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setLogoPreview(objectUrl);
    setLogoUploading(true);
    try {
      const publicUrl = await uploadLogoImage(file);
      setLogoUrl(publicUrl);
      setLogoPreview(publicUrl);
      toast.success("Logo uploaded — click Save to apply");
    } catch (err: any) {
      toast.error("Logo upload failed: " + (err?.message ?? "Unknown error"));
      setLogoPreview(logoUrl); // revert preview
    } finally {
      setLogoUploading(false);
      // Reset file input so the same file can be re-selected
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleSaveCafeInfo = async () => {
    try {
      await updateSettings.mutateAsync({
        cafe_name:      cafeName,
        cafe_tagline:   cafeTagline || null,
        address_line1:  addrLine1 || null,
        address_line2:  addrLine2 || null,
        phone:          phone || null,
        email:          email || null,
        website:        website || null,
        wifi_name:      wifiName || null,
        wifi_password:  wifiPass || null,
        receipt_footer: receiptFooter || null,
        logo_url:       logoUrl || null,
        currency,
        khr_rate:       parseInt(khrRate) || 4010,
        studio_hours:   studioHours,
      });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  const handleResetData = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("slow_drip_users");
    localStorage.removeItem("slow_drip_customer_session");
    toast.success("All data reset to defaults. Refreshing...");
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your store configuration</p>
      </div>

      {/* -- Cafe & Receipt Info ------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex items-center gap-2 text-foreground">
          <Receipt className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Cafe & Receipt Info</h3>
          <span className="text-[10px] text-muted-foreground ml-auto uppercase tracking-widest">Appears on every receipt</span>
        </div>

        {settingsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : (
          <>
            {/* Name + Tagline */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Store className="h-3 w-3" /> Cafe Name
                </Label>
                <Input value={cafeName} onChange={e => setCafeName(e.target.value)} className="h-9 text-sm" placeholder="Slow Drip Cafe" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tagline / Description</Label>
                <Input value={cafeTagline} onChange={e => setCafeTagline(e.target.value)} className="h-9 text-sm" placeholder="Artisanal Coffee & Tea" />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> Address Line 1
              </Label>
              <Input value={addrLine1} onChange={e => setAddrLine1(e.target.value)} className="h-9 text-sm" placeholder="No. 123, Street 217, Sangkat Veal Vong" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Address Line 2</Label>
              <Input value={addrLine2} onChange={e => setAddrLine2(e.target.value)} className="h-9 text-sm" placeholder="Khan 7 Makara, Phnom Penh, Cambodia" />
            </div>

            {/* Phone / Email / Website */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> Phone
                </Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-9 text-sm" placeholder="012-345-6789" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-9 text-sm" placeholder="hello@cafe.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Website</Label>
                <Input value={website} onChange={e => setWebsite(e.target.value)} className="h-9 text-sm" placeholder="www.slowdripcafe.com" />
              </div>
            </div>

            {/* WiFi */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Wifi className="h-3 w-3" /> WiFi Network Name
                </Label>
                <Input value={wifiName} onChange={e => setWifiName(e.target.value)} className="h-9 text-sm" placeholder="SlowDrip_Cafe" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">WiFi Password</Label>
                <Input value={wifiPass} onChange={e => setWifiPass(e.target.value)} className="h-9 text-sm" placeholder="slowdrip2024" />
              </div>
            </div>

            {/* Receipt Footer */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Receipt Footer Message</Label>
              <Input value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} className="h-9 text-sm" placeholder="Thank you for your visit!" />
              <p className="text-[10px] text-muted-foreground">Shown as *** message *** at the bottom of the receipt.</p>
            </div>

            {/* Studio Hours */}
            <div className="space-y-2 pt-1 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Studio Hours
                </Label>
                <button
                  type="button"
                  onClick={() => setStudioHours(h => [...h, { day: "", hours: "" }])}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" /> Add row
                </button>
              </div>
              <div className="space-y-2">
                {studioHours.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={row.day}
                      onChange={e => setStudioHours(h => h.map((r, j) => j === i ? { ...r, day: e.target.value } : r))}
                      className="h-8 text-xs flex-1"
                      placeholder="e.g. Mon – Fri"
                    />
                    <Input
                      value={row.hours}
                      onChange={e => setStudioHours(h => h.map((r, j) => j === i ? { ...r, hours: e.target.value } : r))}
                      className="h-8 text-xs flex-1"
                      placeholder="e.g. 6:00 AM – 9:00 PM"
                    />
                    <button
                      type="button"
                      onClick={() => setStudioHours(h => h.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Shown on the customer Contact page.</p>
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Logo</Label>
              <div className="flex items-center gap-4">
                {/* Preview box */}
                <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0 relative">
                  {logoPreview ? (
                    <>
                      <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-1" />
                      <button
                        type="button"
                        onClick={() => { setLogoPreview(""); setLogoUrl(""); }}
                        className="absolute top-0.5 right-0.5 bg-background rounded-full p-0.5 shadow border border-border opacity-70 hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <ImagePlus className="h-6 w-6 text-muted-foreground/50" />
                  )}
                </div>
                {/* Upload button */}
                <div className="space-y-1.5">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={logoUploading}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    {logoUploading ? "Uploading…" : "Upload Logo"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">PNG, JPG, WebP or SVG. Shown at top of receipt.</p>
                  <p className="text-[10px] text-muted-foreground">Leave empty to use the default logo.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1 border-t border-border">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Currency</Label>
                <Input value={currency} onChange={e => setCurrency(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Exchange Rate (KHR)</Label>
                <Input type="number" value={khrRate} onChange={e => setKhrRate(e.target.value)} className="h-9 text-sm" placeholder="4010" />
              </div>
            </div>

            <Button onClick={handleSaveCafeInfo} disabled={updateSettings.isPending} className="gap-2">
              {updateSettings.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Cafe Info
            </Button>
          </>
        )}
      </div>

    </div>
  );
};

export default SettingsPage;
