import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from './server';

/**
 * Extract the authenticated agent's user ID from the request cookies.
 * Returns { agentId } on success, or a NextResponse error to return immediately.
 */
export async function requireAgent(): Promise<
    { agentId: string; error?: never } | { agentId?: never; error: NextResponse }
> {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return {
            error: NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            ),
        };
    }

    return { agentId: user.id };
}

/**
 * Validate a cron/webhook secret on the incoming request.
 *
 * Accepts the secret via three channels (any one is sufficient):
 *   - `x-cron-secret` header (manual/tool invocation)
 *   - `?secret=...` query parameter (legacy — still supported)
 *   - `Authorization: Bearer <CRON_SECRET>` (Vercel Cron scheduler)
 *
 * FAIL-CLOSED: if `CRON_SECRET` is missing from the environment, this returns
 * a 500 instead of allowing traffic through. Never silently disable auth.
 *
 * Returns `{ ok: true }` on success, or `{ error: NextResponse }` to return.
 */
export function requireCronSecret(
    req: Request
): { ok: true; error?: never } | { ok?: never; error: NextResponse } {
    const CRON_SECRET = process.env.CRON_SECRET || "";
    if (!CRON_SECRET) {
        console.error("[requireCronSecret] CRON_SECRET is not set — refusing to serve cron route");
        return {
            error: NextResponse.json(
                { error: "Server misconfigured: CRON_SECRET not set" },
                { status: 500 }
            ),
        };
    }

    const headerSecret = req.headers.get("x-cron-secret") || "";
    const querySecret = (() => {
        try {
            return new URL(req.url).searchParams.get("secret") || "";
        } catch {
            return "";
        }
    })();
    const bearer = req.headers.get("authorization") === `Bearer ${CRON_SECRET}`;

    if (headerSecret !== CRON_SECRET && querySecret !== CRON_SECRET && !bearer) {
        return {
            error: NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            ),
        };
    }

    return { ok: true };
}
