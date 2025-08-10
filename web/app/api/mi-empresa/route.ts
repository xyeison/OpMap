import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase
      .from('mi_empresa_config')
      .select('*')
      .order('anio_fiscal', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching mi empresa config:', error);
      return NextResponse.json(
        { error: 'Error al obtener configuración' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || null });
  } catch (error) {
    console.error('Error in GET mi empresa:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('mi_empresa_config')
      .insert({
        nombre: body.nombre,
        nit: body.nit,
        anio_fiscal: body.anio_fiscal || new Date().getFullYear(),
        activo_corriente: body.activo_corriente,
        activo_total: body.activo_total,
        pasivo_corriente: body.pasivo_corriente,
        pasivo_total: body.pasivo_total,
        patrimonio: body.patrimonio,
        ingresos_anuales: body.ingresos_anuales,
        utilidad_neta: body.utilidad_neta,
        gastos_intereses: body.gastos_intereses,
        utilidad_operacional: body.utilidad_operacional,
        anos_experiencia: body.anos_experiencia,
        certificaciones: body.certificaciones
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating mi empresa config:', error);
      return NextResponse.json(
        { error: 'Error al crear configuración' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in POST mi empresa:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    // Get the latest config
    const { data: existing, error: fetchError } = await supabase
      .from('mi_empresa_config')
      .select('id')
      .order('anio_fiscal', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !existing) {
      // If no config exists, create one
      return POST(request);
    }

    const { data, error } = await supabase
      .from('mi_empresa_config')
      .update({
        nombre: body.nombre,
        nit: body.nit,
        anio_fiscal: body.anio_fiscal,
        activo_corriente: body.activo_corriente,
        activo_total: body.activo_total,
        pasivo_corriente: body.pasivo_corriente,
        pasivo_total: body.pasivo_total,
        patrimonio: body.patrimonio,
        ingresos_anuales: body.ingresos_anuales,
        utilidad_neta: body.utilidad_neta,
        gastos_intereses: body.gastos_intereses,
        utilidad_operacional: body.utilidad_operacional,
        anos_experiencia: body.anos_experiencia,
        certificaciones: body.certificaciones
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating mi empresa config:', error);
      return NextResponse.json(
        { error: 'Error al actualizar configuración' },
        { status: 500 }
      );
    }

    // Trigger revalidation of all contracts
    const { error: validationError } = await supabase
      .rpc('validar_todos_contratos');

    if (validationError) {
      console.error('Error revalidating contracts:', validationError);
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in PUT mi empresa:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}