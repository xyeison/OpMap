import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
);

export async function GET(request: NextRequest) {
  try {
    // Query the contract_compliance view
    const { data: contracts, error } = await supabase
      .from('contract_compliance')
      .select('*')
      .order('contract_number', { ascending: true });

    if (error) {
      console.error('Error fetching compliance:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform contract_id to id for compatibility with frontend
    const transformedContracts = (contracts || []).map(contract => ({
      ...contract,
      id: contract.contract_id,
      // Keep contract_id for backwards compatibility
    }));

    return NextResponse.json({ 
      contracts: transformedContracts,
      success: true 
    });
  } catch (error) {
    console.error('Error in compliance API:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}