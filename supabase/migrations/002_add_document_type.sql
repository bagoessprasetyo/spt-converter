-- Add document_type column to conversions table
ALTER TABLE conversions 
ADD COLUMN document_type TEXT DEFAULT 'spt' CHECK (document_type IN ('spt', 'indomaret'));

-- Create index for better performance on document_type queries
CREATE INDEX idx_conversions_document_type ON conversions(document_type);

-- Update existing conversions to have default document type
UPDATE conversions SET document_type = 'spt' WHERE document_type IS NULL;