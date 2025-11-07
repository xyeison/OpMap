export interface Zone {
  id: string;
  code: string;
  name: string;
  description?: string;
  coordinator_name?: string;
  coordinator_email?: string;
  coordinator_phone?: string;
  color?: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface ZoneKam {
  id: string;
  zone_id: string;
  kam_id: string;
  is_primary: boolean;
  assigned_at?: string;
  assigned_by?: string;
}

export interface ZoneStatistics {
  zone_id: string;
  zone_code: string;
  zone_name: string;
  coordinator_name?: string;
  zone_color?: string;
  total_kams: number;
  total_hospitals: number;
  total_municipalities: number;
  total_departments: number;
  total_beds: number;
  high_level_hospitals: number;
  active_hospitals: number;
  total_contract_value: number;
}

export interface ZoneTerritoryAssignment {
  zone_id: string;
  zone_code: string;
  zone_name: string;
  zone_color?: string;
  territory_id: string;
  territory_name: string;
  department_id: string;
  department_name: string;
  hospital_count: number;
  total_beds: number;
}

export interface ZoneWithKams extends Zone {
  kams?: Array<{
    id: string;
    name: string;
    area_id: string;
    color: string;
    is_primary: boolean;
  }>;
}