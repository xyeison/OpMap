/**
 * PR 7 · Pruebas puras de la carga de SECOP (sin red ni base de datos).
 *
 * Cubre: normalizeNit (9 dígitos desde las formas que publica SECOP), DV y variantes, persona natural,
 * classifyLinea con objetos REALES de SECOP II y del Integrado (copiados de datos.gov.co el 2026-10-11),
 * que el prefiltro SoQL sea un superconjunto de la clasificación, detectEspecialidad, esAtipico, mapeo de
 * filas literales de los dos datasets, regla de alcance, URLs SoQL, cursor incremental, hash de documento
 * y la próxima ejecución de una expresión cron.
 *
 * Uso (desde web/): npx tsx scripts/secop-check.ts      Código de salida 1 si alguna prueba falla.
 */
import {
  ATIPICO_MIN_CONTRATOS,
  SECOP_PREFILTRO_RAICES,
  VALOR_ATIPICO_COP,
  buildSecopTareas,
  buildSecopUrl,
  cerrarPasada,
  clasificarContrato,
  classifyLinea,
  cursorVacio,
  decidirAlcance,
  detectEspecialidad,
  esAtipico,
  esDocumentoPersona,
  huellaTareas,
  iniciarPasada,
  mapSecopRow,
  nitsNuevos,
  normalizeNit,
  parseSecopCursor,
  pasaPrefiltro,
  pasadaTerminada,
  percentilContinuo,
  registrarPagina,
  restarDias,
  toIsoDate,
  toMoney,
  variantesNit,
  watermarkDeFila,
  type SecopContratoRow,
  type SecopLinea,
} from '../lib/secop'
import { hashDocumento } from '../lib/secop-hash'
import { nextCronRun, parseCronExpression } from '../lib/fuentes-estado'
import { extraerZipsCifras } from '../lib/cifras-sync'
import { buildRepsSedesUrl } from '../lib/reps-sedes-sync'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FALLA ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`)
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  check(name, a === e, a === e ? undefined : { actual, expected })
}

// ---------------------------------------------------------------------------------------------
console.log('\nNIT')
eq('9 dígitos tal cual', normalizeNit('900294380'), '900294380')
eq('10 dígitos con DV pegado', normalizeNit('9002943801'), '900294380')
eq('con puntos y guion', normalizeNit('900.294.380-1'), '900294380')
eq('DV separado por espacio', normalizeNit('900294380 1'), '900294380')
eq('puntos y guion con espacios', normalizeNit('860.529.890 - 0'), '860529890')
eq('separador raro (¿)', normalizeNit('830.035.101 ¿ 8'), '830035101')
eq('DV pegado tras puntos', normalizeNit('860.529.8900'), '860529890')
eq('dos documentos en la celda → el primero', normalizeNit('800.227.279-5 0819004841-7'), '800227279')
eq('puntos y punto antes del guion', normalizeNit('900.124.455.-5'), '900124455')
eq('número (SECOP II publica nit_entidad numérico)', normalizeNit(800006850), '800006850')
eq('cédula de 10 dígitos que empieza por 1 se queda igual', normalizeNit('1072195222'), '1072195222')
eq('cédula de 8 dígitos se queda igual', normalizeNit('80864049'), '80864049')
eq('vacío / NO DEFINIDO → null', [normalizeNit(''), normalizeNit('NO DEFINIDO'), normalizeNit(null), normalizeNit('12')], [null, null, null, null])
eq('DV DIAN y variantes (900294380 → DV 1)', variantesNit('900294380'), ['900294380', '9002943801', '900294380-1'])
eq('variantes de 800006850 (DV 3)', variantesNit('800006850'), ['800006850', '8000068503', '800006850-3'])
check('persona por tipo de documento', esDocumentoPersona('Cédula de Ciudadanía', '3093395') && esDocumentoPersona('Nit de Persona Natural', '808640491'))
check('NIT de persona natural (no empieza por 8/9) se trata como persona', esDocumentoPersona('NIT', '80864049'))
check('NIT jurídico no es persona', !esDocumentoPersona('NIT', '900294380') && !esDocumentoPersona('Nit de Persona Jurídica', '860.529.890-0'))
check('sin documento no es persona', !esDocumentoPersona('No Definido', 'NO DEFINIDO'))

// ---------------------------------------------------------------------------------------------
console.log('\nClasificación por línea (objetos reales de SECOP)')
const casos: Array<{ objeto: string; descripcion?: string; unspsc?: string; linea: SecopLinea; nota: string }> = [
  { objeto: 'MATERIAL DE OSTEOSINTESIS', linea: 'trauma', nota: 'SECOP I, Fusagasugá: osteosíntesis a secas' },
  { objeto: 'SUMINISTRO DE MATERIAL DE OSTEOSiNTESIS DE ORTOPEDIA\nPARA LA ATENCIoN INTRA HOSPITALARIA DE PACIENTES DE LA EMPRESA SOCIAL DEL ESTADO HOSPITAL SAN RAFAEL DE FUSAGASUGa.', linea: 'trauma', nota: 'SECOP I con tildes rotas' },
  { objeto: 'SUMINISTRO MATERIAL DE OSTEOSISTESIS; PARA LA ATENCION EN SALUD DE LOS USUARIOS DE LA EMPRESA SOCIAL DEL ESTADO HOSPITAL SAN ANTONIO DE PADUA.', linea: 'trauma', nota: 'error de digitación "osteosistesis"' },
  { objeto: 'SUMINISTRO DE MATERIAL DE OSTEOSÍNTESIS E INJERTOS ÓSEOS; PARA LAS ESPECIALIDADES DE ORTOPEDIA; CIRUGÍA DE TÓRAX; CIRUGÍA DE MANO; CIRUGÍA DE COLUMNA; CIRUGÍA MAXILOFACIAL', linea: 'trauma', nota: 'varias especialidades con ortopedia → trauma (con columna)' },
  { objeto: 'SUMINISTRO DE MATERIAL MEDICO QUIRURGICO Y ACCESORIOS DE OSTEOSINTESIS PARA LA REALIZACION DE LOS PROCEDIMIENTOS DE NEUROCIRUGIA; REALIZADOS EN EL SERVICIO DE CIRUGIA', linea: 'neurocirugia', nota: 'osteosíntesis para neurocirugía' },
  { objeto: 'Suministro de material de osteosíntesis para la atención quirúrgica de las diferentes patologías en la especialidad médica de ortopedia (artroscopia) que requieran los usuarios', linea: 'deportiva', nota: 'ortopedia (artroscopia)' },
  { objeto: 'SUMINISTRO DE MATERIAL DE OSTEOSINTESIS PARA LA ATENCIÓN QUIRÚRGICA DE LAS DIFERENTES PATOLOGÍAS EN LA ESPECIALIDAD MÉDICA DE ORTOPEDIA (TRAUMA) QUE REQUIERAN LOS USUARIOS', linea: 'trauma', nota: 'ortopedia (trauma)' },
  { objeto: 'SUMINISTRO DE MATERIALES DE OSTEOSÍNTESIS ESPECIALIZADOS PARA PROCEDIMIENTOS DE REEMPLAZOS ARTICULARES; QUE SON INDISPENSABLES PARA GARANTIZAR LA ATENCIÓN OPORTUNA', linea: 'reemplazo', nota: 'reemplazos articulares' },
  { objeto: 'SUMINISTRO DE MATERIAL DE OSTEOSINTESIS GENERAL; REEMPLAZOS PARCIALES Y TOTALES DE CADERA; RODILLA; OSTEOSINTESIS DE MANO; OSTEOSINTESIS MAXILOFACIAL; PRODUCTOS ESPECIALES DE ORTOPEDIA', linea: 'trauma', nota: 'osteosíntesis general + reemplazos → trauma' },
  { objeto: 'SUMINISTRAR MATERIAL DE OSTEOSINTESIS REEMPLAZOS ARTICULARES; MEDICINA DEPORTIVA; PARA LAS ESPECIALIDADES QUIRÚRGICAS QUE LO REQUIERAN', linea: 'trauma', nota: 'tres líneas con osteosíntesis → trauma' },
  { objeto: 'SUMINISTRO DE DISPOSITIVOS MÉDICO-QUIRÚRGICOS; PARA LAS ESPECIALIDADES DE ORTOPEDIA Y CIRUGÍA ARTROSCÓPICA; DENTRO DE LOS DIFERENTES PROCESOS', linea: 'deportiva', nota: 'cirugía artroscópica' },
  { objeto: 'SUMINISTRO DE ELEMENTOS DE OSTEOSINTESIS PARA LOS SERVICIOS DE ORTOPEDIA Y MAXILO FACIAL PARA LOS USUARIOS DEL SUBSISTEMA DE SALUD DE LA POLICÍA NACIONAL', linea: 'trauma', nota: 'osteosíntesis para servicios (no es servicio profesional)' },
  { objeto: 'CONTRATAR EL SUMINISTRO DE PRÓTESIS; ORTESIS; APARATOS ORTOPÉDICOS; DISPOSITIVOS DE APOYO TERAPÉUTICO Y DE REHABILITACIÓN', linea: 'otros_implantes', nota: 'ortopedia genérica' },
  { objeto: 'PRESTACIÓN DE SERVICIOS COMO MÉDICO ESPECIALISTA EN UROLOGÍA EN EL ÁREA ASISTENCIAL', linea: 'no_clasificado', nota: 'servicio de otra especialidad' },
  { objeto: 'PRESTACION DE SERVICIOS PROFESIONALES COMO MEDICO ESPECIALISTA EN ORTOPEDIA Y TRAUMATOLOGIA PARA LA ESE', linea: 'no_clasificado', nota: 'servicio profesional: va como especialidad, no como línea' },
  { objeto: 'SUMINISTRO DE INSUMOS Y DISPOSITIVOS MÉDICO QUIRÚRGICOS DE ACUERDO CON LA DESCRIPCIÓN DEL ANEXO TÉCNICO', unspsc: 'V1.42321500', linea: 'otros_implantes', nota: 'solo por UNSPSC 4232 (implantes ortopédicos)' },
  { objeto: 'SUMINISTRO DE INSTRUMENTAL QUIRÚRGICO DE LAPAROSCOPIA PARA LAS ESPECIALIDADES QUIRÚRGICAS', unspsc: 'V1.42294200', linea: 'no_clasificado', nota: 'UNSPSC 4229 no basta' },
  { objeto: 'EL SUMINISTRO DE DISPOSITIVOS MÉDICOS SOBRE MEDIDA PARA LA SALUD VISUAL Y OCULAR (LENTES OFTÁLMICOS Y LENTES DE CONTACTO)', unspsc: 'V1.42321500', linea: 'no_clasificado', nota: 'oftálmico excluido aunque el UNSPSC diga implantes' },
  { objeto: 'SUMINISTRO DE AGUJAS ESPINALES Y KITS DE ANESTESIA RAQUIDEA', linea: 'no_clasificado', nota: 'espinal de anestesia no es columna' },
  { objeto: 'SUMINISTRO DE ALIMENTOS PARA LOS PACIENTES DEL HOSPITAL SAN RAFAEL DE EL ESPINAL TOLIMA', linea: 'no_clasificado', nota: 'El Espinal (municipio) no es columna' },
  { objeto: 'SUMINISTRO DE MATERIAL DE OSTEOSINTESIS PARA EL HOSPITAL SAN RAFAEL DE EL ESPINAL', linea: 'trauma', nota: 'osteosíntesis en El Espinal → trauma, no columna' },
  { objeto: 'ADQUISICION DE SISTEMA DE FIJACION EXTERNA TIPO TUTOR PARA EL SERVICIO DE URGENCIAS', linea: 'trauma', nota: 'fijación externa' },
  { objeto: 'COMPRA DE CLAVOS ENDOMEDULARES BLOQUEADOS PARA FEMUR Y TIBIA', linea: 'trauma', nota: 'clavos endomedulares' },
  { objeto: 'SUMINISTRO DE MATERIAL PARA CIRUGÍA DE COLUMNA (TORNILLOS PEDICULARES, CAJAS INTERSOMÁTICAS)', linea: 'columna', nota: 'cirugía de columna' },
  { objeto: 'SUMINISTRO DE VÁLVULAS DE DERIVACIÓN VENTRÍCULO PERITONEAL Y MATERIAL DE NEUROCIRUGÍA', linea: 'neurocirugia', nota: 'válvulas de derivación' },
  { objeto: 'ALQUILER DE TORRE DE ARTROSCOPIA Y SUMINISTRO DE ANCLAJES BIOABSORBIBLES', linea: 'deportiva', nota: 'artroscopia y anclajes' },
  { objeto: 'MANTENIMIENTO Y REEMPLAZO TOTAL DE LUMINARIAS DEL HOSPITAL', linea: 'no_clasificado', nota: 'reemplazo sin articulación' },
  { objeto: 'SUMINISTRO DE MATERIALES DE FERRETERIA: CLAVOS, TORNILLOS, PLACAS Y PINTURA', linea: 'no_clasificado', nota: 'ferretería' },
  { objeto: 'SUMINISTRO DE IMPLANTES DENTALES Y MATERIAL DE ODONTOLOGIA', linea: 'no_clasificado', nota: 'dental' },
  { objeto: 'SUMINISTRO DE PROTESIS TOTAL DE RODILLA Y CADERA CON INSTRUMENTAL EN CALIDAD DE PRESTAMO', linea: 'reemplazo', nota: 'prótesis de rodilla y cadera' },
  { objeto: 'SUMINISTRO DE MATERIAL DE OSTEOSÍNTESIS DE ORTOPEDIA BÁSICO - ESPECIALIZADO; CIRUGÍA DE LA MANO; RADIO DISTAL; MAXILO FACIAL BÁSICO Y ESPECIALIZADO; NEUROCIRUGÍA', linea: 'trauma', nota: 'osteosíntesis de ortopedia con neurocirugía al final → trauma' },
  { objeto: 'SUMINISTRO DE MATERIAL DE OSTEOSINTESIS PARA CIRUGIA DE COLUMNA DEL SERVICIO DE ORTOPEDIA', linea: 'columna', nota: 'columna nombrada antes que ortopedia → columna' },
  { objeto: 'CONTRATAR LA PRESTACIÓN DEL SERVICIO DE RECOLECCIÓN; TRANSPORTE; INCINERACIÓN Y DISPOSICIÓN FINAL DE DESECHOS BIOMÉDICOS; CORTO PUNZANTES; MATERIAL DE OSTEOSINTESIS', linea: 'no_clasificado', nota: 'residuos aunque nombre osteosíntesis' },
  { objeto: 'EJECUTAR LOS PROCESOS Y SUBPROCESOS DE ORTOPEDIA Y TRAUMATOLOGIA REQUERIDOS PARA LA ATENCION INTEGRAL DE LOS PACIENTES DEL HOSPITAL SAN JUAN', linea: 'no_clasificado', nota: 'procesos de ortopedia tercerizados = servicio' },
  { objeto: 'SUMINISTRO DE MEDICAMENTOS (AGUA ESTERIL PARA IRRIGACION) PARA LA INTERVENCION DE PACIENTES EN CIRUGIAS DE UROLOGIA Y ORTOPEDIA', linea: 'no_clasificado', nota: 'medicamentos para cirugías de ortopedia' },
  { objeto: 'CONTRATAR PERSONAL TECNICO EN ATENCION PREHOSPITALARIA Y ATENCION EN EMERGENCIAS; TRAUMA Y DESASTRES', linea: 'no_clasificado', nota: 'personal técnico (servicio) aunque diga trauma' },
  { objeto: 'SERVICIOS ESPECIALIZADOS EN ORTOPEDIA PARA LA E.S.E. HOSPITAL UNIVERSITARIO SAN RAFAEL DE TUNJA', linea: 'no_clasificado', nota: 'servicios especializados en ortopedia = servicio' },
  { objeto: 'ADQUISICION DE SERVICIOS DE SALUD PARA EJECUTAR Y DESARROLLAR PROCESOS Y PROCEDIMIENTOS DE MEDICOS PROFESIONALES DE LA ESPECIALIDAD DE ORTOPEDIA Y TRAUMATOLOGIA', linea: 'no_clasificado', nota: 'adquisición de servicios de salud = servicio' },
  { objeto: 'CONTRATAR UN PROFESIONAL MEDICO CON LA ESPECIALIDAD EN ORTOPEDIA QUE EJERZA SUS FUNCIONES EN EL ÁMBITO DEL HOSPITAL REGIONAL DEL LÍBANO E.S.E', linea: 'no_clasificado', nota: 'contratar un profesional médico = servicio' },
  { objeto: 'PROVEER A EL HOSPITAL DE LOS SUBPROCESOS PROPIOS DE LAS ESPECIALIDADES MÉDICAS EN ORTOPEDIA Y TRAUMATOLOGÍA DENTRO DE LOS PROCESOS DE CONSULTA EXTERNA', linea: 'no_clasificado', nota: 'subprocesos de especialidades médicas = servicio' },
  { objeto: 'INSTRUMENTADORA OSTEOSINTESIS', linea: 'no_clasificado', nota: 'instrumentadora (persona) no es compra de osteosíntesis' },
  { objeto: 'MEDICO ENTRADA POR COMPRA SUMINISTRO DE MATERIAL DE OSTEOSINTESIS', linea: 'trauma', nota: 'empieza por "médico" pero es una compra de osteosíntesis' },
  { objeto: 'SUMINISTRO MATERIAL ORTOPEDIA', linea: 'otros_implantes', nota: 'material de ortopedia genérico' },
  { objeto: 'SUMINISTRO DE TEJIDOS ÓSEOS PARA LA ATENCIÓN INTEGRAL DE LOS USUARIOS CUYO ESTADO PATOLÓGICO ASÍ LOS REQUIERA', linea: 'otros_implantes', nota: 'tejidos óseos (banco de tejidos)' },
  { objeto: 'Prestación de servicios de arrendamiento de equipos biomédicos para la realización de procedimientos quirúrgicos de Neurocirugía en las instalaciones', linea: 'neurocirugia', nota: 'arrendamiento de equipos (compra pronto en el texto) no es servicio profesional' },
  // v2 (revisión 2026-10-11): aneurisma de aorta e ítems de osteosíntesis de SECOP I
  { objeto: 'ADQUISICION DE PROTESIS ENDOVASCULARES PARA LA CORRECCION DE ANEURISMA AORTICO ABDOMINALES Y/O TORAXICOS PARA EL AREA DE CIRUGIA VASCULAR Y DE ANGIOLOGIA DEL ESTABLECIMIENTO PUBLICO HOSPITAL MILITAR CENTRAL', linea: 'no_clasificado', nota: 'aneurisma de aorta (cardiovascular) no es neurocirugía' },
  { objeto: 'ADQUISICIoN DE KIT DE ENDUROPROTESIS ENDURANT II UNO PARA REPARO ENDOVASCULAR DE ANEURISMA DE AORTA ABDOMINAL', linea: 'no_clasificado', nota: 'reparo endovascular de aorta' },
  { objeto: 'SUMINISTRO DE CLIPS PARA ANEURISMA CEREBRAL Y MATERIAL DE CRANEOTOMIA', linea: 'neurocirugia', nota: 'aneurisma cerebral sí es neurocirugía' },
  { objeto: 'ENTRADA POR COMPRA DE TORNILLO CORTICAL 4.5 # 3 # 4 # 6 # 7 PLACA TIBIA PROXIMAL LATE', linea: 'trauma', nota: 'ítem: tornillo cortical y placa de tibia' },
  { objeto: 'CLAVO INTRA MEDULAR DE TIBIA II 10-300 MM', linea: 'trauma', nota: 'ítem: clavo "intra medular" separado' },
  { objeto: 'PLACA DCP 4.5 MM ANGOSTA 8 ORIFICIOS ACERO', linea: 'trauma', nota: 'ítem: placa DCP' },
  { objeto: 'TORNILLO INTERFERENCIAL FEMORAL BIOABSORBIBLE 9 X 25 MM', linea: 'deportiva', nota: 'tornillo interferencial femoral es deportiva' },
  { objeto: 'ENTRADA POR COMPRA DE TORNILLO CORTICAL 4.5*3 4.5*4 COTILO EXTERIOR SPARK UP TORNILLO CORTICAL 4.5 X 3', linea: 'reemplazo', nota: 'tornillos de un cotilo son de reemplazo (ítem = señal débil)' },
]
for (const caso of casos) {
  const c = clasificarContrato(caso.objeto, caso.descripcion ?? null, caso.unspsc ?? null)
  check(`${caso.nota}: ${caso.linea}`, c.linea === caso.linea, c)
}
eq('lineas de un contrato múltiple (principal primero)', clasificarContrato(casos[3].objeto, null).lineas, ['trauma', 'columna'])
eq('classifyLinea = clasificarContrato().linea', classifyLinea('MATERIAL DE OSTEOSINTESIS', null, null), 'trauma')
eq('la descripción también cuenta', classifyLinea('SUMINISTRO DE INSUMOS', 'INCLUYE MATERIAL DE OSTEOSINTESIS Y FIJADORES EXTERNOS', null), 'trauma')
eq('texto vacío', clasificarContrato(null, null, null), { linea: 'no_clasificado', lineas: [], motivo: 'ninguno' })

console.log('\nPrefiltro SoQL (superconjunto de la clasificación)')
const positivos = casos.filter(c => c.linea !== 'no_clasificado' && !(c.unspsc && clasificarContrato(c.objeto, null, c.unspsc).motivo === 'unspsc'))
for (const caso of positivos) check(`prefiltro deja pasar: ${caso.nota}`, pasaPrefiltro(caso.objeto, caso.descripcion))
check('prefiltro deja pasar a los médicos', pasaPrefiltro('PRESTACIÓN DE SERVICIOS PROFESIONALES COMO NEUROCIRUJANO') && pasaPrefiltro('MEDICO ESPECIALISTA EN ORTOPEDIA Y TRAUMATOLOGÍA'))
check('raíces en mayúsculas (SoQL compara upper())', SECOP_PREFILTRO_RAICES.every(r => r === r.toUpperCase()))

// ---------------------------------------------------------------------------------------------
console.log('\nEspecialidad del médico')
eq('ortopedia y traumatología', detectEspecialidad('PRESTACION DE SERVICIOS PROFESIONALES COMO MEDICO ESPECIALISTA EN ORTOPEDIA Y TRAUMATOLOGIA'), 'ortopedia')
eq('neurocirujano', detectEspecialidad('PRESTACIÓN DE SERVICIOS PROFESIONALES COMO NEUROCIRUJANO EN LA E.S.E.'), 'neurocirugia')
eq('subespecialidad de columna gana a ortopedia', detectEspecialidad('PRESTACIÓN DE SERVICIOS COMO MÉDICO ESPECIALISTA EN ORTOPEDIA CON SUBESPECIALIDAD EN CIRUGÍA DE COLUMNA'), 'columna')
eq('artroscopia → deportiva', detectEspecialidad('SERVICIOS PROFESIONALES DE ORTOPEDISTA CON ENFASIS EN ARTROSCOPIA DE RODILLA Y HOMBRO'), 'deportiva')
eq('auxiliar de enfermería en el servicio de ortopedia → no', detectEspecialidad('PRESTACION DE SERVICIOS COMO AUXILIAR DE ENFERMERIA EN EL SERVICIO DE ORTOPEDIA'), null)
eq('instrumentador quirúrgico → no', detectEspecialidad('PRESTACIÓN DE SERVICIOS COMO INSTRUMENTADOR QUIRÚRGICO PARA CIRUGÍAS DE ORTOPEDIA'), null)
eq('médico general → no', detectEspecialidad('PRESTACION DE SERVICIOS COMO MEDICO GENERAL DE APOYO AL SERVICIO DE ORTOPEDIA'), null)
eq('compra de material → no es especialidad', detectEspecialidad('SUMINISTRO DE MATERIAL DE OSTEOSINTESIS PARA ORTOPEDIA'), null)
eq('urología → no', detectEspecialidad('PRESTACIÓN DE SERVICIOS COMO MÉDICO ESPECIALISTA EN UROLOGÍA'), null)
eq('procesos de ortopedia tercerizados (empresa) → ortopedia', detectEspecialidad('EJECUTAR LOS PROCESOS Y SUBPROCESOS DE ORTOPEDIA Y TRAUMATOLOGIA REQUERIDOS PARA LA ATENCION INTEGRAL DE LOS PACIENTES'), 'ortopedia')
eq('"traumotologia" (error de digitación) y "prestar sus servicios"', detectEspecialidad('prestar sus servicios personales y en su condición de profesional en MEDICINA ESPECIALIZADA EN ORTOPEDIA Y TRAUMOTOLOGIA en forma oportuna'), 'ortopedia')
eq('adecuaciones locativas del consultorio ortopédico → no', detectEspecialidad('PRESTACIÓN DE SERVICIOS POR ADECUACIONES LOCATIVAS PARA EL ÁREA DE CONSULTORIO ORTOPÉDICO PEDIÁTRICO'), null)
eq('atención en neurocirugía (empresa)', detectEspecialidad('Prestar los servicios para el desarrollo de los procesos y procedimientos quirúrgicos que requieran Atención en NEUROCIRUGIA para el Hospital'), 'neurocirugia')
eq('servicio profesional que menciona insumos más adelante', detectEspecialidad('PRESTAR LOS SERVICIOS PROFESIONALES ESPECIALIZADOS DE TRAUMATOLOGÍA Y ORTOPEDIA PEDIÁTRICA; CIRUGÍA DE MANO; INCLUYE LOS INSUMOS Y EQUIPOS NECESARIOS PARA LA ATENCIÓN'), 'ortopedia')
eq('agremiación sindical de neurocirujanos', detectEspecialidad('OPERAR DE MANERA INDEPENDIENTE CON AUTONOMÍA Y AUTOGOBIERNO PARA EL DESARROLLO DE LOS PROCESOS DE NEUROCIRUGÍA'), 'neurocirugia')
eq('contratar un profesional médico con especialidad en ortopedia', detectEspecialidad('CONTRATAR UN PROFESIONAL MEDICO CON LA ESPECIALIDAD EN ORTOPEDIA QUE EJERZA SUS FUNCIONES EN EL ÁMBITO DEL HOSPITAL'), 'ortopedia')
eq('instrumentadora → sin especialidad', detectEspecialidad('INSTRUMENTADORA OSTEOSINTESIS'), null)

// ---------------------------------------------------------------------------------------------
console.log('\nAtípicos')
eq('umbral 50.000 M', [esAtipico(VALOR_ATIPICO_COP + 1), esAtipico(VALOR_ATIPICO_COP)], [true, false])
eq('p99 solo con 100+ contratos', [esAtipico(900, { p99: 800, contratos: ATIPICO_MIN_CONTRATOS }), esAtipico(900, { p99: 800, contratos: 99 })], [true, false])
eq('nulo o sin valor no es atípico', [esAtipico(null), esAtipico(undefined), esAtipico(Number.NaN)], [false, false, false])
eq('percentil continuo como PostgreSQL', [percentilContinuo([1, 2, 3, 4], 0.5), percentilContinuo([10], 0.99), percentilContinuo([], 0.99)], [2.5, 10, null])
const cien = Array.from({ length: 100 }, (_, i) => i + 1)
eq('p99 de 1..100 = 99,01', percentilContinuo(cien, 0.99), 99.01)

// ---------------------------------------------------------------------------------------------
console.log('\nMapeo de filas (fixtures literales de datos.gov.co, 2026-10-11)')
const sal = 'a'.repeat(32)
const ctx = {
  hashDocumento: (d: string) => hashDocumento(d, sal),
  hospitalPorNit: new Map([['800006850', '11111111-1111-1111-1111-111111111111']]),
  vigilados: new Set(['900294380']),
}
const secop2Medico = {
  nombre_entidad: 'empresa social del estado región de salud soacha.',
  nit_entidad: '800006850',
  departamento: 'Cundinamarca',
  ciudad: 'Soacha',
  orden: 'Territorial',
  proceso_de_compra: 'CO1.BDOS.9422739',
  id_contrato: 'CO1.PCCNTR.8806883',
  referencia_del_contrato: 'CPS-264-2026',
  estado_contrato: 'Modificado',
  codigo_de_categoria_principal: 'V1.80111701',
  descripcion_del_proceso: 'PRESTACIÓN DE SERVICIOS COMO MÉDICO ESPECIALISTA EN UROLOGÍA EN EL ÁREA ASISTENCIAL; DENTRO DE LOS DIFERENTES PROCESOS',
  tipo_de_contrato: 'Prestación de servicios',
  modalidad_de_contratacion: 'Contratación régimen especial',
  fecha_de_firma: '2026-01-13T00:00:00.000',
  fecha_de_inicio_del_contrato: '2026-01-13T00:00:00.000',
  fecha_de_fin_del_contrato: '2026-12-31T00:00:00.000',
  tipodocproveedor: 'Cédula de Ciudadanía',
  documento_proveedor: '3093395',
  proveedor_adjudicado: 'MIGUEL ABDON MARTINEZ GARZON',
  valor_del_contrato: '105000000',
  valor_pagado: '0',
  urlproceso: { url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.9436553&isFromPublicArea=True&isModal=true&asPopupView=true' },
  ultima_actualizacion: '2026-06-30T00:00:00.000',
  objeto_del_contrato: 'PRESTACIÓN DE SERVICIOS COMO MÉDICO ESPECIALISTA EN UROLOGÍA EN EL ÁREA ASISTENCIAL; DENTRO DE LOS DIFERENTES PROCESOS',
}
const m1 = mapSecopRow('secop2', secop2Medico, ctx)
check('SECOP II se mapea', 'row' in m1, m1)
if ('row' in m1) {
  const r = m1.row
  eq('SECOP II: id, entidad, IPS por NIT', [r.id_contrato, r.nit_entidad, r.hospital_id, r.origen], ['CO1.PCCNTR.8806883', '800006850', '11111111-1111-1111-1111-111111111111', 'SECOPII'])
  eq('SECOP II: persona sin documento en claro, con hash de 64', [r.es_persona, r.documento_proveedor, /^[0-9a-f]{64}$/.test(r.proveedor_hash ?? '')], [true, null, true])
  check('el hash no contiene la cédula', !(r.proveedor_hash ?? '').includes('3093395'))
  eq('SECOP II: urlproceso es un objeto {url}', r.url?.startsWith('https://community.secop.gov.co/'), true)
  eq('SECOP II: valores, fechas, UNSPSC', [r.valor, r.valor_pagado, r.fecha_firma, r.fecha_fin, r.ultima_actualizacion, r.categoria_unspsc], [105000000, 0, '2026-01-13', '2026-12-31', '2026-06-30', 'V1.80111701'])
  eq('SECOP II: descripción igual al objeto → null', r.descripcion, null)
  eq('SECOP II: urología → sin línea ni especialidad → no se guarda', [r.linea, r.especialidad_medico, decidirAlcance(r, new Set(['800006850']))], ['no_clasificado', null, null])
  eq('marca de agua SECOP II = ultima_actualizacion', watermarkDeFila('secop2', secop2Medico), '2026-06-30')
}
const secop2Vigilado = {
  ...secop2Medico,
  id_contrato: 'CO1.PCCNTR.1234567',
  nit_entidad: '8999990321',
  nombre_entidad: 'OTRA ENTIDAD',
  tipodocproveedor: 'NIT',
  documento_proveedor: '9002943801',
  proveedor_adjudicado: 'LH S.A.S',
  objeto_del_contrato: 'SUMINISTRO DE MATERIAL DE OSTEOSINTESIS PARA EL SERVICIO DE ORTOPEDIA',
  descripcion_del_proceso: 'SUMINISTRO DE MATERIAL DE OSTEOSINTESIS PARA EL SERVICIO DE ORTOPEDIA',
  codigo_de_categoria_principal: 'V1.42321500',
  valor_del_contrato: '98530781648',
}
const m2 = mapSecopRow('secop2', secop2Vigilado, ctx)
if ('row' in m2) {
  const r = m2.row
  eq('vigilado: NIT a 9 dígitos y vínculo con la lista', [r.documento_proveedor, r.proveedor_vigilado_id, r.es_persona, r.proveedor_hash], ['900294380', '900294380', false, null])
  eq('entidad con DV pegado → 9 dígitos; sin IPS', [r.nit_entidad, r.hospital_id], ['899999032', null])
  eq('vigilado con cualquier entidad se guarda', decidirAlcance(r, new Set(['800006850'])), 'vigilado')
  eq('osteosíntesis → trauma', r.linea, 'trauma')
} else check('SECOP II vigilado se mapea', false, m2)

const integradoSecopI = {
  nivel_entidad: 'TERRITORIAL',
  codigo_entidad_en_secop: '225290029',
  nombre_de_la_entidad: 'CUNDINAMARCA - E.S.E. HOSPITAL SAN RAFAEL DE FUSAGASUGÁ',
  nit_de_la_entidad: '890680025',
  departamento_entidad: 'Cundinamarca',
  municipio_entidad: 'Fusagasugá',
  estado_del_proceso: 'Convocado',
  modalidad_de_contrataci_n: 'Régimen Especial',
  objeto_a_contratar: 'NO DEFINIDO',
  objeto_del_proceso: 'SUMINISTRO DE MATERIAL DE OSTEOSINTESIS PARA EL SERVICIO DE ORTOPEDIA',
  tipo_de_contrato: 'Suministro',
  numero_del_contrato: '17-4-6990259',
  numero_de_proceso: '475-2017',
  valor_contrato: '27000000',
  nom_raz_social_contratista: 'NO DEFINIDO',
  url_contrato: 'https://www.contratos.gov.co/consultas/detalleProceso.do?numConstancia=17-4-6990259',
  origen: 'SECOPI',
  tipo_documento_proveedor: 'NO DEFINIDO',
  documento_proveedor: 'NO DEFINIDO',
}
const m3 = mapSecopRow('integrado', integradoSecopI, ctx)
if ('row' in m3) {
  const r = m3.row
  eq('Integrado SECOP I: origen, número, referencia', [r.origen, r.numero_contrato, r.referencia], ['SECOPI', '17-4-6990259', '475-2017'])
  eq('Integrado SECOP I: "NO DEFINIDO" → null', [r.descripcion, r.proveedor_nombre, r.documento_proveedor, r.tipo_doc_proveedor, r.es_persona], [null, null, null, null, false])
  eq('Integrado SECOP I: id compuesto sin fecha de firma', r.id_contrato, 'SECOPI|17-4-6990259||')
  eq('Integrado SECOP I: sin valor pagado ni UNSPSC', [r.valor, r.valor_pagado, r.categoria_unspsc, r.ultima_actualizacion], [27000000, null, null, null])
  eq('Integrado SECOP I: entidad objetivo + trauma → se guarda', decidirAlcance(r, new Set(['890680025'])), 'linea')
} else check('Integrado SECOP I se mapea', false, m3)

const integradoMedico = {
  nivel_entidad: 'Territorial',
  nombre_de_la_entidad: 'empresa social del estado región de salud soacha.',
  nit_de_la_entidad: '800006850',
  departamento_entidad: 'Cundinamarca',
  municipio_entidad: 'Soacha',
  estado_del_proceso: 'Activo',
  modalidad_de_contrataci_n: 'Contratación régimen especial',
  objeto_a_contratar: 'PRESTACIÓN DE SERVICIOS PROFESIONALES COMO MÉDICO ESPECIALISTA EN ORTOPEDIA Y TRAUMATOLOGÍA EN EL ÁREA ASISTENCIAL',
  objeto_del_proceso: 'PRESTACIÓN DE SERVICIOS PROFESIONALES COMO MÉDICO ESPECIALISTA EN ORTOPEDIA Y TRAUMATOLOGÍA EN EL ÁREA ASISTENCIAL',
  tipo_de_contrato: 'Prestación de servicios',
  fecha_de_firma_del_contrato: '2025-06-09T15:23:16.000',
  fecha_fin_ejecuci_n: '2025-08-05T23:59:00.000',
  numero_del_contrato: 'CO1.PCCNTR.7932390',
  numero_de_proceso: 'CPS-888-2025',
  valor_contrato: '9500000',
  nom_raz_social_contratista: 'Daniel Felipe Giraldo Rubiano',
  url_contrato: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.8216979&isFromPublicArea=True&isModal=true&asPopupView=true',
  origen: 'SECOPII',
  tipo_documento_proveedor: 'Cédula de Ciudadanía',
  documento_proveedor: '1072195222',
}
const m4 = mapSecopRow('integrado', integradoMedico, ctx)
if ('row' in m4) {
  const r = m4.row
  eq('Integrado médico: especialidad ortopedia, sin línea', [r.especialidad_medico, r.linea], ['ortopedia', 'no_clasificado'])
  eq('Integrado médico: persona, sin cédula, con hash', [r.es_persona, r.documento_proveedor, r.proveedor_hash?.length], [true, null, 64])
  check('Integrado médico: id compuesto con hash corto y fecha, sin la cédula', r.id_contrato.startsWith('SECOPII|CO1.PCCNTR.7932390|h') && r.id_contrato.endsWith('|2025-06-09') && !r.id_contrato.includes('1072195222'), r.id_contrato)
  eq('Integrado médico: entidad objetivo → se guarda por especialidad', decidirAlcance(r, new Set(['800006850'])), 'especialidad')
  eq('Integrado médico en otra entidad → no se guarda', decidirAlcance(r, new Set(['890680025'])), null)
  eq('marca de agua Integrado = fecha de firma', watermarkDeFila('integrado', integradoMedico), '2025-06-09')
} else check('Integrado médico se mapea', false, m4)
eq('mismo documento → mismo hash; otra sal → otro hash', [hashDocumento('123', sal) === hashDocumento('123', sal), hashDocumento('123', sal) === hashDocumento('123', 'b'.repeat(32))], [true, false])
let salCorta = false
try {
  hashDocumento('123', 'corta')
} catch {
  salCorta = true
}
check('sal corta → error', salCorta)
check('sin NIT de entidad → error', 'error' in mapSecopRow('secop2', { ...secop2Medico, nit_entidad: 'No Definido' }, ctx))
check('Integrado con origen raro → error', 'error' in mapSecopRow('integrado', { ...integradoSecopI, origen: 'OTRO' }, ctx))
eq('fechas: futuro lejano y basura → null', [toIsoDate('2026-10-09T12:50:59.000'), toIsoDate('1899-01-01T00:00:00.000'), toIsoDate('nada')], ['2026-10-09', null, null])
eq('dinero: decimal, negativo, gigante, texto', [toMoney('575146643.36'), toMoney('-5'), toMoney('1e17'), toMoney('NO DEFINIDO')], [575146643.36, null, null, null])

const tipo: SecopContratoRow['linea'] = 'columna'
eq('alcance: entidad objetivo sin línea ni especialidad → no', decidirAlcance({ proveedor_vigilado_id: null, nit_entidad: '1', linea: 'no_clasificado', especialidad_medico: null }, new Set(['1'])), null)
eq('alcance: línea en entidad no objetivo → no', decidirAlcance({ proveedor_vigilado_id: null, nit_entidad: '2', linea: tipo, especialidad_medico: null }, new Set(['1'])), null)

// ---------------------------------------------------------------------------------------------
console.log('\nURLs SoQL')
const tareas = buildSecopTareas(Array.from({ length: 85 }, (_, i) => String(800000000 + i)), ['900294380', '860529890'])
eq('tareas: 85 entidades en grupos de 40 + 1 de proveedores', tareas.map(t => `${t.tipo}:${t.nits.length}`), ['entidades:40', 'entidades:40', 'entidades:5', 'proveedores:2'])
const uIni = new URL(buildSecopUrl('secop2', tareas[2], { modo: 'inicial', desde: null, offset: 0, limit: 1000 }))
const wIni = uIni.searchParams.get('$where') ?? ''
check('SECOP II inicial: entidades con NIT y NIT+DV (columna numérica: sin guion)', wIni.includes("nit_entidad in ('800000080'") && !wIni.includes("'800000080-") && uIni.pathname === '/resource/jbjy-vk9h.json')
check('SECOP II inicial: prefiltro de texto y UNSPSC', wIni.includes("upper(objeto_del_contrato) like '%OSTEO%'") && wIni.includes("codigo_de_categoria_principal like 'V1.4232%'"))
eq('orden estable y página', [uIni.searchParams.get('$order'), uIni.searchParams.get('$limit'), uIni.searchParams.get('$offset')], [':id', '1000', '0'])
const uInc = new URL(buildSecopUrl('secop2', tareas[0], { modo: 'incremental', desde: '2026-10-05', offset: 2000, limit: 1000 }))
const wInc = uInc.searchParams.get('$where') ?? ''
check('SECOP II incremental: sin prefiltro, con marca de agua', !wInc.includes('upper(') && wInc.endsWith("ultima_actualizacion >= '2026-10-05T00:00:00.000'") && uInc.searchParams.get('$offset') === '2000', wInc)
const uProvI = new URL(buildSecopUrl('integrado', tareas[3], { modo: 'incremental', desde: '2026-09-01', offset: 0, limit: 500 }))
const wProvI = uProvI.searchParams.get('$where') ?? ''
check('Integrado proveedores: starts_with con y sin puntos + fecha de firma', wProvI.includes("starts_with(documento_proveedor, '900294380')") && wProvI.includes("starts_with(documento_proveedor, '900.294.380')") && wProvI.includes("fecha_de_firma_del_contrato >= '2026-09-01T00:00:00.000'") && uProvI.pathname === '/resource/rpmr-utcd.json', wProvI)
const uProv2 = new URL(buildSecopUrl('secop2', tareas[3], { modo: 'inicial', desde: null, offset: 0, limit: 500 }))
check('SECOP II proveedores: IN con variantes y sin prefiltro (todos sus contratos)', (uProv2.searchParams.get('$where') ?? '') === "documento_proveedor in ('860529890','8605298900','860529890-0','900294380','9002943801','900294380-1')", uProv2.searchParams.get('$where'))
check('URL de 40 entidades con prefiltro por debajo de 9,5 KB (datos.gov.co aceptó 9,6 KB el 2026-10-11)', buildSecopUrl('integrado', tareas[0], { modo: 'inicial', desde: null, offset: 0, limit: 5000 }).length < 9500 && buildSecopUrl('secop2', tareas[0], { modo: 'inicial', desde: null, offset: 0, limit: 5000 }).length < 9500)
check('huella cambia si cambia la lista', huellaTareas('secop2', tareas) !== huellaTareas('secop2', tareas.slice(1)) && huellaTareas('secop2', tareas) === huellaTareas('secop2', buildSecopTareas(Array.from({ length: 85 }, (_, i) => String(800000000 + i)), ['860529890', '900294380'])))

// ---------------------------------------------------------------------------------------------
console.log('\nCursor incremental')
const ahora = new Date('2026-10-11T06:00:00Z')
let c = iniciarPasada(cursorVacio(), { ahora, huella: 'H' })
eq('primera pasada: inicial y desde cero', [c.en_curso, c.modo, c.desde, c.paso, c.offset], [true, 'inicial', null, 0, 0])
c = registrarPagina(c, { filas: 1000, limite: 1000, guardadas: 300, maxVisto: '2026-10-09', ahora })
eq('página completa: misma tarea, offset avanza', [c.paso, c.offset, c.leidas, c.guardadas, c.max_visto], [0, 1000, 1000, 300, '2026-10-09'])
c = registrarPagina(c, { filas: 10, limite: 1000, guardadas: 5, maxVisto: '2099-01-01', ahora })
eq('página incompleta: siguiente tarea; fecha futura ignorada', [c.paso, c.offset, c.max_visto], [1, 0, '2026-10-09'])
const retomado = iniciarPasada(parseSecopCursor(JSON.parse(JSON.stringify(c))), { ahora, huella: 'H' })
eq('retomar la pasada en curso (cursor guardado en JSON)', [retomado.paso, retomado.offset, retomado.leidas], [1, 0, 1010])
eq('si cambia la lista de tareas, vuelve a la tarea 0 con el mismo desde', [iniciarPasada(c, { ahora, huella: 'OTRA' }).paso, iniciarPasada(c, { ahora, huella: 'OTRA' }).leidas], [0, 1010])
c = registrarPagina(c, { filas: 0, limite: 1000, guardadas: 0, maxVisto: null, ahora })
check('pasada terminada tras la última tarea', pasadaTerminada(c, 2))
c = cerrarPasada(c, { ahora, solapeDias: 3 })
eq('al cerrar: próxima desde = máxima vista − 3 días', [c.en_curso, c.siguiente_desde, c.ultima_pasada?.leidas, c.ultima_pasada?.modo], [false, '2026-10-06', 1010, 'inicial'])
c = iniciarPasada(c, { ahora: new Date('2026-10-12T06:00:00Z'), huella: 'H' })
eq('segunda pasada: incremental desde la marca', [c.modo, c.desde, c.leidas, c.max_visto], ['incremental', '2026-10-06', 0, null])
const sinFilas = cerrarPasada(c, { ahora, solapeDias: 3 })
eq('pasada sin filas: la próxima desde baja el solape otra vez desde "desde"', sinFilas.siguiente_desde, '2026-10-03')
eq('forzar inicial', iniciarPasada(sinFilas, { ahora, huella: 'H', forzarInicial: true }).desde, null)
eq('restarDias cruza meses', restarDias('2026-03-01', 1), '2026-02-28')
eq('NIT nuevos respecto a la última pasada completa', [nitsNuevos(['1', '2', '3'], ['1', '3']), nitsNuevos(['1'], null)], [['2'], []])
const conNuevos = buildSecopTareas(['800000001', '800000002'], ['900294380'], { entidades: 40, proveedores: 40 }, { entidades: [], proveedores: ['900294380'] })
eq('proveedor nuevo: tarea extra de histórico', conNuevos.map(t => `${t.tipo}:${t.nits.length}${t.historico ? ':h' : ''}`), ['entidades:2', 'proveedores:1', 'proveedores:1:h'])
const uHist = new URL(buildSecopUrl('integrado', { tipo: 'entidades', nits: ['800000001'], historico: true }, { modo: 'incremental', desde: '2026-10-01', offset: 0, limit: 100 }))
check('tarea de histórico ignora la marca de agua y usa el prefiltro', !(uHist.searchParams.get('$where') ?? '').includes('fecha_de_firma_del_contrato >=') && (uHist.searchParams.get('$where') ?? '').includes('upper(objeto_del_proceso)'))
check('la huella distingue la tarea de histórico', huellaTareas('integrado', conNuevos) !== huellaTareas('integrado', conNuevos.map(t => ({ ...t, historico: false }))))
const cerradoNits = cerrarPasada(iniciarPasada(cursorVacio(), { ahora, huella: 'H' }), { ahora, solapeDias: 3, nits: { entidades: ['800000002', '800000001'], proveedores: ['900294380'] } })
eq('al cerrar se guardan los NIT cubiertos (ordenados) y sobreviven al JSON', parseSecopCursor(JSON.parse(JSON.stringify(cerradoNits))).nits_completos, { entidades: ['800000001', '800000002'], proveedores: ['900294380'] })
eq('cursor ilegible → vacío', parseSecopCursor('basura'), cursorVacio())
eq('consulta que no cupo: el contador sobrevive al JSON y una página leída lo reinicia', [parseSecopCursor({ ...cursorVacio(), agotados: 2 }).agotados, registrarPagina({ ...cursorVacio(), agotados: 2 }, { filas: 5, limite: 10, guardadas: 1, maxVisto: null, ahora }).agotados], [2, 0])

// ---------------------------------------------------------------------------------------------
console.log('\nCron (próxima ejecución, UTC)')
const base = new Date('2026-10-11T07:30:00Z') // domingo
eq('diario 06:00 → mañana', nextCronRun('0 6 * * *', base)?.toISOString(), '2026-10-12T06:00:00.000Z')
eq('semanal lunes 07:00', nextCronRun('0 7 * * 1', base)?.toISOString(), '2026-10-12T07:00:00.000Z')
eq('mensual día 2 → noviembre', nextCronRun('0 8 2 * *', base)?.toISOString(), '2026-11-02T08:00:00.000Z')
eq('mensual día 3 07:00 (GitHub Actions)', nextCronRun('0 7 3 * *', new Date('2026-10-03T06:59:00Z'))?.toISOString(), '2026-10-03T07:00:00.000Z')
eq('expresión no soportada → null', [parseCronExpression('*/5 * * * *'), nextCronRun('nada', base)], [null, null])

// ---------------------------------------------------------------------------------------------
console.log('\nCargas mensuales (partes puras)')
const html = `<a href="/sites/rid/Lists/BibliotecaDigital/RIDE/VP/RBC/cifras-afiliacion-salud-agosto2026.zip">Agosto</a>
<a href="/sites/rid/Lists/BibliotecaDigital/RIDE/VP/DOA/cifras-afiliacion-salud-julio-2026.zip">Julio</a>
<a href="/sites/rid/Lists/BibliotecaDigital/RIDE/VP/RBC/cifras-afiliacion-salud-jun-2026.zip">Junio</a>
<a href="/sites/rid/Lists/BibliotecaDigital/RIDE/VP/DOA/OAS/cifras-afiliacion-salud-oct2025.zip">Oct</a>
<a href="/sites/rid/Lists/BibliotecaDigital/RIDE/VP/RBC/cifra-afiliacion-salud-enero-2026.zip">Enero</a>
<a href="/sites/rid/Lists/BibliotecaDigital/RIDE/VP/RBC/cifras-afiliacion-salud-agosto2026.zip">repetido</a>
<a href="/otro/documento.zip">no es de cifras</a>`
const zips = extraerZipsCifras(html)
eq('ZIP de MinSalud: mes desde el nombre, sin repetidos, del más nuevo al más viejo', zips.map(z => z.corte), ['2026-08-31', '2026-07-31', '2026-06-30', '2026-01-31', '2025-10-31'])
eq('ZIP de MinSalud: URL absoluta', zips[0].url, 'https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/VP/RBC/cifras-afiliacion-salud-agosto2026.zip')
const uReps = new URL(buildRepsSedesUrl(10000))
check('REPS por SoQL: solo las 3 clases que se cargan, orden por código, página', (uReps.searchParams.get('$where') ?? '').includes("'Transporte Especial de Pacientes'") && !(uReps.searchParams.get('$where') ?? '').includes('Profesional') && uReps.searchParams.get('$order') === 'codigohabilitacionsede' && uReps.searchParams.get('$offset') === '10000' && uReps.pathname === '/resource/c36g-9fc2.json')

console.log(`\n${passed} pruebas OK, ${failed} fallidas`)
process.exit(failed > 0 ? 1 : 0)
