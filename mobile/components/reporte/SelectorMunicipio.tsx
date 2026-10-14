/**
 * Municipio (código DANE de 5 dígitos) en dos pasos: departamento y municipio, de /api/locations/*. Arranca con el
 * municipio que se le pase (el de la zona de la persona).
 */
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import * as api from '../../lib/api'
import { mensajeDeError } from '../../lib/errores'
import { departamentoDe } from '../../lib/terceros'
import type { LugarItem } from '../../lib/tipos'
import { Aviso, Boton } from '../../lib/ui'
import { Selector } from './Selector'

interface Props {
  valor: string | null
  alCambiar: (municipio: string | null, nombre: string | null) => void
  error?: string | null
  etiqueta?: string
}

export function SelectorMunicipio({ valor, alCambiar, error, etiqueta = 'Municipio' }: Props) {
  const [departamentos, setDepartamentos] = useState<LugarItem[]>([])
  const [departamento, setDepartamento] = useState<string | null>(departamentoDe(valor))
  const [municipios, setMunicipios] = useState<LugarItem[]>([])
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    api
      .departamentos()
      .then(lista => {
        setDepartamentos(lista)
        setErrorCarga(null)
      })
      .catch(lanzado => setErrorCarga(mensajeDeError(lanzado)))
  }, [intento])

  useEffect(() => {
    if (!departamento) {
      setMunicipios([])
      return
    }
    let vigente = true
    api
      .municipios(departamento)
      .then(lista => {
        if (!vigente) return
        setMunicipios(lista)
        setErrorCarga(null)
        const actual = valor ? lista.find(m => m.id === valor) : undefined
        if (actual) alCambiar(actual.id, actual.name)
      })
      .catch(lanzado => vigente && setErrorCarga(mensajeDeError(lanzado)))
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departamento, intento])

  return (
    <View style={{ gap: 10 }}>
      <Selector
        etiqueta="Departamento"
        valor={departamento}
        opciones={departamentos.map(d => ({ id: d.id, titulo: d.name }))}
        placeholder="Elige el departamento"
        alElegir={id => {
          setDepartamento(id)
          if (id !== departamentoDe(valor)) alCambiar(null, null)
        }}
      />
      <Selector
        etiqueta={etiqueta}
        valor={valor}
        opciones={municipios.map(m => ({ id: m.id, titulo: m.name }))}
        placeholder={departamento ? 'Elige el municipio' : 'Primero el departamento'}
        vacio={departamento ? 'Cargando municipios…' : 'Elige primero el departamento.'}
        alElegir={id => alCambiar(id, municipios.find(m => m.id === id)?.name ?? null)}
        error={error}
      />
      {errorCarga ? (
        <Aviso tono="alerta" accion={<Boton titulo="Reintentar" variante="secundario" alPresionar={() => setIntento(n => n + 1)} />}>
          {errorCarga}
        </Aviso>
      ) : null}
    </View>
  )
}
