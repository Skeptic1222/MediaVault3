-- Add sharedWithEmails column to share_links table
ALTER TABLE share_links
ADD COLUMN IF NOT EXISTS shared_with_emails jsonb;

-- Add comment
COMMENT ON COLUMN share_links.shared_with_emails IS 'Array of email addresses to share with';
