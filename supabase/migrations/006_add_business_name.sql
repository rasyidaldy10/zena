-- Migration 006: Add business_name column
-- ============================================

-- Add business_name to user_preferences
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS business_name TEXT;

-- No RLS changes needed (existing policies cover all columns)

-- Verify
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences'
    AND column_name = 'business_name'
  ) THEN
    RAISE NOTICE 'Column business_name added successfully';
  ELSE
    RAISE EXCEPTION 'Failed to add business_name column';
  END IF;
END $$;
