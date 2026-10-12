import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { hashPassword } from '@/lib/passwords'
import {
  EXECUTIVE_ACCOUNT_ROLE,
  generateTempPassword,
  planExecutiveAccounts,
  type ExecutiveForAccount,
  type UserForAccount,
} from '@/lib/executive-accounts'
import { linkExecutiveToUserByEmail } from '../../executives/_lib/executive-shared'

export const dynamic = 'force-dynamic'

// Usuarios de OpMap para las Ejecutivas Comerciales que no tienen (app de visita, Fase 0).
// GET = simulación (qué se crearía o enlazaría, sin escribir). POST { confirm: true } = lo hace quien administra
// usuarios (users:manage, solo admin): crea los usuarios con rol sales_manager y una contraseña temporal que se
// devuelve UNA sola vez (en la base solo queda el hash) y los enlaza con su ejecutiva.

async function loadPlan() {
  const supabase = getSupabaseAdmin()
  const [{ data: executives, error: executivesError }, { data: users, error: usersError }] = await Promise.all([
    supabase.from('executives').select('id, full_name, email, status, user_id').range(0, 999),
    supabase.from('users').select('id, email').range(0, 4999),
  ])
  if (executivesError) throw executivesError
  if (usersError) throw usersError
  return planExecutiveAccounts((executives || []) as ExecutiveForAccount[], (users || []) as UserForAccount[])
}

const describe = (plan: Awaited<ReturnType<typeof loadPlan>>) =>
  plan.map(action => ({
    executiveId: action.executive.id,
    name: action.executive.full_name,
    email: action.kind === 'skip' ? action.executive.email : action.email,
    action: action.kind,
    reason: action.kind === 'skip' ? action.reason : null,
  }))

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'users:manage')
  if (!auth.ok) return auth.response
  try {
    const plan = await loadPlan()
    return NextResponse.json({ role: EXECUTIVE_ACCOUNT_ROLE, items: describe(plan) })
  } catch (error) {
    console.error('users/from-executives GET:', error)
    return NextResponse.json({ error: 'Error al revisar las ejecutivas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'users:manage')
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la petición no válido' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || (body as { confirm?: unknown }).confirm !== true) {
    return NextResponse.json({ error: 'Falta la confirmación (confirm: true)' }, { status: 400 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const plan = await loadPlan()
    const results: Array<{ name: string; email: string | null; action: string; tempPassword: string | null; error: string | null }> = []

    for (const action of plan) {
      if (action.kind === 'skip') {
        results.push({ name: action.executive.full_name, email: action.executive.email, action: 'skip', tempPassword: null, error: action.reason })
        continue
      }
      if (action.kind === 'link') {
        const linked = await linkExecutiveToUserByEmail(action.userId, action.email)
        results.push({ name: action.executive.full_name, email: action.email, action: linked ? 'link' : 'skip', tempPassword: null, error: linked ? null : 'No se pudo enlazar' })
        continue
      }

      const tempPassword = generateTempPassword(size => randomBytes(size))
      const { data: created, error } = await supabase
        .from('users')
        .insert({
          id: randomUUID(),
          email: action.email,
          password: await hashPassword(tempPassword),
          full_name: action.executive.full_name,
          role: EXECUTIVE_ACCOUNT_ROLE,
          active: true,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (error || !created) {
        results.push({ name: action.executive.full_name, email: action.email, action: 'error', tempPassword: null, error: error?.code === '23505' ? 'El email ya está registrado' : 'No se pudo crear' })
        continue
      }
      let linked: string | null = null
      try {
        linked = await linkExecutiveToUserByEmail(created.id as string, action.email)
      } catch (linkError) {
        console.error('users/from-executives: usuario creado sin enlace', linkError)
      }
      results.push({
        name: action.executive.full_name,
        email: action.email,
        action: 'create',
        tempPassword,
        error: linked ? null : 'Usuario creado, pero no se enlazó: guarda la ejecutiva en Ejecutivas Comerciales para reintentar',
      })
    }

    const created = results.filter(result => result.action === 'create').length
    const linked = results.filter(result => result.action === 'link').length
    return NextResponse.json({ results, created, linked, message: `${created} usuarios creados y ${linked} enlazados` })
  } catch (error) {
    console.error('users/from-executives POST:', error)
    return NextResponse.json({ error: 'Error al crear los usuarios' }, { status: 500 })
  }
}
