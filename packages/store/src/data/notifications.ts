export type NotificationType = "reservation" | "order" | "member" | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  contactMethod?: "phone" | "telegram" | "whatsapp";
}

export const notifications: Notification[] = [
  {
    id: "n1",
    type: "reservation",
    title: "New Reservation",
    message: "New member Jessica Lee booked Morning Flow (Feb 26, 07:00)",
    read: false,
    createdAt: "2026-02-25T13:45:00",
  },
  {
    id: "n2",
    type: "reservation",
    title: "Waitlist Alert",
    message: "Power Pilates (Feb 25, 09:00) has 3 waitlisted — consider adding a session",
    read: false,
    createdAt: "2026-02-25T12:00:00",
  },
  {
    id: "n3",
    type: "member",
    title: "New Member Signup",
    message: "Daniel Russo signed up as a Bronze member via the reservation portal",
    read: true,
    createdAt: "2026-02-25T10:30:00",
  },
  {
    id: "n4",
    type: "order",
    title: "Order Ready",
    message: "Order #1041 (James Park) is ready for pickup",
    read: true,
    createdAt: "2026-02-25T09:20:00",
  },
  {
    id: "n5",
    type: "reservation",
    title: "Cancellation",
    message: "James Park cancelled Evening Reformer reservation (Feb 25, 18:00)",
    read: true,
    createdAt: "2026-02-25T08:00:00",
  },
];
