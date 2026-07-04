import { useMemo, useState, useCallback } from "react";
import { Clock, Users, Calendar, AlertCircle, CheckCircle2, Plus, Pencil, Loader2, Trash2, GripVertical, UserPlus, Search, Mail, Phone, ShieldAlert } from "lucide-react";
import ManualBookingDialog from "./ManualBookingDialog";
import {
  statusColors, bookingStatusConfig, isRecoveryLounge,
  canonicalServiceTypeLabel, withBong, getInstructorName, fmt12, getScheduleName, parseRecoveryNote,
} from "./classesUtils";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui";
import { Skeleton } from "@repo/ui";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@repo/ui";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@repo/ui";
import { Input } from "@repo/ui";
import { Label } from "@repo/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useApiServiceTypes,
  useApiInstructors,
  useApiSchedules,
  useApiScheduleDetail,
  useApiWaitlist,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  useBulkDeleteSchedules,
  useGenerateWeeklySchedule,
  useUpdateBookingAttendance,
  usePromoteWaitlistEntry,
  useRemoveWaitlistEntry,
  useReorderWaitlist,
  useApiAdminBookings,
  useApiAdminBookingPackages,
  useCancelBooking,
  useDeleteBooking,
  useAdminBlockSlots,
  type ApiSchedule,
  type ApiWaitlistEntry,
  type ApiBooking,
  type ApiServiceType,
} from "@repo/store";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import { Calendar as CalendarComponent } from "@repo/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";

const emptySlotForm = {
  serviceTypeId: "", instructorId: "", date: "",
  startTime: "09:00", endTime: "10:00", capacity: "10",
  locationNote: "", sessionTitle: "", status: "available" as ApiSchedule["status"],
};

// ─── Drag-and-drop sortable row for the waitlist queue ──────────────────────
function WaitlistSortableRow({
  entry,
  name,
  onPromote,
  onRemove,
  promoteDisabled,
  removeDisabled,
}: {
  entry: ApiWaitlistEntry;
  name: string;
  onPromote: () => void;
  onRemove: () => void;
  promoteDisabled: boolean;
  removeDisabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 select-none",
        isDragging && "opacity-70 shadow-lg ring-1 ring-primary/30 bg-card z-50"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-bold text-primary">#{entry.position}</span>
        <span className="text-sm text-foreground truncate">{name}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[10px]"
          disabled={promoteDisabled}
          onClick={onPromote}
        >
          Promote
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[10px]"
          disabled={removeDisabled}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

const ClassesPage = ({ userRole = "receptionist" }: { userRole?: string }) => {
  const isAdmin = userRole === "admin";
  const { data: serviceTypesRaw = [] } = useApiServiceTypes();
  const serviceTypes = serviceTypesRaw as ApiServiceType[];
  const { data: instructorsRaw = [] } = useApiInstructors();
  const instructors = instructorsRaw as any[];
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<"schedule" | "reservations" | "calendar">("schedule");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");
  const [bookingDateFilter, setBookingDateFilter] = useState("");
  const [showManualBooking, setShowManualBooking] = useState(false);
  const [blockDialog, setBlockDialog] = useState<{ schedule: ApiSchedule } | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [blockSpots, setBlockSpots] = useState(1);
  const blockSlots = useAdminBlockSlots();
  const [schedulePage, setSchedulePage] = useState(1);
  const [bookingsPage, setBookingsPage] = useState(1);
  const [showArchivedSchedules, setShowArchivedSchedules] = useState(false);
  const [pendingAttendance, setPendingAttendance] = useState<Set<string>>(new Set());

  // Generate Weekly Schedule Dialog
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    date: format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7), "yyyy-MM-dd"), // Next Monday
    days: 7,
    force: false,
  });

  // Bulk select state for schedule table
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set());
  const [bulkDeletingSchedules, setBulkDeletingSchedules] = useState(false);
  const [showScheduleBulkConfirm, setShowScheduleBulkConfirm] = useState<"selected" | "all" | null>(null);
  const SCHEDULE_PAGE_SIZE = 10;

  const calendarMonthStart = useMemo(() => startOfMonth(calendarMonth), [calendarMonth]);
  const calendarMonthEnd = useMemo(() => endOfMonth(calendarMonth), [calendarMonth]);

  const scheduleFilters = useMemo(() => {
    if (viewTab === "calendar") {
      return { from_date: format(calendarMonthStart, "yyyy-MM-dd") };
    }
    if (selectedDate) return { date: selectedDate };
    // Default: show from today onwards; archived mode removes the floor
    return showArchivedSchedules ? undefined : { from_date: today };
  }, [viewTab, selectedDate, calendarMonthStart, showArchivedSchedules, today]);

  const { data: allSchedulesRaw = [], isLoading: schedulesLoading } = useApiSchedules(scheduleFilters);
  const allSchedules = allSchedulesRaw as ApiSchedule[];

  const { data: adminBookingsRaw = [], isLoading: adminBookingsLoading } = useApiAdminBookings({
    date: bookingDateFilter || undefined,
    search: bookingSearch,
    status: bookingStatusFilter === "all" ? undefined : bookingStatusFilter,
  });
  const adminBookings = adminBookingsRaw as ApiBooking[];

  const filteredSchedules = useMemo(() => {
    return allSchedules
      .filter((s) => {
        if (statusFilter !== "all" && s.status !== statusFilter) return false;
        if (typeFilter !== "all" && s.serviceTypeId !== typeFilter) return false;
        return true;
      })
      .sort((a, b) => {
        // Ascending: earliest date first, earliest time first within the same day
        const dateDiff = new Date(a.classDate).getTime() - new Date(b.classDate).getTime();
        return dateDiff !== 0 ? dateDiff : a.startTime.localeCompare(b.startTime);
      });
  }, [allSchedules, statusFilter, typeFilter]);

  const calendarSchedules = useMemo(() => {
    if (viewTab !== "calendar") return [];
    return filteredSchedules.filter((s) => {
      const d = parseISO(s.classDate);
      return d >= calendarMonthStart && d <= calendarMonthEnd;
    });
  }, [viewTab, filteredSchedules, calendarMonthStart, calendarMonthEnd]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(calendarMonthStart, { weekStartsOn: 1 });
    const end = endOfWeek(calendarMonthEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let current = start;

    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }

    return days;
  }, [calendarMonthStart, calendarMonthEnd]);

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, ApiSchedule[]>();
    for (const s of calendarSchedules) {
      const key = s.classDate.split("T")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [calendarSchedules]);

  // Fetch detail (with bookings + user data embedded) for selected class
  const { data: scheduleDetail } = useApiScheduleDetail(selectedClassId);
  const { data: waitlistEntries = [] } = useApiWaitlist(selectedClassId);
  const selectedClass = scheduleDetail?.schedule ?? null;
  // Bookings embedded in schedule detail — single request, no separate query
  const bookings = useMemo(() => {
    return ((selectedClass as any)?.bookings ?? []) as ApiBooking[];
  }, [(selectedClass as any)?.bookings]);
  // Loading: true only when dialog is open and we have no data yet
  const dialogInitialLoading = !!selectedClassId && !selectedClass;
  const dialogBookingsFetching = false;

  const { data: bookingPackagesMap = {} } = useApiAdminBookingPackages(bookings);

  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const bulkDeleteSchedules = useBulkDeleteSchedules();
  const generateWeeklySchedule = useGenerateWeeklySchedule();
  const updateBookingAttendance = useUpdateBookingAttendance();
  const promoteWaitlistEntry = usePromoteWaitlistEntry();
  const removeWaitlistEntry = useRemoveWaitlistEntry();
  const reorderWaitlist = useReorderWaitlist();
  const cancelBooking = useCancelBooking();
  const deleteBooking = useDeleteBooking();

  // Drag-and-drop sensors
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleWaitlistDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedClass) return;

    const queue = waitlistEntries
      .filter((w: ApiWaitlistEntry) => w.status === "waiting")
      .sort((a, b) => a.position - b.position);
    const oldIds = queue.map((e) => e.id);
    const oldIndex = oldIds.indexOf(active.id as string);
    const newIndex = oldIds.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;

    const newIds = arrayMove(oldIds, oldIndex, newIndex);
    try {
      await reorderWaitlist.mutateAsync({ scheduleId: selectedClass.id, entryIds: newIds });
      toast.success("Waitlist reordered");
    } catch (err: any) {
      toast.error(err?.body?.message || err?.message || "Failed to reorder waitlist");
    }
  }, [waitlistEntries, selectedClass, reorderWaitlist]);

  // Add slot dialog
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [slotForm, setSlotForm] = useState<typeof emptySlotForm>(emptySlotForm);

  // Edit slot dialog
  const [editSlotId, setEditSlotId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<typeof emptySlotForm>(emptySlotForm);



  const handleDeleteSlot = async (id: string) => {
    if (confirm("Are you sure you want to delete this timeslot? Associated bookings will be affected.")) {
      try {
        await deleteSchedule.mutateAsync(id);
        toast.success("Timeslot deleted");
        if (selectedClassId === id) setSelectedClassId(null);
      } catch (err: any) {
        toast.error(err?.message || "Failed to delete timeslot");
      }
    }
  };

  // Page slice for the schedule table
  const pagedSchedules = filteredSchedules.slice(
    (schedulePage - 1) * SCHEDULE_PAGE_SIZE,
    schedulePage * SCHEDULE_PAGE_SIZE
  );

  const allPageScheduleSelected = pagedSchedules.length > 0 && pagedSchedules.every(s => selectedScheduleIds.has(s.id));
  const somePageScheduleSelected = !allPageScheduleSelected && pagedSchedules.some(s => selectedScheduleIds.has(s.id));

  const togglePageScheduleSelection = () => {
    setSelectedScheduleIds(prev => {
      const next = new Set(prev);
      if (allPageScheduleSelected) pagedSchedules.forEach(s => next.delete(s.id));
      else pagedSchedules.forEach(s => next.add(s.id));
      return next;
    });
  };

  const handleBulkDeleteSchedules = async () => {
    const ids = showScheduleBulkConfirm === "all"
      ? filteredSchedules.map(s => s.id)
      : [...selectedScheduleIds];
    
    if (ids.length === 0) return;

    setBulkDeletingSchedules(true);
    try {
      const res = await bulkDeleteSchedules.mutateAsync(ids);
      toast.success(res.message);
      if (selectedClassId && ids.includes(selectedClassId)) setSelectedClassId(null);
      setSelectedScheduleIds(new Set());
    } catch (err: any) {
      toast.error(err?.body?.message || "Failed to delete sessions.");
    } finally {
      setBulkDeletingSchedules(false);
      setShowScheduleBulkConfirm(null);
    }
  };

  const stats = useMemo(() => ({
    todayClasses: allSchedules.length,
    totalEnrolled: allSchedules.reduce((s, c) => s + c.bookedCount, 0),
    totalCapacity: allSchedules.reduce((s, c) => s + c.maxCapacity, 0),
  }), [allSchedules]);

  const occupancyPercent = stats.totalCapacity > 0 ? Math.round((stats.totalEnrolled / stats.totalCapacity) * 100) : 0;

  // ─── Add Slot ──
  const openAddSlot = () => {
    setSlotForm({ ...emptySlotForm, date: selectedDate || today, serviceTypeId: serviceTypes[0]?.id || "" });
    setShowAddSlot(true);
  };

  const saveSlot = async () => {
    if (!slotForm.serviceTypeId) return;
    // Close dialog immediately — don't make the user wait with a frozen dialog.
    // The mutation invalidates the schedule cache on success, which triggers a
    // silent background refetch (no loading skeleton since data already exists).
    setShowAddSlot(false);
    const toastId = toast.loading("Adding session…");
    try {
      await createSchedule.mutateAsync({
        serviceTypeId: slotForm.serviceTypeId,
        classDate: slotForm.date,
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        instructorId: slotForm.instructorId === "none" ? undefined : (slotForm.instructorId || undefined),
        maxCapacity: parseInt(slotForm.capacity) || 10,
        locationNote: slotForm.locationNote || undefined,
      sessionTitle: slotForm.sessionTitle || undefined,
      });
      toast.success("Session added", { id: toastId });
    } catch (err: any) {
      toast.error(err?.body?.message || err?.message || "Failed to add session", { id: toastId });
    }
  };

  // ─── Edit Slot ──
  const openEditSlot = (cls: ApiSchedule) => {
    setEditForm({
      serviceTypeId: cls.serviceTypeId,
      instructorId: cls.instructorId || "none",
      date: cls.classDate.split("T")[0],
      startTime: cls.startTime.slice(0, 5),
      endTime: cls.endTime.slice(0, 5),
      capacity: String(cls.maxCapacity),
      locationNote: cls.locationNote || "",
      sessionTitle: (cls as any).sessionTitle || "",
      status: cls.status,
    });
    setEditSlotId(cls.id);
  };

  const saveEditSlot = async () => {
    if (!editSlotId || !editForm.serviceTypeId) return;
    try {
      await updateSchedule.mutateAsync({
        id: editSlotId,
        serviceTypeId: editForm.serviceTypeId,
        classDate: editForm.date,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        instructorId: editForm.instructorId === "none" ? null : (editForm.instructorId || null),
        maxCapacity: parseInt(editForm.capacity) || 10,
        locationNote: editForm.locationNote || null,
        sessionTitle: editForm.sessionTitle || null,
        status: editForm.status,
      });
      setEditSlotId(null);
      setSelectedClassId(null);
      toast.success("Timeslot updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update timeslot");
    }
  };

  const handleAttendanceUpdate = async (
    bookingId: string,
    status: "attended" | "no_show",
    scheduleId?: string
  ) => {
    const sid = scheduleId ?? selectedClass?.id;
    if (!sid) return;
    setPendingAttendance(prev => new Set(prev).add(bookingId));
    try {
      await updateBookingAttendance.mutateAsync({ scheduleId: sid, bookingId, status });
      toast.success(status === "attended" ? "Marked as attended" : "Marked as no-show");
    } catch (err: any) {
      toast.error(err?.body?.message || err?.message || "Failed to update attendance");
    } finally {
      setPendingAttendance(prev => { const s = new Set(prev); s.delete(bookingId); return s; });
    }
  };

  const handleCancelBooking = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this booking? The session will be returned to the customer's package.")) return;
    const toastId = toast.loading("Cancelling booking...");
    try {
      await cancelBooking.mutateAsync(id);
      toast.success("Booking cancelled", { id: toastId });
    } catch (err: any) {
      toast.error(err?.body?.message || err?.message || "Failed to cancel booking", { id: toastId });
    }
  };

  const handleDeleteBooking = async (id: string) => {
    if (!confirm("DANGER: This will permanently delete the booking record. Use only for testing/cleanup. Continue?")) return;
    const toastId = toast.loading("Deleting record...");
    try {
      await deleteBooking.mutateAsync(id);
      toast.success("Booking record deleted", { id: toastId });
    } catch (err: any) {
      toast.error(err?.body?.message || err?.message || "Failed to delete record", { id: toastId });
    }
  };

  // classType comes back as a plain string from WellnessScheduleResource — handle both forms
  const getClassTypeName = (schedule: ApiSchedule) => {
    const ct = schedule.classType as any;
    if (typeof ct === "string") return ct;
    return ct?.name ?? (schedule as any).class_type?.name ?? null;
  };

  // ─── Booking/Reservation helpers ──
  const confirmed = bookings.filter(r => r.status === "confirmed" || r.status === "attended" || r.status === "no_show");
  const cancelled = bookings.filter(r => r.status === "cancelled");
  const attendedBookings = bookings.filter(r => r.status === "attended");
  const noShowBookings = bookings.filter(r => r.status === "no_show");
  const waitingQueue = waitlistEntries.filter((w: ApiWaitlistEntry) => w.status === "waiting").sort((a, b) => a.position - b.position);

  const handlePromoteWaitlist = async (entryId: string) => {
    if (!selectedClass) return;
    try {
      await promoteWaitlistEntry.mutateAsync({ scheduleId: selectedClass.id, entryId });
      toast.success("Waitlist entry promoted");
    } catch (err: any) {
      toast.error(err?.body?.message || err?.message || "Failed to promote waitlist entry");
    }
  };

  const handleRemoveWaitlist = async (entryId: string) => {
    if (!selectedClass) return;
    try {
      await removeWaitlistEntry.mutateAsync({ scheduleId: selectedClass.id, entryId });
      toast.success("Waitlist entry removed");
    } catch (err: any) {
      toast.error(err?.body?.message || err?.message || "Failed to remove waitlist entry");
    }
  };



  if (schedulesLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
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
      <ManualBookingDialog
        open={showManualBooking}
        onOpenChange={setShowManualBooking}
        initialDate={selectedDate}
        allSchedules={allSchedules as ApiSchedule[]}
      />

      {/* ── Block Slots Dialog ── */}
      <Dialog open={!!blockDialog} onOpenChange={(v) => { if (!v) setBlockDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Block Spots
            </DialogTitle>
          </DialogHeader>
          {blockDialog && (() => {
            const avail = blockDialog.schedule.maxCapacity - blockDialog.schedule.bookedCount;
            return (
              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-muted/40 p-3 text-sm">
                  <p className="font-bold text-foreground">{getScheduleName(blockDialog.schedule)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {blockDialog.schedule.classDate ? format(parseISO(blockDialog.schedule.classDate), "EEE, d MMM yyyy") : "—"}
                    {" · "}
                    {fmt12(blockDialog.schedule.startTime)} – {fmt12(blockDialog.schedule.endTime)}
                    {" · "}
                    {avail} spot{avail !== 1 ? "s" : ""} available
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wide">Reason <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. Owner walk-in, Private session, Staff reservation"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">This reason is recorded for tracking purposes.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wide">Number of spots</Label>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: Math.min(avail, 10) }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        onClick={() => setBlockSpots(n)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all",
                          blockSpots === n
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-card border-border text-muted-foreground hover:border-amber-300"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                    {avail === 0 && <p className="text-xs text-destructive">No spots available.</p>}
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialog(null)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!blockReason.trim() || blockSlots.isPending || (blockDialog ? (blockDialog.schedule.maxCapacity - blockDialog.schedule.bookedCount) === 0 : true)}
              onClick={async () => {
                if (!blockDialog) return;
                try {
                  await blockSlots.mutateAsync({
                    scheduleId: blockDialog.schedule.id,
                    reason: blockReason.trim(),
                    spots: blockSpots,
                  });
                  toast.success(`${blockSpots} spot${blockSpots !== 1 ? "s" : ""} blocked.`);
                  setBlockDialog(null);
                } catch (err: any) {
                  toast.error(err?.body?.message || "Failed to block spots.");
                }
              }}
            >
              {blockSlots.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Blocking…</> : "Block Spots"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Classes</span>
          </div>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{stats.todayClasses}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Booked</span>
          </div>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{stats.totalEnrolled}/{stats.totalCapacity}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Almost Full</span>
          </div>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{allSchedules.filter(s => s.status === "almost_full").length}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Occupancy</span>
          </div>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{occupancyPercent}%</p>
        </div>
      </div>

      {/* View tabs + Add */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {(["schedule", "reservations", "calendar"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setViewTab(tab)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-bold tracking-wide transition-colors border",
                  viewTab === tab
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {tab === "schedule" ? "Class Schedule" : tab === "reservations" ? "Wellness Bookings" : "Calendar"}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            {viewTab === "schedule" && (
              <>
                {/* Generate Weekly Sessions — hidden, now handled automatically by the server cron.
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  disabled={generateWeeklySchedule.isPending}
                  onClick={() => setShowGenerateDialog(true)}
                >
                  {generateWeeklySchedule.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                    : <><Calendar className="h-3.5 w-3.5" /> Generate Weekly Sessions</>}
                </Button>
                */}
                {isAdmin && filteredSchedules.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => setShowScheduleBulkConfirm("all")}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete All ({filteredSchedules.length})
                  </Button>
                )}
                <Button size="sm" onClick={openAddSlot} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Session
                </Button>
              </>
            )}

            {viewTab === "reservations" && (
              <Button size="sm" variant="outline" onClick={() => setShowManualBooking(true)} className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5">
                <UserPlus className="h-3.5 w-3.5" /> Manual Booking
              </Button>
            )}
          </div>
        </div>
        {/* Tab description */}
        <p className="text-[11px] text-muted-foreground px-0.5">
          {viewTab === "schedule" && "Plan and manage class time slots — add, edit, or cancel sessions and monitor capacity."}
          {viewTab === "reservations" && "Customer booking log — see who has reserved a session, check them in, and track attendance status."}
          {viewTab === "calendar" && "Month-at-a-glance view — visually scan your class schedule to spot busy days and quickly jump to a date."}
        </p>
      </div>

      {/* Filters + Date picker row */}
      {(viewTab === "schedule" || viewTab === "calendar") && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Filters */}
            <div className="flex gap-2 mr-2 border-r border-border pr-4">
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setSchedulePage(1); }}>
                <SelectTrigger className="h-9 w-[150px] text-xs">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {serviceTypes.filter((st: any) => !st.name.toLowerCase().includes("membership")).map((st: any) => (
                    <SelectItem key={st.id} value={st.id}>{canonicalServiceTypeLabel(st.name)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setSchedulePage(1); }}>
                <SelectTrigger className="h-9 w-[130px] text-xs">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="almost_full">Almost Full</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {viewTab === "schedule" && (
              <button
                onClick={() => { setShowArchivedSchedules(v => !v); setSchedulePage(1); }}
                className={cn(
                  "h-9 px-3 rounded-lg border text-xs font-semibold transition-colors gap-1.5 flex items-center",
                  showArchivedSchedules
                    ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                {showArchivedSchedules ? "Showing archived" : "Show archived"}
              </button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 px-4 font-medium border-border hover:border-primary/50 transition-colors">
                  <Calendar className="h-4 w-4 text-primary" />
                  {selectedDate ? format(new Date(selectedDate), "EEEE, MMM d, yyyy") : (showArchivedSchedules ? "All dates" : "From today")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate ? new Date(selectedDate) : undefined}
                  onSelect={(d) => d && setSelectedDate(format(d, "yyyy-MM-dd"))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {selectedDate && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3"
                onClick={() => setSelectedDate(undefined)}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {viewTab === "schedule" ? (
        <>
        {isAdmin && selectedScheduleIds.size > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
            <span className="text-sm font-medium text-foreground">{selectedScheduleIds.size} selected</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedScheduleIds(new Set())} className="h-8 text-xs">Clear</Button>
              <Button size="sm" onClick={() => setShowScheduleBulkConfirm("selected")} className="h-8 gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs">
                <Trash2 className="h-3.5 w-3.5" /> Delete Selected ({selectedScheduleIds.size})
              </Button>
            </div>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-10 px-4 py-4">
                  <input
                    type="checkbox"
                    checked={allPageScheduleSelected}
                    ref={el => { if (el) el.indeterminate = somePageScheduleSelected; }}
                    onChange={togglePageScheduleSelection}
                    className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Session</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Schedule</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Capacity</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedSchedules.map((cls) => {
                const isCancelled = cls.status === "cancelled";
                return (
                  <tr key={cls.id} className={cn("group hover:bg-muted/30 transition-colors", isCancelled && "opacity-60", selectedScheduleIds.has(cls.id) && "bg-primary/5")}>
                    <td className="w-10 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedScheduleIds.has(cls.id)}
                        onChange={() => setSelectedScheduleIds(prev => { const n = new Set(prev); n.has(cls.id) ? n.delete(cls.id) : n.add(cls.id); return n; })}
                        className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className="font-bold text-foreground text-[15px] mb-1 cursor-pointer hover:underline"
                        onClick={() => setSelectedClassId(cls.id)}
                      >
                        {canonicalServiceTypeLabel(getClassTypeName(cls))}
                      </div>
                      <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                        {/* Recovery lounge: show category badge as the primary descriptor */}
                        {(() => {
                          const cat = parseRecoveryNote(cls.locationNote);
                          if (cat) return (
                            <span className={`inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full border text-[10px] font-bold ${cat.color}`}>
                              {cat.badge}
                            </span>
                          );
                          if (cls.locationNote) return (
                            <span className="text-muted-foreground">{cls.locationNote}</span>
                          );
                          return null;
                        })()}
                        <span className="text-muted-foreground">{getInstructorName(cls)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{format(new Date(cls.classDate), "d MMM")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{fmt12(cls.startTime)}–{fmt12(cls.endTime)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{cls.bookedCount}/{cls.maxCapacity}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide capitalize", statusColors[cls.status])}>
                        {cls.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        {cls.status !== "cancelled" && cls.status !== "completed" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                onClick={() => { setBlockDialog({ schedule: cls }); setBlockReason(""); setBlockSpots(1); }}
                              >
                                <ShieldAlert className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Block Spots</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEditSlot(cls)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Session</TooltipContent>
                        </Tooltip>
                        {isAdmin && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteSlot(cls.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Session</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredSchedules.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="rounded-full bg-primary/10 p-4">
                        <Calendar className="h-8 w-8 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-foreground">No classes scheduled</p>
                        <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">
                          {typeFilter !== 'all' || selectedDate || statusFilter !== 'all'
                            ? "Try adjusting your filters to find existing sessions."
                            : "There are no sessions scheduled for this period. Start by generating the weekly sessions."}
                        </p>
                      </div>
                      {/* Generate Weekly Sessions — hidden, now handled automatically by server cron.
                      {typeFilter === 'all' && !selectedDate && statusFilter === 'all' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-2"
                          onClick={() => setShowGenerateDialog(true)}
                          disabled={generateWeeklySchedule.isPending}
                        >
                          <Calendar className="h-4 w-4" /> Generate Weekly Sessions
                        </Button>
                      )}
                      */}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredSchedules.length > SCHEDULE_PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {((schedulePage - 1) * SCHEDULE_PAGE_SIZE) + 1}–{Math.min(schedulePage * SCHEDULE_PAGE_SIZE, filteredSchedules.length)} of {filteredSchedules.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSchedulePage(p => Math.max(1, p - 1))}
                  disabled={schedulePage <= 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs font-medium text-foreground">Page {schedulePage} of {Math.max(1, Math.ceil(filteredSchedules.length / SCHEDULE_PAGE_SIZE))}</span>
                <button
                  onClick={() => setSchedulePage(p => Math.min(Math.ceil(filteredSchedules.length / SCHEDULE_PAGE_SIZE), p + 1))}
                  disabled={schedulePage >= Math.ceil(filteredSchedules.length / SCHEDULE_PAGE_SIZE)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
        </>
      ) : viewTab === "calendar" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-xl font-bold text-foreground">{format(calendarMonthStart, "MMMM yyyy")}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Click a day to jump to its schedule. Click a session card to open details.</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
                className="rounded-full px-4 py-1.5 text-xs font-bold border border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => setCalendarMonth(new Date())}
                className="rounded-full px-4 py-1.5 text-xs font-bold border border-primary bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                className="rounded-full px-4 py-1.5 text-xs font-bold border border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
              >
                Next →
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-muted/30">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const daySchedules = schedulesByDate.get(dayKey) ?? [];
                const inMonth = isSameMonth(day, calendarMonthStart);

                return (
                  <button
                    key={dayKey}
                    className={cn(
                      "min-h-[140px] border-r border-b border-border p-2 text-left align-top transition-colors",
                      "hover:bg-muted/20",
                      !inMonth && "bg-muted/10 text-muted-foreground/60"
                    )}
                    onClick={() => {
                      setSelectedDate(dayKey);
                      setViewTab("schedule");
                    }}
                  >
                    <div className={cn(
                      "mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isSameDay(day, new Date()) && "bg-primary text-primary-foreground"
                    )}>
                      {format(day, "d")}
                    </div>

                    <div className="space-y-1">
                      {daySchedules.slice(0, 3).map((s) => (
                        <div
                          key={s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClassId(s.id);
                          }}
                          className="rounded-md border border-border bg-background px-2 py-1 text-[10px] leading-tight"
                        >
                          <div className="font-semibold text-foreground truncate">{getScheduleName(s)}</div>
                          {(s as any).sessionTitle && (
                            <div className="text-[9px] text-primary/80 font-medium truncate">{(s as any).sessionTitle}</div>
                          )}
                          {(() => {
                            const cat = parseRecoveryNote((s as any).locationNote);
                            if (cat) return <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border ${cat.color}`}>{cat.badge}</span>;
                            return null;
                          })()}
                          <div className="text-muted-foreground">{fmt12(s.startTime)}–{fmt12(s.endTime)}</div>
                        </div>
                      ))}
                      {daySchedules.length > 3 && (
                        <div className="text-[10px] font-medium text-primary">+{daySchedules.length - 3} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Wellness Booking Management Dashboard */
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by customer name or email..."
                className="pl-9 h-9"
                value={bookingSearch}
                onChange={(e) => { setBookingSearch(e.target.value); setBookingsPage(1); }}
              />
            </div>
            <Select value={bookingStatusFilter} onValueChange={(v) => { setBookingStatusFilter(v); setBookingsPage(1); }}>
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue placeholder="Status: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="attended">Attended</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No-Show</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 px-4 font-medium border-border hover:border-primary/50 transition-colors">
                  <Calendar className="h-4 w-4 text-primary" />
                  {bookingDateFilter ? format(new Date(bookingDateFilter), "EEEE, MMM d, yyyy") : "All dates"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="single"
                  selected={bookingDateFilter ? new Date(bookingDateFilter) : undefined}
                  onSelect={(d) => { if (d) { setBookingDateFilter(format(d, "yyyy-MM-dd")); setBookingsPage(1); } }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {bookingDateFilter && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3"
                onClick={() => { setBookingDateFilter(""); setBookingsPage(1); }}
              >
                All
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booked Session</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirmation</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {adminBookingsLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td></tr>
                  ))
                ) : (
                  [...adminBookings]
                    .sort((a, b) => {
                      const aDate = a.schedule?.classDate ?? "";
                      const bDate = b.schedule?.classDate ?? "";
                      if (aDate !== bDate) return aDate.localeCompare(bDate);
                      return (a.schedule?.startTime ?? "").localeCompare(b.schedule?.startTime ?? "");
                    })
                    .slice((bookingsPage - 1) * SCHEDULE_PAGE_SIZE, bookingsPage * SCHEDULE_PAGE_SIZE)
                    .map((b: ApiBooking) => {
                    const StatusIcon = bookingStatusConfig[b.status]?.icon || AlertCircle;
                    const isAdminBlock = b.isAdminBlock === true;
                    const userName = isAdminBlock
                        ? "Admin Block"
                        : b.user ? `${b.user.firstName ?? ""} ${b.user.lastName ?? ""}`.trim() || b.user.email : "—";
                    const classLabel = canonicalServiceTypeLabel(b.className ?? (typeof b.schedule?.classType === "string" ? b.schedule.classType : b.schedule?.classType?.name));
                    return (
                      <tr key={b.id} className={cn("group hover:bg-muted/30 transition-colors", isAdminBlock && "bg-amber-50/50 hover:bg-amber-50")}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              {isAdminBlock && <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />}
                              <span className={cn("font-bold text-[14px]", isAdminBlock ? "text-amber-700" : "text-foreground")}>{userName}</span>
                            </div>
                            {isAdminBlock ? (
                              <p className="text-[11px] text-amber-600 mt-0.5 italic">{b.adminBlockReason}</p>
                            ) : (
                              <div className="flex items-center gap-3 mt-1">
                                {b.user?.email && (
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Mail className="h-3 w-3" />
                                    {b.user.email}
                                  </div>
                                )}
                                {b.user?.phone && (
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Phone className="h-3 w-3" />
                                    {b.user.phone}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-foreground text-sm">{classLabel}</div>
                          <div className="flex flex-col gap-0.5 mt-0.5 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 shrink-0" />
                              {b.schedule?.classDate ? format(parseISO(b.schedule.classDate), "EEEE, d MMM yyyy") : "—"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 shrink-0" />
                              {fmt12(b.schedule?.startTime ?? "")}–{fmt12(b.schedule?.endTime ?? "")}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider capitalize",
                            bookingStatusConfig[b.status]?.className
                          )}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {bookingStatusConfig[b.status]?.label || b.status.replace("_", " ")}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs text-foreground font-semibold">{b.bookingReference}</span>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Booked on {format(new Date(b.bookedAt), "d MMM yyyy, h:mm a")}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            {b.status === "confirmed" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    className="h-8 px-3 text-[10px] font-bold gap-1.5"
                                    disabled={pendingAttendance.has(b.id)}
                                    onClick={() => handleAttendanceUpdate(b.id, "attended", b.scheduleId)}
                                  >
                                    {pendingAttendance.has(b.id)
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <CheckCircle2 className="h-3.5 w-3.5" />
                                    }
                                    {pendingAttendance.has(b.id) ? "Updating…" : "Mark Attended"}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Confirm this customer showed up to the {classLabel} session</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-3 text-[10px] font-bold gap-1.5 text-muted-foreground"
                                  onClick={() => setSelectedClassId(b.scheduleId)}
                                >
                                  <Users className="h-3.5 w-3.5" />
                                  Full Class
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View all attendees booked into this {classLabel} session</TooltipContent>
                            </Tooltip>

                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                  <AlertCircle className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-48 p-2">
                                <div className="space-y-1">
                                  {b.status !== "cancelled" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start text-[11px] font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                      onClick={() => handleCancelBooking(b.id)}
                                      disabled={cancelBooking.isPending}
                                    >
                                      Cancel Booking
                                    </Button>
                                  )}
                                    {isAdmin && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-[11px] font-bold text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDeleteBooking(b.id)}
                                        disabled={deleteBooking.isPending}
                                      >
                                        Delete Record
                                      </Button>
                                    )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                {!adminBookingsLoading && adminBookings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="rounded-full bg-primary/10 p-4">
                          <Users className="h-8 w-8 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-foreground">No bookings found</p>
                          <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">
                            {bookingSearch || bookingStatusFilter !== 'all'
                              ? "No reservations match your current search or status filter."
                              : "There are no customer bookings recorded yet."}
                          </p>
                        </div>
                        {!bookingSearch && bookingStatusFilter === 'all' && (
                          <Button onClick={() => setShowManualBooking(true)} variant="outline" className="mt-2 border-primary/20 text-primary hover:bg-primary/5">
                            <UserPlus className="mr-2 h-4 w-4" /> New Manual Booking
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {!adminBookingsLoading && adminBookings.length > SCHEDULE_PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Showing {((bookingsPage - 1) * SCHEDULE_PAGE_SIZE) + 1}–{Math.min(bookingsPage * SCHEDULE_PAGE_SIZE, adminBookings.length)} of {adminBookings.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBookingsPage(p => Math.max(1, p - 1))}
                    disabled={bookingsPage <= 1}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-medium text-foreground">Page {bookingsPage} of {Math.max(1, Math.ceil(adminBookings.length / SCHEDULE_PAGE_SIZE))}</span>
                  <button
                    onClick={() => setBookingsPage(p => Math.min(Math.ceil(adminBookings.length / SCHEDULE_PAGE_SIZE), p + 1))}
                    disabled={bookingsPage >= Math.ceil(adminBookings.length / SCHEDULE_PAGE_SIZE)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Class detail dialog — clean attendance tracking */}
      <Dialog open={!!selectedClassId} onOpenChange={() => setSelectedClassId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          {!selectedClass ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-border">
                <DialogTitle className="text-lg font-semibold text-foreground">
                  {getScheduleName(selectedClass)}
                  {(selectedClass as any).sessionTitle && (
                    <span className="ml-2 text-sm font-normal text-primary/80">{(selectedClass as any).sessionTitle}</span>
                  )}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {format(new Date(selectedClass.classDate), "EEEE, d MMM")} · {fmt12(selectedClass.startTime)} – {fmt12(selectedClass.endTime)}
                  {getInstructorName(selectedClass) !== "—" && <> · {getInstructorName(selectedClass)}</>}
                </p>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{selectedClass.bookedCount} / {selectedClass.maxCapacity} spots</span>
                    <span className="flex items-center gap-1.5">
                      {dialogBookingsFetching && !dialogInitialLoading && (
                        <Loader2 className="h-3 w-3 animate-spin opacity-50" />
                      )}
                      {attendedBookings.length} attended · {noShowBookings.length} no-show
                    </span>
                  </div>
                  <div className="h-0.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all"
                      style={{ width: `${Math.min(100, (selectedClass.bookedCount / selectedClass.maxCapacity) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Attendee list */}
              <div className="flex-1 overflow-y-auto">
                {dialogInitialLoading ? (
                  <div className="px-6 py-12 flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading…</span>
                  </div>
                ) : confirmed.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No bookings for this session
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {confirmed.map((b) => {
                      const isPending = pendingAttendance.has(b.id);
                      const isAttended = b.status === "attended";
                      const isNoShow = b.status === "no_show";
                      const fullName = `${b.user?.firstName ?? ""} ${b.user?.lastName ?? ""}`.trim();
                      const name = fullName || b.user?.email?.split("@")[0] || "Unknown";
                      const initials = fullName
                        ? ((b.user?.firstName?.[0] ?? "") + (b.user?.lastName?.[0] ?? "")).toUpperCase()
                        : (b.user?.email?.[0] ?? "?").toUpperCase();

                      return (
                        <div key={b.id} className={cn("flex items-center gap-4 px-6 py-4 transition-colors", isPending && "opacity-50")}>
                          {/* Avatar */}
                          <div className={cn(
                            "h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 select-none",
                            isAttended ? "bg-foreground text-background"
                            : isNoShow ? "bg-muted text-muted-foreground/40"
                            : "bg-muted text-muted-foreground"
                          )}>
                            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (initials || "?")}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-medium truncate", isNoShow && "text-muted-foreground/50")}>
                              {name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {!fullName && b.user?.email && (
                                <span className="mr-1">{b.user.email}</span>
                              )}
                              {(b.userPackage?.package?.name
                                ?? (b.userId ? bookingPackagesMap[b.userId]?.find((p: any) => p.id === b.userPackageId)?.package?.name : undefined)) && (
                                <span>
                                  {fullName || !b.user?.email ? "" : "· "}
                                  {b.userPackage?.package?.name
                                    ?? (b.userId ? bookingPackagesMap[b.userId]?.find((p: any) => p.id === b.userPackageId)?.package?.name : undefined)}
                                </span>
                              )}
                              {(b as any).gender && <span className="ml-1 opacity-60">· {(b as any).gender}</span>}
                            </p>
                          </div>

                          {/* Action or status text */}
                          {isAttended ? (
                            <span className="text-[11px] text-foreground font-medium shrink-0">Attended</span>
                          ) : isNoShow ? (
                            <span className="text-[11px] text-muted-foreground shrink-0">No-show</span>
                          ) : (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                disabled={isPending}
                                onClick={() => handleAttendanceUpdate(b.id, "attended")}
                                className="text-[11px] font-medium text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-foreground hover:text-background transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Attended
                              </button>
                              <button
                                disabled={isPending}
                                onClick={() => handleAttendanceUpdate(b.id, "no_show")}
                                className="text-[11px] font-medium text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                No-show
                              </button>
                              
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-all">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-40 p-2">
                                  <div className="space-y-1">
                                    {!isAttended && !isNoShow && b.status !== "cancelled" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                        onClick={() => handleCancelBooking(b.id)}
                                        disabled={cancelBooking.isPending}
                                      >
                                        Cancel Booking
                                      </Button>
                                    )}
                                    {isAdmin && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-[10px] font-bold text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDeleteBooking(b.id)}
                                        disabled={deleteBooking.isPending}
                                      >
                                        Delete Record
                                      </Button>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Waitlist — compact */}
                {waitingQueue.length > 0 && (
                  <div className="border-t border-border px-6 pt-4 pb-4">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">
                      Waitlist ({waitingQueue.length})
                    </p>
                    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleWaitlistDragEnd}>
                      <SortableContext items={waitingQueue.map(e => e.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {waitingQueue.map((entry) => (
                            <WaitlistSortableRow
                              key={entry.id}
                              entry={entry}
                              name={`${entry.user?.firstName ?? ""} ${entry.user?.lastName ?? ""}`.trim() || entry.user?.email || "—"}
                              onPromote={() => handlePromoteWaitlist(entry.id)}
                              onRemove={() => handleRemoveWaitlist(entry.id)}
                              promoteDisabled={promoteWaitlistEntry.isPending || selectedClass.bookedCount >= selectedClass.maxCapacity}
                              removeDisabled={removeWaitlistEntry.isPending}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>


      {/* Edit Timeslot Dialog */}
      <Dialog open={!!editSlotId} onOpenChange={() => setEditSlotId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">Update the details for this class time slot.</p>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Class Type</Label>
                <Select value={editForm.serviceTypeId} onValueChange={(v) => setEditForm(f => ({ ...f, serviceTypeId: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {serviceTypes.filter(st => !st.name.toLowerCase().includes("membership")).map(st => <SelectItem key={st.id} value={st.id}>{canonicalServiceTypeLabel(st.name)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Instructor (Optional)</Label>
                <Select value={editForm.instructorId || "none"} onValueChange={(v) => setEditForm(f => ({ ...f, instructorId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select instructor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {instructors.map((st: any) => <SelectItem key={st.id} value={st.id}>{withBong(`${st.firstName ?? ""} ${st.lastName ?? ""}`.trim())}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {editForm.date ? format(new Date(editForm.date + "T00:00:00"), "EEEE, MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={editForm.date ? new Date(editForm.date + "T00:00:00") : undefined}
                    onSelect={(d) => d && setEditForm(f => ({ ...f, date: format(d, "yyyy-MM-dd") }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={editForm.startTime} onChange={(e) => setEditForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" value={editForm.endTime} onChange={(e) => setEditForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  max={isRecoveryLounge(serviceTypes.find(st => st.id === editForm.serviceTypeId)?.name) ? 5 : 50}
                  value={editForm.capacity}
                  onChange={(e) => setEditForm(f => ({ ...f, capacity: e.target.value }))}
                />
                {isRecoveryLounge(serviceTypes.find(st => st.id === editForm.serviceTypeId)?.name) && (
                  <p className="text-[10px] text-amber-600 font-medium">Recovery Lounge max: 5</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Location Note</Label>
                <Input value={editForm.locationNote} onChange={(e) => setEditForm(f => ({ ...f, locationNote: e.target.value }))} placeholder="Studio A, Room 2..." />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Session Title</Label>
              <Input value={editForm.sessionTitle} onChange={(e) => setEditForm(f => ({ ...f, sessionTitle: e.target.value }))} placeholder="e.g. Full Body Harmony, Core Balance..." />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v: any) => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="almost_full">Almost Full</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSlotId(null)}>Cancel</Button>
            <Button onClick={saveEditSlot} disabled={updateSchedule.isPending} className="gap-2">
              {updateSchedule.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Timeslot Dialog */}
      <Dialog open={showAddSlot} onOpenChange={setShowAddSlot}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add New Session</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Class Type</Label>
                <Select value={slotForm.serviceTypeId} onValueChange={(v) => {
                  const sType = serviceTypes.find(st => st.id === v);
                  setSlotForm(f => ({
                    ...f,
                    serviceTypeId: v,
                    capacity: isRecoveryLounge(sType?.name) ? "5" : f.capacity,
                  }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Select class type" /></SelectTrigger>
                  <SelectContent>{serviceTypes.filter(st => !st.name.toLowerCase().includes("membership")).map(st => <SelectItem key={st.id} value={st.id}>{canonicalServiceTypeLabel(st.name)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Instructor (Optional)</Label>
                <Select value={slotForm.instructorId || "none"} onValueChange={(v) => setSlotForm(f => ({ ...f, instructorId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select instructor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {instructors.map((st: any) => <SelectItem key={st.id} value={st.id}>{withBong(`${st.firstName ?? ""} ${st.lastName ?? ""}`.trim())}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {slotForm.date ? format(new Date(slotForm.date + "T00:00:00"), "EEEE, MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={slotForm.date ? new Date(slotForm.date + "T00:00:00") : undefined}
                    onSelect={(d) => d && setSlotForm(f => ({ ...f, date: format(d, "yyyy-MM-dd") }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Start Time</Label><Input type="time" value={slotForm.startTime} onChange={(e) => setSlotForm(f => ({ ...f, startTime: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>End Time</Label><Input type="time" value={slotForm.endTime} onChange={(e) => setSlotForm(f => ({ ...f, endTime: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  max={isRecoveryLounge(serviceTypes.find(st => st.id === slotForm.serviceTypeId)?.name) ? 5 : 50}
                  value={slotForm.capacity}
                  onChange={(e) => setSlotForm(f => ({ ...f, capacity: e.target.value }))}
                />
                {isRecoveryLounge(serviceTypes.find(st => st.id === slotForm.serviceTypeId)?.name) && (
                  <p className="text-[10px] text-amber-600 font-medium">Recovery Lounge max: 5</p>
                )}
              </div>
              <div className="space-y-1.5"><Label>Location Note</Label><Input value={slotForm.locationNote} onChange={(e) => setSlotForm(f => ({ ...f, locationNote: e.target.value }))} placeholder="Studio A, Room 2..." /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Session Title</Label>
              <Input value={slotForm.sessionTitle} onChange={(e) => setSlotForm(f => ({ ...f, sessionTitle: e.target.value }))} placeholder="e.g. Full Body Harmony, Core Balance..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSlot(false)}>Cancel</Button>
            <Button onClick={saveSlot} disabled={createSchedule.isPending}>
              {createSchedule.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Timeslot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Schedule Confirm */}
      <AlertDialog open={!!showScheduleBulkConfirm} onOpenChange={(o) => { if (!o && !bulkDeletingSchedules) setShowScheduleBulkConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {showScheduleBulkConfirm === "all"
                ? `Delete all ${filteredSchedules.length} sessions?`
                : `Delete ${selectedScheduleIds.size} selected session${selectedScheduleIds.size !== 1 ? "s" : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sessions with existing customer bookings cannot be deleted and will be skipped. All others will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeletingSchedules}>Cancel</AlertDialogCancel>
            <Button
              onClick={handleBulkDeleteSchedules}
              disabled={bulkDeletingSchedules}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {bulkDeletingSchedules && <Loader2 className="h-4 w-4 animate-spin" />}
              {bulkDeletingSchedules ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* ── Generate Weekly Sessions Dialog — hidden, now handled automatically by server cron. ──
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Weekly Sessions</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={generateForm.date}
                onChange={(e) => setGenerateForm({ ...generateForm, date: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">The date to start generating sessions from (Template: Mon-Sun).</p>
            </div>

            <div className="space-y-2">
              <Label>Number of Days</Label>
              <Select
                value={String(generateForm.days)}
                onValueChange={(v) => setGenerateForm({ ...generateForm, days: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Days (1 Week)</SelectItem>
                  <SelectItem value="14">14 Days (2 Weeks)</SelectItem>
                  <SelectItem value="1">1 Day (Test)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="force-gen"
                checked={generateForm.force}
                onChange={(e) => setGenerateForm({ ...generateForm, force: e.target.checked })}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="force-gen" className="text-sm cursor-pointer font-normal">
                Force overwrite existing sessions
              </Label>
            </div>

            <div className="rounded-lg bg-amber-50 p-3 border border-amber-100">
              <p className="text-xs text-amber-700 leading-relaxed">
                <strong>Note:</strong> This will use the predefined schedule template for each day. Existing sessions with bookings will <strong>not</strong> be deleted even with "Force" enabled.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                const tid = toast.loading("Generating sessions...");
                try {
                  const res = await generateWeeklySchedule.mutateAsync(generateForm);
                  toast.success(res.message || "Sessions generated successfully", { id: tid });
                  setShowGenerateDialog(false);
                } catch (err: any) {
                  toast.error(err?.body?.message || "Failed to generate sessions", { id: tid });
                }
              }}
              disabled={generateWeeklySchedule.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {generateWeeklySchedule.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      */}
    </div>
  );
};

export default ClassesPage;
