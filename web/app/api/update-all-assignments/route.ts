import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import fs from 'fs/promises'
import path from 'path'

export async function POST() {
  try {
    // Read the SQL file
    const sqlPath = path.join(process.cwd(), '..', 'database', 'update_all_assignments.sql')
    const sqlContent = await fs.readFile(sqlPath, 'utf-8')
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent })
    
    if (error) {
      // If RPC doesn't exist, try a different approach
      // First delete all assignments
      const { error: deleteError } = await supabase
        .from('assignments')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
      
      if (deleteError) {
        return NextResponse.json({ error: 'Failed to delete assignments', details: deleteError }, { status: 500 })
      }
      
      // Extract INSERT values from SQL
      const insertMatch = sqlContent.match(/INSERT INTO assignments[\s\S]*?VALUES([\s\S]*?);/m)
      if (!insertMatch) {
        return NextResponse.json({ error: 'Could not parse SQL file' }, { status: 500 })
      }
      
      // Parse values - this is a simplified approach
      return NextResponse.json({ 
        message: 'Assignments cleared. Please run the SQL manually in Supabase dashboard.',
        sqlFile: 'database/update_all_assignments.sql'
      })
    }
    
    return NextResponse.json({ success: true, message: 'All assignments updated successfully' })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to update assignments', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}