/**
 * Paso 1 de Reportar: las sedes a menos de 1 km (también en el croquis de arriba), la más cercana arriba, con su
 * distancia y si está dentro del radio para la visita presencial. Tocar una la deja elegida para las visitas que se
 * reporten. Estilo Uber (2026-10-15): filas con separador fino; la elegida, con borde negro y "✓".
 */
import { Pressable, View } from 'react-native'
import { sinCortes } from '../../lib/reglas'
import { textoDistancia } from '../../lib/geo'
import type { SedeOpcion } from '../../lib/propuesta'
import { etiquetaClaseCuenta } from '../../lib/terceros'
import { FilaLista, Grupo, Insignia, TAMANO, Texto, Vacio, useColores } from '../../lib/ui'

interface Props {
  sedes: readonly SedeOpcion[]
  radioM: number
  elegida: string | null
  alElegir: (id: string | null) => void
  max?: number
  /** Texto si no hay sedes (p. ej. sin ubicación). */
  vacio?: string
}

export function ListaSedes({ sedes, radioM, elegida, alElegir, max = 12, vacio = 'No hay sedes de OpMap a menos de 1 km de aquí.' }: Props) {
  const c = useColores()
  const ordenadas = [...sedes].sort((a, b) => (a.distancia_m ?? Infinity) - (b.distancia_m ?? Infinity)).slice(0, max)
  if (ordenadas.length === 0) return <Vacio texto={vacio} />
  return (
    <View>
      {ordenadas.map((sede, i) => {
        const dentro = sede.distancia_m !== null && sede.distancia_m <= radioM
        const activa = sede.id === elegida
        const etiqueta = `${sede.nombre}${sede.distancia_m !== null ? `, a ${textoDistancia(sede.distancia_m)}` : ''}`
        const contenido = (
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Texto negrita={activa} media={!activa} estilo={{ flexShrink: 1 }}>
                {activa ? '✓ ' : ''}
                {sede.nombre}
              </Texto>
              {sede.distancia_m !== null ? <Texto negrita peque>{sinCortes(textoDistancia(sede.distancia_m))}</Texto> : null}
            </View>
            {sede.cuenta_nombre && sede.cuenta_nombre !== sede.nombre ? (
              <Texto suave peque>
                {sede.cuenta_nombre}
                {sede.cuenta_clase ? ` · ${etiquetaClaseCuenta(sede.cuenta_clase)}` : ''}
              </Texto>
            ) : null}
            <Grupo estilo={{ marginTop: 4 }}>
              <Insignia texto={dentro ? 'Dentro del radio' : `Fuera del radio (${sinCortes(textoDistancia(radioM))})`} tono={dentro ? 'exito' : 'alerta'} />
              {sede.ubicacion_confirmada === false ? <Insignia texto="Ubicación sin confirmar" tono="neutro" /> : null}
            </Grupo>
          </View>
        )
        if (activa) {
          return (
            <Pressable
              key={sede.id}
              accessibilityRole="button"
              accessibilityLabel={etiqueta}
              accessibilityState={{ selected: true }}
              onPress={() => alElegir(null)}
              style={({ pressed }) => ({ padding: 14, borderRadius: TAMANO.radioTarjeta, borderWidth: 2, borderColor: c.acento, backgroundColor: c.superficie, opacity: pressed ? 0.7 : 1 })}
            >
              {contenido}
            </Pressable>
          )
        }
        return (
          <FilaLista key={sede.id} primera={i === 0} alPresionar={() => alElegir(sede.id)} etiquetaAccesible={etiqueta}>
            {contenido}
          </FilaLista>
        )
      })}
    </View>
  )
}
