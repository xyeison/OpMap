'use client'

// Configuración > Metas: valores de toda la empresa (médica, institucional y subtipos con meta propia) y
// excepciones por zona y por Ejecutivo Comercial. Prioridad al calcular: persona > zona > toda la empresa.
// Cada clave muestra el valor que rige hoy y su línea de tiempo; todo cambio pasa por FormularioCambio
// (config_metas). Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "Interfaz").
import { useMemo, useState } from 'react'
import {
  etiquetaTipoVisita,
  valorVigente,
  type ConfigMeta,
  type ConfigVisitasResponse,
  type ScopeMeta,
  type TipoVisita,
} from '@/lib/visits-rules'
import { Chip, claseBotonChico } from '@/components/terceros/comun'
import FormularioCambio from '../FormularioCambio'
import { ClaveTarjeta, estadoVigencia } from '../LineaDeTiempo'
import TerminarValor from '../TerminarValor'
import { EditorMeta, EditorMetaNueva, valoresMeta, type ValorMeta, type ValorMetaNueva } from '../editores'
import { Tarjeta, mensajeCambioGuardado } from '../comun'
import { textoMeta } from '../textos'

interface Base {
  scope: ScopeMeta
  kam_id: string | null
  executive_id: string | null
  tipo: TipoVisita
  subtipo_id: string | null
}

type Abierto =
  | { tipo: 'cambiar'; base: Base; titulo: string; subtitulo?: string; inicial: ValorMeta }
  | { tipo: 'nueva'; scope: ScopeMeta }
  | { tipo: 'terminar'; fila: ConfigMeta; despues: string }

const describir = (fila: ConfigMeta) => textoMeta(fila)

function claveDe(base: Base): string {
  return [base.scope, base.kam_id ?? base.executive_id ?? '-', base.tipo, base.subtipo_id ?? '-'].join(':')
}

export default function MetasTab({ datos, onCambio }: { datos: ConfigVisitasResponse; onCambio: (mensaje: string) => void }) {
  const { hoy, metas, subtipos, zonas, ejecutivas, conteo } = datos
  const [abierto, setAbierto] = useState<Abierto | null>(null)

  const porClave = useMemo(() => {
    const mapa = new Map<string, ConfigMeta[]>()
    for (const fila of metas) {
      const clave = claveDe(fila)
      mapa.set(clave, [...(mapa.get(clave) ?? []), fila])
    }
    return mapa
  }, [metas])

  const nombreSubtipo = (id: string | null) => subtipos.find(s => s.id === id)?.nombre ?? 'Subtipo'
  const nombreZona = (id: string | null) => zonas.find(z => z.id === id)?.nombre ?? 'Zona sin nombre'
  const ejecutiva = (id: string | null) => ejecutivas.find(e => e.id === id)
  const subtiposVivos = subtipos.filter(s => s.vigente_hasta === null || s.vigente_hasta >= hoy).sort((a, b) => a.orden - b.orden)

  const textoTipo = (base: Base) =>
    base.subtipo_id ? `Meta propia: ${nombreSubtipo(base.subtipo_id)}` : etiquetaTipoVisita(base.tipo)

  // Subtipos que hoy tienen meta propia en Qué cuenta, o que ya tienen una meta de toda la empresa.
  const subtiposConMeta = subtiposVivos.filter(subtipo => {
    const modoHoy = valorVigente(
      conteo.filter(c => c.subtipo_id === subtipo.id),
      hoy
    )?.modo
    return modoHoy === 'meta_propia' || porClave.has(claveDe({ scope: 'general', kam_id: null, executive_id: null, tipo: 'institucional', subtipo_id: subtipo.id }))
  })

  const abrirCambio = (base: Base, titulo: string, subtitulo?: string) => {
    const filas = porClave.get(claveDe(base)) ?? []
    const actual =
      valorVigente(filas, hoy) ??
      filas.filter(f => !f.anulado_at).sort((a, b) => (a.vigente_desde < b.vigente_desde ? 1 : -1))[0]
    setAbierto({
      tipo: 'cambiar',
      base,
      titulo,
      subtitulo,
      inicial: actual ? { periodo: actual.periodo, cantidad: String(actual.cantidad) } : { periodo: 'dia', cantidad: '' },
    })
  }

  /** Claves de un alcance (zona o ejecutiva), separadas en vigentes y terminadas. */
  const clavesDe = (scope: 'zona' | 'ejecutiva') => {
    const claves = Array.from(porClave.entries())
      .filter(([, filas]) => filas[0]?.scope === scope)
      .map(([clave, filas]) => {
        const muestra = filas[0]
        const base: Base = {
          scope,
          kam_id: muestra.kam_id,
          executive_id: muestra.executive_id,
          tipo: muestra.tipo,
          subtipo_id: muestra.subtipo_id,
        }
        const nombre = scope === 'zona' ? nombreZona(base.kam_id) : ejecutiva(base.executive_id)?.nombre ?? 'Ejecutivo Comercial'
        const vivo = filas.some(f => {
          const estado = estadoVigencia(f, hoy)
          return estado === 'rige' || estado === 'programado'
        })
        return { clave, filas, base, nombre, vivo }
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || textoTipo(a.base).localeCompare(textoTipo(b.base), 'es'))
    return { vivas: claves.filter(c => c.vivo), terminadas: claves.filter(c => !c.vivo) }
  }

  const zonasClaves = clavesDe('zona')
  const personasClaves = clavesDe('ejecutiva')

  const tarjetaExcepcion = (item: ReturnType<typeof clavesDe>['vivas'][number]) => {
    const persona = item.base.scope === 'ejecutiva' ? ejecutiva(item.base.executive_id) : undefined
    const subtitulo =
      item.base.scope === 'ejecutiva'
        ? `${textoTipo(item.base)} · ${persona?.zona ? `zona ${persona.zona}` : 'sin zona'}`
        : textoTipo(item.base)
    const despues = item.base.scope === 'zona' ? 'la meta de toda la empresa' : 'la meta de su zona o la de toda la empresa'
    return (
      <ClaveTarjeta
        key={item.clave}
        titulo={item.nombre}
        subtitulo={subtitulo}
        etiquetas={persona && persona.status !== 'active' ? <Chip tono="ambar">{persona.status === 'placeholder' ? 'Por contratar' : 'Inactiva'}</Chip> : undefined}
        filas={item.filas}
        hoy={hoy}
        describir={describir}
        sinValor={`Sin valor hoy: rige ${despues}.`}
        onCambiar={() =>
          abrirCambio(item.base, item.base.scope === 'zona' ? `Meta de la zona ${item.nombre}` : `Meta de ${item.nombre}`, subtitulo)
        }
        onTerminar={fila => setAbierto({ tipo: 'terminar', fila, despues })}
      />
    )
  }

  return (
    <div className="space-y-6 min-w-0">
      <Tarjeta className="p-4">
        <p className="text-sm text-gray-700">
          Al calcular la cuota de una persona se usa su excepción si la tiene; si no, la de su zona; si no, la de toda la
          empresa. Cada día usa el valor que regía ese día.
        </p>
      </Tarjeta>

      {/* Toda la empresa */}
      <section className="space-y-3 min-w-0">
        <h2 className="text-lg font-bold text-gray-900">Toda la empresa</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(['medica', 'institucional'] as const).map(tipo => {
            const base: Base = { scope: 'general', kam_id: null, executive_id: null, tipo, subtipo_id: null }
            const titulo = tipo === 'medica' ? 'Meta médica' : 'Meta institucional'
            return (
              <ClaveTarjeta
                key={tipo}
                titulo={titulo}
                subtitulo="Valor por defecto para todas las zonas"
                filas={porClave.get(claveDe(base)) ?? []}
                hoy={hoy}
                describir={describir}
                sinValor={`Sin ${titulo.toLowerCase()} hoy: nadie tiene cuota ${tipo === 'medica' ? 'médica' : 'institucional'}, salvo zonas o personas con excepción.`}
                onCambiar={() => abrirCambio(base, `Cambiar ${titulo.toLowerCase()}`, 'Toda la empresa')}
                onTerminar={fila =>
                  setAbierto({
                    tipo: 'terminar',
                    fila,
                    despues: `ninguna ${titulo.toLowerCase()} de toda la empresa: nadie tiene cuota ${tipo === 'medica' ? 'médica' : 'institucional'}, salvo zonas o personas con excepción`,
                  })
                }
                puedeTerminar={fila => fila.vigente_desde > hoy}
              />
            )
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Subtipos con meta propia</h3>
          <button type="button" onClick={() => setAbierto({ tipo: 'nueva', scope: 'general' })} className={claseBotonChico}>
            + Meta de un subtipo
          </button>
        </div>
        {subtiposConMeta.length === 0 ? (
          <p className="text-sm text-gray-500">
            Ningún subtipo tiene meta propia. Para darle una, cámbialo a «Tiene meta propia» en Qué cuenta y define aquí su
            cantidad.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {subtiposConMeta.map(subtipo => {
              const base: Base = { scope: 'general', kam_id: null, executive_id: null, tipo: 'institucional', subtipo_id: subtipo.id }
              const modoHoy = valorVigente(
                conteo.filter(c => c.subtipo_id === subtipo.id),
                hoy
              )?.modo
              return (
                <ClaveTarjeta
                  key={subtipo.id}
                  titulo={`Meta propia: ${subtipo.nombre}`}
                  subtitulo="Toda la empresa"
                  etiquetas={modoHoy !== 'meta_propia' ? <Chip tono="ambar">Hoy no tiene meta propia</Chip> : undefined}
                  filas={porClave.get(claveDe(base)) ?? []}
                  hoy={hoy}
                  describir={describir}
                  sinValor="Sin meta definida para este subtipo."
                  onCambiar={() => abrirCambio(base, `Cambiar meta propia: ${subtipo.nombre}`, 'Toda la empresa')}
                  onTerminar={fila => setAbierto({ tipo: 'terminar', fila, despues: 'ninguna meta propia para este subtipo' })}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* Por zona */}
      <section className="space-y-3 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">Por zona</h2>
          <button type="button" onClick={() => setAbierto({ tipo: 'nueva', scope: 'zona' })} className={claseBotonChico}>
            + Meta de una zona
          </button>
        </div>
        {zonasClaves.vivas.length === 0 ? (
          <p className="text-sm text-gray-500">Ninguna zona tiene una meta distinta a la de toda la empresa.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{zonasClaves.vivas.map(tarjetaExcepcion)}</div>
        )}
        {zonasClaves.terminadas.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600">Metas de zona terminadas ({zonasClaves.terminadas.length})</summary>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">{zonasClaves.terminadas.map(tarjetaExcepcion)}</div>
          </details>
        )}
      </section>

      {/* Por persona */}
      <section className="space-y-3 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">Por Ejecutivo Comercial</h2>
          <button type="button" onClick={() => setAbierto({ tipo: 'nueva', scope: 'ejecutiva' })} className={claseBotonChico}>
            + Excepción de una persona
          </button>
        </div>
        {personasClaves.vivas.length === 0 ? (
          <p className="text-sm text-gray-500">Nadie tiene una meta propia distinta a la de su zona.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{personasClaves.vivas.map(tarjetaExcepcion)}</div>
        )}
        {personasClaves.terminadas.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600">Excepciones terminadas ({personasClaves.terminadas.length})</summary>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">{personasClaves.terminadas.map(tarjetaExcepcion)}</div>
          </details>
        )}
      </section>

      {abierto?.tipo === 'cambiar' && (
        <FormularioCambio<ValorMeta, ConfigMeta>
          titulo={abierto.titulo}
          subtitulo={abierto.subtitulo}
          tabla="config_metas"
          hoy={hoy}
          filasTabla={metas}
          describir={describir}
          inicial={abierto.inicial}
          editor={(valor, onCambiar) => <EditorMeta valor={valor} onCambiar={onCambiar} />}
          construir={valor => {
            const meta = valoresMeta(valor)
            return typeof meta === 'string' ? meta : { ...abierto.base, ...meta }
          }}
          resumen={valor => textoMeta({ cantidad: valor.cantidad || '0', periodo: valor.periodo })}
          onCerrar={() => setAbierto(null)}
          onGuardado={respuesta => {
            setAbierto(null)
            onCambio(mensajeCambioGuardado(respuesta.meses_recalculados))
          }}
        />
      )}

      {abierto?.tipo === 'nueva' && (
        <FormularioCambio<ValorMetaNueva, ConfigMeta>
          titulo={
            abierto.scope === 'zona'
              ? 'Meta de una zona'
              : abierto.scope === 'ejecutiva'
                ? 'Excepción de un Ejecutivo Comercial'
                : 'Meta propia de un subtipo'
          }
          subtitulo={abierto.scope === 'general' ? 'Toda la empresa' : undefined}
          tabla="config_metas"
          hoy={hoy}
          filasTabla={metas}
          describir={describir}
          inicial={{
            destino: '',
            tipo: abierto.scope === 'general' ? 'institucional' : 'medica',
            subtipo_id: '',
            periodo: 'dia',
            cantidad: '',
          }}
          editor={(valor, onCambiar) => (
            <EditorMetaNueva
              valor={valor}
              onCambiar={onCambiar}
              destinos={
                abierto.scope === 'zona'
                  ? [...zonas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(z => ({ id: z.id, nombre: z.nombre }))
                  : abierto.scope === 'ejecutiva'
                    ? ejecutivas
                        .filter(e => e.status !== 'inactive')
                        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
                        .map(e => ({ id: e.id, nombre: e.nombre, detalle: e.zona ? `zona ${e.zona}` : 'sin zona' }))
                    : null
              }
              etiquetaDestino={abierto.scope === 'zona' ? 'Zona' : 'Ejecutivo Comercial'}
              subtipos={subtiposVivos}
              fijarTipo={abierto.scope === 'general'}
            />
          )}
          construir={valor => {
            if (abierto.scope === 'zona' && !valor.destino) return 'Elige la zona'
            if (abierto.scope === 'ejecutiva' && !valor.destino) return 'Elige el Ejecutivo Comercial'
            if (abierto.scope === 'general' && !valor.subtipo_id) return 'Elige el subtipo'
            const meta = valoresMeta(valor)
            if (typeof meta === 'string') return meta
            return {
              scope: abierto.scope,
              kam_id: abierto.scope === 'zona' ? valor.destino : null,
              executive_id: abierto.scope === 'ejecutiva' ? valor.destino : null,
              tipo: valor.tipo,
              subtipo_id: valor.tipo === 'institucional' && valor.subtipo_id ? valor.subtipo_id : null,
              ...meta,
            }
          }}
          resumen={valor => textoMeta({ cantidad: valor.cantidad || '0', periodo: valor.periodo })}
          onCerrar={() => setAbierto(null)}
          onGuardado={respuesta => {
            setAbierto(null)
            onCambio(mensajeCambioGuardado(respuesta.meses_recalculados))
          }}
        />
      )}

      {abierto?.tipo === 'terminar' && (
        <TerminarValor<ConfigMeta>
          tabla="config_metas"
          fila={abierto.fila}
          filasTabla={metas}
          hoy={hoy}
          describir={describir}
          despues={abierto.despues}
          onCerrar={() => setAbierto(null)}
          onHecho={mensaje => {
            setAbierto(null)
            onCambio(mensaje)
          }}
        />
      )}
    </div>
  )
}
