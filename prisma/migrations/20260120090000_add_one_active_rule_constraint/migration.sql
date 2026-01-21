-- Enforce "only one active rule per surface" at database level
-- This is a PostgreSQL partial unique index

-- Create the partial unique index (idempotent with IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS one_active_rule_per_surface
ON footprint_surface_rules("surfaceId")
WHERE "isActive" = true;

-- Add a comment for documentation
COMMENT ON INDEX one_active_rule_per_surface IS 
'Ensures only one active rule per surface. Multiple inactive rules are allowed.';
