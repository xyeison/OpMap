// Verificación de la sesión firmada para el Edge runtime (middleware.ts).
// Usa solo WebCrypto (crypto.subtle): NO importar aquí módulos de Node.
// Mismo formato que lib/session.ts: base64url(JSON{uid,pv,iat,exp}) + "." + base64url(HMAC-SHA256).
// IMPORTANTE: aquí solo se validan firma, estructura y expiración. El claim pv (revocación al
// cambiar la contraseña) NO se comprueba en el Edge porque exige leer users.password de la BD;
// lo comprueba getUserFromRequest (lib/auth-server.ts) en cada ruta API protegida. Una sesión
// revocada puede, por tanto, seguir cargando el HTML de las páginas, pero todas sus llamadas a
// /api/* devuelven 401.
import {
  BASE64URL_RE,
  SESSION_TOKEN_MAX_LENGTH,
  getSessionSecret,
  parseSessionPayload,
} from './session-config'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

let cachedKey: { secret: string; key: Promise<CryptoKey> } | null = null

function getHmacKey(secret: string): Promise<CryptoKey> {
  if (!cachedKey || cachedKey.secret !== secret) {
    cachedKey = {
      secret,
      key: crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      ),
    }
  }
  return cachedKey.key
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(new ArrayBuffer(binary.length))
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Verifica firma (crypto.subtle.verify compara en tiempo constante) y expiración, sin BD
 * (no valida pv: ver la nota de la cabecera).
 * Devuelve { uid } o null. Lanza si falta SESSION_SECRET en producción (fail closed).
 */
export async function verifySessionEdge(token: string | null | undefined): Promise<{ uid: string } | null> {
  if (!token || token.length > SESSION_TOKEN_MAX_LENGTH) return null

  const secret = getSessionSecret()

  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, signature] = parts
  if (!body || !signature || !BASE64URL_RE.test(body) || !BASE64URL_RE.test(signature)) return null

  const signatureBytes = base64UrlToBytes(signature)
  // HMAC-SHA256 = 32 bytes; exigir codificación canónica (igual que la versión Node)
  if (!signatureBytes || signatureBytes.length !== 32 || bytesToBase64Url(signatureBytes) !== signature) {
    return null
  }

  const key = await getHmacKey(secret)
  const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(body))
  if (!valid) return null

  const payloadBytes = base64UrlToBytes(body)
  if (!payloadBytes) return null

  const payload = parseSessionPayload(decoder.decode(payloadBytes), Math.floor(Date.now() / 1000))
  return payload ? { uid: payload.uid } : null
}
