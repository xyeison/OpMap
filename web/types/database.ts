export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      kams: {
        Row: {
          id: string
          name: string
          area_id: string
          lat: number
          lng: number
          enable_level2: boolean
          max_travel_time: number
          priority: number
          color: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          area_id: string
          lat: number
          lng: number
          enable_level2?: boolean
          max_travel_time?: number
          priority?: number
          color: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          area_id?: string
          lat?: number
          lng?: number
          enable_level2?: boolean
          max_travel_time?: number
          priority?: number
          color?: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      hospitals: {
        Row: {
          id: string
          code: string
          name: string
          department_id: string
          municipality_id: string
          locality_id: string | null
          lat: number
          lng: number
          beds: number
          address: string | null
          phone: string | null
          email: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          department_id: string
          municipality_id: string
          locality_id?: string | null
          lat: number
          lng: number
          beds?: number
          address?: string | null
          phone?: string | null
          email?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          department_id?: string
          municipality_id?: string
          locality_id?: string | null
          lat?: number
          lng?: number
          beds?: number
          address?: string | null
          phone?: string | null
          email?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      opportunities: {
        Row: {
          id: string
          hospital_id: string
          annual_contract_value: number | null
          current_provider: string | null
          notes: string | null
          contract_end_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          hospital_id: string
          annual_contract_value?: number | null
          current_provider?: string | null
          notes?: string | null
          contract_end_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          hospital_id?: string
          annual_contract_value?: number | null
          current_provider?: string | null
          notes?: string | null
          contract_end_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      assignments: {
        Row: {
          id: string
          kam_id: string
          hospital_id: string
          travel_time: number | null
          assignment_type: string
          assigned_at: string
        }
        Insert: {
          id?: string
          kam_id: string
          hospital_id: string
          travel_time?: number | null
          assignment_type?: string
          assigned_at?: string
        }
        Update: {
          id?: string
          kam_id?: string
          hospital_id?: string
          travel_time?: number | null
          assignment_type?: string
          assigned_at?: string
        }
      }
    }
    Views: {
      kam_statistics: {
        Row: {
          id: string
          name: string
          total_hospitals: number
          total_municipalities: number
          total_opportunity_value: number | null
          avg_travel_time: number | null
        }
      }
      territory_assignments: {
        Row: {
          municipality_id: string
          locality_id: string | null
          department_id: string
          kam_id: string
          kam_name: string
          kam_color: string
          hospital_count: number
        }
      }
    }
  }
}