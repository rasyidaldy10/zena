-- Add column to track if user has seen CEO welcome modal
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS has_seen_ceo_welcome BOOLEAN DEFAULT FALSE;

-- Update existing users to show the welcome (set to false so they see it once)
UPDATE user_preferences
SET has_seen_ceo_welcome = FALSE
WHERE has_seen_ceo_welcome IS NULL;
