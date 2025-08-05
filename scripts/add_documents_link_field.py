#!/usr/bin/env python3
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get Supabase credentials
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_ANON_KEY')

if not url or not key:
    print("Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file")
    exit(1)

# Create Supabase client
supabase: Client = create_client(url, key)

# SQL to add documents_link field
sql = """
-- Add documents_link field to hospital_contracts
ALTER TABLE hospital_contracts 
ADD COLUMN IF NOT EXISTS documents_link TEXT;

-- Add comment
COMMENT ON COLUMN hospital_contracts.documents_link IS 'Link to Google Drive or Zoho Docs folder with contract documents';
"""

try:
    # Execute SQL
    result = supabase.rpc('exec_sql', {'query': sql}).execute()
    print("✅ Successfully added documents_link field to hospital_contracts table")
except Exception as e:
    print(f"❌ Error executing SQL: {e}")
    # If RPC doesn't exist, let's check if field already exists
    try:
        # Test query to check if field exists
        test = supabase.from_('hospital_contracts').select('documents_link').limit(1).execute()
        print("✅ Field documents_link already exists in hospital_contracts table")
    except Exception as e2:
        print(f"❌ Field doesn't exist and couldn't be added: {e2}")