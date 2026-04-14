-- Run this entirely in the Supabase SQL Editor

-- 0. Create Agents Table (references auth.users)
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    sender_email TEXT,
    recipient_email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 1. Create Clients Table
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    buy_box_json JSONB NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Properties Table (Global Feed)
CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY, -- We use the sourceId (e.g., CRX-123)
    platform TEXT NOT NULL,
    address TEXT NOT NULL,
    price NUMERIC,
    property_type TEXT,
    property_data_json JSONB NOT NULL,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Daily Scans Log
CREATE TABLE IF NOT EXISTS daily_scans (
    date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    property_ids TEXT[] NOT NULL,
    inserted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Chat Sessions (Cross-device sync)
CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id TEXT PRIMARY KEY,
    messages_json JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Deal Matches (Blast History)
CREATE TABLE IF NOT EXISTS deal_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
    blasted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(client_id, property_id) -- Prevent sending same deal twice
);

-- Seed Initial 6 Clients
INSERT INTO clients (name, buy_box_json) VALUES
('Ali Beydoun', '{"minMatchScore": 85, "platforms": {"crexi": {"enabled": true, "predefined": "Value-Add Retail Strips", "customInstruction": "Strictly Wayne County"}, "loopnet": {"enabled": true, "predefined": "Under-market Rents", "customInstruction": "Strictly Wayne County"}, "mls": {"enabled": true, "predefined": "High Density Zoning", "customInstruction": "Strictly Wayne County"}}}'::jsonb),
('Collin Goslin', '{"minMatchScore": 85, "platforms": {"crexi": {"enabled": true, "predefined": "Value-Add Retail Strips", "customInstruction": "Wayne or Oakland County"}, "loopnet": {"enabled": true, "predefined": "Under-market Rents", "customInstruction": "Wayne or Oakland County"}, "mls": {"enabled": true, "predefined": "High Density Zoning", "customInstruction": "Wayne or Oakland County"}}}'::jsonb),
('Fadi', '{"minMatchScore": 85, "platforms": {"crexi": {"enabled": true, "predefined": "Heavy Industrial", "customInstruction": "Warehouse, Wayne County"}, "loopnet": {"enabled": true, "predefined": "Light Industrial", "customInstruction": "Warehouse, Wayne County"}, "mls": {"enabled": true, "predefined": "Industrial Zoning", "customInstruction": "Warehouse, Wayne County"}}}'::jsonb),
('Abe Saad', '{"minMatchScore": 85, "platforms": {"crexi": {"enabled": true, "predefined": "Auto Service / Mechanic", "customInstruction": "Anywhere in Michigan"}, "loopnet": {"enabled": true, "predefined": "Auto Dealership", "customInstruction": "Anywhere in Michigan"}, "mls": {"enabled": true, "predefined": "Commercial Auto", "customInstruction": "Anywhere in Michigan"}}}'::jsonb),
('Hussein Zeitoun', '{"minMatchScore": 85, "platforms": {"crexi": {"enabled": false, "predefined": "", "customInstruction": ""}, "loopnet": {"enabled": false, "predefined": "", "customInstruction": ""}, "mls": {"enabled": true, "predefined": "Single Family Residential", "customInstruction": "Strictly 48124 Zip Code"}}}'::jsonb),
('Moe Sabbagh', '{"minMatchScore": 85, "platforms": {"crexi": {"enabled": false, "predefined": "", "customInstruction": ""}, "loopnet": {"enabled": false, "predefined": "", "customInstruction": ""}, "mls": {"enabled": true, "predefined": "Single Family Residential", "customInstruction": "Strictly 48124 and 48128 Zip Codes"}}}'::jsonb);
