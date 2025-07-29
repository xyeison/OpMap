-- OpMap Database Schema for Supabase
-- Version 1.0

-- Enable PostGIS extension for geographic data
CREATE EXTENSION IF NOT EXISTS postgis;

-- KAMs (Key Account Managers) table
CREATE TABLE kams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    area_id VARCHAR(10) NOT NULL, -- Municipality/locality code (e.g., '08001')
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    enable_level2 BOOLEAN DEFAULT true,
    max_travel_time INTEGER DEFAULT 240, -- in minutes
    priority INTEGER DEFAULT 1,
    color VARCHAR(7) NOT NULL, -- Hex color code
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for area lookups
CREATE INDEX idx_kams_area_id ON kams(area_id);
CREATE INDEX idx_kams_active ON kams(active);

-- Hospitals/IPS table
CREATE TABLE hospitals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    department_id VARCHAR(2) NOT NULL,
    municipality_id VARCHAR(5) NOT NULL,
    locality_id VARCHAR(5),
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    beds INTEGER DEFAULT 0,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for efficient querying
CREATE INDEX idx_hospitals_department ON hospitals(department_id);
CREATE INDEX idx_hospitals_municipality ON hospitals(municipality_id);
CREATE INDEX idx_hospitals_locality ON hospitals(locality_id);
CREATE INDEX idx_hospitals_active ON hospitals(active);

-- Opportunities table (business opportunities per hospital)
CREATE TABLE opportunities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    annual_contract_value DECIMAL(12, 2), -- Estimated annual contract value
    current_provider VARCHAR(255), -- Current provider name
    notes TEXT, -- Additional notes about the opportunity
    contract_end_date DATE,
    created_by UUID, -- Reference to auth.users
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for hospital lookups
CREATE INDEX idx_opportunities_hospital ON opportunities(hospital_id);

-- Assignments table (which KAM is assigned to which hospital)
CREATE TABLE assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kam_id UUID NOT NULL REFERENCES kams(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    travel_time INTEGER, -- in minutes
    assignment_type VARCHAR(20) DEFAULT 'automatic', -- 'automatic', 'manual', 'territory_base'
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(hospital_id) -- Each hospital can only be assigned to one KAM
);

-- Create indexes for efficient querying
CREATE INDEX idx_assignments_kam ON assignments(kam_id);
CREATE INDEX idx_assignments_hospital ON assignments(hospital_id);

-- Travel time cache table (to avoid recalculating)
CREATE TABLE travel_time_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    origin_lat DECIMAL(10, 8) NOT NULL,
    origin_lng DECIMAL(11, 8) NOT NULL,
    dest_lat DECIMAL(10, 8) NOT NULL,
    dest_lng DECIMAL(11, 8) NOT NULL,
    travel_time INTEGER NOT NULL, -- in minutes
    distance DECIMAL(10, 2), -- in kilometers
    source VARCHAR(20) DEFAULT 'google_maps', -- 'google_maps', 'osrm', 'haversine'
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(origin_lat, origin_lng, dest_lat, dest_lng, source)
);

-- Create spatial index for faster lookups
CREATE INDEX idx_travel_cache_coords ON travel_time_cache(origin_lat, origin_lng, dest_lat, dest_lng);

-- Departments table (reference data)
CREATE TABLE departments (
    code VARCHAR(2) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    excluded BOOLEAN DEFAULT false
);

-- Municipalities table (reference data)
CREATE TABLE municipalities (
    code VARCHAR(5) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department_code VARCHAR(2) REFERENCES departments(code),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    population_2025 INTEGER DEFAULT 0
);

-- Adjacency matrix for departments
CREATE TABLE department_adjacency (
    department_code VARCHAR(2) REFERENCES departments(code),
    adjacent_department_code VARCHAR(2) REFERENCES departments(code),
    PRIMARY KEY (department_code, adjacent_department_code)
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to tables
CREATE TRIGGER update_kams_updated_at BEFORE UPDATE ON kams 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON hospitals 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON opportunities 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE kams ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Create views for common queries
CREATE VIEW kam_statistics AS
SELECT 
    k.id,
    k.name,
    COUNT(DISTINCT a.hospital_id) as total_hospitals,
    COUNT(DISTINCT h.municipality_id) as total_municipalities,
    SUM(o.annual_contract_value) as total_opportunity_value,
    AVG(a.travel_time) as avg_travel_time
FROM kams k
LEFT JOIN assignments a ON k.id = a.kam_id
LEFT JOIN hospitals h ON a.hospital_id = h.id
LEFT JOIN opportunities o ON h.id = o.hospital_id
WHERE k.active = true
GROUP BY k.id, k.name;

-- Create view for territory visualization
CREATE VIEW territory_assignments AS
SELECT 
    h.municipality_id,
    h.locality_id,
    h.department_id,
    k.id as kam_id,
    k.name as kam_name,
    k.color as kam_color,
    COUNT(h.id) as hospital_count
FROM hospitals h
JOIN assignments a ON h.id = a.hospital_id
JOIN kams k ON a.kam_id = k.id
WHERE h.active = true AND k.active = true
GROUP BY h.municipality_id, h.locality_id, h.department_id, k.id, k.name, k.color;