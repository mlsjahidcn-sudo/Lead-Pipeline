import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF-safe JSON fetch for server-side URL requests.
 *
 * Rules:
 *  - only http/https schemes are allowed
 *  - the hostname is checked against localhost / loopback / link-local /
 *    private / reserved ranges both by name and after DNS resolution
 *  - redirects are not followed automatically (each hop goes through the
 *    same validation)
 *
 * Tests: set `E2E_ALLOW_LOOPBACK=1` to permit the loopback range
 * (127.0.0.0/8, ::1) so local-server smoke tests can hit the dev API.
 * Production callers must never set this.
 */
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^0\.0\.0\.0$/,
  /^metadata\./i,
];

function isBlockedIp(ip: string): boolean {
  // Tests are allowed to talk to 127.0.0.1 / ::1; never enable in prod.
  const allowLoopback = process.env.E2E_ALLOW_LOOPBACK === '1';
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    const isLoopback = lower === '::1' || lower.startsWith('::ffff:127.');
    if (isLoopback && allowLoopback) return false;
    return (
      lower === '::' ||
      lower === '::1' ||
      lower.startsWith('fe80:') || // link-local
      lower.startsWith('fc') ||
      lower.startsWith('fd') || // unique local fc00::/7
      lower.startsWith('::ffff:127.') ||
      lower.startsWith('::ffff:10.') ||
      lower.startsWith('::ffff:192.168.') ||
      lower.startsWith('::ffff:169.254.') ||
      lower.startsWith('::ffff:172.16.') ||
      lower.startsWith('::ffff:172.17.') ||
      lower.startsWith('::ffff:172.18.') ||
      lower.startsWith('::ffff:172.19.') ||
      lower.startsWith('::ffff:172.2') ||
      lower.startsWith('::ffff:172.30.') ||
      lower.startsWith('::ffff:172.31.')
    );
  }
  const parts = ip.split('.').map((n) => Number.parseInt(n, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (allowLoopback && a === 127) return false; // explicit opt-in for tests
  if (a === 0 || a === 10 || a === 127) return true; // "this", private, loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a >= 224) return true; // multicast + reserved
  return false;
}

export class UnsafeUrlError extends Error {}

async function assertUrlAllowed(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(`invalid URL: ${rawUrl}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError(`scheme not allowed: ${url.protocol}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  // Loopback hostnames are permitted only when E2E_ALLOW_LOOPBACK=1.
  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(host))) {
    if (!(process.env.E2E_ALLOW_LOOPBACK === '1' && /^localhost$|^127\.|^::1$/.test(host))) {
      throw new UnsafeUrlError(`host not allowed: ${host}`);
    }
  }
  if (isIP(host) !== 0 && isBlockedIp(host)) {
    throw new UnsafeUrlError(`host not allowed: ${host}`);
  }
  const resolved = await lookup(host, { all: true }).catch(() => []);
  if (resolved.length === 0 && isIP(host) === 0) {
    throw new UnsafeUrlError(`host cannot be resolved: ${host}`);
  }
  for (const { address } of resolved) {
    if (isBlockedIp(address)) {
      throw new UnsafeUrlError(`host resolves to a blocked address: ${host} -> ${address}`);
    }
  }
  return url;
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
}

export async function safeFetchJson(rawUrl: string, opts: SafeFetchOptions | number = 10_000): Promise<unknown> {
  // Back-compat: allow `safeFetchJson(url, 5000)` shorthand
  if (typeof opts === 'number') opts = { timeoutMs: opts };
  const res = await safeFetchRaw(rawUrl, opts);
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status} ${res.statusText} for ${new URL(rawUrl).host}`);
  }
  return await res.json();
}

/**
 * Validated fetch that returns the raw Response (headers, status, body) so
 * callers that need e.g. Set-Cookie can use it without bypassing the
 * host-allowlist. Redirects are NOT followed — the caller decides.
 */
export async function safeFetchRaw(rawUrl: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const url = await assertUrlAllowed(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
      method: opts.method ?? 'GET',
      headers: { accept: 'application/json', ...(opts.headers ?? {}) },
      body: opts.body,
    });
  } finally {
    clearTimeout(timer);
  }
}
