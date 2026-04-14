/**
 * Seed Script: Create agent accounts and migrate existing clients.
 *
 * Usage: node seed/seed_agents.mjs
 *
 * This script:
 * 1. Creates Supabase Auth accounts for each agent
 * 2. Inserts agent profiles into the `agents` table
 * 3. Assigns all existing clients (agent_id IS NULL) to Nick
 *
 * Run this ONCE after applying the multi_agent migration.
 *
 * Update the AGENTS array below with real emails/passwords before running.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// ─── AGENT DEFINITIONS ───
// Update these with real emails and passwords before running.
// Agent 2 and Agent 3 emails/passwords are placeholders — fill them in.
const AGENTS = [
    {
        email: 'njaafar@kw.com',
        password: 'OpulentusNick2026!',  // Change this to a real password
        display_name: 'Nick',
        company: 'Keller Williams',
        phone: null,
        sender_email: 'info.opulentusmedia@gmail.com',
        recipient_email: 'njaafar@kw.com',
        is_primary: true, // Existing clients get assigned to this agent
    },
    {
        email: 'agent2@placeholder.com',     // REPLACE with real email
        password: 'OpulentusAgent2_2026!',   // REPLACE with real password
        display_name: 'Agent 2',             // REPLACE with real name
        company: null,
        phone: null,
        sender_email: null,
        recipient_email: 'agent2@placeholder.com', // REPLACE
        is_primary: false,
    },
    {
        email: 'agent3@placeholder.com',     // REPLACE with real email
        password: 'OpulentusAgent3_2026!',   // REPLACE with real password
        display_name: 'Agent 3',             // REPLACE with real name
        company: null,
        phone: null,
        sender_email: null,
        recipient_email: 'agent3@placeholder.com', // REPLACE
        is_primary: false,
    },
];

async function main() {
    console.log('=== Opulentus Agent Seed Script ===\n');

    let primaryAgentId = null;

    for (const agent of AGENTS) {
        console.log(`Creating auth account for ${agent.display_name} (${agent.email})...`);

        // 1. Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: agent.email,
            password: agent.password,
            email_confirm: true, // Skip email verification
        });

        if (authError) {
            // Check if user already exists
            if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
                console.log(`  Auth account already exists for ${agent.email}, looking up ID...`);
                const { data: users } = await supabase.auth.admin.listUsers();
                const existing = users?.users?.find(u => u.email === agent.email);
                if (existing) {
                    console.log(`  Found existing user: ${existing.id}`);
                    if (agent.is_primary) primaryAgentId = existing.id;

                    // Upsert agent profile
                    const { error: profileErr } = await supabase.from('agents').upsert({
                        id: existing.id,
                        display_name: agent.display_name,
                        company: agent.company,
                        phone: agent.phone,
                        sender_email: agent.sender_email,
                        recipient_email: agent.recipient_email,
                    });
                    if (profileErr) {
                        console.error(`  Failed to upsert agent profile:`, profileErr.message);
                    } else {
                        console.log(`  Agent profile upserted for ${agent.display_name}`);
                    }
                    continue;
                }
            }
            console.error(`  Failed to create auth account:`, authError.message);
            continue;
        }

        const userId = authData.user.id;
        console.log(`  Auth user created: ${userId}`);

        if (agent.is_primary) primaryAgentId = userId;

        // 2. Insert agent profile
        const { error: profileErr } = await supabase.from('agents').insert({
            id: userId,
            display_name: agent.display_name,
            company: agent.company,
            phone: agent.phone,
            sender_email: agent.sender_email,
            recipient_email: agent.recipient_email,
        });

        if (profileErr) {
            console.error(`  Failed to insert agent profile:`, profileErr.message);
        } else {
            console.log(`  Agent profile created for ${agent.display_name}`);
        }
    }

    // 3. Migrate existing clients to Nick
    if (primaryAgentId) {
        console.log(`\nMigrating unassigned clients to Nick (${primaryAgentId})...`);

        const { data: unassigned, error: fetchErr } = await supabase
            .from('clients')
            .select('id, name')
            .is('agent_id', null);

        if (fetchErr) {
            console.error('Failed to fetch unassigned clients:', fetchErr.message);
        } else if (unassigned && unassigned.length > 0) {
            const { error: updateErr } = await supabase
                .from('clients')
                .update({ agent_id: primaryAgentId })
                .is('agent_id', null);

            if (updateErr) {
                console.error('Failed to update clients:', updateErr.message);
            } else {
                console.log(`  Migrated ${unassigned.length} clients to Nick:`);
                unassigned.forEach(c => console.log(`    - ${c.name}`));
            }
        } else {
            console.log('  No unassigned clients to migrate.');
        }
    }

    console.log('\n=== Seed complete ===');
}

main().catch(err => {
    console.error('Seed script failed:', err);
    process.exit(1);
});
