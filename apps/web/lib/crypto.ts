/**
 * ZenoCrypto — Web Crypto only (PBKDF2 + AES-256-GCM).
 * The derived AES key lives in memory for the tab session; it is never sent to the server.
 * sessionStorage holds only a non-secret "session active" flag for UI (see setSessionFlag).
 */

const PBKDF2_ITERATIONS = 600_000;
const AES_KEY_LENGTH = 256;
const GCM_IV_LENGTH = 12;
const SALT_BYTES = 16;

const SESSION_FLAG_KEY = "zeno_crypto_active";

let sessionAesKey: CryptoKey | null = null;

export function isCryptoUnlocked(): boolean {
  return sessionAesKey !== null;
}

export function setSessionFlag(active: boolean): void {
  if (typeof sessionStorage === "undefined") return;
  if (active) {
    sessionStorage.setItem(SESSION_FLAG_KEY, "1");
  } else {
    sessionStorage.removeItem(SESSION_FLAG_KEY);
  }
}

export function readSessionFlag(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(SESSION_FLAG_KEY) === "1";
}

export function clearSessionCrypto(): void {
  sessionAesKey = null;
  setSessionFlag(false);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function toBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer));
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

/** Decode salt from server (Base64) to ArrayBuffer for PBKDF2 */
export function parseSaltBase64(saltB64: string): Uint8Array {
  return fromBase64(saltB64);
}

/** Generate a new random salt (call once per user; store Base64 on server) */
export async function generateSalt(): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return toBase64(salt.buffer);
}

/**
 * Derive AES-GCM key from master password + per-user salt (PBKDF2-HMAC-SHA256, 600k iters).
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = utf8Encode(password);
  const encBytes = new Uint8Array(enc);
  const saltBytes = new Uint8Array(salt);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(encBytes),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(saltBytes),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Unlock: derive key and keep in module memory. Password is zeroed from JS perspective by caller dropping reference.
 */
export async function unlockWithPassword(
  password: string,
  saltBase64: string,
): Promise<void> {
  const salt = parseSaltBase64(saltBase64);
  sessionAesKey = await deriveKeyFromPassword(password, salt);
  setSessionFlag(true);
}

function requireKey(): CryptoKey {
  if (!sessionAesKey) {
    throw new Error("ZenoCrypto: session not unlocked");
  }
  return sessionAesKey;
}

export type LedgerPlaintext = {
  merchantRaw: string;
  amount: string;
  date: string;
};

/**
 * Encrypt ledger fields to opaque Base64 blob + Base64 nonce (12-byte IV).
 * Wire format for API: encrypted_blob = base64(ciphertext), nonce = base64(iv).
 */
export async function encryptLedgerPayload(
  payload: LedgerPlaintext,
): Promise<{ encrypted_blob: string; nonce: string }> {
  const key = requireKey();
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH));
  const plain = utf8Encode(JSON.stringify(payload));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plain),
  );

  return {
    encrypted_blob: toBase64(ciphertext),
    nonce: bytesToBase64(iv),
  };
}

export async function decryptLedgerPayload(
  encryptedBlobB64: string,
  nonceB64: string,
): Promise<LedgerPlaintext> {
  const key = requireKey();
  const iv = fromBase64(nonceB64);
  const ciphertext = fromBase64(encryptedBlobB64);

  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext),
  );

  const json = utf8Decode(new Uint8Array(plainBuf));
  return JSON.parse(json) as LedgerPlaintext;
}

/** Dev / health: encrypt then decrypt a fixed payload */
export async function verifyEncryptDecryptLoop(
  password: string,
  saltBase64: string,
): Promise<boolean> {
  await unlockWithPassword(password, saltBase64);
  const payload: LedgerPlaintext = {
    merchantRaw: "TEST MERCHANT",
    amount: "42.00",
    date: new Date().toISOString(),
  };
  const { encrypted_blob, nonce } = await encryptLedgerPayload(payload);
  const roundTrip = await decryptLedgerPayload(encrypted_blob, nonce);
  clearSessionCrypto();
  return (
    roundTrip.amount === payload.amount &&
    roundTrip.merchantRaw === payload.merchantRaw
  );
}
