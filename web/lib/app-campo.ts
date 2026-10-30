// La app de campo en la web (/campo, dueño 2026-10-30; docs/decisiones/2026-10-30-app-de-campo-en-la-web.md): la arma
// scripts/construir-campo.mjs en public/campo y no es una página de Next. La usan el middleware (página pública: sin
// datos; los datos van por /api/* con sesión o token) y el menú (la abre como página completa, con <a>).
// Puro: también lo importa el cliente.

/** ¿La ruta es de la app de campo (/campo o algo dentro)? /campos no. */
export function esAppDeCampo(pathname: string): boolean {
  return pathname === '/campo' || pathname.startsWith('/campo/')
}

/**
 * Lo que la app guarda en el navegador para su sesión (mobile/lib/almacen.ts CLAVE_TOKEN y mobile/lib/sesion.ts
 * CLAVE_PERFIL). La web los olvida al cerrar e iniciar sesión, para que las dos sean un solo ingreso. La cola sin señal de
 * la app (sus visitas por enviar) NO está aquí: se queda y se envía cuando vuelva a entrar.
 */
export const CLAVES_SESION_APP_CAMPO = ['opmap.token.v1', 'opmap.perfil.v1'] as const

/** Olvida la sesión guardada de la app de campo en este navegador (nunca lanza). */
export function olvidarSesionAppCampo(almacen: Pick<Storage, 'removeItem'> | null | undefined): void {
  if (!almacen) return
  for (const clave of CLAVES_SESION_APP_CAMPO) {
    try {
      almacen.removeItem(clave)
    } catch {
      // sin almacenamiento (modo privado): no hay nada que olvidar
    }
  }
}
