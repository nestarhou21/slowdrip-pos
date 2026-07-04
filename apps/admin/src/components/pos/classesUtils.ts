import { CheckCircle2, XCircle, UserX } from "lucide-react";
import type { ApiSchedule } from "@repo/store";

export const statusColors: Record<string, string> = {
  available:   "bg-blue-50 text-blue-600 border-blue-100",
  almost_full: "bg-amber-50 text-amber-600 border-amber-100",
  full:        "bg-rose-50 text-rose-600 border-rose-100",
  cancelled:   "bg-slate-50 text-slate-500 border-slate-100",
};

export const bookingStatusConfig: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  confirmed:    { icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 border-emerald-100", label: "Confirmed" },
  cancelled:    { icon: XCircle,      className: "bg-slate-50 text-slate-500 border-slate-100",       label: "Cancelled" },
  "late-cancel":{ icon: XCircle,      className: "bg-amber-50 text-amber-700 border-amber-100",       label: "Late Cancel" },
  attended:     { icon: CheckCircle2, className: "bg-primary/10 text-primary border-primary/20",      label: "Attended" },
  no_show:      { icon: UserX,        className: "bg-rose-50 text-rose-700 border-rose-100",          label: "No-Show" },
};

export const isRecoveryLounge = (name?: string | null): boolean =>
  (name || "").toLowerCase().includes("recovery");

export const canonicalServiceTypeLabel = (name?: string | null): string => {
  const raw = (name || "").trim();
  const compact = raw.toLowerCase().replace(/[_\s]+/g, "-");
  if (
    compact.includes("cardilac") ||
    compact.includes("cadilac") ||
    compact.includes("cadillac") ||
    compact.includes("classical-cadillac")
  ) return "Cadillac";
  return raw || "Class";
};

/**
 * Safely extract the class/service-type name from a schedule slot.
 * The admin API returns `classType` as a plain string (the service type name),
 * while the TS type declares it as ApiServiceType (an object). Handle both.
 */
export const getScheduleName = (s: { classType?: any; serviceTypeId?: any }): string => {
  if (typeof s.classType === "string") return canonicalServiceTypeLabel(s.classType);
  if (s.classType?.name) return canonicalServiceTypeLabel(s.classType.name);
  return "Class";
};

export const withBong = (name: string) =>
  name.startsWith("Bong ") ? name : `Bong ${name}`;

export const getInstructorName = (s: ApiSchedule) => {
  if (!s.instructor) return "—";
  const raw = `${s.instructor.firstName ?? ""} ${s.instructor.lastName ?? ""}`.trim() || s.instructor.email;
  return withBong(raw);
};

/**
 * Parse a recovery lounge locationNote into a typed category.
 * Returns null for non-recovery or unrecognised notes.
 */
export type RecoveryCategory = {
  label: string;
  gender: "female" | "male" | "mixed";
  type: "individual" | "group";
  badge: string;         // short badge text
  color: string;         // tailwind classes for bg + text + border
};

export const parseRecoveryNote = (note?: string | null): RecoveryCategory | null => {
  if (!note) return null;
  const n = note.toLowerCase();

  if (n.includes("special group") || n.includes("4–6 pax") || n.includes("group")) {
    const isMale = n.includes("men") && !n.includes("women");
    return {
      label: isMale ? "Group · Men" : "Group · Women",
      gender: isMale ? "male" : "female",
      type: "group",
      badge: isMale ? "♂ Group" : "♀ Group",
      color: isMale ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-pink-50 text-pink-700 border-pink-200",
    };
  }
  if (n.includes("men") && !n.includes("women")) {
    return {
      label: "Men",
      gender: "male",
      type: "individual",
      badge: "♂ Male",
      color: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }
  if (n.includes("women") || n.includes("female")) {
    return {
      label: "Women",
      gender: "female",
      type: "individual",
      badge: "♀ Female",
      color: "bg-pink-50 text-pink-700 border-pink-200",
    };
  }
  return null;
};

export const fmt12 = (timeStr: string): string => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const hr = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};
