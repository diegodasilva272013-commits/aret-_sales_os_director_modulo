'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', authData.user.id)
        .single()

      // Use hard navigation so the server picks up the new session cookie
      if (profile?.rol === 'setter') window.location.href = '/form/setter'
      else if (profile?.rol === 'closer') window.location.href = '/form/closer'
      else window.location.href = '/dashboard'
      return
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#080B14' }}>
      {/* Grid pattern background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }} />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="glass-strong rounded-2xl p-8 animate-fade-in-up">
          {/* Logo / Brand */}
          <div className="text-center mb-8">
            <img src="/arete.png" alt="Areté Soluciones" className="mx-auto w-16 h-16 object-contain mb-4" />
            <h1 className="text-2xl font-bold gradient-text mb-1">Areté Sales OS</h1>
            <p className="text-gray-500 text-sm">Módulo Director de Ventas</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="w-full bg-[#0D1117] border border-gray-700/80 rounded-lg pl-10 pr-4 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500/50 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#0D1117] border border-gray-700/80 rounded-lg pl-10 pr-4 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500/50 transition-all"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-indigo-500/25 disabled:opacity-60 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar al Sistema'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-6">
            Acceso restringido a miembros del equipo
          </p>
        </div>
      </div>
    </div>
  )
}
