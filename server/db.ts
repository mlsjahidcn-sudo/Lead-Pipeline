import pg from 'pg';

/**
 * Shared pg pool. The Neon pooled endpoint uses transaction-mode pooling, so
 * every multi-statement unit (sync writes, GUC attribution) runs inside an
 * explicit transaction on a single checked-out client.
 */
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

export type UserTx = pg.PoolClient & { __brand?: 'user-attributed' };

/**
 * Runs `fn` inside a transaction where the authenticated employee id is
 * exposed via the `request.jwt.claims` GUC — the same contract the database's
 * audit and stage-history triggers already read through auth.user_id().
 *
 * The `sub` claim is set to the **employee** id (not the neon_auth user id)
 * because the FK on stage_history.changed_by references employees.id.
 */
export async function withUserTx<T>(userId: string, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const emp = await client.query(
      'SELECT id FROM public.employees WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    if (!emp.rowCount) {
      // shouldn't happen because the requireOrg guard rejects unauthenticated users
      throw new Error(`no employee bound to user ${userId}`);
    }
    // set_config(..., true) == SET LOCAL: scoped to this transaction only
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: emp.rows[0].id }),
    ]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection already broken */
    }
    throw err;
  } finally {
    client.release();
  }
}
