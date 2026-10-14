/**
 * Las pantallas de detalle (Nuevo médico, Nueva sede, Visita) son pestañas ocultas de expo-router: el navegador de
 * pestañas NO las desmonta al salir y, al volver a abrirlas (aunque sea para otra tarjeta u otra visita), reusa la
 * misma instancia con su estado viejo: el pedido, el GPS, el formulario, "Visita anulada"… SoloEnFoco monta la
 * pantalla solo mientras tiene el foco: al salir se desmonta y al volver empieza de cero (lee el pedido nuevo, toma
 * el GPS otra vez). `clave` (p. ej. el id de la visita) también la vuelve a montar si cambia estando abierta.
 */
import { useIsFocused } from 'expo-router'
import { Fragment, type ReactNode } from 'react'

export function SoloEnFoco({ children, clave }: { children: ReactNode; clave?: string }) {
  const enfocada = useIsFocused()
  if (!enfocada) return null
  return <Fragment key={clave ?? 'pantalla'}>{children}</Fragment>
}
