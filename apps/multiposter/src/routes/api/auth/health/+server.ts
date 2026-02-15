import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ request }) => {
  const t0 = Date.now();
  const results: Record<string, unknown> = { timings: {} };
  const step = (label: string) => {
    (results.timings as Record<string, number>)[label] = Date.now() - t0;
  };

  try {
    // Environment presence checks (booleans only; never expose values)
    results.betterAuthUrlPresent = Boolean(env.BETTER_AUTH_URL);
    results.betterAuthSecretPresent = Boolean(env.BETTER_AUTH_SECRET);
    results.googleClientIdPresent = Boolean(env.GOOGLE_CLIENT_ID);
    results.googleClientSecretPresent = Boolean(env.GOOGLE_CLIENT_SECRET);
    results.databaseUrlPresent = Boolean(env.DATABASE_URL);
    step('env');

    // Host/domain sanity
    try {
      if (env.BETTER_AUTH_URL) {
        const reqHost = new URL(request.url).host;
        const authHost = new URL(env.BETTER_AUTH_URL).host;
        results.hostMatchesBetterAuthUrl = reqHost === authHost;
        results.requestHost = reqHost;
        results.configuredAuthHost = authHost;
      }
    } catch {
      results.hostMatchesBetterAuthUrl = false;
    }
    step('host');

    // Database connectivity quick check with one retry
    if (env.DATABASE_URL) {
      let dbOk = false;
      let errorMsg: string | undefined;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await db.execute(sql`select 1`);
          dbOk = true;
          results.databaseAttemptCount = attempt;
          break;
        } catch (e) {
          errorMsg = (e as Error).message;
          results[`databaseErrorAttempt${attempt}`] = errorMsg;
        }
      }
      results.databaseOk = dbOk;
      if (!dbOk) results.databaseError = errorMsg || 'DB check failed';
    } else {
      results.databaseOk = false;
    }
    step('db');

    // Overall status
    const ok = Boolean(
      results.betterAuthUrlPresent &&
        results.betterAuthSecretPresent &&
        results.googleClientIdPresent &&
        results.googleClientSecretPresent &&
        results.databaseUrlPresent &&
        results.databaseOk !== false &&
        (results.hostMatchesBetterAuthUrl !== false)
    );
    step('final');

    const body = JSON.stringify({ ok, checks: results }, null, 2);
    console.log('[health:/api/auth/health] result', body);
    return new Response(body, {
      status: ok ? 200 : 500,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  } catch (err) {
    console.error('[health:/api/auth/health] fatal error', err);
    return new Response(JSON.stringify({ ok: false, error: 'Unhandled health error' }), {
      status: 500,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  }
};
