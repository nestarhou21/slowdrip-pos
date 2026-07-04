export type ClassStatus = "upcoming" | "in-progress" | "completed" | "cancelled";

export interface Instructor {
  id: string;
  name: string;
  specialty: string;
}

export interface ClassSlot {
  id: string;
  name: string;
  instructor: Instructor;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  status: ClassStatus;
  price: number;
  serviceTypeId: string;
  description: string;
}

export interface Reservation {
  id: string;
  classId: string;
  className: string;
  customerName: string;
  customerId: string;
  date: string;
  time: string;
  status: "confirmed" | "waitlisted" | "cancelled" | "late-cancel" | "attended" | "no-show";
  bookedAt: string;
}


export const instructors: Instructor[] = [
  { id: "i1", name: "Maya Lin", specialty: "Reformer Pilates" },
  { id: "i2", name: "Alex Rivera", specialty: "Mat Pilates" },
  { id: "i3", name: "Suki Tanaka", specialty: "Barre & Pilates" },
];

export const classSlots: ClassSlot[] = [
  ...[
    "2026-03-09",
    "2026-03-10",
    "2026-03-11",
    "2026-03-12",
    "2026-03-13",
    "2026-03-14",
    "2026-03-15",
  ].flatMap((date) => {
    const hourlySlots: ClassSlot[] = [];
    const types = ["reformer", "cadillac", "hot-pilates", "barre", "recovery-lounge"];

    // Add multiple sessions for each type every day
    types.forEach((type, tIdx) => {
      // Morning Session
      hourlySlots.push({
        id: `cl-${date}-${type}-am`,
        name: `${type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')} morning`,
        instructor: instructors[tIdx % 3],
        date,
        startTime: "08:00",
        endTime: "08:50",
        capacity: 10,
        status: "upcoming",
        price: 25.0,
        serviceTypeId: type,
        description: "Engaging morning session."
      });
      // Lunch Session
      hourlySlots.push({
        id: `cl-${date}-${type}-noon`,
        name: `${type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')} Lunch`,
        instructor: instructors[(tIdx + 1) % 3],
        date,
        startTime: "12:00",
        endTime: "12:50",
        capacity: 10,
        status: "upcoming",
        price: 25.0,
        serviceTypeId: type,
        description: "Focus on movement during lunch."
      });
      // Afternoon Session
      hourlySlots.push({
        id: `cl-${date}-${type}-pm1`,
        name: `${type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')} Power`,
        instructor: instructors[(tIdx + 2) % 3],
        date,
        startTime: "15:00",
        endTime: "15:50",
        capacity: 12,
        status: "upcoming",
        price: 25.0,
        serviceTypeId: type,
        description: "Afternoon energy boost."
      });
      // Evening Session
      hourlySlots.push({
        id: `cl-${date}-${type}-pm2`,
        name: `${type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')} Sunset`,
        instructor: instructors[tIdx % 3],
        date,
        startTime: "18:00",
        endTime: "18:50",
        capacity: 8,
        status: "upcoming",
        price: 30.0,
        serviceTypeId: type,
        description: "Wind down with evening movement."
      });
      // Late Night Session
      hourlySlots.push({
        id: `cl-${date}-${type}-night`,
        name: `${type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')} Night`,
        instructor: instructors[(tIdx + 1) % 3],
        date,
        startTime: "20:00",
        endTime: "20:50",
        capacity: 10,
        status: "upcoming",
        price: 22.0,
        serviceTypeId: type,
        description: "Final session of the day."
      });
    });
    return hourlySlots;
  })
];

export const reservations: Reservation[] = [
  {
    id: "r1",
    classId: "cl1",
    className: "Morning Flow",
    customerName: "Sarah Chen",
    customerId: "c1",
    date: "2026-02-25",
    time: "07:00",
    status: "confirmed",
    bookedAt: "2026-02-23T14:00:00",
  },
  {
    id: "r2",
    classId: "cl1",
    className: "Morning Flow",
    customerName: "Emily Wright",
    customerId: "c3",
    date: "2026-02-25",
    time: "07:00",
    status: "confirmed",
    bookedAt: "2026-02-22T10:30:00",
  },
  {
    id: "r3",
    classId: "cl2",
    className: "Power Pilates",
    customerName: "Aisha Patel",
    customerId: "c5",
    date: "2026-02-25",
    time: "09:00",
    status: "confirmed",
    bookedAt: "2026-02-24T09:00:00",
  },
  {
    id: "r4",
    classId: "cl2",
    className: "Power Pilates",
    customerName: "Liam Nguyen",
    customerId: "c6",
    date: "2026-02-25",
    time: "09:00",
    status: "waitlisted",
    bookedAt: "2026-02-24T16:00:00",
  },
  {
    id: "r5",
    classId: "cl3",
    className: "Matcha & Move",
    customerName: "Olivia Kim",
    customerId: "c7",
    date: "2026-02-25",
    time: "11:00",
    status: "confirmed",
    bookedAt: "2026-02-23T11:00:00",
  },
  {
    id: "r6",
    classId: "cl5",
    className: "Evening Reformer",
    customerName: "James Park",
    customerId: "c2",
    date: "2026-02-25",
    time: "18:00",
    status: "cancelled",
    bookedAt: "2026-02-21T20:00:00",
  },
  {
    id: "r7",
    classId: "cl1",
    className: "Morning Flow",
    customerName: "Michael Torres",
    customerId: "c4",
    date: "2026-02-25",
    time: "07:00",
    status: "no-show",
    bookedAt: "2026-02-20T12:00:00",
  },
];
