/**
 * Paso 1 de Reportar: las sedes a menos de 1 km (sin mapa), la más cercana arriba, con su distancia y si está dentro
 * del radio para la visita presencial. Tocar una la deja elegida para las visitas que se reporten.
 */
import { View } from 'react-native'
import { sinCortes } from '../../lib/reglas'
import { textoDistancia } from '../../lib/geo'
import type { SedeOpcion } from '../../lib/propuesta'
import { etiquetaClaseCuenta } from '../../lib/terceros'
import { Grupo, Insignia, Tarjeta, Texto, Vacio } from '../../lib/ui'

interface Props {
  sedes: readonly SedeOpcion[]
  radioM: number
  elegida: string | null
  alElegir: (id: string | null) => void
  max?: number
}

export function ListaSedes({ sedes, radioM, elegida, alElegir, max = 12 }: Props) {
  const ordenadas = [...sedes].sort((a, b) => (a.distancia_m ?? Infinity) - (b.distancia_m ?? Infinity)).slice(0, max)
  if (ordenadas.length === 0) return <Vacio texto="No hay sedes de OpMap a menos de 1 km de aquí." />
  return (
    <View style={{ gap: 8 }}>
      {ordenadas.map(sede => {
        const dentro = sede.distancia_m !== null && sede.distancia_m <= radioM
        const activa = sede.id === elegida
        return (
          <Tarjeta
            key={sede.id}
            alPresionar={() => alElegir(activa ? null : sede.id)}
            etiquetaAccesible={`${sede.nombre}${sede.distancia_m !== null ? `, a ${textoDistancia(sede.distancia_m)}` : ''}`}
            estilo={{ padding: 12, borderWidth: activa ? 2.5 : undefined }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Texto negrita estilo={{ flexShrink: 1 }}>
                {activa ? '✓ ' : ''}
                {sede.nombre}
              </Texto>
              {sede.distancia_m !== null ? <Texto negrita>{sinCortes(textoDistancia(sede.distancia_m))}</Texto> : null}
            </View>
            {sede.cuenta_nombre && sede.cuenta_nombre !== sede.nombre ? (
              <Texto suave peque>
                {sede.cuenta_nombre}
                {sede.cuenta_clase ? ` · ${etiquetaClaseCuenta(sede.cuenta_clase)}` : ''}
              </Texto>
            ) : null}
            <Grupo>
              <Insignia texto={dentro ? 'Dentro del radio' : `Fuera del radio (${sinCortes(textoDistancia(radioM))})`} tono={dentro ? 'exito' : 'alerta'} />
              {sede.ubicacion_confirmada === false ? <Insignia texto="Ubicación sin confirmar" tono="neutro" /> : null}
            </Grupo>
          </Tarjeta>
        )
      })}
    </View>
  )
}
