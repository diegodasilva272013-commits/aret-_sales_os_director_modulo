'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Plus, UserCheck, UserX, Loader2 } from 'lucide-react'
import Badge from '@/components/ui/Badge'

interface Profile {
  id: string
  nombre: string
  rol: 'setter' | 'closer' | 'director'
  activo: boolean
  created_at: string
}

export default function EquipoPageClient() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ nombre: '', email: '', password: '', rol: 'setter' as 'setter' | 'closer' | 'director' })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  async function fetchProfiles() {
    setLoading(true)
    const res = await fetch('/api/equipo')
    if (res.ok) {
      const json = await res.json()
      setProfiles(json.profiles || [])
    }
    setLoading(false)
  }

  useEffect(() => { fetchProfiles() }, [])

  async function handleToggleActive(id: string, activo: boolean) {
    await fetch('/api/equipo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activo: !activo }),
    })
    await fetchProfiles()
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    setFormSuccess('')

    const res = await fetch('/api/equipo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    const json = await res.json()
    if (!res.ok) {
      setFormError(json.error || 'Error al crear el usuario')
    } else {
      setFormSuccess('Usuario creado exitosamente')
      setFormData({ nombre: '', email: '', password: '', rol: 'setter' })
      setShowForm(false)
      await fetchProfiles()
    }
    setFormLoading(false)
  }

  const roleBadge = (rol: string): 'bueno' | 'top' | 'default' => {
    if (rol === 'director') return 'top'
    if (rol === 'closer') return 'bueno'
    return 'default'
  }

  return (
    <div className="min-h-screen" style={{ background: '#080B14' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-300 transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <Users size={20} className="text-indigo-400" />
              <h1 className="text-xl font-bold text-white">Equipo</h1>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-medium transition-all"
          >
            <Plus size={16} />
            Invitar Usuario
          </button>
        </div>

        {/* Create user form */}
        {showForm && (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-6 mb-6 animate-fade-in-up">
            <h3 className="text-sm font-semibold text-indigo-400 mb-4">Nuevo Usuario</h3>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Nombre completo</label>
                <input
                  required
                  value={formData.nombre}
                  onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Juan Pérez"
                  className="w-full bg-[#0D1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  placeholder="juan@empresa.com"
                  className="w-full bg-[#0D1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Contraseña temporal</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-[#0D1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Rol</label>
                <select
                  value={formData.rol}
                  onChange={e => setFormData(p => ({ ...p, rol: e.target.value as 'setter' | 'closer' | 'director' }))}
                  className="w-full bg-[#0D1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="setter">Setter</option>
                  <option value="closer">Closer</option>
                  <option value="director">Director</option>
                </select>
              </div>

              {formError && (
                <div className="sm:col-span-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  <p className="text-red-400 text-sm">{formError}</p>
                </div>
              )}
              {formSuccess && (
                <div className="sm:col-span-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                  <p className="text-emerald-400 text-sm">{formSuccess}</p>
                </div>
              )}

              <div className="sm:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-medium disabled:opacity-60"
                >
                  {formLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                  Crear Usuario
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-lg border border-gray-700 text-gray-400 text-sm hover:bg-gray-800 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Team list */}
        <div className="rounded-xl border border-gray-800 bg-[#111827] overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Nombre</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Rol</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Estado</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile, i) => (
                  <tr key={profile.id} className={`border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                    <td className="px-4 py-3 font-medium text-white">{profile.nombre || 'Sin nombre'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={roleBadge(profile.rol)}>
                        {profile.rol}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {profile.activo ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 text-xs">
                          <UserCheck size={12} />
                          Activo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-gray-500 text-xs">
                          <UserX size={12} />
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleToggleActive(profile.id, profile.activo)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          profile.activo
                            ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                            : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {profile.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No hay usuarios en el equipo
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
