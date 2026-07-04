import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// ─── Constants ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "zenhouse_auth_session";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// ─── Auth State Management ───────────────────────────────────────────────────
let _currentSession: Session | null = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
const _subscribers: Array<(session: Session | null, user: User | null, event: string) => void> = [];

function notify(event: string) {
    const user = _currentSession?.user ?? null;
    _subscribers.forEach((cb) => cb(_currentSession, user, event));
}

function setSession(session: Session | null, event: string = "SIGNED_IN") {
    _currentSession = session;
    if (session) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
    notify(event);
}

// ─── Listen for Supabase Auth changes (Google redirection, etc.) ─────────────
// This ensures that when Google redirects back, we pick up the token and
// notify the Laravel backend.
supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED" || event === "PASSWORD_RECOVERY") {
        setSession(session, event);
    } else if (event === "SIGNED_OUT") {
        setSession(null, "SIGNED_OUT");
    }
});

// ─── Public API ──────────────────────────────────────────────────────────────

/** Bridge to Laravel login endpoint */
export async function signIn(email: string, password: string) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false as const,
                error: data.message || "Email or password is incorrect. Please try again.",
                errorCode: data.error_code as string | undefined,
                retryAfter: data.retry_after as number | undefined,
                attemptsRemaining: data.attempts_remaining as number | undefined,
            };
        }

        // The Laravel AuthController returns the Supabase session object.
        // Register it with the Supabase client so autoRefreshToken works.
        if (data.access_token && data.refresh_token) {
            await supabase.auth.setSession({
                access_token: data.access_token,
                refresh_token: data.refresh_token,
            });
        }
        setSession(data, "SIGNED_IN");
        return { success: true as const, session: data, user: data.user };
    } catch {
        return {
            success: false as const,
            error: "Unable to connect. Please check your internet connection.",
        };
    }
}

/** Google OAuth */
export async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: window.location.origin + "/book",
        },
    });

    if (error) {
        return { success: false as const, error: error.message };
    }
    return { success: true as const };
}

/** Phone OTP Step 1: Send SMS */
export async function signInWithPhone(phone: string) {
    const { error } = await supabase.auth.signInWithOtp({
        phone: phone,
    });

    if (error) {
        return { success: false as const, error: error.message };
    }
    return { success: true as const };
}

/** Phone OTP Step 2: Verify Code */
export async function verifyOtp(phone: string, token: string) {
    const { data, error } = await supabase.auth.verifyOtp({
        phone: phone,
        token: token,
        type: "sms",
    });

    if (error) {
        return { success: false as const, error: error.message };
    }
    if (data.session) {
        setSession(data.session, "SIGNED_IN");
    }
    return { success: true as const, session: data.session, user: data.user };
}

/** Bridge to Laravel register endpoint */
export async function signUp(email: string, password: string, metadata: any) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ email, password, metadata }),
        });

        const data = await response.json();

        if (!response.ok) {
            return { 
                success: false as const, 
                error: data.message || "Registration failed." 
            };
        }

        // Supabase might return a session or just a user if email confirmation is required
        if (data.session) {
            setSession(data.session, "SIGNED_IN");
        }
        
        return { success: true as const, session: data.session, user: data.user };
    } catch {
        return {
            success: false as const,
            error: "Unable to connect to the server.",
        };
    }
}

/** Clear session locally */
export async function signOut() {
    // Optionally hit Laravel logout endpoint
    getAccessToken().then(token => {
        if (!token) return;
        fetch(`${API_BASE_URL}/auth/logout`, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Accept": "application/json" 
            },
        }).catch(() => {});
    });

    await supabase.auth.signOut();
    setSession(null, "SIGNED_OUT");
}

/** Get current session from local storage / memory */
export async function getSession(): Promise<Session | null> {
    return _currentSession;
}

/** Token refresh using Supabase internal mechanism */
export async function refreshAccessToken(): Promise<string | null> {
    try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) {
            // Refresh failed — clear stale session so the app forces re-login
            setSession(null, "SIGNED_OUT");
            return null;
        }
        setSession(data.session, "TOKEN_REFRESHED");
        return data.session.access_token;
    } catch {
        // Supabase crashes internally (e.g. 'Cannot read properties of undefined (reading payload)')
        // when the stored refresh token is invalid/expired. Clear it and force re-login.
        setSession(null, "SIGNED_OUT");
        return null;
    }
}

/** Get token for API headers — refreshes proactively if within 60s of expiry */
export async function getAccessToken(): Promise<string | null> {
    const session = await getSession();
    if (!session) return null;
    const expiresAt = session.expires_at; // Unix seconds
    if (expiresAt && expiresAt - 60 < Math.floor(Date.now() / 1000)) {
        try {
            return await refreshAccessToken();
        } catch {
            setSession(null, "SIGNED_OUT");
            return null;
        }
    }
    return session.access_token;
}

/** Send a password-reset magic link via Supabase (routed through Resend SMTP) */
export async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
}

/** Set a new password using the recovery session from the magic link */
export async function updatePasswordDirect(password: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { success: false, error: error.message };
    return { success: true };
}

/** Update user password via backend */
export async function updatePassword(password: string): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/update-password`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json", 
                "Accept": "application/json",
                "Authorization": `Bearer ${_currentSession?.access_token}`
            },
            body: JSON.stringify({ password }),
        });

        const data = await response.json();
        if (!response.ok) return { success: false, error: data.message || "Failed to update password." };
        return { success: true };
    } catch {
        return { success: false, error: "Unable to connect to the server." };
    }
}

/** Auth change listener for useAuth hook */
export function onAuthStateChange(
    callback: (session: Session | null, user: User | null, event: string) => void
) {
    _subscribers.push(callback);
    
    // Initial emission
    const user = _currentSession?.user ?? null;
    callback(_currentSession, user, "INITIAL_SESSION");

    return () => {
        const idx = _subscribers.indexOf(callback);
        if (idx !== -1) _subscribers.splice(idx, 1);
    };
}
