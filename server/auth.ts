import { randomUUID } from 'node:crypto';
import { Kysely, PostgresDialect } from 'kysely';
import { betterAuth } from 'better-auth';
import { pool } from './db';

/**
 * Neon Auth (better-auth) instance pointed at the SAME tables the hosted
 * Neon Auth service provisions in the `neon_auth` schema (user, session,
 * account, verification). Existing accounts created through the Neon
 * console work here unchanged because password hashing uses the same
 * better-auth defaults.
 */
const kysely = new Kysely<any>({
  dialect: new PostgresDialect({ pool: pool as any }),
});

const trustedOrigins = (process.env.TRUSTED_ORIGINS ||
  'http://localhost:3000,http://localhost:3001,http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: {
    type: 'postgres' as const,
    db: kysely,
    schemaName: 'neon_auth',
  },
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once a day
  },
  trustedOrigins,
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Bind the new Neon Auth user to the CRM: reuse the employee row
          // already bound to this user id (or with the same email), else
          // create a counsellor employee in the existing org.
          // The DB's audit_log_capture() trigger reads request.jwt.claims;
          // we set the GUC so the trigger can attribute the employee insert
          // to the user who signed up.
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            // The audit trigger stores changed_by in tables that FK to
            // employees.id; we set the GUC to the user_id but then UPDATE
            // the GUC after the employee row is created so subsequent
            // trigger fires reference the new employee id. The employee
            // insert itself uses the user_id GUC (which the trigger records
            // into audit_log.actor_user_id, not changed_by).
            await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
              JSON.stringify({ sub: user.id }),
            ]);

            const bound = await client.query(
              'SELECT id FROM public.employees WHERE user_id = $1',
              [user.id]
            );
            let employeeId: string | null = bound.rowCount ? (bound.rows[0].id as string) : null;

            if (!employeeId) {
              const byEmail = await client.query(
                'SELECT id FROM public.employees WHERE email = $1 AND user_id IS DISTINCT FROM $2',
                [user.email, user.id]
              );
              if (byEmail.rowCount && byEmail.rowCount > 0) {
                employeeId = byEmail.rows[0].id as string;
                await client.query(
                  'UPDATE public.employees SET user_id = $1 WHERE id = $2',
                  [user.id, employeeId]
                );
              } else {
                const org = await client.query('SELECT org_id FROM public.employees LIMIT 1');
                if (org.rowCount) {
                  const ins = await client.query(
                    `INSERT INTO public.employees
                       (org_id, user_id, full_name, email, role)
                     VALUES ($1, $2, $3, $4, 'counsellor')
                     RETURNING id`,
                    [org.rows[0].org_id, user.id, user.name || user.email, user.email]
                  );
                  employeeId = ins.rows[0].id as string;
                }
              }
            }
            // re-publish the GUC with the employee id so any later trigger
            // calls (e.g. employees.user_id UPDATE) attribute correctly
            if (employeeId) {
              await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
                JSON.stringify({ sub: employeeId, user: user.id }),
              ]);
            }
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            console.error('[auth] employee binding failed for user', user.id, err);
          } finally {
            client.release();
          }
        },
      },
    },
  },
});
