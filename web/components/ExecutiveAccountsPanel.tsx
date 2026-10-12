'use client'

// Panel de /users: crea de una vez los usuarios de las Ejecutivas Comerciales que no tienen (app de visita).
// Lo usa quien administra usuarios. Las contraseñas temporales se ven una sola vez.

import { useEffect, useState } from 'react'

interface PlanItem {
  executiveId: string
  name: string
  email: string | null
  action: 'create' | 'link' | 'skip'
  reason: string | null
}

interface ResultItem {
  name: string
  email: string | null
  action: string
  tempPassword: string | null
  error: string | null
}

export default function ExecutiveAccountsPanel({ onDone }: { onDone: () => void }) {
  const [plan, setPlan] = useState<PlanItem[] | null>(null)
  const [results, setResults] = useState<ResultItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const loadPlan = async () => {
    try {
      const response = await fetch('/api/users/from-executives')
      const data = await response.json()
      if (response.ok) setPlan(data.items as PlanItem[])
      else setError(data.error || 'No se pudo revisar las ejecutivas')
    } catch {
      setError('No se pudo revisar las ejecutivas')
    }
  }

  useEffect(() => {
    loadPlan()
  }, [])

  const pending = (plan || []).filter(item => item.action !== 'skip')
  const skipped = (plan || []).filter(item => item.action === 'skip')

  const run = async () => {
    if (!window.confirm(`Se crearán o enlazarán ${pending.length} usuarios de Ejecutivas Comerciales con rol de gerente comercial. ¿Continuar?`)) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/users/from-executives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const data = await response.json()
      if (response.ok) {
        setResults(data.results as ResultItem[])
        onDone()
        loadPlan()
      } else setError(data.error || 'No se pudieron crear los usuarios')
    } catch {
      setError('No se pudieron crear los usuarios')
    } finally {
      setBusy(false)
    }
  }

  const credentialsText = (results || [])
    .filter(item => item.tempPassword)
    .map(item => `${item.name}\t${item.email}\t${item.tempPassword}`)
    .join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(credentialsText)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (!results && plan && pending.length === 0 && skipped.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 sm:p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900">Usuarios de las Ejecutivas Comerciales</h2>
          <p className="text-sm text-gray-600 mt-1">
            {plan === null
              ? 'Revisando…'
              : pending.length > 0
                ? `${pending.length} Ejecutivas Comerciales activas no tienen usuario en OpMap. Se crean con rol de gerente comercial y su email, y quedan enlazadas.`
                : 'Todas las Ejecutivas Comerciales activas tienen usuario.'}
          </p>
        </div>
        {pending.length > 0 && !results && (
          <button
            onClick={run}
            disabled={busy}
            className="px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 shrink-0"
          >
            {busy ? 'Creando…' : `Crear ${pending.length} usuarios`}
          </button>
        )}
      </div>

      {pending.length > 0 && !results && (
        <ul className="mt-4 text-sm text-gray-700 grid sm:grid-cols-2 gap-x-6 gap-y-1">
          {pending.map(item => (
            <li key={item.executiveId} className="truncate">
              {item.name} · <span className="text-gray-500">{item.email}</span>
              {item.action === 'link' && <span className="text-blue-700"> (ya tiene usuario: solo se enlaza)</span>}
            </li>
          ))}
        </ul>
      )}

      {skipped.length > 0 && !results && (
        <ul className="mt-3 text-xs text-amber-700 space-y-0.5">
          {skipped.map(item => (
            <li key={item.executiveId}>{item.name}: {item.reason}</li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {results && (
        <div className="mt-4">
          <p className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Estas contraseñas temporales se ven una sola vez. Cópialas y entrégaselas a cada persona; luego puedes
            cambiarlas con el botón de contraseña de cada usuario.
          </p>
          <div className="overflow-x-auto mt-3">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1 pr-4 font-medium">Ejecutiva</th>
                  <th className="py-1 pr-4 font-medium">Email</th>
                  <th className="py-1 pr-4 font-medium">Contraseña temporal</th>
                  <th className="py-1 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {results.map(item => (
                  <tr key={`${item.name}-${item.email}`} className="border-t border-gray-100">
                    <td className="py-1.5 pr-4">{item.name}</td>
                    <td className="py-1.5 pr-4 text-gray-600">{item.email}</td>
                    <td className="py-1.5 pr-4 font-mono">{item.tempPassword || '—'}</td>
                    <td className="py-1.5 text-gray-600">
                      {item.action === 'create' ? 'Creado' : item.action === 'link' ? 'Enlazado' : item.action === 'skip' ? 'Omitido' : 'Error'}
                      {item.error ? ` · ${item.error}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {credentialsText && (
            <button onClick={copy} className="mt-3 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
              {copied ? 'Copiado' : 'Copiar todo'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
