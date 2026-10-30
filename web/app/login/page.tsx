'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'

// Destino tras el login (?next=...). Solo rutas internas relativas: empieza por "/", no por "//"
// (protocol-relative), sin barras invertidas, sin caracteres de control (el navegador los
// elimina y "/\t/evil.com" acabaría siendo "//evil.com") y nunca una ruta /api.
const SAFE_NEXT_RE = /^\/(?!\/)[^\\]*$/
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/

function safeNextPath(raw: string | null): string {
  if (!raw) return '/'
  if (!SAFE_NEXT_RE.test(raw) || CONTROL_CHARS_RE.test(raw)) return '/'
  if (raw.toLowerCase().startsWith('/api')) return '/'
  return raw
}

// useSearchParams exige un límite <Suspense> en las páginas que se prerenderizan, y lo de dentro no viene en el HTML del
// servidor: el fondo va por fuera, para que en oscuro no se vea el <main> claro mientras carga. data-sigue-tema: en el
// tema de la persona aunque <main> vaya en claro (lib/tema.ts).
export default function LoginPage() {
  return (
    <div data-sigue-tema className="min-h-screen flex items-center justify-center bg-fondo text-texto px-5 py-10">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = safeNextPath(searchParams.get('next'))
  const { login, user } = useUser()

  // Si ya está logueado, redirigir
  useEffect(() => {
    if (user) {
      router.push(nextPath)
    }
  }, [user, router, nextPath])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const success = await login(email, password)
    
    if (success) {
      router.push(nextPath)
    } else {
      setError('Email o contraseña incorrectos')
    }
    
    setLoading(false)
  }

  // El diseño de la app de campo (etapa 1 del diseño, dueño 2026-10-30): etiqueta sobre cada campo, campos y botón de
  // 52 px con radio 10, botón negro (blanco en oscuro).
  const campo =
    'block w-full min-h-[52px] rounded-[10px] border border-borde-control bg-superficie px-3.5 text-base text-texto placeholder:text-texto-suave focus:outline-none focus:border-2 focus:border-acento focus:px-[13px]'

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-[30px] leading-9 font-bold tracking-[-0.6px]">OpMap</h1>
        <h2 className="mt-2 text-base text-texto-suave">Inicia sesión en tu cuenta</h2>
      </div>

      <form className="space-y-5" onSubmit={handleLogin}>
        {error && (
          <div role="alert" className="rounded-xl bg-fondo-peligro text-peligro px-3.5 py-3 text-[15px] leading-[21px]">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-[15px] leading-5 font-bold">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={campo}
            placeholder="nombre@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-[15px] leading-5 font-bold">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={campo}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[52px] rounded-[10px] bg-acento text-sobre-acento px-[18px] text-[17px] leading-[22px] font-bold hover:opacity-90 active:opacity-80 disabled:opacity-[0.45] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
        >
          {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </button>
      </form>

      <p className="text-center text-sm text-texto-suave">¿Necesitas ayuda? Contacta al administrador</p>
    </div>
  )
}