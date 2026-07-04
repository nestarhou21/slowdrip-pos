import { useState, useEffect } from "react";
import { Eye, EyeOff, RefreshCw, Lock } from "lucide-react";
import { Button, Input, Label } from "@repo/ui";
import { signIn } from "@repo/store";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 10;
const STORAGE_KEY = "admin_login_lockout";

interface LockoutState { attempts: number; lockedUntil: number | null }

function getLockout(): LockoutState {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return { attempts: 0, lockedUntil: null }; }
}
function saveLockout(s: LockoutState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

interface LoginProps {
  onLogin: () => void;
  authError?: string | null;
  onRetry?: () => void;
}

const Login = ({ onLogin, authError, onRetry }: LoginProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const isLockedOut = secondsLeft > 0;

  // Tick the lockout countdown
  useEffect(() => {
    const check = () => {
      const { lockedUntil } = getLockout();
      if (lockedUntil && lockedUntil > Date.now()) {
        setSecondsLeft(Math.ceil((lockedUntil - Date.now()) / 1000));
      } else {
        setSecondsLeft(0);
      }
    };
    check();
    const t = setInterval(check, 1000);
    return () => clearInterval(t);
  }, []);

  const displayError = error || authError || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) return;
    if (!email || !password) { setError("Please fill in all fields"); return; }

    setLoading(true);
    setError("");

    const result = await signIn(email, password);

    if (result.success) {
      saveLockout({ attempts: 0, lockedUntil: null });
      onLogin();
    } else {
      const prev = getLockout();
      const attempts = (prev.attempts || 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        const lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
        saveLockout({ attempts, lockedUntil });
        setSecondsLeft(LOCKOUT_MINUTES * 60);
        setError("");
      } else {
        saveLockout({ attempts, lockedUntil: null });
        const remaining = MAX_ATTEMPTS - attempts;
        setError(`Incorrect credentials. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`);
      }
    }

    setLoading(false);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            Slow Drip
          </h1>
          <p className="mt-1 text-sm text-muted-foreground uppercase tracking-[0.2em] font-semibold">Admin Portal</p>
        </div>

        {isLockedOut ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
            <Lock className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm font-bold text-destructive">Too many failed attempts</p>
            <p className="text-xs text-destructive/80">
              Try again in{" "}
              <span className="font-black tabular-nums">
                {mins}:{String(secs).padStart(2, "0")}
              </span>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                className="h-11 rounded-xl shadow-sm"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className="h-11 rounded-xl pr-10 shadow-sm"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {displayError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 space-y-2">
                <p className="text-sm text-destructive font-medium">{displayError}</p>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="flex items-center gap-1.5 text-xs font-semibold text-destructive underline-offset-2 hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry connection
                  </button>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-primary/20"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
