-- Create the ai_analyses cache table
CREATE TABLE IF NOT EXISTS ai_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    ai_score INTEGER NOT NULL,
    ai_reason TEXT NOT NULL,
    property_price NUMERIC, -- Store price at time of analysis to detect drops
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure exactly one active analysis per client per property
    UNIQUE(property_id, client_id)
);

-- Enable RLS
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow authenticated read access for ai_analyses" 
ON ai_analyses FOR SELECT 
TO authenticated 
USING (true);

-- Allow backend service role to insert/update
CREATE POLICY "Allow service role full access to  ai_analyses" 
ON ai_analyses FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
