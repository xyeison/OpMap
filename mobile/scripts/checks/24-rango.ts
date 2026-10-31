/**
 * La pastilla "En rango / Fuera de rango" del croquis y el croquis en "Revisa la visita" (dueño, 2026-10-31; spec
 * docs/specs/2026-10-31-reportar-croquis-en-rango.md): las reglas puras de lib/rango-sede.ts y lo que Reportar y
 * Croquis.tsx tienen que hacer (se lee su archivo). Corren en Node, sin React Native ni red. Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 24-rango
 */
import { dentroDelRadioConPrecision, estadoDeRango, rangoDeSede } from '../../lib/rango-sede'
import type { Probador } from './probador'

// Corre en Node (tsx) con el programa de tipos de la app (sin @types/node): fs y path con lo mínimo que se usa.
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

export async function pruebas(t: Probador): Promise<void> {
  t.seccion('24. En rango / fuera de rango (lib/rango-sede.ts)')
  const RADIO = 300
  const YO = { lat: 11.0121, lng: -74.8669, precision: 10 }

  t.check('dentro del radio descontando la precisión: 250 m ±10 → sí; 305 m ±10 → sí; 305 m ±0 → no; 311 m ±10 → no', dentroDelRadioConPrecision(250, 10, RADIO) && dentroDelRadioConPrecision(305, 10, RADIO) && !dentroDelRadioConPrecision(305, 0, RADIO) && !dentroDelRadioConPrecision(311, 10, RADIO))
  t.check('la precisión se redondea a metros enteros como el servidor (0940): 310,4 m con ±10,4 → fuera (300,4 > 300); con ±10,6 → dentro', !dentroDelRadioConPrecision(310.4, 10.4, RADIO) && dentroDelRadioConPrecision(310.4, 10.6, RADIO))
  t.check('precisión rara (null, NaN, negativa) no descuenta nada', dentroDelRadioConPrecision(300, null, RADIO) && !dentroDelRadioConPrecision(301, NaN, RADIO) && !dentroDelRadioConPrecision(301, -50, RADIO))

  const enRango = estadoDeRango({ punto: YO, distanciaM: 250, conocida: true, radioM: RADIO })
  t.check('a 250 m → verde "En rango"', enRango?.clase === 'en_rango' && enRango.tono === 'exito' && enRango.texto === 'En rango', enRango)
  const justo = estadoDeRango({ punto: YO, distanciaM: 305, conocida: true, radioM: RADIO })
  t.check('a 305 m con ±10 m → "En rango" (la misma cuenta que el servidor, 0940)', justo?.clase === 'en_rango', justo)
  const fuera = estadoDeRango({ punto: YO, distanciaM: 4800, conocida: true, radioM: RADIO })
  t.check('a 4,8 km → roja "Fuera de rango · 4,8 km"', fuera?.clase === 'fuera' && fuera.tono === 'peligro' && fuera.texto === 'Fuera de rango · 4,8 km', fuera)
  const cerca = estadoDeRango({ punto: YO, distanciaM: 730, conocida: true, radioM: RADIO })
  t.check('a 730 m → "Fuera de rango · 730 m"', cerca?.texto === 'Fuera de rango · 730 m', cerca)
  const sinPunto = estadoDeRango({ punto: null, distanciaM: null, conocida: true, radioM: RADIO })
  t.check('sin el punto del teléfono → gris "Sin ubicación"', sinPunto?.clase === 'sin_ubicacion' && sinPunto.tono === 'neutro' && sinPunto.texto === 'Sin ubicación', sinPunto)
  const sedeSin = estadoDeRango({ punto: YO, distanciaM: null, conocida: true, radioM: RADIO })
  t.check('la sede sin coordenadas → gris "Sede sin ubicación"', sedeSin?.clase === 'sede_sin_ubicacion' && sedeSin.texto === 'Sede sin ubicación', sedeSin)
  t.check('distancia que calcula el servidor (no conocida) → nada', estadoDeRango({ punto: YO, distanciaM: null, conocida: false, radioM: RADIO }) === null)
  t.check('visita telefónica → nada, aunque esté lejos', estadoDeRango({ punto: YO, distanciaM: 4800, conocida: true, radioM: RADIO, telefonica: true }) === null)

  t.seccion('24b. rangoDeSede: contra la sede de la cita o la elegida')
  const PORTO = { lat: 11.0116, lng: -74.8669 }
  t.check('sede a ~55 m → "En rango"', rangoDeSede(PORTO, YO, RADIO)?.clase === 'en_rango')
  t.check('sede a 6,6 km → "Fuera de rango · 6,6 km"', rangoDeSede({ lat: 11.004, lng: -74.807 }, YO, RADIO)?.texto === 'Fuera de rango · 6,6 km')
  t.check('sede sin coordenadas (se sabe) → "Sede sin ubicación"; con coordenadas desconocidas → nada; sin sede → nada', rangoDeSede({ lat: null, lng: null }, YO, RADIO)?.clase === 'sede_sin_ubicacion' && rangoDeSede({ lat: null, lng: null, coordenadas_desconocidas: true }, YO, RADIO) === null && rangoDeSede(null, YO, RADIO) === null)
  t.check('sin punto → "Sin ubicación" (antes que cualquier otra cosa)', rangoDeSede(PORTO, null, RADIO)?.clase === 'sin_ubicacion')

  t.seccion('24c. Reportar y Croquis.tsx (se lee el archivo)')
  const reportar = leer('app/(app)/reportar.tsx')
  const croquis = leer('components/Croquis.tsx')
  t.check('Reportar pinta el croquis también con tarjetas ("Revisa la visita"), no solo mientras se elige', /const conCroquis = fase === 'lista' \|\| \(fase === 'tarjetas' && borradores\.length > 0\)/.test(reportar) && /\{conCroquis \? \(\s*<Croquis/.test(reportar) && /\{conCroquis \? <BordeHoja \/> : null\}/.test(reportar) && !/\{fase === 'lista' \? \(\s*<Croquis/.test(reportar))
  t.check('el foco del croquis: la cita o la sede elegida; con tarjetas, la sede de la primera abierta', /const sedeDelCroquis = fase === 'tarjetas' \? \(primeraAbierta\?\.sede_id \?\? null\) : \(cita\?\.sede\.id \?\? sede\?\.id \?\? null\)/.test(reportar) && /foco=\{sedeDelCroquis\}/.test(reportar))
  t.check('con tarjetas entran también las sedes de los médicos (la de la tarjeta puede ser una de ellas)', /fase === 'tarjetas' \? catalogo\.medicos\.flatMap\(m => m\.sedes\.map\(/.test(reportar) && /sedes=\{sedesDelCroquis\}/.test(reportar))
  t.check('la pastilla: con tarjetas por distanciaASede + estadoDeRango (telefónica sin pastilla); en lista por rangoDeSede', /estadoDeRango\(\{ punto, distanciaM: distancia\.distancia_m, conocida: distancia\.conocida, radioM, telefonica: primeraAbierta\.modalidad === 'telefonica' \}\)/.test(reportar) && /if \(!primeraAbierta\.sede_id\) return null/.test(reportar) && /rangoDeSede\(cita\?\.sede \?\? sede \?\? null, punto, radioM\)/.test(reportar) && /arribaDerecha=\{rango \? <PastillaRango tono=\{rango\.tono\} texto=\{rango\.texto\} \/> : undefined\}/.test(reportar))
  t.check('Croquis.tsx: la pastilla va arriba a la derecha, con bolita de color, y "Estás aquí" la evita', /export function PastillaRango\(/.test(croquis) && /top: arriba \+ 8, right: 16/.test(croquis) && /const encima = \[cajaLogo, cajaDerecha\]/.test(croquis) && /etiquetaSedeArriba\(plan, anchoNombre \?\? ANCHO_NOMBRE_SEDE, encima, ancho\)/.test(croquis) && /tono === 'exito' \? c\.exito : tono === 'peligro' \? c\.peligro : c\.textoSuave/.test(croquis))
  t.check('Croquis.tsx: la etiqueta de tu punto pasa por etiquetaYoDelPlan ("Estás a 4,8 km" con la sede lejos)', /const etiqueta = etiquetaYoDelPlan\(plan, etiquetaYo \?\? null, textoDistancia\)/.test(croquis) && /\{posicionYo && etiqueta \? \(/.test(croquis))
}
