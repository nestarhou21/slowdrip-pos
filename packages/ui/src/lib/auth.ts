// ─── Simple localStorage-based auth for demo ────────────────────────────────

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  contactMethod: "phone" | "telegram" | "whatsapp";
  role: "admin" | "staff" | "customer";
}

const USERS_KEY = "zh_users";
const SESSION_KEY = "zh_session";
const ADMIN_SESSION_KEY = "zh_admin_session";
const ADMIN_ROLE_KEY = "zh_admin_role";

// Hardcoded users
const ADMIN_USER: UserAccount = {
  id: "admin-1",
  name: "Manager",
  email: "admin@zh.com",
  password: "admin123",
  phone: "",
  contactMethod: "phone",
  role: "admin",
};

const STAFF_USER: UserAccount = {
  id: "staff-1",
  name: "ZenHouse Staff",
  email: "staff@zh.com",
  password: "staff123",
  phone: "",
  contactMethod: "phone",
  role: "staff",
};

export function loginAdmin(email: string, password: string): { success: boolean; error?: string; role?: string } {
  if (email === ADMIN_USER.email && password === ADMIN_USER.password) {
    localStorage.setItem(ADMIN_SESSION_KEY, "true");
    localStorage.setItem(ADMIN_ROLE_KEY, ADMIN_USER.role);
    return { success: true, role: ADMIN_USER.role };
  }
  if (email === STAFF_USER.email && password === STAFF_USER.password) {
    localStorage.setItem(ADMIN_SESSION_KEY, "true");
    localStorage.setItem(ADMIN_ROLE_KEY, STAFF_USER.role);
    return { success: true, role: STAFF_USER.role };
  }
  return { success: false, error: "Invalid credentials." };
}

export function isAdminLoggedIn(): boolean {
  return localStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

export function getAdminRole(): string | null {
  return localStorage.getItem(ADMIN_ROLE_KEY);
}

export function logoutAdmin() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  localStorage.removeItem(ADMIN_ROLE_KEY);
}

// Stored users (for customers)
function getStoredUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: UserAccount[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function registerUser(data: Omit<UserAccount, "id" | "role">): { success: boolean; error?: string; user?: UserAccount } {
  const users = getStoredUsers();
  if (data.email === ADMIN_USER.email || data.email === STAFF_USER.email) return { success: false, error: "Email already in use." };
  if (users.find(u => u.email === data.email)) return { success: false, error: "Email already in use." };
  const user: UserAccount = { ...data, id: `cust-${Date.now()}`, role: "customer" };
  users.push(user);
  saveUsers(users);
  return { success: true, user };
}

export function loginUser(email: string, password: string): { success: boolean; error?: string; user?: UserAccount } {
  if (email === ADMIN_USER.email && password === ADMIN_USER.password) return { success: true, user: ADMIN_USER };
  if (email === STAFF_USER.email && password === STAFF_USER.password) return { success: true, user: STAFF_USER };

  const users = getStoredUsers();
  const user = users.find(u => u.email === email);
  if (!user) return { success: false, error: "No account found with this email." };
  if (user.password !== password) return { success: false, error: "Incorrect password." };
  return { success: true, user };
}

// Customer session
export function saveCustomerSession(user: { id: string; name: string; email: string; phone: string; contactMethod: string }) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function getCustomerSession(): { id: string; name: string; email: string; phone: string; contactMethod: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCustomerSession() {
  localStorage.removeItem(SESSION_KEY);
}
