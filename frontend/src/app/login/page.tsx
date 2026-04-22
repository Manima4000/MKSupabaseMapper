'use client'

import { useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/dashboard/overview'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Erro ao fazer login')
        return
      }

      router.push(redirectTo)
      router.refresh()
    } catch {
      setError('Não foi possível conectar ao servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--bg-base) p-4">
      <div className="w-full max-w-sm animate-fade-up">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-(--accent-blue) shadow-lg shadow-blue-500/25">
            <span className="text-white text-sm font-black font-mono tracking-tighter">AS</span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-(--border-subtle) bg-white/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-8">
          <h1 className="font-display text-xl font-bold text-(--text-primary) mb-1">
            Bem-vindo
          </h1>
          <p className="text-xs text-(--text-muted) uppercase tracking-widest font-semibold mb-8">
            MemberKit Analytics
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-(--text-secondary)">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@exemplo.com"
                required
                autoComplete="email"
                suppressHydrationWarning
                className="w-full px-4 py-2.5 rounded-xl border border-(--border-subtle) bg-(--bg-base) text-sm text-(--text-primary) placeholder:text-(--text-muted) outline-none focus:border-(--accent-blue) focus:ring-2 focus:ring-(--accent-blue-glow) transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-(--text-secondary)">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 rounded-xl border border-(--border-subtle) bg-(--bg-base) text-sm text-(--text-primary) placeholder:text-(--text-muted) outline-none focus:border-(--accent-blue) focus:ring-2 focus:ring-(--accent-blue-glow) transition-all"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 rounded-xl bg-(--accent-blue) text-white text-[11px] font-black uppercase tracking-widest transition-all hover:bg-(--accent-blue-dim) disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-(--text-muted) mt-6 uppercase tracking-widest">
          Acesso restrito · Tropa do Arcanjo
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
