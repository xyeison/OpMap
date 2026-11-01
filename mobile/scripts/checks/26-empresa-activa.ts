/**
 * La empresa activa en la app de campo (capa 1 de empresas, docs/specs/2026-10-31-empresas-papeles-y-asignaciones.md,
 * Task 10): lib/empresa-activa.ts (puro) y lo que Ajustes, la franja de estado y la sesión tienen que hacer (se leen sus
 * archivos). Corren en Node, sin React Native ni red. Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 26-empresa-activa
 */
import { CLAVES_API } from '../../lib/claves-api'
import { MENSAJE_EMPRESA_SIN_SENAL, empresasDelUsuario, selectorDeEmpresa } from '../../lib/empresa-activa'
import type { EmpresaMovil } from '../../lib/tipos'
import type { Probador } from './probador'

interface FsMinimo {
  readFileSync(ruta: string, codificacion: 'utf8'): string
}
interface PathMinimo {
  resolve(...partes: string[]): string
}
declare const __dirname: string
const { readFileSync } = require('fs') as FsMinimo
const path = require('path') as PathMinimo
const leer = (relativa: string) => readFileSync(path.resolve(__dirname, '..', '..', relativa), 'utf8')

const VG: EmpresaMovil = { id: '00000000-0000-4000-8000-000000000001', codigo: 'vg', nombre_corto: 'VG Medical' }
const MEDIX: EmpresaMovil = { id: '00000000-0000-4000-8000-000000000002', codigo: 'medix', nombre_corto: 'Medix' }

export async function pruebas(t: Probador): Promise<void> {
  t.seccion('26. La empresa activa (lib/empresa-activa.ts)')
  t.check('sin empresa (sin papeles, o un servidor sin la 0960): no se muestra nada', selectorDeEmpresa({ empresa: null, empresas: [], enLinea: true }).modo === 'oculto')
  const una = selectorDeEmpresa({ empresa: VG, empresas: [VG], enLinea: true })
  t.check('con una sola empresa: solo su nombre corto (no hay a cuál cambiar)', una.modo === 'solo_nombre' && una.nombre === 'VG Medical', una)
  const dos = selectorDeEmpresa({ empresa: VG, empresas: [VG, MEDIX], enLinea: true })
  t.check(
    'con dos o más y señal: el selector con todas, habilitado y sin aviso',
    dos.modo === 'selector' && dos.opciones.length === 2 && dos.opciones[0].id === VG.id && dos.opciones[1].id === MEDIX.id && !dos.deshabilitado && dos.aviso === null,
    dos
  )
  const sinSenal = selectorDeEmpresa({ empresa: MEDIX, empresas: [VG, MEDIX], enLinea: false })
  t.check('con dos o más SIN señal: el selector deshabilitado con el aviso', sinSenal.modo === 'selector' && sinSenal.deshabilitado && sinSenal.aviso === MENSAJE_EMPRESA_SIN_SENAL, sinSenal)
  t.check('el aviso dice que sin señal no se puede cambiar de empresa', MENSAJE_EMPRESA_SIN_SENAL === 'Sin señal no se puede cambiar de empresa')
  const viejo = empresasDelUsuario({ id: 'u1', full_name: 'Ana', role: 'line_leader' } as never)
  t.check('un perfil guardado antes de la capa 1 (sin empresa, empresas ni papeles): empresa null y listas vacías', viejo.empresa === null && Array.isArray(viejo.empresas) && viejo.empresas.length === 0 && Array.isArray(viejo.papeles) && viejo.papeles.length === 0, viejo)
  const nuevo = empresasDelUsuario({ empresa: VG, empresas: [VG, MEDIX], papeles: [] })
  t.check('con los datos: se conservan', nuevo.empresa?.id === VG.id && nuevo.empresas.length === 2, nuevo)
  t.check('y un perfil dañado (null) tampoco rompe', empresasDelUsuario(null).empresa === null && empresasDelUsuario(undefined).empresas.length === 0)

  t.seccion('26b. Claves de la API (lib/claves-api.ts)')
  t.check('usuario del login y de me: id, full_name, role, empresa, empresas y papeles', [...CLAVES_API.usuario].sort().join(' ') === 'empresa empresas full_name id papeles role')
  t.check('una empresa: id, codigo y nombre_corto', [...CLAVES_API.empresaMovil].sort().join(' ') === 'codigo id nombre_corto')
  t.check('POST /api/auth/empresa con portador: empresa, token y expira_at', [...CLAVES_API.cambioEmpresa].sort().join(' ') === 'empresa expira_at token')

  t.seccion('26c. Ajustes, la franja y la sesión (se leen los archivos)')
  const ajustes = leer('app/(app)/ajustes.tsx')
  t.check('Ajustes decide qué mostrar con selectorDeEmpresa (empresa y empresas del perfil, y si hay señal)', /selectorDeEmpresa\(\{ empresa: perfil\?\.usuario\.empresa \?\? null, empresas: perfil\?\.usuario\.empresas \?\? \[\], enLinea \}\)/.test(ajustes))
  t.check('la sección "Empresa" va encima de "Cerrar sesión"', ajustes.indexOf('<Subtitulo>Empresa</Subtitulo>') > 0 && ajustes.indexOf('<Subtitulo>Empresa</Subtitulo>') < ajustes.indexOf('titulo="Cerrar sesión"'))
  t.check('con una: solo el nombre; con varias: una fila por empresa, la actual marcada', /modo === 'solo_nombre'/.test(ajustes) && /\.opciones\.map\(/.test(ajustes) && /selected: actual/.test(ajustes))
  t.check('sin señal: las filas deshabilitadas y el aviso (MENSAJE_EMPRESA_SIN_SENAL) a la vista', /disabled=\{[^}]*deshabilitado/.test(ajustes) && /\.aviso \?/.test(ajustes))
  t.check('al tocar otra empresa llama a cambiarEmpresa de la sesión y muestra el error ahí mismo', /cambiarEmpresa\(/.test(ajustes) && /setErrorEmpresa\(/.test(ajustes))

  const franja = leer('components/EstadoCola.tsx')
  t.check('la franja muestra el nombre corto de la empresa junto al botón "OpMap", solo si hay empresa', /perfil\?\.usuario\.empresa\?\.nombre_corto/.test(franja) && /\{empresaCorta && !soloIcono \?/.test(franja))

  const sesion = leer('lib/sesion.ts')
  const cuerpoCambiar = sesion.slice(sesion.indexOf('const cambiarEmpresa = useCallback'), sesion.indexOf('const valor = useMemo'))
  t.check('sesion.ts: cambiarEmpresa llama a la API, guarda el token nuevo y el perfil, y vuelve a pedir me', cuerpoCambiar.length > 0 && /api\.cambiarEmpresa\(empresaId\)/.test(cuerpoCambiar) && /guardarToken\(respuesta\.token\)/.test(cuerpoCambiar) && /guardarJson\(CLAVE_PERFIL/.test(cuerpoCambiar) && /confirmar\(respuesta\.token/.test(cuerpoCambiar))
  t.check('y NO toca el contexto guardado ni las colas', !/olvidarContexto|borrarClave|cola|foto/i.test(cuerpoCambiar), cuerpoCambiar.length)
  t.check('el perfil guardado se lee con empresasDelUsuario (los perfiles viejos siguen sirviendo)', /empresasDelUsuario\(/.test(sesion))
  t.check('cambiarEmpresa está en ValorSesion', /cambiarEmpresa: \(empresaId: string\) => Promise<void>/.test(sesion))

  const api = leer('lib/api.ts')
  t.check('api.ts: cambiarEmpresa hace POST /api/auth/empresa con { empresa_id } (con el token)', /export function cambiarEmpresa\(empresaId: string\): Promise<CambioEmpresaResponse>/.test(api) && /'\/api\/auth\/empresa', \{ metodo: 'POST', cuerpo: \{ empresa_id: empresaId \} \}/.test(api))
}
