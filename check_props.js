const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('properties').select('*').order('created_at', { ascending: false }).limit(5);
    console.log("Error:", error);
    console.log("Data length:", data ? data.length : "null");
    if (data && data.length > 0) {
        console.log("First property date:", data[0].created_at || data[0].inserted_at);
        console.log("Keys available:", Object.keys(data[0]));
    }
}
check();
