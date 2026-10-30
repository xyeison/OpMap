/**
 * SIA Observa · utilidades comunes de los scripts locales (sia-smoke, sia-entidades, sia-load, sia-extraer). No es un
 * script ejecutable. Lee web/.env.local (Supabase con service_role; SIA_CONTACTO para el User-Agent) y guarda la caché de
 * respuestas del portal en web/.sia-cache/ (no va a git): una consulta igual en menos de SIA_CACHE_HORAS no vuelve a SIA.
 */
import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import dotenv from 'dotenv'
import { SiaCliente, type SiaCache } from '../../lib/sia-observa/client'

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })

export const SIA_CACHE_DIR = path.resolve(__dirname, '..', '..', '.sia-cache')
/** Horas que vale una respuesta guardada (el sync es diario: 20 h evita repetir la misma noche). */
export const SIA_CACHE_HORAS = 20

export function cacheEnDisco(horas = SIA_CACHE_HORAS, dir = SIA_CACHE_DIR): SiaCache {
  return {
    async get(clave) {
      const archivo = path.join(dir, `${createHash('sha256').update(clave).digest('hex')}.txt`)
      try {
        const stat = fs.statSync(archivo)
        if (Date.now() - stat.mtimeMs > horas * 3_600_000) return null
        return fs.readFileSync(archivo, 'utf8')
      } catch {
        return null
      }
    },
    async set(clave, valor) {
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, `${createHash('sha256').update(clave).digest('hex')}.txt`), valor, 'utf8')
    },
  }
}

export function log(mensaje: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${mensaje}`)
}

export function crearCliente(opts: { sinCache?: boolean } = {}): SiaCliente {
  if (!process.env.SIA_CONTACTO) log('Aviso: SIA_CONTACTO no está en .env.local; el User-Agent va sin correo de contacto.')
  return new SiaCliente({ cache: opts.sinCache ? undefined : cacheEnDisco(), log })
}

/** Argumentos --clave valor y banderas --clave. */
export function leerArgs(argv: string[], conValor: readonly string[], banderas: readonly string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) throw new Error(`Argumento desconocido: ${arg}`)
    const clave = arg.slice(2)
    if (banderas.includes(clave)) out[clave] = true
    else if (conValor.includes(clave)) {
      const valor = argv[++i]
      if (valor === undefined || valor.startsWith('--')) throw new Error(`Falta el valor de ${arg}`)
      out[clave] = valor
    } else throw new Error(`Argumento desconocido: ${arg}`)
  }
  return out
}
