import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Debug route to check Supabase schema — safe to delete
export async function GET() {
    const results: string[] = [];

    const { error: emailTest } = await supabaseAdmin.from('clients').select('email').limit(1);
    results.push(emailTest ? `❌ email: ${emailTest.message}` : "✓ email column exists");

    const { error: alertTest } = await supabaseAdmin.from('clients').select('alert_preferences_json').limit(1);
    results.push(alertTest ? `❌ alert_preferences_json: ${alertTest.message}` : "✓ alert_preferences_json column exists");

    const { error: updatedTest } = await supabaseAdmin.from('clients').select('updated_at').limit(1);
    results.push(updatedTest ? `❌ updated_at: ${updatedTest.message}` : "✓ updated_at column exists");

    const anyMissing = results.some(r => r.startsWith('❌'));
    if (anyMissing) {
        results.push("");
        results.push("Run this SQL in the Supabase Dashboard → SQL Editor:");
        results.push("ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT;");
        results.push("ALTER TABLE clients ADD COLUMN IF NOT EXISTS alert_preferences_json JSONB;");
        results.push("ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();");
    }

    return NextResponse.json({ results });
}
