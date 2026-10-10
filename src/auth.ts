import { createAuthClient } from 'better-auth/client';
import { inferAdditionalFields } from 'better-auth/client/plugins';

// Browser-side better-auth client. Points at the same Express mount that
// hosts the better-auth handler; with the Vite proxy that is just /api/auth
// on the same origin.
export const authClient = createAuthClient({
  // relative URL — goes through the Vite dev proxy in dev, served by the
  // same origin in production. better-auth constructs full URLs from this.
  baseURL: window.location.origin,
});

export type AuthClientSession = Awaited<ReturnType<typeof authClient.getSession>>;
