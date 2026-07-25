/**
 * Auth client used by sign-in / sign-up / app shell.
 * Local mode talks to FastAPI (/auth/*) + Docker Postgres — no Supabase required.
 */

const TOKEN_KEY = "zeno_access_token";
const EMAIL_KEY = "zeno_user_email";

export type AuthSession = {
  access_token: string;
  user?: { email?: string | null };
};

export type AuthClient = {
  auth: {
    signUp: (args: {
      email: string;
      password: string;
    }) => Promise<{ error: { message: string } | null }>;
    signInWithPassword: (args: {
      email: string;
      password: string;
    }) => Promise<{ error: { message: string } | null }>;
    getSession: () => Promise<{ data: { session: AuthSession | null } }>;
    signOut: () => Promise<void>;
  };
};

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
}

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function writeSession(token: string, email: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

async function postAuth(
  path: "/auth/signup" | "/auth/signin",
  email: string,
  password: string,
): Promise<{ error: { message: string } | null }> {
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const text = await response.text();
      let message = text || `Request failed (${response.status})`;
      try {
        const json = JSON.parse(text) as { detail?: string };
        if (json.detail) message = json.detail;
      } catch {
        // keep text
      }
      return { error: { message } };
    }
    const data = (await response.json()) as {
      access_token: string;
      email: string;
    };
    writeSession(data.access_token, data.email);
    return { error: null };
  } catch (e) {
    const message =
      e instanceof Error && e.message === "Failed to fetch"
        ? "Cannot reach API. Is it running on NEXT_PUBLIC_API_URL?"
        : e instanceof Error
          ? e.message
          : "Auth request failed";
    return { error: { message } };
  }
}

export function createLocalAuthClient(): AuthClient {
  return {
    auth: {
      async signUp({ email, password }) {
        return postAuth("/auth/signup", email, password);
      },
      async signInWithPassword({ email, password }) {
        return postAuth("/auth/signin", email, password);
      },
      async getSession() {
        const token = readToken();
        if (!token) return { data: { session: null } };
        return {
          data: {
            session: {
              access_token: token,
              user: { email: localStorage.getItem(EMAIL_KEY) },
            },
          },
        };
      },
      async signOut() {
        clearSession();
      },
    },
  };
}

export function isLocalAuthMode(): boolean {
  const mode = (process.env.NEXT_PUBLIC_AUTH_MODE ?? "local").toLowerCase();
  return mode === "local" || mode === "docker";
}
