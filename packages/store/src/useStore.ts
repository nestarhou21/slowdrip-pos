import { useSyncExternalStore } from "react";
import { products as defaultProducts, categories as defaultCategories, type Product } from "./data/products";
import { orders as defaultOrders, type Order } from "./data/orders";
import { notifications as defaultNotifications, type Notification } from "./data/notifications";
import { classSlots as defaultClassSlots, type ClassSlot, reservations as defaultReservations, type Reservation } from "./data/classes";
import { classPackages as defaultClassPackages, membershipPlans as defaultMembershipPlans, type ClassPackage, type MembershipPlan } from "./data/classPackages";
import { customers as defaultCustomers, type Customer } from "./data/customers";

// ─── Simple global store shared across admin + public portals ────────────────

interface Store {
  products: Product[];
  orders: Order[];
  notifications: Notification[];
  closedClassIds: Set<string>;
  classSlots: ClassSlot[];
  reservations: Reservation[];
  classPackages: ClassPackage[];
  membershipPlans: MembershipPlan[];
  categories: { id: string; label: string; count: number }[];
  members: Customer[];
  registerSession: {
    isOpen: boolean;
    openedAt: string | null;
    closedAt: string | null;
    openingBalance: number;
    closingBalance: number | null;
    cashIn: number;
    cashOut: number;
    staffName: string | null;
    shiftType: "morning" | "afternoon" | null;
    shiftStartTime: string | null;
    shiftEndTime: string | null;
    cashEntries: {
      id: string;
      type: 'in' | 'out';
      amount: number;
      reason: string;
      time: string;
    }[];
  };
}

const STORAGE_KEY = "zenhouse_store_v8";

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        products: parsed.products ?? [...defaultProducts],
        orders: parsed.orders ?? [...defaultOrders],
        notifications: parsed.notifications ?? [...defaultNotifications],
        closedClassIds: new Set(parsed.closedClassIds ?? []),
        classSlots: parsed.classSlots ?? [...defaultClassSlots],
        reservations: parsed.reservations ?? [...defaultReservations],
        classPackages: parsed.classPackages ?? [...defaultClassPackages],
        membershipPlans: parsed.membershipPlans ?? [...defaultMembershipPlans],
        categories: parsed.categories ?? [...defaultCategories],
        members: parsed.members ?? [...defaultCustomers],
        registerSession: parsed.registerSession ?? {
          isOpen: false,
          openedAt: null,
          closedAt: null,
          openingBalance: 0,
          closingBalance: null,
          cashIn: 0,
          cashOut: 0,
          staffName: null,
          shiftType: null,
          shiftStartTime: null,
          shiftEndTime: null,
          cashEntries: [],
        },
      };
    }
  } catch (e) {
    console.warn("Failed to load store from localStorage", e);
  }
  return {
    products: [...defaultProducts],
    orders: [...defaultOrders],
    notifications: [...defaultNotifications],
    closedClassIds: new Set(),
    classSlots: [...defaultClassSlots],
    reservations: [...defaultReservations],
    classPackages: [...defaultClassPackages],
    membershipPlans: [...defaultMembershipPlans],
    categories: [...defaultCategories],
    members: [...defaultCustomers],
    registerSession: {
      isOpen: false,
      openedAt: null,
      closedAt: null,
      openingBalance: 0,
      closingBalance: null,
      cashIn: 0,
      cashOut: 0,
      staffName: null,
      shiftType: null,
      shiftStartTime: null,
      shiftEndTime: null,
      cashEntries: [],
    },
  };
}

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...store,
      closedClassIds: Array.from(store.closedClassIds),
    }));
  } catch (e) {
    console.warn("Failed to save store to localStorage", e);
  }
}

let store: Store = loadStore();

const listeners = new Set<() => void>();

function emitChange() {
  saveStore();
  listeners.forEach((l) => l());
}

// Cross-tab sync: listen for localStorage changes from other tabs
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      store = loadStore();
      listeners.forEach((l) => l());
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ─── Selectors ───────────────────────────────────────────────────────────────

function getProducts() { return store.products; }
function getOrders() { return store.orders; }
function getNotifications() { return store.notifications; }
function getClosedClassIds() { return store.closedClassIds; }
function getClassSlots() { return store.classSlots; }
function getClassPackages() { return store.classPackages; }
function getMembershipPlans() { return store.membershipPlans; }
function getCategories() { return store.categories; }
function getMembers() { return store.members; }
function getReservations() { return store.reservations; }
function getRegisterSession() { return store.registerSession; }

// ─── Product Actions ─────────────────────────────────────────────────────────

export function setProducts(products: Product[]) {
  store = { ...store, products };
  emitChange();
}

export function addProduct(product: Product) {
  store = { ...store, products: [...store.products, product] };
  emitChange();
}

export function updateProduct(id: string, updates: Partial<Product>) {
  store = { ...store, products: store.products.map((p) => p.id === id ? { ...p, ...updates } : p) };
  emitChange();
}

export function deleteProduct(id: string) {
  store = { ...store, products: store.products.filter((p) => p.id !== id) };
  emitChange();
}

export function addCategory(category: { id: string; label: string; count: number }) {
  store = { ...store, categories: [...store.categories, category] };
  emitChange();
}

// ─── Order Actions ───────────────────────────────────────────────────────────

export function setOrders(orders: Order[]) {
  store = { ...store, orders };
  emitChange();
}

export function addOrder(order: Order) {
  store = { ...store, orders: [order, ...store.orders] };
  emitChange();
}

export function updateOrder(id: string, updates: Partial<Order>) {
  store = { ...store, orders: store.orders.map((o) => o.id === id ? { ...o, ...updates } : o) };
  emitChange();
}

// ─── Notification Actions ────────────────────────────────────────────────────

export function addNotification(notification: Notification) {
  store = { ...store, notifications: [notification, ...store.notifications] };
  emitChange();
}

export function setNotifications(notifications: Notification[]) {
  store = { ...store, notifications };
  emitChange();
}

export function markNotificationRead(id: string) {
  store = { ...store, notifications: store.notifications.map((n) => n.id === id ? { ...n, read: true } : n) };
  emitChange();
}

export function markAllNotificationsRead() {
  store = { ...store, notifications: store.notifications.map((n) => ({ ...n, read: true })) };
  emitChange();
}

export function deleteNotification(id: string) {
  store = { ...store, notifications: store.notifications.filter((n) => n.id !== id) };
  emitChange();
}

// ─── Class Availability Actions ──────────────────────────────────────────────

export function toggleClassClosed(classId: string) {
  const next = new Set(store.closedClassIds);
  if (next.has(classId)) next.delete(classId);
  else next.add(classId);
  store = { ...store, closedClassIds: next };
  emitChange();
}

export function setClassSlots(slots: ClassSlot[]) {
  store = { ...store, classSlots: slots };
  emitChange();
}

export function addClassSlot(slot: ClassSlot) {
  store = { ...store, classSlots: [...store.classSlots, slot] };
  emitChange();
}

export function updateClassSlot(id: string, updates: Partial<ClassSlot>) {
  store = { ...store, classSlots: store.classSlots.map(s => s.id === id ? { ...s, ...updates } : s) };
  emitChange();
}

export function deleteClassSlot(id: string) {
  store = { ...store, classSlots: store.classSlots.filter(s => s.id !== id) };
  emitChange();
}

// ─── Reservation Actions ─────────────────────────────────────────────────────

export function addReservation(reservation: Reservation) {
  store = { ...store, reservations: [...store.reservations, reservation] };
  emitChange();
}

export function updateReservation(id: string, updates: Partial<Reservation>) {
  store = { ...store, reservations: store.reservations.map(r => r.id === id ? { ...r, ...updates } : r) };
  emitChange();
}

export function deleteReservation(id: string) {
  store = { ...store, reservations: store.reservations.filter(r => r.id !== id) };
  emitChange();
}

// ─── Package Actions ─────────────────────────────────────────────────────────

export function setClassPackages(pkgs: ClassPackage[]) {
  store = { ...store, classPackages: pkgs };
  emitChange();
}

export function addClassPackage(pkg: ClassPackage) {
  store = { ...store, classPackages: [...store.classPackages, pkg] };
  emitChange();
}

export function updateClassPackage(id: string, updates: Partial<ClassPackage>) {
  store = { ...store, classPackages: store.classPackages.map(p => p.id === id ? { ...p, ...updates } : p) };
  emitChange();
}

export function deleteClassPackage(id: string) {
  store = { ...store, classPackages: store.classPackages.filter(p => p.id !== id) };
  emitChange();
}

// ─── Membership Plan Actions ─────────────────────────────────────────────────

export function setMembershipPlans(plans: MembershipPlan[]) {
  store = { ...store, membershipPlans: plans };
  emitChange();
}

export function addMembershipPlan(plan: MembershipPlan) {
  store = { ...store, membershipPlans: [...store.membershipPlans, plan] };
  emitChange();
}

export function updateMembershipPlan(id: string, updates: Partial<MembershipPlan>) {
  store = { ...store, membershipPlans: store.membershipPlans.map(p => p.id === id ? { ...p, ...updates } : p) };
  emitChange();
}

export function deleteMembershipPlan(id: string) {
  store = { ...store, membershipPlans: store.membershipPlans.filter(p => p.id !== id) };
  emitChange();
}

// ─── Member Actions ──────────────────────────────────────────────────────────

export function setMembers(members: Customer[]) {
  store = { ...store, members };
  emitChange();
}

export function addMember(member: Customer) {
  store = { ...store, members: [...store.members, member] };
  emitChange();
}

export function updateMember(id: string, updates: Partial<Customer>) {
  store = { ...store, members: store.members.map(m => m.id === id ? { ...m, ...updates } : m) };
  emitChange();
}

export function deductMemberSession(customerId: string, serviceTypeId: string) {
  store = {
    ...store,
    members: store.members.map(m => {
      if (m.id !== customerId || !m.packageBalances || !serviceTypeId || !m.packageBalances[serviceTypeId]) return m;
      const current = m.packageBalances[serviceTypeId];
      if (current.sessionsLeft <= 0) return m;

      return {
        ...m,
        classesAttended: (m.classesAttended || 0) + 1,
        packageBalances: {
          ...m.packageBalances,
          [serviceTypeId]: {
            ...current,
            sessionsLeft: current.sessionsLeft - 1
          }
        }
      };
    })
  };
  emitChange();
}

// ─── Register Actions ────────────────────────────────────────────────────────

export function openRegister(data: {
  openingBalance: number;
  staffName: string;
  shiftType: "morning" | "afternoon";
  startTime: string;
  endTime: string;
}) {
  store = {
    ...store,
    registerSession: {
      isOpen: true,
      openedAt: new Date().toISOString(),
      closedAt: null,
      openingBalance: data.openingBalance,
      closingBalance: null,
      cashIn: 0,
      cashOut: 0,
      staffName: data.staffName,
      shiftType: data.shiftType,
      shiftStartTime: data.startTime,
      shiftEndTime: data.endTime,
      cashEntries: [],
    }
  };
  emitChange();
}

export function closeRegister(actualCash: number) {
  store = {
    ...store,
    registerSession: {
      ...store.registerSession,
      isOpen: false,
      closedAt: new Date().toISOString(),
      closingBalance: actualCash,
    }
  };
  emitChange();
}

export function updateRegisterCash(type: 'in' | 'out', amount: number, reason: string = "Manual Entry") {
  const newEntry = {
    id: Math.random().toString(36).substr(2, 9),
    type,
    amount,
    reason,
    time: new Date().toISOString(),
  };
  store = {
    ...store,
    registerSession: {
      ...store.registerSession,
      cashIn: type === 'in' ? store.registerSession.cashIn + amount : store.registerSession.cashIn,
      cashOut: type === 'out' ? store.registerSession.cashOut + amount : store.registerSession.cashOut,
      cashEntries: [...(store.registerSession.cashEntries || []), newEntry],
    }
  };
  emitChange();
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useProducts() {
  return useSyncExternalStore(subscribe, getProducts);
}

export function useOrders() {
  return useSyncExternalStore(subscribe, getOrders);
}

export function useNotifications() {
  return useSyncExternalStore(subscribe, getNotifications);
}

export function useClosedClassIds() {
  return useSyncExternalStore(subscribe, getClosedClassIds);
}

export function useClassSlots() {
  return useSyncExternalStore(subscribe, getClassSlots);
}

export function useClassPackages() {
  return useSyncExternalStore(subscribe, getClassPackages);
}

export function useMembershipPlans() {
  return useSyncExternalStore(subscribe, getMembershipPlans);
}

export function useCategories() {
  return useSyncExternalStore(subscribe, getCategories);
}

export function useMembers() {
  return useSyncExternalStore(subscribe, getMembers);
}

export function useReservations() {
  return useSyncExternalStore(subscribe, getReservations);
}

export function useRegisterSession() {
  return useSyncExternalStore(subscribe, getRegisterSession);
}
