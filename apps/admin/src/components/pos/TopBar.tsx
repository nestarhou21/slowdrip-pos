import { useState } from "react";
import { Search, Bell, Clock } from "lucide-react";
import { cn, Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import type { AdminNotification } from "@repo/store";

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  unreadCount?: number;
  notifications?: AdminNotification[];
  onShowAll?: () => void;
  onNotificationClick?: (notification: AdminNotification) => void;
  userRole?: string;
  userName?: string;
}

const TopBar = ({ searchQuery, onSearchChange, unreadCount = 0, notifications = [], onShowAll, onNotificationClick, userRole = "staff", userName = "" }: TopBarProps) => {
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };
  const [panelOpen, setPanelOpen] = useState(false);
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  const roleLabel = userRole === "admin" ? "Manager" : "Staff";
  // Use real name if available, fall back to role label
  const displayName = userName || roleLabel;
  // Initials: first letter of each word in the name (max 2)
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="font-medium">{dateStr}</span>
          <span className="text-primary font-semibold">{timeStr}</span>
        </div>
      </div>

      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search menu items..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-muted/50 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:bg-card"
        />
      </div>

      <div className="flex items-center gap-3">
        <Popover open={panelOpen} onOpenChange={setPanelOpen}>
          <PopoverTrigger asChild>
            <button className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-destructive/10 text-destructive font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="divide-y divide-border max-h-[360px] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No notifications</p>
              ) : (
                notifications.slice(0, 6).map((n) => (
                  <button 
                    key={n.id} 
                    onClick={() => { setPanelOpen(false); onNotificationClick?.(n); }}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b border-border last:border-0", 
                      !n.read && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                      {!n.read && <span className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">{timeAgo(n.created_at)}</p>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-border px-4 py-2.5">
              <button
                onClick={() => { setPanelOpen(false); onShowAll?.(); }}
                className="w-full text-center text-xs font-semibold text-primary hover:underline"
              >
                View all in Inbox &rarr;
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2">

          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initials}
          </div>
          <span className="text-sm font-medium text-foreground">{displayName}</span>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
