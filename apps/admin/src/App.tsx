import { useState, useEffect, useRef, useCallback, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Toaster, Sonner, TooltipProvider, toast } from "@repo/ui";
import { onAuthStateChange, signOut, api, getAccessToken, refreshAccessToken } from "@repo/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import type { Session } from "@supabase/supabase-js";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("[App error]", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center space-y-3 p-8">
            <p className="text-lg font-semibold text-foreground">Something went wrong</p>
            <p className="text-sm text-muted-foreground">Please refresh the page to try again.</p>
            <button className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" onClick={() => window.location.reload()}>Refresh</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

type MeResponse = { data: { id: string; role: string; first_name: string | null; last_name: string | null; email: string } };

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState("barista");
  const [userName, setUserName] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // roleConfirmed is only true once /auth/me succeeds — prevents portal access
  // when the backend is unreachable or returns an unexpected error.
  const [roleConfirmed, setRoleConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const sessionRef = useRef<Session | null>(null);

  // Extracted so both onAuthStateChange and handleRetry can call it
  const fetchUserRole = useCallback(async () => {
    setRoleLoading(true);
    setAuthError(null);

    const token = await getAccessToken();
    if (!token) {
      setAuthError("Session expired. Please sign in again.");
      setRoleConfirmed(false);
      setRoleLoading(false);
      return;
    }

    let res: MeResponse | null = null;
    try {
      res = await api.get<MeResponse>("/auth/me");
    } catch (err: any) {
      // 401 = stale token (race with Supabase background refresh). Retry once with fresh token.
      if (err?.status === 401) {
        const fresh = await refreshAccessToken();
        if (fresh) {
          try { res = await api.get<MeResponse>("/auth/me"); } catch { /* fall through */ }
        }
      }
      if (!res) {
        const status = err?.status;
        if (status === 401) {
          setAuthError("Session expired. Please sign in again.");
        } else if (status === 403) {
          setAuthError("You do not have permission to access this portal.");
        } else {
          setAuthError("Unable to connect to the server. Please try again.");
        }
        setRoleConfirmed(false);
        setRoleLoading(false);
        return;
      }
    }

    if (res) {
      const role = res.data?.role;
      if (!role || !["admin", "barista", "receptionist"].includes(role)) {
        setAuthError("Your account does not have admin or staff access.");
        setRoleConfirmed(false);
      } else {
        setUserRole(role);
        setRoleConfirmed(true);
      }
      const first = res.data?.first_name ?? "";
      const last = res.data?.last_name ?? "";
      setUserName([first, last].filter(Boolean).join(" ") || res.data?.email || "");
      setCurrentUserId(res.data?.id ?? null);
    }
    setRoleLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((newSession, _user, event) => {
      const userId = newSession?.user?.id ?? null;
      const userChanged = userId !== lastUserIdRef.current;

      if (event !== "TOKEN_REFRESHED" || userChanged) {
        setSession(newSession);
        sessionRef.current = newSession;
        setLoading(false);
      } else {
        setLoading(false);
      }

      if (newSession && userChanged) {
        lastUserIdRef.current = userId;
        setRoleLoading(true); // set synchronously to avoid flash
        fetchUserRole();
      } else if (!newSession && userChanged) {
        lastUserIdRef.current = null;
        setUserRole("barista");
        setUserName("");
        setCurrentUserId(null);
        setRoleConfirmed(false);
        setRoleLoading(false);
      } else if (!newSession) {
        setRoleLoading(false);
      }
    });

    return unsubscribe;
  }, [fetchUserRole]);

  const handleLogin = useCallback(() => {
    setAuthError(null);
    setRoleConfirmed(false);
    // If a session already exists (same user re-authenticating), trigger role fetch
    // since onAuthStateChange won't fire when the user ID hasn't changed.
    if (sessionRef.current) {
      fetchUserRole();
    }
  }, [fetchUserRole]);

  const handleRetry = useCallback(() => {
    if (sessionRef.current) {
      fetchUserRole();
    }
  }, [fetchUserRole]);

  const handleLogout = useCallback(async () => {
    await signOut();
    setSession(null);
    sessionRef.current = null;
    queryClient.clear();
    // Clear saved tab so the next user starts on their own default tab
    try {
      localStorage.removeItem("zh_staff_tab");
      localStorage.removeItem("zh_admin_tab");
    } catch { /* ignore */ }
  }, []);

  // Auto-logout when any API call returns 401 (session expired on the server)
  useEffect(() => {
    let fired = false;
    const handle = () => {
      if (fired) return;
      fired = true;
      toast.error("Your session has expired. Please sign in again.", { id: "session-expired" });
      handleLogout();
    };
    window.addEventListener("zh:session-expired", handle);
    return () => window.removeEventListener("zh:session-expired", handle);
  }, [handleLogout]);

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        {/* Sidebar skeleton */}
        <div className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card px-3 py-4 gap-3">
          <div className="flex items-center gap-3 px-1 pb-3">
            <div className="h-14 w-14 rounded-xl bg-muted animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-28 rounded bg-muted animate-pulse" />
              <div className="h-3 w-16 rounded bg-muted animate-pulse" />
            </div>
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              <div className="h-4 w-4 rounded bg-muted animate-pulse" />
              <div className="h-4 rounded bg-muted animate-pulse" style={{ width: `${55 + (i % 3) * 20}px` }} />
            </div>
          ))}
        </div>
        {/* Main content skeleton */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Topbar */}
          <div className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
            <div className="h-5 w-36 rounded bg-muted animate-pulse" />
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            </div>
          </div>
          {/* Content area */}
          <div className="flex-1 p-6 space-y-4">
            <div className="h-8 w-48 rounded bg-muted animate-pulse" />
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
            <div className="h-64 rounded-2xl bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const isAuthenticated = !!session && roleConfirmed;
  const isPendingRole = !!session && !roleConfirmed && !roleLoading;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="bottom-right" />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Auth */}
            <Route
              path="/login"
              element={
                isAuthenticated && !authError
                  ? <Navigate to={userRole === "admin" ? "/admin" : "/staff"} replace />
                  : <ErrorBoundary><Login onLogin={handleLogin} authError={authError} onRetry={isPendingRole ? handleRetry : undefined} /></ErrorBoundary>
              }
            />

            {/* Admin portal — admins only */}
            <Route
              path="/admin/*"
              element={
                !isAuthenticated
                  ? <Navigate to="/login" replace />
                  : userRole !== "admin"
                  ? <Navigate to="/staff" replace />
                  : <ErrorBoundary><Index onLogout={handleLogout} userRole="admin" userName={userName} currentUserId={currentUserId} /></ErrorBoundary>
              }
            />

            {/* Staff portal — staff and admin */}
            <Route
              path="/staff/*"
              element={
                !isAuthenticated
                  ? <Navigate to="/login" replace />
                  : <ErrorBoundary><Index onLogout={handleLogout} userRole={userRole} staffPortal userName={userName} /></ErrorBoundary>
              }
            />

            {/* Default redirect based on role */}
            <Route
              path="/"
              element={
                !isAuthenticated
                  ? <Navigate to="/login" replace />
                  : <Navigate to={userRole === "admin" ? "/admin" : "/staff"} replace />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
