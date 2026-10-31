/**
 * Datos de PRUEBA en Barranquilla para la app de campo (dueño, 2026-10-31: "créame varios médicos y varios contactos de
 * IPS que estén en Barranquilla y médicos simulados asignados a Estefanía González para hacer muchas pruebas").
 *
 *   npx tsx scripts/datos-prueba-barranquilla.ts            # vista previa: no escribe nada
 *   npx tsx scripts/datos-prueba-barranquilla.ts --run      # crea lo que falte (volver a correrlo no duplica)
 *   npx tsx scripts/datos-prueba-barranquilla.ts --borrar   # borra SOLO lo que creó este script (por su marca)
 *
 * Qué crea, todo marcado como prueba (nombre con "(prueba)", `notas` = MARCA en médicos y consultorios, correo
 * @prueba.opmap.local en los contactos):
 *   - 10 médicos (CC 9000001xx, especialidades de las líneas) que atienden en IPS reales de Barranquilla ya cargadas
 *     (Misericordia, Iberoamérica, Clínica de la Costa, del Caribe, General del Norte, Bonnadona, Reina Catalina, La
 *     Asunción, Jaller, Funmedic, Instituto Clínico y Quirúrgico) y en Portoazul (Puerto Colombia); tres tienen además
 *     su consultorio (cuenta `consultorio` con su sede). Los consultorios de prueba llevan coordenadas INVENTADAS a
 *     unos 150 m de una clínica real (son de prueba: `ubicacion_confirmada = false`, `origen = 'manual'`); los
 *     consultorios reales se ubican solo por su dirección con certeza (decisión 2026-10-31).
 *   - Los médicos quedan como creados por la líder de Medicina deportiva (Stefania Andrea Gonzalez Torres) y de sus
 *     líneas de líder (`medico_lineas`, 0950): así los ve en Hoy, Reportar y Agendar.
 *   - 11 contactos de IPS (compras, farmacia, programación de cirugía, quirófano…) con teléfono y correo, uno por sede.
 *
 * Se crea por la misma función que la API (`terceros_crear_medico`) y con las mismas reglas de unicidad: un médico
 * con el mismo documento, una cuenta con la misma identificación o un contacto con el mismo correo en la cuenta no se
 * repiten (se informan como "ya está"). Variables de web/.env.local (cliente service_role de lib/supabase-admin.ts); no
 * las imprime. No llama a Google.
 */
import path from 'path'

export const MARCA = 'Datos de prueba (scripts/datos-prueba-barranquilla.ts, 2026-10-31)'
export const DOMINIO_PRUEBA = 'prueba.opmap.local'
const LIDER_USER_ID = '1717ca01-d67a-4f87-ac3f-9157f466761a' // Stefania Andrea Gonzalez Torres (line_leader, Medicina deportiva)
const BARRANQUILLA = '08001'

type Especialidad = 'ortopedia' | 'neurocirugia' | 'columna' | 'deportiva' | 'maxilofacial' | 'fisiatria' | 'cirugia_general' | 'otra'
type RolContacto = 'compras' | 'gerencia' | 'direccion_medica' | 'quimico_farmaceutico' | 'almacen_farmacia' | 'autorizaciones' | 'auditoria_medica' | 'programacion_cirugia' | 'quirofano' | 'esterilizacion' | 'instrumentacion' | 'cartera_facturacion' | 'otro'

/** Sedes reales (ya cargadas desde hospitals) por el nombre con que están en `sedes`. */
const SEDES = {
  portoazul: 'Clínica Portoazul S.A. Sigla Cpa',
  misericordia: 'Clínica Misericordia',
  iberoamerica: 'Clínica Iberoamérica',
  costa: 'IPS Clínica de La Costa S.A.S.',
  caribe: 'IPS Clínica del Caribe',
  norte: 'Organización Clínica General del Norte S.A.',
  bonnadona: 'Organización Clínica Bonnadona Prevenir S.A.S.',
  reina: 'Clínica Reina Catalina S.A.S.',
  asuncion: 'Clínica La Asunción',
  jaller: 'Clínica Jaller S.A.S.',
  funmedic: 'Fundación Médica Integral de La Costa Limitada - Funmedic IPS Ltda.',
  icqc: 'Instituto Cardiovascular Y Quirúrgico de La Costa S.A.S.',
} as const
type ClaveSede = keyof typeof SEDES

interface MedicoPrueba {
  cc: string
  nombre: string
  especialidades: Especialidad[]
  telefono: string
  /** Sedes donde atiende (la primera es la principal). */
  atiende: ClaveSede[]
  /** Consultorio propio: dirección y la clínica cerca de la cual se ubica (a unos 150 m, coordenadas de prueba). */
  consultorio?: { direccion: string; cerca: ClaveSede }
}

export const MEDICOS: readonly MedicoPrueba[] = [
  { cc: '900000101', nombre: 'Carlos Andrés Mejía Ospino (prueba)', especialidades: ['deportiva'], telefono: '310 000 0101', atiende: ['portoazul', 'iberoamerica'], consultorio: { direccion: 'Calle 80 # 51B-20, consultorio 301 (prueba)', cerca: 'iberoamerica' } },
  { cc: '900000102', nombre: 'Laura Valentina Pérez Char (prueba)', especialidades: ['ortopedia'], telefono: '310 000 0102', atiende: ['misericordia', 'iberoamerica'] },
  { cc: '900000103', nombre: 'Jorge Luis Barrios Donado (prueba)', especialidades: ['columna'], telefono: '310 000 0103', atiende: ['costa'] },
  { cc: '900000104', nombre: 'María Fernanda Ruiz Acosta (prueba)', especialidades: ['deportiva', 'fisiatria'], telefono: '310 000 0104', atiende: ['caribe'], consultorio: { direccion: 'Carrera 49C # 80-125, consultorio 504 (prueba)', cerca: 'caribe' } },
  { cc: '900000105', nombre: 'Andrés Felipe Castro Llanos (prueba)', especialidades: ['neurocirugia'], telefono: '310 000 0105', atiende: ['norte'] },
  { cc: '900000106', nombre: 'Daniela Sofía Mendoza Vergara (prueba)', especialidades: ['ortopedia', 'deportiva'], telefono: '310 000 0106', atiende: ['bonnadona', 'reina'] },
  { cc: '900000107', nombre: 'Rafael Enrique Torres Insignares (prueba)', especialidades: ['maxilofacial'], telefono: '310 000 0107', atiende: ['asuncion'] },
  { cc: '900000108', nombre: 'Paula Andrea Gómez Suárez (prueba)', especialidades: ['fisiatria'], telefono: '310 000 0108', atiende: ['jaller'], consultorio: { direccion: 'Carrera 53 # 68-40, consultorio 208 (prueba)', cerca: 'jaller' } },
  { cc: '900000109', nombre: 'Luis Miguel Herrera Polo (prueba)', especialidades: ['cirugia_general'], telefono: '310 000 0109', atiende: ['funmedic'] },
  { cc: '900000110', nombre: 'Natalia Rodríguez Altamar (prueba)', especialidades: ['columna', 'ortopedia'], telefono: '310 000 0110', atiende: ['icqc', 'misericordia'] },
]

interface ContactoPrueba {
  sede: ClaveSede
  nombre: string
  cargo: string
  rol: RolContacto
  telefono: string
  correo: string
}

export const CONTACTOS: readonly ContactoPrueba[] = [
  { sede: 'portoazul', nombre: 'Ana María Villarreal (prueba)', cargo: 'Jefe de compras', rol: 'compras', telefono: '320 000 0201', correo: `ana.villarreal@${DOMINIO_PRUEBA}` },
  { sede: 'portoazul', nombre: 'Héctor Julio Bolaño (prueba)', cargo: 'Coordinador de quirófanos', rol: 'quirofano', telefono: '320 000 0202', correo: `hector.bolano@${DOMINIO_PRUEBA}` },
  { sede: 'misericordia', nombre: 'Karen Patricia Orozco (prueba)', cargo: 'Programación de cirugía', rol: 'programacion_cirugia', telefono: '320 000 0203', correo: `karen.orozco@${DOMINIO_PRUEBA}` },
  { sede: 'iberoamerica', nombre: 'Mauricio Daza Celedón (prueba)', cargo: 'Almacén y farmacia', rol: 'almacen_farmacia', telefono: '320 000 0204', correo: `mauricio.daza@${DOMINIO_PRUEBA}` },
  { sede: 'costa', nombre: 'Liliana Esther Pacheco (prueba)', cargo: 'Dirección médica', rol: 'direccion_medica', telefono: '320 000 0205', correo: `liliana.pacheco@${DOMINIO_PRUEBA}` },
  { sede: 'caribe', nombre: 'Jaime Alberto Noriega (prueba)', cargo: 'Gerente administrativo', rol: 'gerencia', telefono: '320 000 0206', correo: `jaime.noriega@${DOMINIO_PRUEBA}` },
  { sede: 'norte', nombre: 'Sandra Milena Cantillo (prueba)', cargo: 'Cartera y facturación', rol: 'cartera_facturacion', telefono: '320 000 0207', correo: `sandra.cantillo@${DOMINIO_PRUEBA}` },
  { sede: 'bonnadona', nombre: 'Óscar David Escorcia (prueba)', cargo: 'Instrumentación quirúrgica', rol: 'instrumentacion', telefono: '320 000 0208', correo: `oscar.escorcia@${DOMINIO_PRUEBA}` },
  { sede: 'reina', nombre: 'Yesenia Paola Mercado (prueba)', cargo: 'Central de esterilización', rol: 'esterilizacion', telefono: '320 000 0209', correo: `yesenia.mercado@${DOMINIO_PRUEBA}` },
  { sede: 'asuncion', nombre: 'Rodrigo Antonio Sarmiento (prueba)', cargo: 'Autorizaciones', rol: 'autorizaciones', telefono: '320 000 0210', correo: `rodrigo.sarmiento@${DOMINIO_PRUEBA}` },
  { sede: 'jaller', nombre: 'Claudia Inés Berdugo (prueba)', cargo: 'Química farmacéutica', rol: 'quimico_farmaceutico', telefono: '320 000 0211', correo: `claudia.berdugo@${DOMINIO_PRUEBA}` },
]

/** Coordenadas de prueba: a unos 150 m al noreste de un punto (6 decimales). */
export function cerquita(lat: number, lng: number): { lat: number; lng: number } {
  return { lat: Number((lat + 0.001).toFixed(6)), lng: Number((lng + 0.001).toFixed(6)) }
}

export function leerArgumentos(argv: readonly string[]): { modo: 'previa' | 'run' | 'borrar' } {
  if (argv.includes('--borrar')) return { modo: 'borrar' }
  if (argv.includes('--run')) return { modo: 'run' }
  return { modo: 'previa' }
}

interface SedeDb {
  id: string
  nombre: string
  cuenta_id: string
  lat: number | null
  lng: number | null
  activo: boolean
}

async function main() {
  const { modo } = leerArgumentos(process.argv.slice(2))
  const dotenv = await import('dotenv')
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), quiet: true })
  const { supabaseAdmin } = await import('../lib/supabase-admin')
  /** Hoy en Bogotá (AAAA-MM-DD), como todayInBogota del servidor. */
  const todayInBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  const { data: lider, error: errorLider } = await supabaseAdmin.from('users').select('id, full_name, role, active').eq('id', LIDER_USER_ID).maybeSingle<{ id: string; full_name: string; role: string; active: boolean }>()
  if (errorLider) throw errorLider
  if (!lider || !lider.active || !/gonzalez/i.test(lider.full_name)) throw new Error('No encuentro a la líder (Stefania Andrea Gonzalez Torres) con ese id, o está inactiva')
  const { data: lineasData, error: errorLineas } = await supabaseAdmin.from('business_lines').select('id, name').eq('leader_user_id', lider.id).eq('active', true)
  if (errorLineas) throw errorLineas
  const lineas = (lineasData ?? []) as Array<{ id: string; name: string }>
  console.log(`Líder: ${lider.full_name} (${lider.role}); líneas de líder: ${lineas.map(l => l.name).join(', ') || 'ninguna'}`)
  console.log(`Modo: ${modo === 'run' ? '--run (escribe)' : modo === 'borrar' ? '--borrar (borra lo marcado como prueba)' : 'vista previa (no escribe)'}`)
  console.log('')

  if (modo === 'borrar') {
    await borrar(supabaseAdmin)
    return
  }

  // Las sedes reales, por nombre.
  const nombres = Object.values(SEDES)
  const { data: sedesData, error: errorSedes } = await supabaseAdmin.from('sedes').select('id, nombre, cuenta_id, lat, lng, activo').in('nombre', nombres)
  if (errorSedes) throw errorSedes
  const porNombre = new Map(((sedesData ?? []) as SedeDb[]).filter(s => s.activo).map(s => [s.nombre, s]))
  const sede = (clave: ClaveSede): SedeDb => {
    const s = porNombre.get(SEDES[clave])
    if (!s) throw new Error(`No está la sede "${SEDES[clave]}" (activa) en OpMap`)
    return s
  }
  for (const clave of Object.keys(SEDES) as ClaveSede[]) sede(clave)
  console.log(`Sedes reales encontradas: ${porNombre.size}/${nombres.length}`)

  // Lo que ya existe (idempotente).
  const { data: medicosData } = await supabaseAdmin.from('medicos').select('id, numero_documento').eq('tipo_documento', 'CC').in('numero_documento', MEDICOS.map(m => m.cc))
  const medicosHechos = new Map(((medicosData ?? []) as Array<{ id: string; numero_documento: string }>).map(m => [m.numero_documento, m.id]))
  const { data: cuentasData } = await supabaseAdmin.from('cuentas').select('id, numero_identificacion').eq('tipo_identificacion', 'CC').in('numero_identificacion', MEDICOS.map(m => m.cc))
  const consultoriosHechos = new Map(((cuentasData ?? []) as Array<{ id: string; numero_identificacion: string }>).map(c => [c.numero_identificacion, c.id]))
  const { data: contactosData } = await supabaseAdmin.from('contactos').select('id, email').ilike('email', `%@${DOMINIO_PRUEBA}`)
  const contactosHechos = new Set(((contactosData ?? []) as Array<{ email: string | null }>).map(c => (c.email ?? '').toLowerCase()))

  console.log('\nMédicos:')
  let creados = 0
  for (const m of MEDICOS) {
    const sedesDelMedico: Array<{ sede_id: string; rol: 'atiende' | 'consultorio'; principal: boolean }> = m.atiende.map((clave, i) => ({ sede_id: sede(clave).id, rol: 'atiende', principal: i === 0 }))
    const textoSedes = m.atiende.map(c => SEDES[c]).join(' | ')
    if (medicosHechos.has(m.cc)) {
      console.log(`  = ${m.nombre} (CC ${m.cc}) ya está`)
      continue
    }
    let consultorioTexto = ''
    if (m.consultorio) {
      const base = sede(m.consultorio.cerca)
      const punto = base.lat !== null && base.lng !== null ? cerquita(Number(base.lat), Number(base.lng)) : null
      consultorioTexto = ` + consultorio "${m.consultorio.direccion}"${punto ? ` (${punto.lat}, ${punto.lng}, de prueba)` : ' (sin ubicar)'}`
      if (modo === 'run') {
        let cuentaId = consultoriosHechos.get(m.cc) ?? null
        if (!cuentaId) {
          const { data: cuenta, error } = await supabaseAdmin
            .from('cuentas')
            .insert({ nombre: `Consultorio ${m.nombre}`, clase: 'consultorio', es_cliente: false, tipo_identificacion: 'CC', numero_identificacion: m.cc, notas: MARCA, origen: 'manual', created_by: lider.id })
            .select('id')
            .single<{ id: string }>()
          if (error) throw error
          cuentaId = cuenta.id
          const { error: errorSede } = await supabaseAdmin.from('sedes').insert({
            cuenta_id: cuentaId,
            nombre: `Consultorio ${m.nombre}`,
            es_principal: true,
            direccion: m.consultorio.direccion,
            municipality_id: BARRANQUILLA,
            lat: punto?.lat ?? null,
            lng: punto?.lng ?? null,
            ubicacion_confirmada: false,
            origen: 'manual',
            created_by: lider.id,
          })
          if (errorSede) throw errorSede
        }
        const { data: sedeConsultorio, error: errorBuscar } = await supabaseAdmin.from('sedes').select('id').eq('cuenta_id', cuentaId).eq('es_principal', true).limit(1).maybeSingle<{ id: string }>()
        if (errorBuscar) throw errorBuscar
        if (sedeConsultorio) sedesDelMedico.push({ sede_id: sedeConsultorio.id, rol: 'consultorio', principal: false })
      }
    }
    console.log(`  + ${m.nombre} (CC ${m.cc}, ${m.especialidades.join(', ')}) atiende en ${textoSedes}${consultorioTexto}`)
    if (modo !== 'run') continue
    const { data: id, error } = await supabaseAdmin.rpc('terceros_crear_medico', {
      p_medico: { tipo_documento: 'CC', numero_documento: m.cc, nombre: m.nombre, especialidades: m.especialidades, municipality_id: BARRANQUILLA, telefono: m.telefono, email: null, notas: MARCA },
      p_sedes: sedesDelMedico,
      p_user: lider.id,
    })
    if (error) throw error
    if (typeof id !== 'string') throw new Error(`No se creó ${m.nombre}`)
    if (lineas.length > 0) {
      const { error: errorMl } = await supabaseAdmin.from('medico_lineas').insert(lineas.map(l => ({ medico_id: id, line_id: l.id, user_id: lider.id, desde: todayInBogota() })))
      if (errorMl) throw errorMl
    }
    creados++
  }

  console.log('\nContactos de IPS:')
  let contactosCreados = 0
  for (const k of CONTACTOS) {
    const s = sede(k.sede)
    if (contactosHechos.has(k.correo.toLowerCase())) {
      console.log(`  = ${k.nombre} en ${s.nombre} ya está`)
      continue
    }
    console.log(`  + ${k.nombre} · ${k.cargo} (${k.rol}) · ${s.nombre} · ${k.telefono} · ${k.correo}`)
    if (modo !== 'run') continue
    const { error } = await supabaseAdmin.from('contactos').insert({ cuenta_id: s.cuenta_id, sede_id: s.id, nombre: k.nombre, cargo_texto: k.cargo, rol: k.rol, telefono: k.telefono, email: k.correo, created_by: lider.id })
    if (error) throw error
    contactosCreados++
  }

  console.log('')
  if (modo === 'run') console.log(`Listo: ${creados} médicos y ${contactosCreados} contactos creados (los demás ya estaban).`)
  else console.log(`Vista previa: ${MEDICOS.filter(m => !medicosHechos.has(m.cc)).length} médicos y ${CONTACTOS.filter(k => !contactosHechos.has(k.correo.toLowerCase())).length} contactos por crear. Corre con --run para crearlos.`)
}

type Cliente = Awaited<ReturnType<typeof importarCliente>>
async function importarCliente() {
  const { supabaseAdmin } = await import('../lib/supabase-admin')
  return supabaseAdmin
}

/** Borra solo lo marcado como prueba por este script: contactos por su correo, médicos y consultorios por `notas` = MARCA. */
async function borrar(db: Cliente) {
  const { data: contactos, error: e1 } = await db.from('contactos').delete().ilike('email', `%@${DOMINIO_PRUEBA}`).select('id')
  if (e1) throw e1
  const { data: medicos, error: e2 } = await db.from('medicos').delete().eq('notas', MARCA).select('id')
  if (e2) throw e2
  const { data: cuentas, error: e3 } = await db.from('cuentas').select('id').eq('notas', MARCA)
  if (e3) throw e3
  const ids = ((cuentas ?? []) as Array<{ id: string }>).map(c => c.id)
  let sedesBorradas = 0
  if (ids.length > 0) {
    const { data: sedes, error: e4 } = await db.from('sedes').delete().in('cuenta_id', ids).select('id')
    if (e4) throw e4
    sedesBorradas = (sedes ?? []).length
    const { error: e5 } = await db.from('cuentas').delete().in('id', ids)
    if (e5) throw e5
  }
  console.log(`Borrados: ${(contactos ?? []).length} contactos, ${(medicos ?? []).length} médicos (con sus sedes y líneas), ${ids.length} consultorios de prueba (${sedesBorradas} sedes).`)
}

if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
