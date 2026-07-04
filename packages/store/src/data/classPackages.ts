// ─── Class types offered at Zen House ────────────────────────────────────────

export interface ClassType {
  id: string;
  name: string;
  description: string;
  image?: string;
}

export const classTypes: ClassType[] = [
  { id: "reformer", name: "Reformer", description: "Pilates sessions on the Reformer machine." },
  { id: "cadillac", name: "Cadillac", description: "Full-body conditioning using the Cadillac apparatus." },
  { id: "hot-pilates", name: "Hot Pilates", description: "High-energy sessions in a heated studio." },
  { id: "barre", name: "Barre", description: "Ballet-inspired movements to build lean muscle." },
  { id: "recovery-lounge", name: "Recovery Lounge", description: "Recovery sessions including sauna and cold plunge." },
  { id: "membership", name: "Membership Packages", description: "Bundled class and lifestyle plans." },
];

// ─── Packages per class type ─────────────────────────────────────────────────

export interface ClassPackage {
  id: string;
  serviceTypeId: string;
  serviceTypeName?: string;
  name: string;
  sessions: number;
  pricePerSession: number;
  price: number;
  discountPercent?: number;
  validity: string;
  remarks: string;
  duration: string;
  benefits?: string[];
  isIntro?: boolean;
  isActive?: boolean;
  /** Structured: complimentary recovery sessions included (from DB field, not benefits text). */
  freeRecoverySessions?: number | null;
  /** Structured: individual recovery session discount percent. */
  recoveryDiscountPercent?: number | null;
  /** Structured: group recovery lounge discount percent. */
  groupRecoveryDiscountPercent?: number | null;
}

export const classPackages: ClassPackage[] = [
  // Reformer
  { id: "ref-intro-3", serviceTypeId: "reformer", name: "Intro Move 3", sessions: 3, pricePerSession: 17, price: 51, validity: "1 month", duration: "50 mins", remarks: "1 free recovery lounge session. Non-transferrable, non-refundable, non-sharable", isIntro: true, isActive: true },
  { id: "ref-move-1", serviceTypeId: "reformer", name: "Move 1", sessions: 1, pricePerSession: 22, price: 22, validity: "1 week", duration: "50 mins", remarks: "10% off on 1 recovery lounge session. Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "ref-move-6", serviceTypeId: "reformer", name: "Move 6", sessions: 6, pricePerSession: 20, price: 120, validity: "2 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "ref-move-12", serviceTypeId: "reformer", name: "Move 12", sessions: 12, pricePerSession: 18, price: 216, validity: "4 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "ref-move-24", serviceTypeId: "reformer", name: "Move 24", sessions: 24, pricePerSession: 16, price: 384, validity: "5 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "ref-move-30", serviceTypeId: "reformer", name: "Move 30", sessions: 30, pricePerSession: 14, price: 420, validity: "6 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, sharable up to 2 pax", isActive: true },

  // Cadillac
  { id: "cad-intro-3", serviceTypeId: "cadillac", name: "Intro Move 3", sessions: 3, pricePerSession: 20, price: 60, validity: "1 month", duration: "50 mins", remarks: "1 free recovery lounge session. Non-transferrable, non-refundable, non-sharable", isIntro: true, isActive: true },
  { id: "cad-move-1", serviceTypeId: "cadillac", name: "Move 1", sessions: 1, pricePerSession: 25, price: 25, validity: "1 week", duration: "50 mins", remarks: "10% off on 1 recovery lounge session. Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "cad-move-6", serviceTypeId: "cadillac", name: "Move 6", sessions: 6, pricePerSession: 23, price: 138, validity: "2 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "cad-move-12", serviceTypeId: "cadillac", name: "Move 12", sessions: 12, pricePerSession: 21, price: 252, validity: "4 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "cad-move-24", serviceTypeId: "cadillac", name: "Move 24", sessions: 24, pricePerSession: 19, price: 456, validity: "5 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "cad-move-30", serviceTypeId: "cadillac", name: "Move 30", sessions: 30, pricePerSession: 18, price: 540, validity: "6 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, sharable up to 2 pax", isActive: true },

  // Hot Pilates
  { id: "hot-intro-3", serviceTypeId: "hot-pilates", name: "Intro Move 3", sessions: 3, pricePerSession: 13, price: 39, validity: "1 month", duration: "50 mins", remarks: "1 free recovery lounge session. Non-transferrable, non-refundable, non-sharable", isIntro: true, isActive: true },
  { id: "hot-move-1", serviceTypeId: "hot-pilates", name: "Move 1", sessions: 1, pricePerSession: 20, price: 20, validity: "1 week", duration: "50 mins", remarks: "10% off on 1 recovery lounge session. Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "hot-move-6", serviceTypeId: "hot-pilates", name: "Move 6", sessions: 6, pricePerSession: 18, price: 108, validity: "2 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "hot-move-12", serviceTypeId: "hot-pilates", name: "Move 12", sessions: 12, pricePerSession: 16, price: 192, validity: "4 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "hot-move-24", serviceTypeId: "hot-pilates", name: "Move 24", sessions: 24, pricePerSession: 14, price: 336, validity: "5 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "hot-move-30", serviceTypeId: "hot-pilates", name: "Move 30", sessions: 30, pricePerSession: 12, price: 360, validity: "6 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, sharable up to 2 pax", isActive: true },

  // Barre
  { id: "barre-intro-3", serviceTypeId: "barre", name: "Intro Move 3", sessions: 3, pricePerSession: 12, price: 36, validity: "1 month", duration: "50 mins", remarks: "1 free recovery lounge session. Non-transferrable, non-refundable, non-sharable", isIntro: true, isActive: true },
  { id: "barre-move-1", serviceTypeId: "barre", name: "Move 1", sessions: 1, pricePerSession: 19, price: 19, validity: "1 week", duration: "50 mins", remarks: "10% off on 1 recovery lounge session. Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "barre-move-6", serviceTypeId: "barre", name: "Move 6", sessions: 6, pricePerSession: 17, price: 102, validity: "2 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "barre-move-12", serviceTypeId: "barre", name: "Move 12", sessions: 12, pricePerSession: 15, price: 180, validity: "4 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "barre-move-24", serviceTypeId: "barre", name: "Move 24", sessions: 24, pricePerSession: 13, price: 312, validity: "5 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "barre-move-30", serviceTypeId: "barre", name: "Move 30", sessions: 30, pricePerSession: 11, price: 330, validity: "6 months", duration: "50 mins", remarks: "Non-transferrable, non-refundable, sharable up to 2 pax", isActive: true },

  // Recovery Lounge
  { id: "rec-intro-3", serviceTypeId: "recovery-lounge", name: "Intro Recover 3", sessions: 3, price: 24, pricePerSession: 8, validity: "1 month", duration: "60 mins", remarks: "(Save $3) Non-transferrable, non-refundable, non-sharable", isIntro: true, isActive: true },
  { id: "rec-move-1", serviceTypeId: "recovery-lounge", name: "Recover 1", sessions: 1, price: 9, pricePerSession: 9, validity: "1 week", duration: "60 mins", remarks: "Non-transferrable, non-refundable, non-sharable", isActive: true },
  { id: "rec-move-9", serviceTypeId: "recovery-lounge", name: "Recover 9", sessions: 9, price: 72, pricePerSession: 8, validity: "3 months", duration: "60 mins", remarks: "(Save $9) Non-transferrable, non-refundable, non-sharable", isActive: true },
];

// ─── Membership packages ─────────────────────────────────────────────────────

export interface MembershipPlan {
  id: string;
  name: string;
  tagline: string;
  price: number;
  validity: string;
  duration: string;
  includes: string[];
  description: string;
}

export const membershipPlans: MembershipPlan[] = [
  {
    id: "mem-intro",
    name: "Intro Move and Recover",
    tagline: "4 Classes + 4 Recovery Passes",
    price: 125,
    validity: "1 month",
    duration: "50 mins / session",
    includes: ["4 classes", "4 recovery lounge passes"],
    description: "Introductory membership for testing both worlds. Non-transferrable, non-refundable, non-sharable"
  },
  {
    id: "mem-nourish",
    name: "Move and Nourish",
    tagline: "8 Classes + Juice Discount",
    price: 185,
    validity: "3 months",
    duration: "50 mins / session",
    includes: ["8 classes", "10% off on all juice drinks and yogurt bowls"],
    description: "Combine movement with healthy nourishment. Non-transferrable, non-refundable, non-sharable"
  },
  {
    id: "mem-recover",
    name: "Move and Recover",
    tagline: "8 Classes + 8 Recovery Passes",
    price: 240,
    validity: "3 months",
    duration: "50 mins / session",
    includes: ["8 classes", "8 recovery lounge passes"],
    description: "The perfect balance of movement and recovery. Non-transferrable, non-refundable, non-sharable"
  },
  {
    id: "mem-lifestyle",
    name: "Full Lifestyle",
    tagline: "The Ultimate ZenHouse Experience",
    price: 280,
    validity: "4 months",
    duration: "50 mins / session",
    includes: ["10 classes", "10 recovery passes", "10% off on whole menu"],
    description: "Our most comprehensive wellness plan. Non-transferrable, non-refundable, non-sharable"
  }
];

// ─── Booking reservation type ────────────────────────────────────────────────

export interface ClassBooking {
  id: string;
  serviceTypeId: string;
  packageId: string;
  customerName: string;
  customerEmail: string;
  customerContact: string;
  contactMethod: "phone" | "telegram" | "whatsapp";
  selectedDate: string;
  selectedTime: string;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
}
