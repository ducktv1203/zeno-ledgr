import type { RetrieveResponse, StatementRow } from "@/lib/types";

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
  if (response.status === 204) {
    return undefined as T;
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

export async function apiCreateStatement(
  token: string,
  body: {
    filename: string;
    page_count?: number | null;
    payment_count: number;
    period_start?: string | null;
    period_end?: string | null;
  },
): Promise<StatementRow> {
  return request("/statements", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiListStatements(token: string): Promise<StatementRow[]> {
  return request("/statements", token);
}

export async function apiDeleteStatement(token: string, statementId: string): Promise<void> {
  return request(`/statements/${statementId}`, token, { method: "DELETE" });
}

export async function apiIngest(
  token: string,
  payload: { encrypted_blob: string; nonce: string; statement_id?: string | null },
): Promise<{ id: string }> {
  return request("/ingest", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Server caps a single request at 5,000 ids. */
const DELETE_BATCH = 2_000;

export async function apiDeleteEntries(token: string, ids: string[]): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += DELETE_BATCH) {
    const batch = ids.slice(i, i + DELETE_BATCH);
    const result = await request<{ deleted: number }>("/entries/delete", token, {
      method: "POST",
      body: JSON.stringify({ ids: batch }),
    });
    deleted += result.deleted;
  }
  return deleted;
}

export async function apiRetrieve(
  token: string,
  params?: { limit?: number; cursor?: string | null; statement_id?: string | null },
): Promise<RetrieveResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  if (params?.statement_id) query.set("statement_id", params.statement_id);
  const suffix = query.size ? `?${query.toString()}` : "";
  return request(`/retrieve${suffix}`, token);
}
