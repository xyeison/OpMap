/**
 * Geocodificación de la dirección del consultorio (decisión 2026-10-31, spec
 * docs/specs/2026-10-31-consultorio-direccion-geocodificada.md): pruebas puras, SIN red ni Google (fetch falso).
 *   npx tsx scripts/geocode-check.ts
 */
import {
  COSTO_GEOCODIFICACION_USD,
  RADIO_MAXIMO_KM,
  distanciaKm,
  evaluarGeocodificacion,
  geocodificarDireccion,
  textoGeocodificacion,
  urlGeocodificar,
  type RespuestaGeocode,
} from '../lib/google-geocode'
import type { FetchLike } from '../lib/google-distance'

let total = 0
let fallas = 0
function check(nombre: string, ok: boolean, detalle?: unknown) {
  total++
  if (ok) console.log(`  ok    ${nombre}`)
  else {
    fallas++
    console.log(`  FALLA ${nombre}${detalle !== undefined ? ` → ${JSON.stringify(detalle)}` : ''}`)
  }
}

const BUCARAMANGA = { lat: 7.119349, lng: -73.122742 }
const respuesta = (location_type: string, lat = 7.13, lng = -73.12, extra: Partial<NonNullable<RespuestaGeocode['results']>[number]> = {}): RespuestaGeocode => ({
  status: 'OK',
  results: [{ geometry: { location: { lat, lng }, location_type }, formatted_address: 'Cra. 27 #45-12, Bucaramanga, Santander, Colombia', ...extra }],
})

async function main() {
  console.log('1. evaluarGeocodificacion: solo con certeza')
  {
    const ok = evaluarGeocodificacion(respuesta('ROOFTOP', 7.1234567, -73.1234567), BUCARAMANGA)
    check('ROOFTOP a 1 km del centro → ubicada, con 6 decimales y la dirección formateada', ok.ubicada && ok.lat === 7.123457 && ok.lng === -73.123457 && ok.location_type === 'ROOFTOP' && /Bucaramanga/.test(ok.formatted_address ?? ''), ok)
    check('RANGE_INTERPOLATED también vale', evaluarGeocodificacion(respuesta('RANGE_INTERPOLATED'), BUCARAMANGA).ubicada)
    const aproximado = evaluarGeocodificacion(respuesta('APPROXIMATE'), BUCARAMANGA)
    check('APPROXIMATE (la ciudad, el barrio) → sin certeza', !aproximado.ubicada && aproximado.motivo === 'sin_certeza', aproximado)
    const centroGeometrico = evaluarGeocodificacion(respuesta('GEOMETRIC_CENTER'), BUCARAMANGA)
    check('GEOMETRIC_CENTER (la calle entera) → sin certeza', !centroGeometrico.ubicada && centroGeometrico.motivo === 'sin_certeza')
    const parcial = evaluarGeocodificacion(respuesta('ROOFTOP', 7.13, -73.12, { partial_match: true }), BUCARAMANGA)
    check('partial_match (Google cambió parte de la dirección) → sin certeza aunque sea ROOFTOP', !parcial.ubicada && parcial.motivo === 'sin_certeza')
    const lejos = evaluarGeocodificacion(respuesta('ROOFTOP', 4.65, -74.1), BUCARAMANGA)
    check(`ROOFTOP pero a más de ${RADIO_MAXIMO_KM} km del centro del municipio (Bogotá para Bucaramanga) → lejos`, !lejos.ubicada && lejos.motivo === 'lejos' && distanciaKm(BUCARAMANGA, { lat: 4.65, lng: -74.1 }) > 290)
    const sinCentro = evaluarGeocodificacion(respuesta('ROOFTOP'), null)
    check('sin centro del municipio no se puede descartar un punto en otra ciudad: sin certeza', !sinCentro.ubicada && sinCentro.motivo === 'sin_certeza' && sinCentro.detalle === 'sin centro del municipio')
    const varios = evaluarGeocodificacion({ status: 'OK', results: [respuesta('ROOFTOP').results![0], respuesta('ROOFTOP', 7.06, -73.09).results![0]] }, BUCARAMANGA)
    check('varios resultados (dirección ambigua entre municipios vecinos) → sin certeza aunque el primero sea ROOFTOP', !varios.ubicada && varios.motivo === 'sin_certeza' && varios.detalle === 'varios resultados')
    const cero = evaluarGeocodificacion({ status: 'ZERO_RESULTS', results: [] }, BUCARAMANGA)
    check('ZERO_RESULTS → sin_resultado', !cero.ubicada && cero.motivo === 'sin_resultado')
    const denegada = evaluarGeocodificacion({ status: 'REQUEST_DENIED', error_message: 'clave' }, BUCARAMANGA)
    check('REQUEST_DENIED u otro estado → error con el estado', !denegada.ubicada && denegada.motivo === 'error' && denegada.detalle === 'REQUEST_DENIED')
    const sinCoordenadas = evaluarGeocodificacion({ status: 'OK', results: [{ geometry: { location_type: 'ROOFTOP' } }] }, BUCARAMANGA)
    check('OK sin coordenadas utilizables → sin_resultado (nunca se inventa un punto)', !sinCoordenadas.ubicada && sinCoordenadas.motivo === 'sin_resultado')
    check('el radio es 40 km y el costo de referencia 0,005 USD por petición', RADIO_MAXIMO_KM === 40 && COSTO_GEOCODIFICACION_USD === 0.005)
  }

  console.log('\n2. urlGeocodificar: dirección + municipio + departamento, Colombia, en español, sin clave')
  {
    const url = urlGeocodificar({ direccion: ' Cra 27 # 45-12 ', municipio: 'Bucaramanga', departamento: 'Santander', centro: null })
    check('address = "dirección, municipio, departamento, Colombia"; components=country:CO; region=co; language=es', url.searchParams.get('address') === 'Cra 27 # 45-12, Bucaramanga, Santander, Colombia' && url.searchParams.get('components') === 'country:CO' && url.searchParams.get('region') === 'co' && url.searchParams.get('language') === 'es' && !url.searchParams.has('key'), url.toString())
    const sinDepto = urlGeocodificar({ direccion: 'Calle 1', municipio: 'Bogotá D.C.', departamento: null, centro: null })
    check('sin departamento no deja un hueco', sinDepto.searchParams.get('address') === 'Calle 1, Bogotá D.C., Colombia')
  }

  console.log('\n3. geocodificarDireccion: nunca lanza; sin Google, "sin ubicar"')
  {
    const llamadas: string[] = []
    const fetchFalso = (cuerpo: unknown, ok = true, status = 200): FetchLike => async url => {
      llamadas.push(url)
      return { ok, status, json: async () => cuerpo }
    }
    const entrada = { direccion: 'Cra 27 # 45-12', municipio: 'Bucaramanga', departamento: 'Santander', centro: BUCARAMANGA }
    const guardado = process.env.GOOGLE_ROUTES_DISABLED
    process.env.GOOGLE_ROUTES_DISABLED = 'true'
    const apagado = await geocodificarDireccion(entrada, { apiKey: 'k', fetchImpl: fetchFalso(respuesta('ROOFTOP')) })
    check('GOOGLE_ROUTES_DISABLED=true → deshabilitado y NINGUNA petición', !apagado.ubicada && apagado.motivo === 'deshabilitado' && llamadas.length === 0)
    process.env.GOOGLE_ROUTES_DISABLED = 'false'
    const sinClave = await geocodificarDireccion(entrada, { apiKey: '', fetchImpl: fetchFalso(respuesta('ROOFTOP')) })
    check('sin clave → sin_clave y ninguna petición', !sinClave.ubicada && sinClave.motivo === 'sin_clave' && llamadas.length === 0)
    const ubicada = await geocodificarDireccion(entrada, { apiKey: 'clave-de-prueba', fetchImpl: fetchFalso(respuesta('ROOFTOP', 7.125, -73.121)) })
    check('con Google (falso): una petición con la clave en la URL y el resultado evaluado', ubicada.ubicada && ubicada.lat === 7.125 && llamadas.length === 1 && /key=clave-de-prueba/.test(llamadas[0]) && /address=Cra\+27/.test(llamadas[0]), ubicada)
    const http = await geocodificarDireccion(entrada, { apiKey: 'k', fetchImpl: fetchFalso({}, false, 500) })
    check('HTTP 500 → error HTTP_500, sin lanzar', !http.ubicada && http.motivo === 'error' && http.detalle === 'HTTP_500')
    const red = await geocodificarDireccion(entrada, { apiKey: 'k', fetchImpl: async () => { throw new TypeError('fetch failed') } })
    check('error de red → error, sin lanzar', !red.ubicada && red.motivo === 'error' && red.detalle === 'TypeError')
    const vacia = await geocodificarDireccion({ ...entrada, direccion: '  ' }, { apiKey: 'k', fetchImpl: fetchFalso(respuesta('ROOFTOP')) })
    check('dirección vacía → sin_resultado y ninguna petición', !vacia.ubicada && vacia.motivo === 'sin_resultado' && llamadas.length === 2)
    if (guardado === undefined) delete process.env.GOOGLE_ROUTES_DISABLED
    else process.env.GOOGLE_ROUTES_DISABLED = guardado
  }

  console.log('\n4. Textos')
  {
    check('ubicada: lo dice y que el equipo de datos la confirma', /ubicado por su dirección/.test(textoGeocodificacion({ ubicada: true, lat: 1, lng: 1, location_type: 'ROOFTOP', formatted_address: null })) && /confirma/.test(textoGeocodificacion({ ubicada: true, lat: 1, lng: 1, location_type: 'ROOFTOP', formatted_address: null })))
    check('sin certeza o lejos: "no encontré esa dirección con certeza… sin ubicar"', /con certeza/.test(textoGeocodificacion({ ubicada: false, motivo: 'sin_certeza' })) && /sin ubicar/.test(textoGeocodificacion({ ubicada: false, motivo: 'lejos' })))
    check('deshabilitado o error: "no pude ubicar la dirección ahora"', /ahora/.test(textoGeocodificacion({ ubicada: false, motivo: 'deshabilitado' })) && /ahora/.test(textoGeocodificacion({ ubicada: false, motivo: 'error' })))
  }

  console.log(`\n${total - fallas} pruebas bien, ${fallas} con falla`)
  if (fallas > 0) process.exit(1)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
