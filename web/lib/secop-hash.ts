/**
 * PR 7 · Hash del documento de una persona natural en SECOP (solo servidor y scripts: usa node:crypto).
 *
 * Privacidad: SECOP publica la cédula de los contratistas personas naturales. OpMap NO la guarda: guarda
 * sha256(sal + ':' + dígitos) en secop_contratos.proveedor_hash, que solo sirve para saber que dos
 * contratos son de la misma persona. La sal es aleatoria, se generó en la migración 0710 (tabla
 * secop_ajustes, solo service_role) y no está en el código ni en variables de entorno.
 */
import { createHash } from 'node:crypto'

export function hashDocumento(digitos: string, sal: string): string {
  if (!sal || sal.length < 32) throw new Error('Sal de documentos inválida (secop_ajustes.sal_documentos)')
  return createHash('sha256').update(`${sal}:${digitos}`, 'utf8').digest('hex')
}
