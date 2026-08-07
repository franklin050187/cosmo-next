-- Add anon_id column for distinguishing anonymous analytics visitors
-- (hash of IP + user-agent + salt). Idempotent: safe to re-run.
ALTER TABLE analytics ADD COLUMN IF NOT EXISTS anon_id text;
