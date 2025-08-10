import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; linkId: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    
    const { error } = await supabase
      .from('proveedor_enlaces')
      .delete()
      .eq('id', params.linkId)
      .eq('proveedor_id', params.id);

    if (error) {
      console.error('Error deleting link:', error);
      return NextResponse.json(
        { error: 'Error al eliminar enlace' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE link:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}