import type { RetrieveResponse } from "@/lib/types";

function apiBase(): string {
  const u = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return u.replace(/\/$/, "");
}

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(body || `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }
  return (await response.json()) as T;
}

export async function apiInitSalt(
  token: string,
): Promise<{ password_salt: string; created: boolean }> {
  return request("/crypto/init", token, { method: "POST" });
}

export async function apiGetSalt(token: string): Promise<{ password_salt: string }> {
  return request("/crypto/salt", token);
}

/** Get salt, or create it on first login when missing. */
export async function apiEnsureSalt(
  token: string,
): Promise<{ password_salt: string }> {
  try {
    return await apiGetSalt(token);
  } catch (e) {
    const missing =
      (e instanceof ApiError && e.status === 404) ||
      (e instanceof Error && e.message.toLowerCase().includes("crypto metadata not found"));
    if (!missing) throw e;
    const init = await apiInitSalt(token);
    return { password_salt: init.password_salt };
  }
}

export async function apiIngest(
  token: string,
  payload: { encrypted_blob: string; nonce: string },
): Promise<{ id: string }> {
  return request("/ingest", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiRetrieve(
  token: string,
  params?: { limit?: number; cursor?: string | null },
): Promise<RetrieveResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const suffix = query.size ? `?${query.toString()}` : "";
  return request(`/retrieve${suffix}`, token);
}
