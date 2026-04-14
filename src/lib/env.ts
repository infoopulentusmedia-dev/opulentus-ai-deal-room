/**
 * Startup environment validator.
 *
 * Imported transitively by `src/lib/supabase.ts`, which every API route loads,
 * so cold start on any server path fails loud if required config is missing.
 *
 * The browser bundle is a no-op (checks `typeof window`) so this does not
 * break client-side code that imports `@/lib/supabase`.
 */

/** Required in every environment — the app literally cannot function without these. */
const ALWAYS_REQUIRED = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CRON_SECRET',
] as const;

/** Required in production; warned-about in local dev so the app still boots without every key. */
const PROD_REQUIRED = [
    'SENDGRID_API_KEY',
    'GEMINI_API_KEY',
    'APIFY_API_TOKEN',
    'GOOGLE_MAPS_API_KEY',
] as const;

function validateServerEnv() {
    // Only run server-side. In the browser, `process.env` only has NEXT_PUBLIC_* vars.
    if (typeof window !== 'undefined') return;

    const alwaysMissing = ALWAYS_REQUIRED.filter(k => !process.env[k]);
    if (alwaysMissing.length) {
        throw new Error(
            `[env] Missing required environment variables: ${alwaysMissing.join(', ')}. ` +
            `Set these in .env.local (local) or the Vercel project settings (deploys).`
        );
    }

    const prodMissing = PROD_REQUIRED.filter(k => !process.env[k]);
    if (prodMissing.length) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error(
                `[env] Missing required environment variables (production): ${prodMissing.join(', ')}.`
            );
        } else {
            console.warn(
                `[env] Missing env vars (ok for local dev, required in prod): ${prodMissing.join(', ')}`
            );
        }
    }
}

validateServerEnv();
