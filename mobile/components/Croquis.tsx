/**
 * Croquis de arriba de Hoy y Reportar (estilo Uber, 2026-10-15): tu punto con su precisión, las sedes cercanas y el
 * radio presencial de la sede que importa, a escala (lib/croquis.ts). No es un mapa de calles: sin Google, sin llaves
 * y sin módulos nativos (corre igual en Expo Go, compilada y en el navegador). Las manzanas del fondo son decorativas.
 *
 * Va como PRIMER hijo de <Pantalla> en una pantalla sin encabezado: sube por detrás de la hora y la batería (recupera
 * el margen de arriba que deja Pantalla) y ocupa todo el ancho. Después va <BordeHoja />: lo que sigue queda en la hoja.
 *
 * Revisión 2026-10-15: "Estás aquí" ya no se sale del croquis ni tapa el logotipo (posicionEtiquetaYo) y el croquis
 * mide 120 pt en pantallas de menos de 700 (altoCroquis); Reportar ya no lo agranda al elegir.
 */
import { useState, type ReactNode } from 'react'
import { Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ALTO_ETIQUETA_CROQUIS,
  ANCHO_NOMBRE_SEDE,
  BORDE_ETIQUETA,
  SEPARACION_ETIQUETA,
  altoCroquis,
  cajaNombreSede,
  descripcionCroquis,
  etiquetaSedeArriba,
  izquierdaNombreSede,
  planCroquis,
  posicionEtiquetaYo,
  type SedeCroquis,
} from '../lib/croquis'
import { textoDistancia, type Punto } from '../lib/geo'
import { MAPA_CLARO, MAPA_OSCURO } from '../lib/paleta'
import { useEsquema } from '../lib/tema-preferencia'
import { SOMBRA, TAMANO, useColores, useFuente, useMargenArribaPantalla } from '../lib/ui'

interface Props {
  yo: (Punto & { precision?: number | null }) | null
  sedes: readonly SedeCroquis[]
  /** La sede de la cita elegida o de la siguiente (con su radio); si no, la más cercana. */
  foco: string | null
  radioM: number | null
  /** Alto visible debajo de la hora y la batería (pt); sin él, 170 (120 en una pantalla de menos de 700 pt). */
  alto?: number
  /** "Estás aquí · ±12 m". */
  etiquetaYo?: string | null
  /** Encima del croquis, arriba a la izquierda (el logotipo en Hoy). */
  arribaIzquierda?: ReactNode
}

/** Manzanas decorativas: 70 × 50 cada 80 × 60, corridas como en los artboards. */
const MANZANA = { ancho: 70, alto: 50, pasoX: 80, pasoY: 60, desdeX: -26, desdeY: -18 } as const
/** Lo que el croquis deja para la hoja que sube encima (no se dibuja nada importante ahí). */
const BAJO_LA_HOJA = 20

/** Lo que se calcula que mide "Estás aquí · ±12 m" antes de medirla (13 pt en negrita, 10 de relleno a cada lado). */
const anchoEstimado = (texto: string) => Math.ceil(texto.length * 7.4) + 20
/** El logotipo de arriba a la izquierda (left 16, top 8) antes de medirlo: la pastilla de Hoy (82 + 2 × 12) × 40. */
const LOGO_ESTIMADO = { ancho: 106, alto: 40 }

export function Croquis({ yo, sedes, foco, radioM, alto: altoPedido, etiquetaYo, arribaIzquierda }: Props) {
  const c = useColores()
  const fuente = useFuente()
  const oscuro = useEsquema() === 'dark'
  const mapa = oscuro ? MAPA_OSCURO : MAPA_CLARO
  const { width: ancho, height: altoVentana } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const margenArriba = useMargenArribaPantalla()
  // Lo que miden de verdad la etiqueta de tu punto, el nombre de la sede y el logotipo (onLayout); antes, lo estimado.
  const [anchoYo, setAnchoYo] = useState<number | null>(null)
  const [anchoNombre, setAnchoNombre] = useState<number | null>(null)
  const [logo, setLogo] = useState<{ ancho: number; alto: number } | null>(null)
  const alto = altoPedido ?? altoCroquis(altoVentana)
  const arriba = insets.top
  const altoTotal = arriba + alto + BAJO_LA_HOJA
  // El dibujo útil: debajo de la hora y encima de la hoja.
  const plan = planCroquis({ yo, sedes, foco, radioM, ancho, alto })
  const desplazar = (y: number) => y + arriba
  const sedeArriba = plan ? etiquetaSedeArriba(plan) : true
  // "Estás aquí": dentro del croquis y sin tapar la sede, su nombre ni el logotipo (lib/croquis.ts).
  const cajaLogo = arribaIzquierda ? { x: 16, y: 8, ...(logo ?? LOGO_ESTIMADO) } : null
  const posicionYo =
    plan && etiquetaYo
      ? posicionEtiquetaYo(plan, { ancho, alto, anchoEtiqueta: anchoYo ?? anchoEstimado(etiquetaYo), evitar: [cajaLogo, cajaNombreSede(plan, ancho, anchoNombre ?? ANCHO_NOMBRE_SEDE)] })
      : null

  const manzanas: ReactNode[] = []
  for (let y = MANZANA.desdeY; y < altoTotal; y += MANZANA.pasoY) {
    for (let x = MANZANA.desdeX; x < ancho; x += MANZANA.pasoX) {
      manzanas.push(<View key={`${x}:${y}`} style={{ position: 'absolute', left: x, top: y, width: MANZANA.ancho, height: MANZANA.alto, borderRadius: 3, backgroundColor: mapa.manzana }} />)
    }
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={descripcionCroquis(plan, textoDistancia)}
      style={{ marginTop: -margenArriba, marginHorizontal: -TAMANO.espacio, height: altoTotal, overflow: 'hidden', backgroundColor: mapa.suelo }}
    >
      {manzanas}

      {plan?.radio ? (
        <>
          <View
            style={{
              position: 'absolute',
              left: plan.radio.x - plan.radio.r,
              top: desplazar(plan.radio.y) - plan.radio.r,
              width: plan.radio.r * 2,
              height: plan.radio.r * 2,
              borderRadius: plan.radio.r,
              backgroundColor: c.exito,
              opacity: 0.08,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: plan.radio.x - plan.radio.r,
              top: desplazar(plan.radio.y) - plan.radio.r,
              width: plan.radio.r * 2,
              height: plan.radio.r * 2,
              borderRadius: plan.radio.r,
              borderWidth: 1.5,
              borderColor: c.exito,
            }}
          />
        </>
      ) : null}

      {plan?.sedes.map(sede => {
        const lado = sede.foco ? 14 : 10
        return (
          <View
            key={sede.id}
            style={{
              position: 'absolute',
              left: sede.x - lado / 2,
              top: desplazar(sede.y) - lado / 2,
              width: lado,
              height: lado,
              borderRadius: 2,
              backgroundColor: sede.foco ? c.acento : c.textoSuave,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: sede.foco ? 4 : 3, height: sede.foco ? 4 : 3, backgroundColor: mapa.suelo }} />
          </View>
        )
      })}

      {plan?.yo ? (
        <>
          <View
            style={{
              position: 'absolute',
              left: plan.yo.x - plan.yo.halo,
              top: desplazar(plan.yo.y) - plan.yo.halo,
              width: plan.yo.halo * 2,
              height: plan.yo.halo * 2,
              borderRadius: plan.yo.halo,
              backgroundColor: c.acento,
              opacity: 0.1,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: plan.yo.x - 8,
              top: desplazar(plan.yo.y) - 8,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: mapa.suelo,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: SOMBRA.flotante,
            }}
          >
            <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: c.acento }} />
          </View>
        </>
      ) : null}

      {/* Nombre de la sede del foco, encima de su marca. */}
      {plan?.sedes
        .filter(s => s.foco)
        .map(s => (
          <View
            key={`nombre-${s.id}`}
            style={{
              position: 'absolute',
              left: izquierdaNombreSede(s.x, ancho),
              top: sedeArriba ? desplazar(s.y) - SEPARACION_ETIQUETA - ALTO_ETIQUETA_CROQUIS : desplazar(s.y) + SEPARACION_ETIQUETA,
              width: ANCHO_NOMBRE_SEDE,
              alignItems: 'center',
            }}
          >
            <View
              onLayout={e => setAnchoNombre(e.nativeEvent.layout.width)}
              style={{ maxWidth: ANCHO_NOMBRE_SEDE, paddingHorizontal: 10, height: ALTO_ETIQUETA_CROQUIS, borderRadius: 6, justifyContent: 'center', backgroundColor: c.superficie, boxShadow: SOMBRA.flotante }}
            >
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[{ color: c.texto, fontSize: 13, lineHeight: 16 }, fuente('negrita')]}>
                {s.nombre}
              </Text>
            </View>
          </View>
        ))}

      {/* "Estás aquí · ±12 m" junto a tu punto (del lado que no tapa la sede) o, si ahí no cabe, encima, debajo o en
          diagonal. Se mueve con translateX y no con left: así su ancho es el natural (onLayout) y no el que le deja el
          borde. */}
      {posicionYo && etiquetaYo ? (
        <View
          onLayout={e => setAnchoYo(e.nativeEvent.layout.width)}
          style={{
            position: 'absolute',
            left: 0,
            top: desplazar(posicionYo.y),
            maxWidth: ancho - 2 * BORDE_ETIQUETA,
            transform: [{ translateX: posicionYo.x }],
            height: ALTO_ETIQUETA_CROQUIS,
            paddingHorizontal: 10,
            borderRadius: 6,
            justifyContent: 'center',
            backgroundColor: c.acento,
          }}
        >
          <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[{ color: c.sobreAcento, fontSize: 13, lineHeight: 16 }, fuente('negrita')]}>
            {etiquetaYo}
          </Text>
        </View>
      ) : null}

      {arribaIzquierda ? (
        <View onLayout={e => setLogo({ ancho: e.nativeEvent.layout.width, alto: e.nativeEvent.layout.height })} style={{ position: 'absolute', top: arriba + 8, left: 16 }}>
          {arribaIzquierda}
        </View>
      ) : null}
    </View>
  )
}

/** El logotipo en una pastilla blanca con sombra, sobre el croquis (Hoy). */
export function PastillaLogo({ children }: { children: ReactNode }) {
  const c = useColores()
  return <View style={{ height: 40, paddingHorizontal: 12, borderRadius: TAMANO.radio, justifyContent: 'center', backgroundColor: c.superficie, boxShadow: SOMBRA.flotante }}>{children}</View>
}
