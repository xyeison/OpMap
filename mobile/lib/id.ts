/**
 * Identificadores que genera la app: `client_id` de cada visita (uuid v4). Con él el servidor reconoce un
 * reintento de la cola sin señal y no duplica la visita (decisión 4 del contrato fase 8).
 */
import * as Crypto from 'expo-crypto'

export function nuevoClientId(): string {
  return Crypto.randomUUID()
}
