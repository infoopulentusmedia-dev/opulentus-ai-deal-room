require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { getLiveApifyFeed } = require('./src/lib/apify/fetcher'); // Won't work without TS compilation, moving to fetch()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    console.log("Fetching live properties via Next.js API...");
    // Just trigger the local endpoint to get apify data
    const res = await fetch("http://localhost:3005/api/cron/daily-scrape", { method: "POST" });
    const json = await res.json();
    console.log("Response:", json);
}
run();
