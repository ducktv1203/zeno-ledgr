import type { RetrieveResponse } from "@/lib/types";

function apiBase(): string {
  const u = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return u.replace(/\/$/, "");
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
    throw new Error(await response.text());
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

