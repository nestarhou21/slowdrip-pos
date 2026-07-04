import { LayoutGrid, ClipboardList, Settings, LogOut, Package, Users, ShoppingBag, Wallet, ShieldCheck, ReceiptText, Boxes } from "lucide-react";
import { cn } from "@repo/ui";
import { useSettings } from "@repo/store";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  ordersBadge?: number;
  inboxBadge?: number;
  onLogout?: () => void;
  userRole?: string;
  staffPortal?: boolean;
}

const ADMIN_ALL = ["admin", "barista", "receptionist"];
const ADMIN_ONLY = ["admin"];
const POS_ROLES = ["admin", "barista"];

const navItems = [
  { id: "dashboard",        label: "Dashboard",    icon: LayoutGrid,    roles: ADMIN_ONLY },
  { id: "menu",             label: "POS Register", icon: ShoppingBag,   roles: POS_ROLES  },
  { id: "orders",           label: "Orders",       icon: ClipboardList, roles: POS_ROLES  },
  { id: "register",         label: "Shift",        icon: Wallet,        roles: POS_ROLES  },
  { id: "products",         label: "Products",     icon: Package,       roles: ADMIN_ONLY },
  { id: "staff-management", label: "Staff",        icon: ShieldCheck,   roles: ADMIN_ONLY },
  { id: "members",          label: "Customers",    icon: Users,         roles: ADMIN_ONLY },
  { id: "transactions",     label: "Transactions", icon: ReceiptText,   roles: ADMIN_ONLY },
  { id: "inventory",         label: "Inventory",    icon: Boxes,         roles: ADMIN_ONLY },
  { id: "settings",         label: "Settings",     icon: Settings,      roles: ADMIN_ONLY },
];

const PORTAL_LABELS: Record<string, string> = {
  admin: "Admin Portal",
  staff: "Staff Portal",
  barista: "Barista",
  receptionist: "Receptionist",
};

const Sidebar = ({ activeTab, onTabChange, ordersBadge, inboxBadge, onLogout, userRole = "barista", staffPortal = false }: SidebarProps) => {
  const { data: settings } = useSettings();
  const filteredItems = navItems.filter(item => item.roles.includes(userRole));

  const portalLabel = PORTAL_LABELS[userRole] ?? "Admin Portal";

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-border">
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          {settings?.cafe_name ?? "Slow Drip"}
        </h1>
        <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">{portalLabel}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 pt-4 overflow-y-auto scrollbar-thin">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span>{item.label}</span>
              {item.id === "orders" && ordersBadge != null && ordersBadge > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {ordersBadge}
                </span>
              )}
              {item.id === "inbox" && inboxBadge != null && inboxBadge > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                  {inboxBadge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border p-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
