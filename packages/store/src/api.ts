import { getAccessToken } from "./auth";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApiError {
    message: string;
    errors?: Record<string, string[]>; // Laravel validation errors
}

// ─── Core Fetch Wrapper ──────────────────────────────────────────────────────

async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    // getAccessToken may throw if Supabase's internal JWT parser crashes on
    // a malformed/expired token — treat that as "no token" so the request
    // still fires and gets a 401 which triggers the session-expired flow.
    const token = await getAccessToken().catch(() => null);

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers as Record<string, string>),
    };

    // Attach Bearer token if we have one
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    // Handle non-OK responses
    if (!response.ok) {
        const errorBody: ApiError = await response.json().catch(() => ({
            message: `Request failed with status ${response.status}`,
        }));

        // Notify the app to force-logout when the session expires.
        // Skip auth endpoints so login/register 401s don't trigger this.
        // The flag prevents multiple concurrent 401s from firing the event repeatedly.
        if (response.status === 401 && !endpoint.startsWith("/auth/")) {
            if (!(window as any).__zhSessionExpiredFired) {
                (window as any).__zhSessionExpiredFired = true;
                window.dispatchEvent(new CustomEvent("zh:session-expired"));
            }
        }

        throw new ApiRequestError(response.status, errorBody);
    }

    // 204 No Content
    if (response.status === 204) {
        return undefined as T;
    }

    return response.json();
}

// ─── Custom Error Class ──────────────────────────────────────────────────────

export class ApiRequestError extends Error {
    status: number;
    body: ApiError;

    constructor(status: number, body: ApiError) {
        super(body.message);
        this.name = "ApiRequestError";
        this.status = status;
        this.body = body;
    }

    /** Get Laravel validation errors for a specific field */
    getFieldErrors(field: string): string[] {
        return this.body.errors?.[field] ?? [];
    }
}

// ─── Convenience Methods ─────────────────────────────────────────────────────

export const api = {
    get: <T>(endpoint: string) => request<T>(endpoint),

    post: <T>(endpoint: string, body?: unknown) =>
        request<T>(endpoint, {
            method: "POST",
            body: body ? JSON.stringify(body) : undefined,
        }),

    put: <T>(endpoint: string, body?: unknown) =>
        request<T>(endpoint, {
            method: "PUT",
            body: body ? JSON.stringify(body) : undefined,
        }),

    delete: <T>(endpoint: string, body?: unknown) =>
        request<T>(endpoint, {
            method: "DELETE",
            body: body ? JSON.stringify(body) : undefined,
        }),
};
