-- WiFi Packet Analyzer Database Initialization
-- This script runs when PostgreSQL container first starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Set timezone
SET timezone = 'UTC';

-- Create additional indexes after tables are created by SQLAlchemy
-- (These will be created by the app, but we can prepare other optimizations)

-- Grant additional permissions
GRANT USAGE ON SCHEMA public TO wifi_user;
GRANT CREATE ON SCHEMA public TO wifi_user;

-- Create a function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'WiFi Analyzer database initialized successfully!';
END $$;
