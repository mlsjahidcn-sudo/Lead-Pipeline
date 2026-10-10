import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { toNodeHandler } from 'better-auth/node';
import { jwtVerify, createLocalJWKSet } from 'jose';
import { auth } from './auth';
import { pool } from './db';
import { bootstrap, applySync, resolveOrgId, resolveViewer, ValidationError, type SyncPayload } from './store';
import { safeFetchJson as guardedJson } from './safe-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// In production the SPA bundle lives at <repo>/dist; in dev (vite dev server)
// the bundler proxies /api/* here and serves the SPA itself.
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const HAS_DIST = existsSync(DIST_DIR);

const PORT = Number(process.env.PORT || 3002);
const app = express();
app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// Neon Auth (better-auth) — handles /api/auth/* (sign-in, sign-up, session…)
// using the neon_auth tables in Postgres.
// ---------------------------------------------------------------------------
const authHandler = toNodeHandler(auth);
app.use('/api/auth', (req, res) => {
  void Promise.resolve(authHandler(req, res)).catch((err) => {
    console.error('[auth] handler error', err);
    if (!res.headersSent) res.status(500).json({ error: 'auth handler failed' });
  });
});

// body parsing for the JSON API — mounted after the better-auth handler so
// /api/auth keeps its raw request stream
app.use('/api', express.json({ limit: '20mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up', time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'down', error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// Auth middleware: better-auth session cookie, or a Bearer access token
// issued by the hosted Neon Auth endpoint (verified against its JWKS).
// ---------------------------------------------------------------------------

let jwksCache: { keys: ReturnType<typeof createLocalJWKSet>; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 10 * 60 * 1000;

async function getJwks(): Promise<ReturnType<typeof createLocalJWKSet> | null> {
  const url = process.env.NEON_AUTH_JWKS_URL;
  if (!url) return null;
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  // guardedJson (alias of safeFetchJson) enforces http/https, host allowlist,
  // and rejects private / loopback / reserved addresses before any request
  // leaves the server.
  const data = (await guardedJson(url)) as { keys?: unknown[] };
  if (!data || !Array.isArray(data.keys) || data.keys.length === 0) return null;
  const keys = createLocalJWKSet(data as import('jose').JSONWebKeySet);
  jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
    userEmail?: string;
    viewer?: import('./store').Viewer;
  }
}

const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1) better-auth session cookie (primary path for the web app)
    const session = await auth.api.getSession({ headers: new Headers(req.headers as unknown as Record<string, string>) });
    if (session?.user?.id) {
      req.userId = session.user.id;
      req.userEmail = session.user.email;
      return next();
    }

    // 2) Bearer JWT from the hosted Neon Auth service (machine / other clients)
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.slice('Bearer '.length).trim();
      const keys = await getJwks();
      if (!keys) return res.status(503).json({ error: 'JWKS not configured' });
      const { payload } = await jwtVerify(token, keys, {
        issuer: process.env.NEON_AUTH_ISSUER,
      });
      if (typeof payload.sub !== 'string') return res.status(401).json({ error: 'token missing sub' });
      req.userId = payload.sub;
      return next();
    }

    return res.status(401).json({ error: 'authentication required' });
  } catch (err) {
    return res.status(401).json({ error: 'invalid credentials', detail: (err as Error).message });
  }
};

const requireOrg = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.userId) return res.status(401).json({ error: 'authentication required' });
  try {
    const viewer = await resolveViewer(req.userId);
    if (!viewer) {
      return res.status(403).json({
        error: 'your account is not linked to a CRM employee record yet',
        hint: 'sign up from the app or insert an employees row with user_id = your neon auth user id',
      });
    }
    req.viewer = viewer;
    next();
  } catch (err) {
    next(err);
  }
};

app.get('/api/me', authMiddleware, async (req, res) => {
  const orgId = await resolveOrgId(req.userId!).catch(() => null);
  res.json({ userId: req.userId, email: req.userEmail ?? null, orgId });
});

app.get('/api/bootstrap', authMiddleware, requireOrg, async (req, res, next) => {
  try {
    res.json(await bootstrap(req.viewer!.orgId, req.viewer));
  } catch (err) {
    next(err);
  }
});

// Express 4 + better-auth: /api/auth must NOT go through express.json
app.post('/api/sync', authMiddleware, requireOrg, async (req, res, next) => {
  try {
    const payload = req.body as SyncPayload;
    const result = await applySync(req.userId!, req.viewer!.orgId, payload, req.viewer);
    res.json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: 'validation failed', detail: err.message });
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Production SPA serving. Mounted last so /api/* takes precedence and only
// unmatched non-/api paths fall through to the SPA bundle.
// Skipped when dist/ hasn't been built yet (e.g. dev runs without vite build).
// ---------------------------------------------------------------------------
if (HAS_DIST) {
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }));
  // SPA fallback for any path that wasn't an /api route or a static asset.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api/')) return next();
    if (req.path.includes('.')) return next(); // let missing assets 404 normally
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
  console.log(`[api] serving SPA from ${DIST_DIR}`);
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[api] unhandled error', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'internal server error', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[api] CRM API listening on http://localhost:${PORT}`);
  console.log(`[api] Neon Auth handler mounted at /api/auth`);
});
