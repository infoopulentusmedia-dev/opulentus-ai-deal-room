-- ============================================================
-- Migration: Storage RLS + ai_analyses agent scoping
-- ============================================================

-- 1. Create (or harden) the briefs storage bucket — private, not public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('briefs', 'briefs', false, 10485760, ARRAY['application/json'])
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Storage RLS — agents can only read/write their own {agentId}/* folder.
--    The service role key (used by all API routes) bypasses these policies.
--    These policies protect against direct REST storage API abuse.

-- SELECT: agents read only their own brief files
CREATE POLICY "agents_read_own_briefs"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'briefs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- INSERT: agents upload only into their own folder
CREATE POLICY "agents_insert_own_briefs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'briefs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: agents overwrite only their own brief files
CREATE POLICY "agents_update_own_briefs"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'briefs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: agents delete only their own brief files
CREATE POLICY "agents_delete_own_briefs"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'briefs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Create ai_analyses table if it doesn't exist (covers fresh DBs and
--    DBs where the previous migration was marked-applied but never ran).
CREATE TABLE IF NOT EXISTS ai_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id TEXT NOT NULL,
    client_id UUID NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    ai_score INTEGER DEFAULT 90,
    ai_reason TEXT,
    property_price NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(property_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_agent_id ON ai_analyses(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_client_id ON ai_analyses(client_id);

-- If the table already existed without agent_id, add the column
ALTER TABLE ai_analyses ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- 4. Enable RLS on ai_analyses and add per-agent policies
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agents_own_analyses_select" ON ai_analyses;
DROP POLICY IF EXISTS "agents_own_analyses_insert" ON ai_analyses;
DROP POLICY IF EXISTS "agents_own_analyses_update" ON ai_analyses;
DROP POLICY IF EXISTS "agents_own_analyses_delete" ON ai_analyses;

CREATE POLICY "agents_own_analyses_select" ON ai_analyses
    FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "agents_own_analyses_insert" ON ai_analyses
    FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "agents_own_analyses_update" ON ai_analyses
    FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "agents_own_analyses_delete" ON ai_analyses
    FOR DELETE USING (agent_id = auth.uid());

-- 5. Add updated_at to agents table for profile change tracking
ALTER TABLE agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION update_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agents_updated_at ON agents;
CREATE TRIGGER trg_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_agents_updated_at();
