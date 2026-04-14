-- ============================================================
-- Migration: Backfill ai_analyses.agent_id from clients.agent_id
-- ============================================================
-- The previous migration (20260414000001) added `agent_id` to ai_analyses
-- but did not backfill existing rows. Any pre-migration rows have
-- `agent_id IS NULL`, which means they are invisible to RLS when read by
-- an authenticated agent (the service role still sees them).
--
-- This migration copies agent_id from the parent `clients` row wherever
-- a legacy NULL exists. Safe to re-run — it only touches NULL rows.

UPDATE ai_analyses a
SET    agent_id = c.agent_id
FROM   clients c
WHERE  a.client_id = c.id
  AND  a.agent_id IS NULL
  AND  c.agent_id IS NOT NULL;
