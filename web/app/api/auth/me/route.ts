// GET /api/auth/me: el usuario de la sesión (cookie de la web o, sin cookie, el token de portador de la app
// móvil), el Ejecutivo Comercial enlazado con él (id, full_name, zona) o null y (F1a, 0850) la persona de campo
// ({ rol, lineas: [{ id, nombre, como }] }) o null (la dirección comercial, A1, o un usuario sin líneas) y, sin persona,
// `sin_persona`: el porqué cuando se sabe (app solo para líderes, dueño 2026-10-30: "Las visitas de los Ejecutivos
// Comerciales se registran en VMO"; o sin líneas). `user` es lo que ya usaba la web (contexts/UserContext.tsx) y, desde
// la capa 1 de empresas, la empresa activa, las empresas donde tiene papel y sus papeles en la activa (role = el más alto);
// `ejecutiva`, `persona` y `sin_persona`, lo que la app necesita al abrir. Forma: MeResponse en lib/reporte-visitas.ts.
// Si la base falla al buscar la ejecutiva o la persona, se responde igual con null.
import { NextResponse, NextRequest } from 'next/server'
import { ejecutivaEnlazada, getUserFromRequest } from '@/lib/auth-server'
import type { MeResponse } from '@/lib/reporte-visitas'
import { tienePermiso } from '@/lib/empresas-reglas'
import { empresasDeSesion } from '@/lib/empresas'
import { personaDeCampo } from '@/app/api/config-visitas/_lib/visitas-server'
import { lineasDePersona, personaMovil } from '@/app/api/me/_lib/reporte-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    let ejecutiva: MeResponse['ejecutiva'] = null
    let persona: MeResponse['persona'] = null
    let sinPersona: MeResponse['sin_persona'] = null
    try {
      ejecutiva = await ejecutivaEnlazada(user.id)
    } catch (error) {
      console.error('No se pudo cargar el Ejecutivo Comercial enlazado en /api/auth/me:', error)
    }
    try {
      // Solo quien reporta (visits:report; la dirección comercial ya no lo tiene, A1).
      const resultado = tienePermiso(user.papeles, 'visits:report') ? await personaDeCampo(user) : null
      if (resultado && resultado.ok) persona = personaMovil(resultado.persona, await lineasDePersona(resultado.persona.lineas))
      else if (resultado) sinPersona = resultado.error
    } catch (error) {
      console.error('No se pudo cargar la persona de campo en /api/auth/me:', error)
    }

    const respuesta: MeResponse = {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        active: user.active,
        ...empresasDeSesion(user),
      },
      ejecutiva,
      persona,
      sin_persona: sinPersona,
    }
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error en /api/auth/me:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
