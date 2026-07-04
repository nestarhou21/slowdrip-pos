import { useState, useEffect } from "react";
import {
  ArrowLeft, Calendar, CalendarCheck2, CheckCircle2, ChevronRight,
  Clock, CreditCard, Loader2, Package, Search, UserPlus, Users,
} from "lucide-react";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui";
import { Dialog, DialogContent, DialogTitle } from "@repo/ui";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Input } from "@repo/ui";
import { Label } from "@repo/ui";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  useApiServiceTypes,
  useApiCustomers,
  useApiAdminUserPackages,
  useApiWellnessPackages,
  useApiSchedules,
  useRegisterCustomer,
  useCreateUserPackage,
  useUpdateUserPackage,
  useAdminCheckPackageBakongStatus,
  useAdminBookCustomer,
  useSettings,
  type ApiSchedule,
  type ApiUserPackage,
  type ApiCustomerAccount,
  type ApiWellnessPackage,
} from "@repo/store";
import { canonicalServiceTypeLabel, fmt12, getInstructorName, getScheduleName, parseRecoveryNote } from "./classesUtils";

// Generate a consistent bg color from a string (email/name) for avatars
const avatarColor = (seed: string) => {
  const colors = [
    "bg-rose-400","bg-pink-400","bg-fuchsia-400","bg-violet-400",
    "bg-indigo-400","bg-blue-400","bg-cyan-400","bg-teal-400",
    "bg-emerald-400","bg-amber-400","bg-orange-400",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const CustomerAvatar = ({ c, size = "md", selected = false }: { c: any; size?: "sm"|"md"; selected?: boolean }) => {
  const name = `${c.user.firstName ?? ""} ${c.user.lastName ?? ""}`.trim();
  const initials = name
    ? (c.user.firstName?.[0] ?? "") + (c.user.lastName?.[0] ?? "")
    : (c.user.email?.[0] ?? "?");
  const color = selected ? "" : avatarColor(c.user.email || name);
  const dim = size === "sm" ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <div className={cn(
      dim, "rounded-full flex items-center justify-center font-bold uppercase shrink-0",
      selected ? "bg-primary text-primary-foreground" : `${color} text-white`
    )}>
      {initials.toUpperCase() || "?"}
    </div>
  );
};

type BookingStep = "customer" | "buy-package" | "payment" | "session";

interface ManualBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialScheduleId?: string;
  initialDate?: string;
  allSchedules: ApiSchedule[];
}

const ManualBookingDialog = ({
  open,
  onOpenChange,
  initialScheduleId,
  initialDate,
  allSchedules,
}: ManualBookingDialogProps) => {
  const [step, setStep] = useState<BookingStep>("customer");

  // Customer
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerData, setSelectedCustomerData] = useState<ApiCustomerAccount | null>(null);
  const [showQuickReg, setShowQuickReg] = useState(false);
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Package — primary ID drives filtering/benefit logic; Set tracks all selected for multi-package booking
  const [selectedExistingPkgId, setSelectedExistingPkgId] = useState<string | null>(null);
  const [selectedExistingPkgIds, setSelectedExistingPkgIds] = useState<Set<string>>(new Set());
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string | null>(null);
  const [selectedCatalogPkgId, setSelectedCatalogPkgId] = useState<string | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bakong">("cash");
  const [newUserPackage, setNewUserPackage] = useState<ApiUserPackage | null>(null);
  const [bakongQr, setBakongQr] = useState<{ qr_string: string; md5: string } | null>(null);
  const [pendingPkgId, setPendingPkgId] = useState<string | null>(null);
  const [pendingPkgFullData, setPendingPkgFullData] = useState<ApiUserPackage | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(300);
  const [qrExpired, setQrExpired] = useState(false);

  // Session
  const [bookingDate, setBookingDate] = useState<string>(initialDate || format(new Date(), "yyyy-MM-dd"));
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(initialScheduleId || null);
  const [forceBooking, setForceBooking] = useState(false);
  const [bookingQuantity, setBookingQuantity] = useState(1);

  // ─── Data ────────────────────────────────────────────────────────────────
  const { data: serviceTypesRaw = [] } = useApiServiceTypes();
  const serviceTypes = serviceTypesRaw as any[];

  // Debounce the search so the API only fires 300ms after the user stops typing
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(customerSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  const { data: customersPage, isLoading: customersLoading, isFetching: customersFetching } = useApiCustomers(
    1, undefined, true, debouncedSearch || undefined
  );
  const filteredCustomers = (customersPage as any)?.data ?? [];

  const { data: userPackagesRaw = [], isLoading: packagesLoading } = useApiAdminUserPackages(selectedCustomerId) as any;
  const userPackages: ApiUserPackage[] = userPackagesRaw;

  const { data: catalogPkgsRaw = [] } = useApiWellnessPackages() as any;
  const catalogPackages: ApiWellnessPackage[] = catalogPkgsRaw;

  const activeUserPackages = userPackages.filter(p =>
    (p.status === "active" || p.status === "not_started" || p.status === "exhausted") && p.paymentStatus === "confirmed"
  );

  const [pkgTypeFilter, setPkgTypeFilter] = useState("all");

  // Recovery Lounge service type ID — needed early for effectivePackageId smart-select
  const recoveryServiceTypeId = serviceTypes.find((st: any) =>
    st.name.toLowerCase().includes("recovery")
  )?.id as string | undefined;

  // Derive the effective package ID (existing selection or newly purchased)
  // Smart-select: if session matches the new package's service type → new package, else → existing
  const effectivePackageId = (() => {
    if (newUserPackage && selectedExistingPkgId && selectedCatalogPkgId && selectedScheduleId) {
      const newPkgServiceTypeId = catalogPackages.find(p => p.id === selectedCatalogPkgId)?.serviceTypeId;
      if (newPkgServiceTypeId) {
        const chosenSession = allSchedules.find((s: ApiSchedule) => s.id === selectedScheduleId);
        return chosenSession?.serviceTypeId === newPkgServiceTypeId
          ? newUserPackage.id
          : selectedExistingPkgId;
      }
    }
    return newUserPackage?.id ?? selectedExistingPkgId;
  })();

  // ── Resolve the selected package metadata ──────────────────────────────────
  // UserPackageResource returns: package.serviceType.id  (nested object)
  // WellnessPackageResource returns: serviceTypeId       (flat field)
  // We must handle both shapes.
  // When a new package was just purchased (newUserPackage set), that package
  // drives the session step — not the pre-existing selected package.
  const resolvedPackageMeta = (() => {
    if (newUserPackage && selectedCatalogPkgId) {
      const pkg = catalogPackages.find(p => p.id === selectedCatalogPkgId);
      return {
        serviceTypeId: pkg?.serviceTypeId ?? null as string | null,
        packageType:   (pkg as any)?.packageType as string | null ?? null,
      };
    }
    if (selectedExistingPkgId) {
      const up = activeUserPackages.find(p => p.id === selectedExistingPkgId);
      const pkg = (up as any)?.package;
      return {
        serviceTypeId: pkg?.serviceType?.id ?? pkg?.serviceTypeId ?? null as string | null,
        packageType:   pkg?.packageType as string | null ?? null,
      };
    }
    if (selectedCatalogPkgId) {
      const pkg = catalogPackages.find(p => p.id === selectedCatalogPkgId);
      return {
        serviceTypeId: pkg?.serviceTypeId ?? null as string | null,
        packageType:   (pkg as any)?.packageType as string | null ?? null,
      };
    }
    return { serviceTypeId: null, packageType: null };
  })();

  const isMembership = resolvedPackageMeta.packageType === "membership";
  const effectiveServiceTypeId = resolvedPackageMeta.serviceTypeId;

  // The existing (pre-purchase) package's service type — used for dual-type session filtering
  const existingPkgServiceTypeId = (() => {
    if (!selectedExistingPkgId) return null as string | null;
    const up = activeUserPackages.find(p => p.id === selectedExistingPkgId);
    const pkg = (up as any)?.package;
    return (pkg?.serviceType?.id ?? pkg?.serviceTypeId ?? null) as string | null;
  })();

  // ── Recovery benefit helpers — read from structured fields, no regex needed ──
  const pkgFreeRecoverySessions = (pkg: any): number =>
    (pkg?.package?.freeRecoverySessions ?? pkg?.package?.free_recovery_sessions) ?? 0;

  const pkgRecoveryDiscount = (pkg: any): number =>
    (pkg?.package?.recoveryDiscountPercent ?? pkg?.package?.recovery_discount_percent) ?? 0;

  const pkgGroupRecoveryDiscount = (pkg: any): number =>
    (pkg?.package?.groupRecoveryDiscountPercent ?? pkg?.package?.group_recovery_discount_percent) ?? 0;

  // Badge helpers used in the package list (for display of existing packages)
  const pkgHasFreeRecovery = (pkg: any) => pkgFreeRecoverySessions(pkg) > 0;
  const pkgHasRecoveryDiscount = (pkg: any) => pkgRecoveryDiscount(pkg) > 0 || pkgGroupRecoveryDiscount(pkg) > 0;

  // Returns true when a package has ZERO remaining benefits of any kind
  // (no sessions, no free recovery, and no unused discount).
  const hasNoBookableBenefit = (up: ApiUserPackage): boolean => {
    const sessionsLeft = up.sessionsRemaining;
    // null = unlimited, > 0 = sessions remain → always usable for own class type
    if (sessionsLeft === null || sessionsLeft === undefined || sessionsLeft > 0) return false;
    const pkg = (up as any)?.package;
    const pkgName = (pkg?.name ?? "").toLowerCase();
    const recoveryUsed: number = pkg?.recoveryBookingsCount ?? 0;
    const discountUsed: number = pkg?.discountUsageCount ?? 0;

    // Helper: does this pkg still have an unused discount benefit?
    const hasDiscountBenefit = (() => {
      let pct: number = pkg?.recoveryDiscountPercent ?? 0;
      if (pct === 0) {
        const m = ((pkg?.benefits ?? []) as string[]).join(" ").match(/(\d+)\s*%/i);
        if (m) pct = parseInt(m[1], 10);
      }
      return pct > 0 && discountUsed === 0;
    })();

    if (pkgName.includes("couple")) {
      // Couple: complimentary recovery (1 use) + optional discount
      const coupleRecoveryDone = recoveryUsed >= 1;
      return coupleRecoveryDone && !hasDiscountBenefit;
    }

    // Non-couple: free recovery sessions + optional discount
    let freeTotal: number = pkg?.freeRecoverySessions ?? 0;
    if (freeTotal === 0) {
      const joined = ((pkg?.benefits ?? []) as string[]).join(" ");
      const m = joined.match(/(\d+)\s*(?:free|complimentary).*?recovery/i);
      if (m) freeTotal = parseInt(m[1], 10);
    }
    const freeRecoveryLeft = Math.max(0, freeTotal - recoveryUsed) > 0;
    return !freeRecoveryLeft && !hasDiscountBenefit;
  };

  // Returns true if the UserPackage (from activeUserPackages) is a membership type
  const isUpMembership = (up: any): boolean => {
    const pkg = up?.package;
    return (pkg?.packageType ?? pkg?.package_type ?? "").toLowerCase().includes("membership")
      || (pkg?.serviceType?.name ?? "").toLowerCase().includes("membership");
  };

  // For a given session, returns which selected package covers it and how (session deduct vs free benefit)
  const getPackageForSession = (session: ApiSchedule): { name: string; isFreeRecovery: boolean } | null => {
    if (selectedExistingPkgIds.size <= 1) return null;
    const isRecovery = session.serviceTypeId === recoveryServiceTypeId;
    // 1. Direct type match or membership coverage
    for (const pkgId of selectedExistingPkgIds) {
      const up = activeUserPackages.find(p => p.id === pkgId);
      if (!up) continue;
      const stId = (up as any)?.package?.serviceType?.id;
      const isMem = isUpMembership(up);
      if (isRecovery) continue; // handle recovery separately below
      if (isMem || stId === session.serviceTypeId) {
        return { name: (up as any)?.package?.name ?? "Package", isFreeRecovery: false };
      }
    }
    // 2. Recovery session — find package with free recovery benefit first, then membership
    if (isRecovery) {
      for (const pkgId of selectedExistingPkgIds) {
        const up = activeUserPackages.find(p => p.id === pkgId);
        if (!up) continue;
        const freeTotal = pkgFreeRecoverySessions(up);
        const recoveryUsed = (up as any)?.package?.recoveryBookingsCount ?? 0;
        if (freeTotal > 0 && (freeTotal - recoveryUsed) > 0) {
          return { name: (up as any)?.package?.name ?? "Package", isFreeRecovery: true };
        }
      }
      for (const pkgId of selectedExistingPkgIds) {
        const up = activeUserPackages.find(p => p.id === pkgId);
        if (!up) continue;
        if (isUpMembership(up)) {
          return { name: (up as any)?.package?.name ?? "Package", isFreeRecovery: false };
        }
      }
    }
    return null;
  };

  // Detect recovery benefits on the selected existing package (for session step)
  const selectedExistingPkg = activeUserPackages.find(p => p.id === selectedExistingPkgId);
  const hasFreeRecoveryBenefit = pkgHasFreeRecovery(selectedExistingPkg);

  // Individual recovery discount — prefer structured field, fall back to benefits text
  // (same logic as the badge rendering so catalog prices always match what the badge shows)
  const recoveryDiscountPct = (() => {
    const structured = pkgRecoveryDiscount(selectedExistingPkg);
    if (structured > 0) return structured;
    const benefitsArr: string[] = (selectedExistingPkg as any)?.package?.benefits ?? [];
    const m = benefitsArr.join(" ").match(/(\d+)\s*%/i);
    return m ? parseInt(m[1], 10) : 0;
  })();

  // Group recovery discount — prefer structured field, fall back to benefits text
  const groupRecoveryDiscountPct = (() => {
    const structured = pkgGroupRecoveryDiscount(selectedExistingPkg);
    if (structured > 0) return structured;
    const benefitsArr: string[] = (selectedExistingPkg as any)?.package?.benefits ?? [];
    const m = benefitsArr.join(" ").match(/group.*?(\d+)\s*%|(\d+)\s*%.*?group/i);
    return m ? parseInt(m[1] ?? m[2], 10) : 0;
  })();
  const hasRecoveryBenefit = hasFreeRecoveryBenefit || recoveryDiscountPct > 0 || groupRecoveryDiscountPct > 0;

  // Free recovery: tracked via recovery bookings made directly with this package
  const recoveryBookingsUsed: number = (selectedExistingPkg as any)?.package?.recoveryBookingsCount ?? 0;
  const freeRecoveryTotal = pkgFreeRecoverySessions(selectedExistingPkg);
  const freeRecoveryRemaining = Math.max(0, freeRecoveryTotal - recoveryBookingsUsed);
  const freeRecoveryAvailable = hasFreeRecoveryBenefit && freeRecoveryRemaining > 0;

  // Discount benefit: one-time use — tracked via discountUsageCount (confirmed purchases via this pkg)
  const discountUsageCount: number = (selectedExistingPkg as any)?.package?.discountUsageCount ?? 0;
  const discountBenefitAvailable = recoveryDiscountPct > 0 && discountUsageCount === 0;
  const groupDiscountBenefitAvailable = groupRecoveryDiscountPct > 0 && discountUsageCount === 0;
  const anyDiscountBenefitAvailable = discountBenefitAvailable || groupDiscountBenefitAvailable;

  // Returns the applicable discount % for a given recovery catalog package
  const getApplicableDiscount = (pkgName?: string | null): number => {
    const isGroup = !!(pkgName?.toLowerCase().includes("group"));
    if (isGroup) return groupDiscountBenefitAvailable ? groupRecoveryDiscountPct : 0;
    return discountBenefitAvailable ? recoveryDiscountPct : 0;
  };

  // Kept for backward-compat display (individual recovery discount only)
  const bestRecoveryDiscount = discountBenefitAvailable ? recoveryDiscountPct : 0;

  const isRecoveryServiceType = (serviceTypeId: string | null | undefined) => {
    if (!serviceTypeId || !recoveryServiceTypeId) return false;
    return serviceTypeId === recoveryServiceTypeId;
  };

  const discountedPrice = (basePrice: number, serviceTypeId?: string | null, pkgName?: string | null) => {
    if (!isRecoveryServiceType(serviceTypeId)) return basePrice;
    const pct = getApplicableDiscount(pkgName);
    return pct > 0 ? Math.round(basePrice * (1 - pct / 100) * 100) / 100 : basePrice;
  };

  const { data: daySchedulesRaw = [] } = useApiSchedules({ date: bookingDate }) as any;
  const daySchedules: ApiSchedule[] = (() => {
    const all: ApiSchedule[] = daySchedulesRaw;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (bookingDate !== todayStr) return all;
    // For today: hide sessions that started more than 5 minutes ago
    const now = Date.now();
    return all.filter((s) => {
      if (!s.startTime) return true;
      const [h, m] = s.startTime.split(":").map(Number);
      const slotStart = new Date();
      slotStart.setHours(h, m, 0, 0);
      return slotStart.getTime() + 5 * 60 * 1000 >= now;
    });
  })();

  const activePackageName = (
    newUserPackage && selectedCatalogPkgId
      ? catalogPackages.find(p => p.id === selectedCatalogPkgId)?.name
      : (selectedExistingPkg as any)?.package?.name
  )?.toLowerCase() ?? "";
  const isCouplePackage   = activePackageName.includes("couple");
  const isGroupRecoverPkg = activePackageName.includes("group recover");
  const isIndividualRecovery = effectiveServiceTypeId === recoveryServiceTypeId && !isGroupRecoverPkg && !isCouplePackage;

  // Helper: is this schedule a 2hr group recovery slot?
  const is2hrGroupSlot = (s: ApiSchedule) => {
    const startH = parseInt((s.startTime || "00:00").split(":")[0], 10);
    const endH   = parseInt((s.endTime   || "00:00").split(":")[0], 10);
    return s.serviceTypeId === recoveryServiceTypeId && (endH - startH) >= 2;
  };

  // Session filtering rules:
  // - Couple membership → pilates (all) + empty 1hr recovery slots only
  // - Regular membership → all sessions
  // - Individual recovery package → 1hr slots only (hide 2hr group slots)
  // - Group recover package → all recovery slots (including 2hr group)
  // - Package with FREE recovery benefit → own type + 1hr recovery slots
  // - Regular package → filter strictly to that service type
  // - No package selected → show nothing
  const sessionOptions = (() => {
    // ── Multi-package path: union of all selected packages' eligible session types ──
    if (selectedExistingPkgIds.size > 1) {
      const eligibleTypeIds = new Set<string>();
      let anyMembership = false;
      let anyFreeRecovery = false;

      for (const pkgId of selectedExistingPkgIds) {
        const up = activeUserPackages.find(p => p.id === pkgId);
        if (!up) continue;
        const isExhaustedPkg = up.status === "exhausted";
        // Exhausted packages can't contribute normal class sessions — only benefits
        if (!isExhaustedPkg) {
          if (isUpMembership(up)) {
            anyMembership = true;
          } else {
            const stId = (up as any)?.package?.serviceType?.id;
            if (stId) eligibleTypeIds.add(stId);
          }
        }
        const freeTotal = pkgFreeRecoverySessions(up);
        const recoveryUsed = (up as any)?.package?.recoveryBookingsCount ?? 0;
        if (freeTotal > 0 && freeTotal - recoveryUsed > 0) anyFreeRecovery = true;
        // Couple complimentary recovery benefit applies even when exhausted
        if (isExhaustedPkg && (up as any)?.package?.name?.toLowerCase().includes("couple") && recoveryServiceTypeId) {
          anyFreeRecovery = true;
        }
      }

      const matched = daySchedules.filter((s: ApiSchedule) => {
        if (anyMembership) return true;
        return eligibleTypeIds.has(s.serviceTypeId);
      });

      // Include 1hr recovery slots if any package has a free recovery benefit
      if (anyFreeRecovery && recoveryServiceTypeId && !anyMembership) {
        const recSessions = daySchedules.filter((s: ApiSchedule) =>
          s.serviceTypeId === recoveryServiceTypeId && !is2hrGroupSlot(s)
        );
        const existingIds = new Set(matched.map(s => s.id));
        return [...matched, ...recSessions.filter(s => !existingIds.has(s.id))];
      }

      return matched;
    }

    // ── Single exhausted package: only show sessions for remaining benefits ──
    // An exhausted package (0 sessions left) must not show regular class sessions.
    // Only show recovery sessions when the package still has usable recovery benefits.
    const primaryPkg = selectedExistingPkgIds.size <= 1
      ? activeUserPackages.find(p => p.id === selectedExistingPkgId)
      : null;
    // Treat as exhausted if status is "exhausted" OR sessions_remaining is explicitly 0
    // (covers edge case where status wasn't updated but sessions hit 0).
    const primaryHasNoSessions = primaryPkg != null && (
      primaryPkg.status === "exhausted" ||
      (primaryPkg.sessionsRemaining !== null && primaryPkg.sessionsRemaining !== undefined && primaryPkg.sessionsRemaining <= 0)
    );
    if (primaryHasNoSessions && !newUserPackage) {
      const pkgName = (primaryPkg as any)?.package?.name?.toLowerCase() ?? "";
      const isCouple = pkgName.includes("couple");

      if (isCouple && recoveryServiceTypeId) {
        // Couple's complimentary recovery — only empty 1hr recovery slots
        return daySchedules.filter((s: ApiSchedule) => {
          if (s.serviceTypeId !== recoveryServiceTypeId) return false;
          const startH = parseInt((s.startTime || "00:00").split(":")[0], 10);
          const endH   = parseInt((s.endTime   || "00:00").split(":")[0], 10);
          return s.bookedCount === 0 && (endH - startH) === 1;
        });
      }

      if (freeRecoveryAvailable && recoveryServiceTypeId) {
        // Class pack with unused free recovery sessions
        return daySchedules.filter((s: ApiSchedule) =>
          s.serviceTypeId === recoveryServiceTypeId && !is2hrGroupSlot(s)
        );
      }

      // No usable benefits left — nothing to show
      return [] as ApiSchedule[];
    }

    if (isMembership && isCouplePackage) {
      // Couple package:
      // - Pilates: show all sessions (books 2 spots, no exclusivity needed)
      // - Recovery: show only empty 1hr slots (exclusive private)
      return daySchedules.filter((s: ApiSchedule) => {
        const isRecoverySlot = s.serviceTypeId === recoveryServiceTypeId;
        if (isRecoverySlot) {
          const isEmpty = s.bookedCount === 0;
          const startH = parseInt((s.startTime || "00:00").split(":")[0], 10);
          const endH   = parseInt((s.endTime   || "00:00").split(":")[0], 10);
          return isEmpty && (endH - startH) === 1;
        }
        return true;
      });
    }
    if (isMembership) return daySchedules;
    if (effectiveServiceTypeId) {
      const typeMatched = daySchedules.filter((s: ApiSchedule) => {
        if (s.serviceTypeId !== effectiveServiceTypeId) return false;
        // Individual recovery package: hide 2hr group slots
        if (isIndividualRecovery && is2hrGroupSlot(s)) return false;
        return true;
      });

      // Dual-type: when a new package was just purchased AND an existing package of a
      // different service type is also selected, include that type's sessions too
      let existingTypeMatched: ApiSchedule[] = [];
      if (newUserPackage && existingPkgServiceTypeId && existingPkgServiceTypeId !== effectiveServiceTypeId) {
        existingTypeMatched = daySchedules.filter((s: ApiSchedule) =>
          s.serviceTypeId === existingPkgServiceTypeId
        );
      }

      if (freeRecoveryAvailable && recoveryServiceTypeId && effectiveServiceTypeId !== recoveryServiceTypeId) {
        // Free recovery benefit: only 1hr individual slots (not 2hr group slots)
        const recoverySessions = daySchedules.filter((s: ApiSchedule) =>
          s.serviceTypeId === recoveryServiceTypeId && !is2hrGroupSlot(s)
        );
        return [...typeMatched, ...recoverySessions, ...existingTypeMatched];
      }
      return [...typeMatched, ...existingTypeMatched];
    }
    return [] as ApiSchedule[];
  })();

  const effectivePackageName =
    newUserPackage?.package?.name
    ?? catalogPackages.find(p => p.id === selectedCatalogPkgId)?.name
    ?? userPackages.find(p => p.id === selectedExistingPkgId)?.package?.name;

  // Max spots: min(available session spots, sessions remaining in the effective package)
  const maxBookingQuantity = (() => {
    const schedule = selectedScheduleId
      ? sessionOptions.find((s: ApiSchedule) => s.id === selectedScheduleId) ?? allSchedules.find(s => s.id === selectedScheduleId)
      : null;
    const spotsLeft = schedule ? Math.max(0, schedule.maxCapacity - schedule.bookedCount) : 1;

    // Multi-package: count only packages applicable to the chosen session (each contributes 1 spot)
    let pkgRemaining: number;
    if (selectedExistingPkgIds.size > 1) {
      const chosenServiceTypeId = schedule?.serviceTypeId;
      const isRecoverySession = chosenServiceTypeId === recoveryServiceTypeId;
      const applicableCount = [...selectedExistingPkgIds].filter(id => {
        const up = activeUserPackages.find(p => p.id === id);
        if (!up) return false;
        if (isUpMembership(up)) return true;
        const stId = (up as any)?.package?.serviceType?.id;
        if (stId === chosenServiceTypeId) return true;
        if (isRecoverySession && stId !== chosenServiceTypeId) {
          const freeTotal = pkgFreeRecoverySessions(up);
          const recoveryUsed = (up as any)?.package?.recoveryBookingsCount ?? 0;
          return freeTotal > 0 && (freeTotal - recoveryUsed) > 0;
        }
        return false;
      }).length;
      pkgRemaining = Math.max(1, applicableCount);
    } else if (effectivePackageId === newUserPackage?.id && newUserPackage != null) {
      pkgRemaining = newUserPackage.sessionsRemaining ?? 1;
    } else if (effectivePackageId === selectedExistingPkgId && selectedExistingPkg != null) {
      pkgRemaining = selectedExistingPkg.sessionsRemaining ?? 1;
    } else if (newUserPackage != null) {
      pkgRemaining = newUserPackage.sessionsRemaining ?? 1;
    } else {
      pkgRemaining = 1;
    }

    return Math.max(1, Math.min(spotsLeft, pkgRemaining));
  })();

  // ─── Mutations ────────────────────────────────────────────────────────────
  const registerMutation = useRegisterCustomer();
  const createPackage = useCreateUserPackage();
  const updatePkg = useUpdateUserPackage();
  const checkBakong = useAdminCheckPackageBakongStatus();
  const bookCustomer = useAdminBookCustomer();
  const { data: settingsData } = useSettings();
  const khrRate = (settingsData as any)?.khr_rate || 4010;
  const fmtKHR = (v: number) => `${Math.round(v * khrRate).toLocaleString()} ៛`;

  // Payment step derived values
  const selectedPkg = catalogPackages.find(p => p.id === selectedCatalogPkgId);
  const packageBasePrice = selectedPkg ? parseFloat(selectedPkg.price) : 0;
  const packagePrice = discountedPrice(packageBasePrice, selectedPkg?.serviceTypeId, selectedPkg?.name);

  // ─── QR countdown polling ─────────────────────────────────────────────────
  useEffect(() => {
    if (!bakongQr || !pendingPkgId) return;
    setQrSecondsLeft(300);
    setQrExpired(false);
    const start = Date.now();
    const interval = setInterval(async () => {
      const elapsed = Date.now() - start;
      setQrSecondsLeft(Math.max(0, Math.ceil((300000 - elapsed) / 1000)));
      if (elapsed >= 300000) { setQrExpired(true); clearInterval(interval); return; }
      try {
        const res = await checkBakong.mutateAsync(pendingPkgId);
        if ((res as any).status === "confirmed") {
          clearInterval(interval);
          setBakongQr(null);
          // Keep selectedCatalogPkgId so effectiveServiceTypeId still filters sessions correctly.
          // Use the full package data saved at QR generation time so sessionsRemaining is correct.
          setNewUserPackage(pendingPkgFullData ?? { id: pendingPkgId } as ApiUserPackage);
          setPendingPkgId(null);
          setPendingPkgFullData(null);
          setStep("session");
          toast.success("Payment confirmed! Proceeding to session selection.");
        }
      } catch (err) {
        // Errors during polling are expected (network hiccups); keep polling silently
        console.debug("[BakongPoll] status check failed:", err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [bakongQr?.md5]);

  const reset = () => {
    setStep("customer");
    setCustomerSearch(""); setSelectedCustomerId(null); setSelectedCustomerData(null);
    setShowQuickReg(false);
    setRegFirstName(""); setRegLastName(""); setRegEmail(""); setRegPhone(""); setRegPassword("");
    setSelectedExistingPkgId(null); setSelectedExistingPkgIds(new Set());
    setSelectedServiceTypeId(null); setSelectedCatalogPkgId(null); setPurchaseQuantity(1); setPaymentMethod("cash");
    setNewUserPackage(null); setBakongQr(null); setPendingPkgId(null); setPendingPkgFullData(null);
    setQrSecondsLeft(300); setQrExpired(false);
    setSelectedScheduleId(initialScheduleId || null); setForceBooking(false);
    setBookingQuantity(1);
    setBookingDate(initialDate || format(new Date(), "yyyy-MM-dd"));
  };

  const handleRegister = async () => {
    if (!regFirstName.trim() || !regEmail.trim()) return;
    try {
      await registerMutation.mutateAsync({
        firstName: regFirstName.trim(),
        lastName: regLastName.trim() || undefined,
        email: regEmail.trim(),
        phone: regPhone.trim() || undefined,
        password: regPassword.trim() || undefined,
      });
      toast.success("Customer registered — select them below");
      setCustomerSearch(regEmail.trim());
      setShowQuickReg(false);
      setRegFirstName(""); setRegLastName(""); setRegEmail(""); setRegPhone(""); setRegPassword("");
    } catch (err: any) {
      toast.error(err?.body?.message || "Registration failed");
    }
  };

  const handlePurchase = async () => {
    if (!selectedCustomerId || !selectedCatalogPkgId) return;
    const isBakong = paymentMethod === "bakong";
    const discountSourceId = anyDiscountBenefitAvailable && selectedExistingPkgId ? selectedExistingPkgId : null;
    try {
      if (!isBakong) {
        // Cash: create N separate package records (Option A)
        let lastPkg = null;
        for (let i = 0; i < purchaseQuantity; i++) {
          const result = await createPackage.mutateAsync({
            userId: selectedCustomerId,
            packageId: selectedCatalogPkgId,
            paymentMethod: "cash",
            paymentStatus: "confirmed",
            benefitSourcePackageId: discountSourceId,
          });
          lastPkg = result.data;
        }
        setNewUserPackage(lastPkg);
        setStep("session");
        toast.success(purchaseQuantity > 1 ? `${purchaseQuantity} packages purchased!` : "Package purchased!");
      } else {
        // Bakong QR: single package only (QR is per-transaction)
        const result = await createPackage.mutateAsync({
          userId: selectedCustomerId,
          packageId: selectedCatalogPkgId,
          paymentMethod: "qr_scan",
          paymentStatus: "pending",
          benefitSourcePackageId: discountSourceId,
        });
        if (result.bakong_qr) {
          setPendingPkgId(result.data.id);
          setPendingPkgFullData(result.data);
          setBakongQr(result.bakong_qr);
        } else {
          toast.error("Failed to generate Bakong QR. Check backend config.");
        }
      }
    } catch (err: any) {
      toast.error(err?.body?.message || "Failed to create package");
    }
  };

  const handleCancelBakong = async () => {
    if (pendingPkgId) {
      try { await updatePkg.mutateAsync({ id: pendingPkgId, paymentStatus: "failed" }); } catch {}
    }
    setBakongQr(null); setPendingPkgId(null); setQrExpired(false); setQrSecondsLeft(300);
  };

  const handleBook = async () => {
    if (!selectedCustomerId || !selectedScheduleId || !effectivePackageId) return;
    try {
      if (selectedExistingPkgIds.size > 1) {
        // Multi-package: only book from packages that are actually applicable to the selected session
        const chosenSession = sessionOptions.find((s: ApiSchedule) => s.id === selectedScheduleId)
          ?? allSchedules.find(s => s.id === selectedScheduleId);
        const chosenServiceTypeId = chosenSession?.serviceTypeId;
        const isRecoverySession = chosenServiceTypeId === recoveryServiceTypeId;

        const applicablePkgIds = [...selectedExistingPkgIds].filter(pkgId => {
          const up = activeUserPackages.find(p => p.id === pkgId);
          if (!up) return false;
          if (isUpMembership(up)) return true;
          const stId = (up as any)?.package?.serviceType?.id;
          if (stId === chosenServiceTypeId) return true;
          // Cross-type recovery booking using free benefit
          if (isRecoverySession && stId !== chosenServiceTypeId) {
            const freeTotal = pkgFreeRecoverySessions(up);
            const recoveryUsed = (up as any)?.package?.recoveryBookingsCount ?? 0;
            return freeTotal > 0 && (freeTotal - recoveryUsed) > 0;
          }
          return false;
        });

        let booked = 0;
        for (const pkgId of applicablePkgIds) {
          try {
            await bookCustomer.mutateAsync({
              userId: selectedCustomerId,
              scheduleId: selectedScheduleId,
              userPackageId: pkgId,
              force: forceBooking,
            });
            booked++;
          } catch (err: any) {
            const pkgName = (activeUserPackages.find(p => p.id === pkgId) as any)?.package?.name ?? pkgId;
            toast.error(`"${pkgName}" failed: ${err?.body?.message || "booking error"}`);
          }
        }
        if (booked > 0) toast.success(`Booked ${booked} spot${booked > 1 ? "s" : ""} across ${booked} package${booked > 1 ? "s" : ""}!`);
        else return; // all failed — don't close dialog
      } else {
        await bookCustomer.mutateAsync({
          userId: selectedCustomerId,
          scheduleId: selectedScheduleId,
          userPackageId: effectivePackageId,
          force: forceBooking,
          ...(bookingQuantity > 1 ? { group_size: bookingQuantity } : {}),
        });
        toast.success(bookingQuantity > 1 ? `Booked ${bookingQuantity} spots successfully!` : "Booked successfully!");
      }
      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast.error(err?.body?.message || "Failed to book");
    }
  };

  const stepTitle: Record<BookingStep, string> = {
    customer:     "Identify Customer",
    "buy-package":"Select Package",
    payment:      "Collect Payment",
    session:      "Choose Session",
  };

  const STEPS: BookingStep[] = ["customer", "buy-package", "payment", "session"];

  // The pre-selected schedule (from clicking a session row)
  const preSelectedSchedule = allSchedules.find(x => x.id === initialScheduleId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden bg-card border-none shadow-2xl">
        <VisuallyHidden.Root><DialogTitle>Manual Booking</DialogTitle></VisuallyHidden.Root>
        <div className="flex flex-col md:flex-row h-[650px]">

          {/* ── Left Panel: Live Summary ── */}
          <div className="w-full md:w-[300px] bg-muted/30 border-r border-border p-6 flex flex-col justify-between overflow-y-auto shrink-0">
            <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Booking Summary</h3>

              {/* Session */}
              {(() => {
                const s = allSchedules.find(x => x.id === selectedScheduleId) ?? preSelectedSchedule;
                return s ? (
                  <div className="rounded-2xl bg-background border border-border p-4 shadow-sm space-y-2">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Session</p>
                    <p className="text-sm font-bold text-foreground leading-tight">{getScheduleName(s)}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmt12(s.startTime)} – {fmt12(s.endTime)}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {format(parseISO(s.classDate), "EEE, d MMM")}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{getInstructorName(s)}</p>
                    {bookingQuantity > 1 && (
                      <p className="text-[11px] font-bold text-primary">× {bookingQuantity} spots</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground italic">
                    No session selected yet
                  </div>
                );
              })()}

              {/* Customer */}
              {selectedCustomerData && (
                <div className="animate-in fade-in">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Customer</p>
                  <div className="flex items-center gap-3">
                    <CustomerAvatar c={selectedCustomerData} selected />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">
                        {`${selectedCustomerData.user.firstName ?? ""} ${selectedCustomerData.user.lastName ?? ""}`.trim() || selectedCustomerData.user.email}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{selectedCustomerData.user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Package(s) */}
              {(selectedExistingPkgIds.size > 0 || newUserPackage) && (
                <div className="animate-in fade-in space-y-2">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                    {selectedExistingPkgIds.size > 1 ? `Packages (${selectedExistingPkgIds.size})` : "Package"}
                  </p>
                  {/* All selected existing packages */}
                  {[...selectedExistingPkgIds].map(pkgId => {
                    const pkg = activeUserPackages.find(p => p.id === pkgId);
                    const name = (pkg as any)?.package?.name ?? "Package";
                    const typeName = canonicalServiceTypeLabel((pkg as any)?.package?.serviceType?.name ?? "");
                    return (
                      <div key={pkgId} className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <Package className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-xs font-bold text-foreground truncate">{name}</span>
                        </div>
                        {typeName && <p className="text-[10px] text-primary/70 font-semibold pl-5">{typeName}</p>}
                      </div>
                    );
                  })}
                  {/* Newly purchased package */}
                  {newUserPackage && (() => {
                    const catPkg = catalogPackages.find(p => p.id === selectedCatalogPkgId);
                    const name = (newUserPackage as any)?.package?.name ?? catPkg?.name ?? "New Package";
                    const typeName = canonicalServiceTypeLabel(catPkg?.serviceType?.name ?? "");
                    return (
                      <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <Package className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                            <span className="text-xs font-bold text-teal-800 truncate">{name}</span>
                          </div>
                          <span className="text-[9px] font-black text-teal-600 uppercase shrink-0">New</span>
                        </div>
                        {typeName && <p className="text-[10px] text-teal-600/80 font-semibold pl-5">{typeName}</p>}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Step dots */}
            <div className="pt-6 border-t border-border/50">
              <div className="flex items-center gap-3">
                {STEPS.map((s) => {
                  const isActive = step === s;
                  const isPast = STEPS.indexOf(s) < STEPS.indexOf(step);
                  return (
                    <div
                      key={s}
                      className={cn(
                        "h-2 rounded-full transition-all duration-300",
                        isActive ? "bg-primary w-6" : isPast ? "bg-primary/40 w-2" : "bg-border w-2"
                      )}
                    />
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 font-medium capitalize">
                Step {STEPS.indexOf(step)+1} of {STEPS.length} — {stepTitle[step]}
              </p>
            </div>
          </div>

          {/* ── Right Panel: Action Zone ── */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="p-6 pb-3 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">{stepTitle[step]}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step === "customer" && "Search for an existing customer or register a walk-in."}
                {step === "buy-package" && `Choose a package for ${selectedCustomerData?.user.firstName ?? "the customer"}.`}
                {step === "payment" && "Select payment method and collect or generate QR."}
                {step === "session" && "Pick the date and session, then confirm the booking."}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* ── Step 1: Customer ── */}
              {step === "customer" && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Find or register a customer</p>
                    <Button
                      variant={showQuickReg ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setShowQuickReg(v => !v)}
                      className="gap-1.5 h-8 text-[11px] font-bold"
                    >
                      {showQuickReg ? "Back to Search" : <><UserPlus className="h-3.5 w-3.5" /> Walk-in</>}
                    </Button>
                  </div>

                  {showQuickReg ? (
                    <div className="space-y-3 animate-in zoom-in-95 duration-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">First Name *</Label>
                          <Input placeholder="Sokha" value={regFirstName} onChange={e => setRegFirstName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Last Name</Label>
                          <Input placeholder="Chan" value={regLastName} onChange={e => setRegLastName(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Email *</Label>
                        <Input type="email" placeholder="customer@example.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Phone</Label>
                          <Input placeholder="+855..." value={regPhone} onChange={e => setRegPhone(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Password</Label>
                          <Input type="password" placeholder="Min. 6 chars" value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                        </div>
                      </div>
                      <Button
                        className="w-full h-10 font-bold text-sm gap-2"
                        disabled={registerMutation.isPending || !regFirstName.trim() || !regEmail.trim() || regPassword.trim().length < 6}
                        onClick={handleRegister}
                      >
                        {registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Create Account & Continue
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by name, email or phone..."
                          className="pl-10 h-11"
                          value={customerSearch}
                          onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomerId(null); setSelectedCustomerData(null); }}
                          autoFocus
                        />
                        {(customersLoading || customersFetching) && (
                          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                        {/* Skeleton while loading */}
                        {customersLoading && (
                          [...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border animate-pulse">
                              <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
                              <div className="flex-1 space-y-1.5">
                                <div className="h-3 w-32 bg-muted rounded-full" />
                                <div className="h-2.5 w-48 bg-muted rounded-full" />
                              </div>
                            </div>
                          ))
                        )}
                        {/* Results */}
                        {!customersLoading && filteredCustomers.map((c: any) => {
                          const isSelected = selectedCustomerId === c.userId;
                          const name = `${c.user.firstName ?? ""} ${c.user.lastName ?? ""}`.trim() || c.user.email;
                          return (
                            <button
                              key={c.id}
                              onClick={() => { setSelectedCustomerId(c.userId); setSelectedCustomerData(c); setSelectedExistingPkgId(null); setSelectedExistingPkgIds(new Set()); setNewUserPackage(null); setPkgTypeFilter("all"); }}
                              className={cn(
                                "flex items-center justify-between w-full p-3 rounded-xl border transition-all text-left",
                                isSelected
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : "border-border bg-card hover:border-primary/30 hover:bg-muted/30"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <CustomerAvatar c={c} selected={isSelected} />
                                <div>
                                  <p className="font-bold text-sm text-foreground">{name}</p>
                                  <p className="text-[11px] text-muted-foreground">{c.user.email}</p>
                                </div>
                              </div>
                              {isSelected && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                        {filteredCustomers.length === 0 && !customersLoading && (
                          <div className="py-10 text-center text-muted-foreground">
                            <Users className="h-8 w-8 mx-auto opacity-20 mb-2" />
                            <p className="text-sm font-medium">No customers found</p>
                            <p className="text-xs">Try a different search or use Walk-in to register</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 2: Package ── */}
              {step === "buy-package" && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                  {activeUserPackages.length > 0 && (() => {
                    // Unique class types from this customer's active packages
                    const pkgTypes = Array.from(new Set(
                      activeUserPackages.map(p => canonicalServiceTypeLabel((p as any).package?.serviceType?.name ?? "")).filter(Boolean)
                    )).sort();
                    const filteredPkgs = activeUserPackages.filter(p =>
                      !hasNoBookableBenefit(p) &&
                      (pkgTypeFilter === "all" || canonicalServiceTypeLabel((p as any).package?.serviceType?.name ?? "") === pkgTypeFilter)
                    );
                    return (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-emerald-700">Existing active packages</p>
                          <p className="text-[10px] text-muted-foreground">Select multiple to book with several packages at once</p>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-medium">{activeUserPackages.length} total</span>
                      </div>
                      {pkgTypes.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                          {["all", ...pkgTypes].map(type => (
                            <button
                              key={type}
                              onClick={() => setPkgTypeFilter(type)}
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition-all border",
                                pkgTypeFilter === type
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400"
                              )}
                            >
                              {type === "all" ? "All" : type}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-0.5">
                        {filteredPkgs.map(p => {
                          const noBookable = hasNoBookableBenefit(p);
                          return (
                          <button
                            key={p.id}
                            onClick={() => {
                              const isAlreadySelected = selectedExistingPkgIds.has(p.id);
                              const next = new Set(selectedExistingPkgIds);
                              if (isAlreadySelected) {
                                next.delete(p.id);
                                setSelectedExistingPkgId(next.size > 0 ? [...next][0] : null);
                              } else {
                                next.add(p.id);
                                setSelectedExistingPkgId(p.id);
                              }
                              setSelectedExistingPkgIds(next);
                              setSelectedCatalogPkgId(null);
                            }}
                            className={cn(
                              "w-full flex flex-col gap-1 p-2.5 rounded-lg border text-left transition-all text-xs",
                              selectedExistingPkgIds.has(p.id)
                                ? noBookable
                                  ? "border-amber-300 bg-amber-50"
                                  : "border-emerald-400 bg-emerald-100"
                                : noBookable
                                  ? "border-border bg-muted/20 hover:border-border/80"
                                  : "border-emerald-200 bg-white hover:border-emerald-300"
                            )}
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-foreground">{p.package?.name}</span>
                                  {(p as any).package?.serviceType?.name && (
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                      · {canonicalServiceTypeLabel((p as any).package.serviceType.name)}
                                    </span>
                                  )}
                                  {/* Status badge */}
                                  {(() => {
                                    const s = p.status;
                                    if (s === "exhausted") return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-200 uppercase tracking-wide">Exhausted</span>;
                                    if (s === "not_started") return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500 border border-blue-200 uppercase tracking-wide">Not started</span>;
                                    if (s === "active") {
                                      if (p.expiryDate) {
                                        const daysLeft = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000);
                                        if (daysLeft <= 7) return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-wide">Expiring {daysLeft}d</span>;
                                      }
                                      return <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-wide">Active</span>;
                                    }
                                    return null;
                                  })()}
                                </div>
                                {p.expiryDate && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    Expires {format(new Date(p.expiryDate), "d MMM yyyy")}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-muted-foreground text-[11px]">{p.sessionsRemaining ?? "∞"} left</span>
                                {selectedExistingPkgIds.has(p.id) && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                              </div>
                            </div>
                            {(() => {
                              const recoveryUsed: number = (p as any).package?.recoveryBookingsCount ?? 0;
                              const badges: React.ReactNode[] = [];

                              // Free recovery — structured field first, then parse text benefits as fallback
                              let freeTotal = pkgFreeRecoverySessions(p);
                              if (freeTotal === 0) {
                                const benefitsArr: string[] = (p as any).package?.benefits ?? [];
                                const joined = benefitsArr.join(" ");
                                const m = joined.match(/(\d+)\s*(?:free|complimentary).*?recovery/i) ?? joined.match(/(\d+)\s*recovery/i);
                                if (m) freeTotal = parseInt(m[1], 10);
                              }
                              if (freeTotal > 0) {
                                const remaining = Math.max(0, freeTotal - recoveryUsed);
                                badges.push(
                                  <span key="free" className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border w-fit", remaining > 0 ? "text-teal-600 bg-teal-50 border-teal-200" : "text-muted-foreground bg-muted border-border line-through")}>
                                    + Free Recovery ({remaining}/{freeTotal})
                                  </span>
                                );
                              }

                              // Individual recovery discount
                              const pkgDiscountUsed: number = (p as any).package?.discountUsageCount ?? 0;
                              let pct = pkgRecoveryDiscount(p);
                              if (pct === 0) {
                                const benefitsArr: string[] = (p as any).package?.benefits ?? [];
                                const m = benefitsArr.join(" ").match(/(\d+)\s*%/i);
                                if (m) pct = parseInt(m[1], 10);
                              }
                              if (pct > 0) {
                                const discountSpent = pkgDiscountUsed >= 1;
                                badges.push(
                                  <span key="discount" className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border w-fit", discountSpent ? "text-muted-foreground bg-muted border-border line-through" : "text-teal-600 bg-teal-50 border-teal-200")}>
                                    + {pct}% off Recovery
                                  </span>
                                );
                              }

                              // Group recovery discount
                              const grpPct = pkgGroupRecoveryDiscount(p);
                              if (grpPct > 0) {
                                const discountSpent = pkgDiscountUsed >= 1;
                                badges.push(
                                  <span key="group-discount" className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border w-fit", discountSpent ? "text-muted-foreground bg-muted border-border line-through" : "text-teal-600 bg-teal-50 border-teal-200")}>
                                    + {grpPct}% off Group Recovery
                                  </span>
                                );
                              }

                              return badges.length > 0 ? <div className="flex flex-wrap gap-1 mt-0.5">{badges}</div> : null;
                            })()}
                            {noBookable ? (
                              <p className="text-[10px] text-muted-foreground italic mt-0.5">All benefits used — no sessions or discounts remaining</p>
                            ) : (() => {
                              const discountPct = (() => {
                                let v = pkgRecoveryDiscount(p);
                                if (v === 0) {
                                  const m = ((p as any).package?.benefits ?? [] as string[]).join(" ").match(/(\d+)\s*%/i);
                                  if (m) v = parseInt(m[1], 10);
                                }
                                return v;
                              })();
                              const discountAvailable = discountPct > 0 && (p as any).package?.discountUsageCount === 0;
                              const noSessions = (p.sessionsRemaining ?? 1) <= 0;
                              return noSessions && discountAvailable ? (
                                <p className="text-[10px] text-amber-600 font-medium mt-0.5">Discount benefit only — select to apply {discountPct}% off a new recovery package</p>
                              ) : null;
                            })()}
                          </button>
                          );
                        })}
                        {filteredPkgs.length === 0 && (
                          <p className="text-[11px] text-emerald-600 text-center py-3 italic">No packages for this class type.</p>
                        )}
                      </div>
                    </div>
                    );
                  })()}

                  <div>
                    <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Or purchase a new package</p>
                    {/* Type filter pills */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <button
                        onClick={() => { setSelectedServiceTypeId(null); setSelectedCatalogPkgId(null); }}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-all",
                          !selectedServiceTypeId ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/30"
                        )}>All</button>
                      {serviceTypes
                        .filter((st: any) => catalogPackages.some(p => p.isActive && p.serviceTypeId === st.id))
                        .map((st: any) => (
                          <button key={st.id}
                            onClick={() => { setSelectedServiceTypeId(st.id); setSelectedCatalogPkgId(null); }}
                            className={cn(
                              "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-all",
                              selectedServiceTypeId === st.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/30"
                            )}>
                            {st.name}
                          </button>
                        ))}
                    </div>
                    {/* Package grid */}
                    <div className="grid grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                      {catalogPackages
                        .filter(p => p.isActive && (!selectedServiceTypeId || p.serviceTypeId === selectedServiceTypeId))
                        .map(pkg => (
                          <button
                            key={pkg.id}
                            onClick={() => { setSelectedCatalogPkgId(pkg.id); setPurchaseQuantity(1); }}
                            className={cn(
                              "relative flex flex-col justify-between p-3 rounded-xl border transition-all text-left",
                              selectedCatalogPkgId === pkg.id
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border bg-card hover:border-primary/20"
                            )}
                          >
                            <div>
                              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">{pkg.serviceType?.name}</p>
                              <p className="text-xs font-bold text-foreground leading-snug mt-0.5">{pkg.name}</p>
                            </div>
                            {(() => {
                              const applicableDiscount = getApplicableDiscount(pkg.name);
                              const showDiscount = applicableDiscount > 0 && isRecoveryServiceType(pkg.serviceTypeId);
                              return (
                                <>
                                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40">
                                    <div className="flex flex-col">
                                      {showDiscount ? (
                                        <>
                                          <span className="text-[9px] text-muted-foreground line-through leading-none">${parseFloat(pkg.price)}</span>
                                          <span className="text-sm font-black text-teal-600">${discountedPrice(parseFloat(pkg.price), pkg.serviceTypeId, pkg.name).toFixed(2)}</span>
                                        </>
                                      ) : (
                                        <span className="text-sm font-black text-primary">${parseFloat(pkg.price)}</span>
                                      )}
                                    </div>
                                    <span className="text-[9px] font-bold text-muted-foreground">{pkg.sessionsIncluded ?? "∞"} sess · {pkg.validityDays}d</span>
                                  </div>
                                  {showDiscount && (
                                    <span className="text-[8px] font-bold text-teal-600 uppercase tracking-wide">{applicableDiscount}% discount applied</span>
                                  )}
                                </>
                              );
                            })()}
                            {selectedCatalogPkgId === pkg.id && (
                              <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" />
                            )}
                          </button>
                        ))}
                    </div>
                  </div>

                </div>
              )}

              {/* ── Step 3: Payment ── */}
              {step === "payment" && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                  {/* Amount due */}
                  <div className="rounded-2xl border border-border bg-muted/20 p-5 text-center space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount Due</p>
                    {packagePrice < packageBasePrice && (
                      <p className="text-sm text-muted-foreground line-through">${packageBasePrice.toFixed(2)}{purchaseQuantity > 1 ? ` × ${purchaseQuantity}` : ""}</p>
                    )}
                    {purchaseQuantity > 1 ? (
                      <>
                        <p className="text-sm text-muted-foreground">${packagePrice.toFixed(2)} × {purchaseQuantity}</p>
                        <p className="text-4xl font-black text-foreground">${(packagePrice * purchaseQuantity).toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">{fmtKHR(packagePrice * purchaseQuantity)}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-4xl font-black text-foreground">${packagePrice.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">{fmtKHR(packagePrice)}</p>
                      </>
                    )}
                    {selectedPkg && <p className="text-xs text-primary font-bold mt-1">{selectedPkg.name}{purchaseQuantity > 1 ? ` × ${purchaseQuantity}` : ""}</p>}
                    {packagePrice < packageBasePrice && (
                      <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">
                        {getApplicableDiscount(selectedPkg?.name)}% recovery discount applied
                      </p>
                    )}
                  </div>

                  {/* Payment method selection */}
                  <div className="grid grid-cols-2 gap-3">
                    {(["cash", "bakong"] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => { setPaymentMethod(m); setBakongQr(null); setPendingPkgId(null); setQrExpired(false); }}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                          paymentMethod === m
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-card text-muted-foreground hover:border-primary/30"
                        )}
                      >
                        <CreditCard className="h-5 w-5" />
                        <span className="text-sm font-bold">{m === "bakong" ? "Bakong QR" : "Cash"}</span>
                        <span className="text-[10px] opacity-60">{m === "cash" ? "Collect from customer" : "Scan to pay"}</span>
                      </button>
                    ))}
                  </div>

                  {/* Cash instruction */}
                  {paymentMethod === "cash" && !newUserPackage && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      Collect{" "}
                      <span className="font-bold">
                        ${(packagePrice * purchaseQuantity).toFixed(2)}
                      </span>{" "}
                      ({fmtKHR(packagePrice * purchaseQuantity)}) from the customer
                      {purchaseQuantity > 1 && <span className="text-emerald-600"> — {purchaseQuantity} packages</span>}, then click <span className="font-bold">Confirm Purchase</span>.
                    </div>
                  )}

                  {/* Bakong hint */}
                  {paymentMethod === "bakong" && !bakongQr && !qrExpired && !newUserPackage && (
                    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-[11px] text-muted-foreground space-y-1">
                      <p>Click <span className="font-bold">Generate QR</span> — a Bakong KHQR code will appear for the customer to scan.</p>
                      {purchaseQuantity > 1 && (
                        <p className="text-amber-600 font-semibold">Bakong supports 1 package per QR. The remaining {purchaseQuantity - 1} must be purchased separately or switch to Cash.</p>
                      )}
                    </div>
                  )}

                  {/* Bakong QR waiting */}
                  {bakongQr && !qrExpired && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center space-y-3">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <p className="text-xs font-bold text-blue-700">Waiting for payment…</p>
                      </div>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(bakongQr.qr_string)}`}
                        alt="Bakong QR"
                        className="mx-auto rounded-xl border border-blue-200 bg-white p-2"
                      />
                      <p className="text-[10px] text-blue-600 font-medium">
                        Scan with any Bakong-supported app · Expires in{" "}
                        <span className={qrSecondsLeft < 60 ? "text-red-600 font-bold" : ""}>
                          {Math.floor(qrSecondsLeft / 60)}:{String(qrSecondsLeft % 60).padStart(2, "0")}
                        </span>
                      </p>
                      <Button variant="outline" size="sm" onClick={handleCancelBakong} className="text-xs border-blue-200 text-blue-700 hover:bg-blue-100">
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* QR expired */}
                  {qrExpired && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center space-y-2">
                      <p className="text-sm font-bold text-destructive">QR Expired</p>
                      <p className="text-xs text-muted-foreground">No payment received.</p>
                      <Button size="sm" variant="outline" onClick={handleCancelBakong} className="border-destructive/30 text-destructive">Try Again</Button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 4: Session ── */}
              {step === "session" && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                  {/* Date picker */}
                  {!initialScheduleId && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Session Date</Label>
                      <Input
                        type="date"
                        value={bookingDate}
                        min={format(new Date(), "yyyy-MM-dd")}
                        onChange={e => { setBookingDate(e.target.value); setSelectedScheduleId(null); }}
                        className="h-10"
                      />
                    </div>
                  )}

                  {/* Package type context banner */}
                  {selectedExistingPkgIds.size > 1 && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-primary shrink-0" />
                      <p className="text-[11px] text-primary font-medium">
                        Showing sessions from all <span className="font-bold">{selectedExistingPkgIds.size} selected packages</span>. Each session shows which package will be charged.
                      </p>
                    </div>
                  )}
                  {selectedExistingPkgIds.size <= 1 && !isMembership && effectiveServiceTypeId && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-primary shrink-0" />
                      <p className="text-[11px] text-primary font-medium">
                        Showing <span className="font-bold">{effectivePackageName}</span> sessions only.
                        Only matching class types can be booked with this package.
                      </p>
                    </div>
                  )}
                  {selectedExistingPkgIds.size <= 1 && isMembership && selectedExistingPkg?.status !== "exhausted" && !newUserPackage && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <p className="text-[11px] text-emerald-700 font-medium">Membership — can book any class type.</p>
                    </div>
                  )}
                  {selectedExistingPkgIds.size <= 1 && selectedExistingPkg?.status === "exhausted" && !newUserPackage && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                      <p className="text-[11px] text-orange-700 font-medium">
                        Package exhausted — showing only sessions eligible for remaining benefits.
                      </p>
                    </div>
                  )}
                  {selectedExistingPkgIds.size === 0 && !effectiveServiceTypeId && !isMembership && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-[11px] text-amber-700 font-medium">No package selected. Go back to select a package first.</p>
                    </div>
                  )}

                  {/* Free recovery notice — recovery sessions listed below */}
                  {freeRecoveryAvailable && recoveryServiceTypeId && (
                    <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs text-teal-800 flex items-start gap-2">
                      <span className="text-teal-500 mt-0.5">✦</span>
                      <span>
                        <span className="font-bold">Free Recovery available</span> — {freeRecoveryRemaining} of {freeRecoveryTotal} free recovery session{freeRecoveryTotal !== 1 ? "s" : ""} remaining.
                        Recovery Lounge sessions are shown below alongside regular sessions.
                      </span>
                    </div>
                  )}

                  {/* Session list */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {sessionOptions.length === 0 && (effectiveServiceTypeId || isMembership || selectedExistingPkg?.status === "exhausted")
                        ? `No sessions found for ${bookingDate ? format(parseISO(bookingDate), "d MMM") : "this date"}`
                        : sessionOptions.length > 0
                        ? `Available sessions · ${bookingDate ? format(parseISO(bookingDate), "EEE d MMM") : ""}`
                        : ""}
                    </p>
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {sessionOptions.map((s: ApiSchedule) => {
                        const isSelected = selectedScheduleId === s.id;
                        const isFull = s.bookedCount >= s.maxCapacity;
                        return (
                          <button
                            key={s.id}
                            disabled={isFull && !forceBooking}
                            onClick={() => { setSelectedScheduleId(s.id); setBookingQuantity(1); }}
                            className={cn(
                              "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                              isSelected ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : isFull ? "border-border opacity-50 cursor-not-allowed"
                                : "border-border bg-card hover:border-primary/30"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-foreground">
                                  {fmt12(s.startTime)} – {fmt12(s.endTime)}
                                </p>
                                {(() => {
                                  const cat = parseRecoveryNote((s as any).locationNote);
                                  if (!cat) return null;
                                  return (
                                    <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-bold", cat.color)}>
                                      {cat.badge}
                                    </span>
                                  );
                                })()}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {freeRecoveryAvailable && s.serviceTypeId === recoveryServiceTypeId && selectedExistingPkgIds.size <= 1 && (
                                  <span className="inline-block mr-1 px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-[9px] font-bold uppercase tracking-wide">Free Recovery</span>
                                )}
                                {getScheduleName(s)}
                                {getInstructorName(s) !== "—" && ` · ${getInstructorName(s)}`}
                              </p>
                              {/* Multi-package: which package covers this session */}
                              {(() => {
                                const pkgInfo = getPackageForSession(s);
                                if (!pkgInfo) return null;
                                return (
                                  <p className={cn("text-[10px] font-bold mt-0.5", pkgInfo.isFreeRecovery ? "text-teal-600" : "text-primary/70")}>
                                    {pkgInfo.isFreeRecovery ? "✦ Free Recovery · " : "→ "}{pkgInfo.name}
                                  </p>
                                );
                              })()}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                isFull ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                              )}>
                                {s.bookedCount}/{s.maxCapacity}
                              </span>
                              {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Force booking toggle */}
                  <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-border">
                    <input
                      type="checkbox"
                      checked={forceBooking}
                      onChange={e => setForceBooking(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-xs font-bold text-foreground">Force booking even if session is full</span>
                  </label>
                </div>
              )}
            </div>

            {/* ── Action Bar ── */}
            <div className="px-6 py-4 border-t border-border bg-muted/10 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => {
                  if (step === "buy-package") setStep("customer");
                  else if (step === "payment") {
                    // Back to package selection — clear payment state but keep package selection
                    setBakongQr(null); setPendingPkgId(null); setQrExpired(false);
                    setStep("buy-package");
                  }
                  else if (step === "session") {
                    if (newUserPackage) {
                      // Came from buying a new package — go back to payment
                      setNewUserPackage(null);
                      setBakongQr(null); setPendingPkgId(null); setQrExpired(false);
                      setStep("payment");
                    } else {
                      // Came from selecting an existing package — skip payment, go back to package selection
                      setStep("buy-package");
                    }
                  }
                  else { onOpenChange(false); reset(); }
                }}
                className="gap-2 font-bold text-xs"
              >
                <ArrowLeft className="h-4 w-4" />
                {step === "customer" ? "Cancel" : "Back"}
              </Button>

              <div className="flex items-center gap-2">
                {/* Step 1 → 2 */}
                {step === "customer" && (
                  <Button
                    className="min-w-[110px] h-10 font-bold gap-1.5"
                    disabled={!selectedCustomerId}
                    onClick={() => setStep("buy-package")}
                  >
                    Continue <ChevronRight className="h-4 w-4" />
                  </Button>
                )}

                {/* Step 2: existing pkg → skip to session; new pkg → go to payment */}
                {step === "buy-package" && (
                  <>
                    {selectedExistingPkgIds.size > 0 && !selectedCatalogPkgId && (() => {
                      const allNoBookable = [...selectedExistingPkgIds].every(id => {
                        const up = activeUserPackages.find(p => p.id === id);
                        return up ? hasNoBookableBenefit(up) : true;
                      });
                      return (
                        <Button
                          className="min-w-[160px] h-10 font-bold gap-1.5"
                          disabled={allNoBookable}
                          title={allNoBookable ? "No bookable sessions in selected package(s). Use discount to purchase a new recovery package below." : undefined}
                          onClick={() => setStep("session")}
                        >
                          <CalendarCheck2 className="h-4 w-4" />
                          {selectedExistingPkgIds.size > 1 ? `Use ${selectedExistingPkgIds.size} Packages` : "Use This Package"}
                        </Button>
                      );
                    })()}
                    {selectedCatalogPkgId && (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Qty</span>
                          <div className="flex items-center border border-border rounded-lg overflow-hidden">
                            <button
                              onClick={() => setPurchaseQuantity(q => Math.max(1, q - 1))}
                              disabled={purchaseQuantity <= 1}
                              className="px-2.5 py-1 text-sm font-bold text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                            >−</button>
                            <span className="px-3 py-1 text-sm font-black text-foreground border-x border-border min-w-[2rem] text-center">
                              {purchaseQuantity}
                            </span>
                            <button
                              onClick={() => setPurchaseQuantity(q => Math.min(20, q + 1))}
                              disabled={purchaseQuantity >= 20}
                              className="px-2.5 py-1 text-sm font-bold text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                            >+</button>
                          </div>
                        </div>
                        <Button className="min-w-[160px] h-10 font-bold gap-1.5" onClick={() => setStep("payment")}>
                          <CreditCard className="h-4 w-4" /> Choose Payment →
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {/* Step 3: payment actions */}
                {step === "payment" && (
                  <>
                    {/* Already paid → go to session */}
                    {newUserPackage && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-emerald-600 font-semibold">
                          {paymentMethod === "cash" ? "✓ Cash collected" : "✓ Confirmed"}
                        </span>
                        <Button className="h-10 font-bold gap-1.5" onClick={() => setStep("session")}>
                          <CalendarCheck2 className="h-4 w-4" /> Book Session
                        </Button>
                      </div>
                    )}
                    {/* Cash — confirm purchase */}
                    {!newUserPackage && paymentMethod === "cash" && (
                      <Button
                        className="min-w-[160px] h-10 font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                        disabled={createPackage.isPending}
                        onClick={handlePurchase}
                      >
                        {createPackage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Confirm Purchase
                      </Button>
                    )}
                    {/* Bakong — generate QR or waiting */}
                    {!newUserPackage && paymentMethod === "bakong" && !bakongQr && (
                      <Button
                        className="min-w-[160px] h-10 font-bold gap-1.5"
                        disabled={createPackage.isPending}
                        onClick={handlePurchase}
                      >
                        {createPackage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                        Generate QR
                      </Button>
                    )}
                    {/* QR shown — no button, waiting */}
                    {!newUserPackage && paymentMethod === "bakong" && bakongQr && !qrExpired && (
                      <span className="text-xs text-muted-foreground italic">Waiting for scan…</span>
                    )}
                  </>
                )}

                {step === "session" && (
                  <div className="flex items-center gap-3">
                    {/* Multi-package: show applicable spots for the selected session */}
                    {selectedExistingPkgIds.size > 1 && selectedScheduleId && (() => {
                      const session = sessionOptions.find((s: ApiSchedule) => s.id === selectedScheduleId) ?? allSchedules.find(s => s.id === selectedScheduleId);
                      const stId = session?.serviceTypeId;
                      const isRec = stId === recoveryServiceTypeId;
                      const n = [...selectedExistingPkgIds].filter(id => {
                        const up = activeUserPackages.find(p => p.id === id);
                        if (!up) return false;
                        if (isUpMembership(up)) return true;
                        const pkgStId = (up as any)?.package?.serviceType?.id;
                        if (pkgStId === stId) return true;
                        if (isRec && pkgStId !== stId) {
                          const freeTotal = pkgFreeRecoverySessions(up);
                          const used = (up as any)?.package?.recoveryBookingsCount ?? 0;
                          return freeTotal > 0 && (freeTotal - used) > 0;
                        }
                        return false;
                      }).length;
                      return (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl">
                          {n} spot{n !== 1 ? "s" : ""} · {n} package{n !== 1 ? "s" : ""}
                        </span>
                      );
                    })()}
                    {/* Single-package qty stepper */}
                    {selectedExistingPkgIds.size <= 1 && selectedScheduleId && effectivePackageId && !isCouplePackage && !isGroupRecoverPkg && !isIndividualRecovery && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Spots</span>
                        <div className="flex items-center border border-border rounded-xl overflow-hidden">
                          <button
                            onClick={() => setBookingQuantity(q => Math.max(1, q - 1))}
                            disabled={bookingQuantity <= 1}
                            className="px-2.5 py-1.5 text-sm font-bold text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                          >−</button>
                          <span className="px-3 py-1.5 text-sm font-black text-foreground min-w-[2rem] text-center border-x border-border">
                            {bookingQuantity}
                          </span>
                          <button
                            onClick={() => setBookingQuantity(q => Math.min(maxBookingQuantity, q + 1))}
                            disabled={bookingQuantity >= maxBookingQuantity}
                            className="px-2.5 py-1.5 text-sm font-bold text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                          >+</button>
                        </div>
                      </div>
                    )}
                    <Button
                      className="min-w-[160px] h-10 font-bold gap-1.5"
                      disabled={!selectedScheduleId || !effectivePackageId || bookCustomer.isPending}
                      onClick={handleBook}
                    >
                      {bookCustomer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />}
                      {selectedExistingPkgIds.size > 1
                        ? `Confirm ${selectedExistingPkgIds.size} Bookings`
                        : `Confirm Booking${bookingQuantity > 1 ? ` (${bookingQuantity})` : ""}`}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualBookingDialog;
