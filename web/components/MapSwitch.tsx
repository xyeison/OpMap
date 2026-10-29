'use client'

// Interruptor del panel de Filtros del mapa ("Mostrar": puntos de IPS, municipios de alcance, vacantes). Filas de al
// menos 44 px en táctil.
export default function MapSwitch({ checked, onChange, label, hint, touch = false }: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
  touch?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center justify-between gap-3 rounded-lg px-1.5 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${touch ? 'min-h-[44px] py-1' : 'min-h-[36px] py-0.5'}`}
    >
      <span className="min-w-0">
        <span className="block text-sm text-gray-900">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </span>
    </button>
  )
}
