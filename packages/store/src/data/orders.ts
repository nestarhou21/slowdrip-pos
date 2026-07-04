export type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";
export type OrderType = "dine-in" | "takeaway" | "delivery";

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  type: OrderType;
  total: number;
  subtotal?: number;
  tax?: number;
  discount?: number;
  paymentMethod?: "cash" | "aba";
  receivedAmount?: number;
  change?: number;
  createdAt: string;
  notes?: string;
}

export const orders: Order[] = [
  {
    id: "o1",
    orderNumber: "#1042",
    customerName: "Sarah Chen",
    customerId: "c1",
    items: [
      { name: "Iced Matcha Latte", quantity: 2, price: 5.50 },
      { name: "Matcha Croissant", quantity: 1, price: 4.75 },
    ],
    status: "preparing",
    type: "dine-in",
    total: 15.75,
    createdAt: "2026-02-25T09:30:00",
  },
  {
    id: "o2",
    orderNumber: "#1041",
    customerName: "James Park",
    customerId: "c2",
    items: [
      { name: "Hot Matcha Latte", quantity: 1, price: 4.50 },
      { name: "Cinnamon Roll", quantity: 2, price: 4.25 },
    ],
    status: "ready",
    type: "takeaway",
    total: 13.00,
    createdAt: "2026-02-25T09:15:00",
  },
  {
    id: "o3",
    orderNumber: "#1040",
    customerName: "Emily Wright",
    customerId: "c3",
    items: [
      { name: "Matcha Smoothie Bowl", quantity: 1, price: 8.50 },
      { name: "Butter Croissant", quantity: 1, price: 3.50 },
    ],
    status: "completed",
    type: "dine-in",
    total: 12.00,
    createdAt: "2026-02-25T08:45:00",
  },
  {
    id: "o4",
    orderNumber: "#1039",
    customerName: "Michael Torres",
    customerId: "c4",
    items: [
      { name: "Matcha Cheesecake", quantity: 2, price: 6.50 },
      { name: "Iced Matcha Latte", quantity: 2, price: 5.50 },
    ],
    status: "completed",
    type: "delivery",
    total: 24.00,
    createdAt: "2026-02-25T08:20:00",
  },
  {
    id: "o5",
    orderNumber: "#1038",
    customerName: "Aisha Patel",
    customerId: "c5",
    items: [
      { name: "Morning Flow", quantity: 1, price: 25.00 },
      { name: "Hot Matcha Latte", quantity: 1, price: 4.50 },
    ],
    status: "pending",
    type: "dine-in",
    total: 29.50,
    createdAt: "2026-02-25T10:00:00",
  },
  {
    id: "o6",
    orderNumber: "#1037",
    customerName: "Liam Nguyen",
    customerId: "c6",
    items: [{ name: "Power Pilates", quantity: 1, price: 30.00 }],
    status: "completed",
    type: "dine-in",
    total: 30.00,
    createdAt: "2026-02-24T16:00:00",
  },
  {
    id: "o7",
    orderNumber: "#1036",
    customerName: "Sarah Chen",
    customerId: "c1",
    items: [
      { name: "Chocolate Muffin", quantity: 3, price: 3.75 },
      { name: "Iced Matcha Latte", quantity: 1, price: 5.50 },
    ],
    status: "cancelled",
    type: "takeaway",
    total: 16.75,
    createdAt: "2026-02-24T14:30:00",
  },
  {
    id: "o8",
    orderNumber: "#1035",
    customerName: "Olivia Kim",
    customerId: "c7",
    items: [
      { name: "Matcha & Move", quantity: 1, price: 35.00 },
    ],
    status: "completed",
    type: "dine-in",
    total: 35.00,
    createdAt: "2026-02-24T10:00:00",
  },
];
