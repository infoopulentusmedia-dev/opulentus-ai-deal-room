-- Multi-Agent Profile System Migration
-- Adds agent profiles, scopes client data by agent, and enables RLS.

-- 1. Create agents table (extends auth.users with business info)
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    sender_email TEXT,        -- FROM address for SendGrid blasts
    recipient_email TEXT,     -- TO address where agent receives blasts
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add agent_id to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- 3. Add agent_id to chat_sessions
-- Note: chat_sessions PK is session_id (TEXT), but route.ts writes to 'id' column.
-- Add agent_id regardless of PK naming.
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- 4. Add agent_id to deal_matches
ALTER TABLE deal_matches ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- 5. Enable RLS on agent-scoped tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_matches ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for agents table
CREATE POLICY "agents_read_own" ON agents
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "agents_update_own" ON agents
    FOR UPDATE USING (id = auth.uid());

-- 7. RLS Policies for clients table
CREATE POLICY "agents_own_clients_select" ON clients
    FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "agents_own_clients_insert" ON clients
    FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "agents_own_clients_update" ON clients
    FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "agents_own_clients_delete" ON clients
    FOR DELETE USING (agent_id = auth.uid());

-- 8. RLS Policies for chat_sessions table
CREATE POLICY "agents_own_sessions_select" ON chat_sessions
    FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "agents_own_sessions_insert" ON chat_sessions
    FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "agents_own_sessions_update" ON chat_sessions
    FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "agents_own_sessions_delete" ON chat_sessions
    FOR DELETE USING (agent_id = auth.uid());

-- 9. RLS Policies for deal_matches table
CREATE POLICY "agents_own_matches_select" ON deal_matches
    FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "agents_own_matches_insert" ON deal_matches
    FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "agents_own_matches_update" ON deal_matches
    FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "agents_own_matches_delete" ON deal_matches
    FOR DELETE USING (agent_id = auth.uid());

-- 10. Properties and daily_scans stay public (shared market data)
-- No RLS needed — all agents see the same scraped listings.

-- 11. Create indexes for agent_id lookups
CREATE INDEX IF NOT EXISTS idx_clients_agent_id ON clients(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_id ON chat_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_deal_matches_agent_id ON deal_matches(agent_id);
