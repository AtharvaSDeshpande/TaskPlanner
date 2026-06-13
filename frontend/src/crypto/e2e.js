// End-to-end encryption for the personal To-Do board.
//
// The AES-GCM key is derived from the user's login password (PBKDF2) plus a
// per-user salt. Plaintext never leaves the browser — the server only ever
// stores the resulting ciphertext + IV (in the DB) and never sees the password
// or key. The encrypted to-dos live in the database, so they sync across
// devices; logging in on any device re-derives the key from the password.
//
// The derived key is cached in localStorage (same lifetime as the auth token)
// so the board stays unlocked across refreshes, new tabs and browser restarts —
// no per-session "unlock on this device" prompt. It is cleared on logout.

const KEY_STORAGE = 'careplus.e2eKey';
const store = window.localStorage;
const enc = new TextEncoder();
const dec = new TextDecoder();

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

// Derives an extractable AES-GCM key from the password + per-user salt so it can
// be cached locally and re-imported after a refresh.
export async function deriveKey(password, saltHex) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: 250000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function cacheKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  store.setItem(KEY_STORAGE, bufToB64(raw));
}

export async function loadCachedKey() {
  const b64 = store.getItem(KEY_STORAGE);
  if (!b64) return null;
  return crypto.subtle.importKey('raw', b64ToBuf(b64), { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export function clearKey() {
  store.removeItem(KEY_STORAGE);
}

// Encrypts a JS object → { ciphertext, iv } (both base64).
export async function encryptObject(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = enc.encode(JSON.stringify(obj));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { ciphertext: bufToB64(cipher), iv: bufToB64(iv) };
}

// Decrypts { ciphertext, iv } → the original JS object.
export async function decryptObject(key, ciphertext, iv) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBuf(iv) },
    key,
    b64ToBuf(ciphertext),
  );
  return JSON.parse(dec.decode(plain));
}
