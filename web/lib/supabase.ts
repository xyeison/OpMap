import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Helper functions for common operations
export const kamService = {
  async getAll() {
    const { data, error } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
      .order('name')
    
    if (error) throw error
    return data
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('kams')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async create(kam: any) {
    const { data, error } = await supabase
      .from('kams')
      .insert(kam)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('kams')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async archive(id: string) {
    return this.update(id, { active: false })
  }
}

export const hospitalService = {
  async getAll() {
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
      .order('name')
    
    if (error) throw error
    return data
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('hospitals')
      .select(`
        *,
        opportunities (*),
        assignments (
          *,
          kams (*)
        )
      `)
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async create(hospital: any) {
    const { data, error } = await supabase
      .from('hospitals')
      .insert(hospital)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('hospitals')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async archive(id: string) {
    return this.update(id, { active: false })
  }
}

export const opportunityService = {
  async create(opportunity: any) {
    const { data, error } = await supabase
      .from('opportunities')
      .insert(opportunity)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('opportunities')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

export const assignmentService = {
  async getByKam(kamId: string) {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        hospitals (*)
      `)
      .eq('kam_id', kamId)
    
    if (error) throw error
    return data
  },

  async reassign(hospitalId: string, newKamId: string) {
    const { data, error } = await supabase
      .from('assignments')
      .update({ kam_id: newKamId })
      .eq('hospital_id', hospitalId)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}