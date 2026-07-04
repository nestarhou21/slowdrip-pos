export type MembershipStatus = "active" | "inactive" | "suspended";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  membershipStatus: MembershipStatus;
  totalSpent: number;
  totalOrders: number;
  classesAttended: number;
  joinedAt: string;
  lastVisit: string;
  notes?: string;
  packageBalances?: Record<string, { sessionsLeft: number, expiry: string }>;
}

export const customers: Customer[] = [
  {
    id: "c1",
    name: "Sarah Chen",
    email: "sarah.chen@email.com",
    phone: "+1 (555) 123-4567",
    membershipStatus: "active",
    totalSpent: 842.50,
    totalOrders: 67,
    classesAttended: 24,
    joinedAt: "2025-03-15",
    lastVisit: "2026-02-25",
    notes: "Prefers oat milk. Regular morning customer.",
    packageBalances: {
      "reformer": { sessionsLeft: 12, expiry: "2026-06-15" },
      "hot-pilates": { sessionsLeft: 2, expiry: "2026-04-01" }
    }
  },
  {
    id: "c2",
    name: "James Park",
    email: "james.park@email.com",
    phone: "+1 (555) 234-5678",
    membershipStatus: "active",
    totalSpent: 456.00,
    totalOrders: 38,
    classesAttended: 12,
    joinedAt: "2025-06-20",
    lastVisit: "2026-02-25",
    packageBalances: {
      "reformer": { sessionsLeft: 5, expiry: "2026-05-20" }
    }
  },
  {
    id: "c3",
    name: "Emily Wright",
    email: "emily.w@email.com",
    phone: "+1 (555) 345-6789",
    membershipStatus: "active",
    totalSpent: 1240.00,
    totalOrders: 95,
    classesAttended: 48,
    joinedAt: "2025-01-10",
    lastVisit: "2026-02-25",
    notes: "VIP customer. Attends pilates 4x/week.",
    packageBalances: {
      "reformer": { sessionsLeft: 24, expiry: "2026-12-31" },
      "recovery-lounge": { sessionsLeft: 8, expiry: "2026-06-30" }
    }
  },
  {
    id: "c4",
    name: "Michael Torres",
    email: "m.torres@email.com",
    phone: "+1 (555) 456-7890",
    membershipStatus: "active",
    totalSpent: 186.50,
    totalOrders: 15,
    classesAttended: 3,
    joinedAt: "2025-11-01",
    lastVisit: "2026-02-24",
  },
  {
    id: "c5",
    name: "Aisha Patel",
    email: "aisha.patel@email.com",
    phone: "+1 (555) 567-8901",
    membershipStatus: "active",
    totalSpent: 720.00,
    totalOrders: 52,
    classesAttended: 30,
    joinedAt: "2025-04-08",
    lastVisit: "2026-02-25",
    notes: "Instructor referral. Interested in private sessions.",
  },
  {
    id: "c6",
    name: "Liam Nguyen",
    email: "liam.n@email.com",
    phone: "+1 (555) 678-9012",
    membershipStatus: "active",
    totalSpent: 390.00,
    totalOrders: 28,
    classesAttended: 16,
    joinedAt: "2025-07-15",
    lastVisit: "2026-02-24",
  },
  {
    id: "c7",
    name: "Olivia Kim",
    email: "olivia.kim@email.com",
    phone: "+1 (555) 789-0123",
    membershipStatus: "active",
    totalSpent: 680.00,
    totalOrders: 45,
    classesAttended: 22,
    joinedAt: "2025-05-22",
    lastVisit: "2026-02-24",
    notes: "Allergic to nuts.",
  },
  {
    id: "c8",
    name: "Daniel Russo",
    email: "d.russo@email.com",
    phone: "+1 (555) 890-1234",
    membershipStatus: "inactive",
    totalSpent: 95.00,
    totalOrders: 8,
    classesAttended: 1,
    joinedAt: "2026-01-15",
    lastVisit: "2026-02-20",
  },
];
