'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FolderOpen, Plus, Users, ChevronDown, X, Save, Check, ToggleLeft, ToggleRight, Pencil, LogOut, BookOpen } from 'lucide-react'
import Link from 'next/link'

interface Proyecto {
  id: string
  nombre: string
  empresa: string | null
  descripcion: string | null
  activo: boolean
  tipo: 'evergreen' | 'lanzamiento'
  created_at: string
  proyecto_miembros?: { count: number }[]
}

interface Miembro {
  id: string
  user_id: string
  proyecto_id: string
  rol: string
  profiles: { id: string; nombre: string; rol: string } | null
}

interface Profile {
  id: string
  nombre: string
  rol: string
}

interface Comisiones {
  id?: string
  proyecto_id?: string
  setter_base_mensual: number
  setter_por_cita_show_calificada: number
  setter_por_venta_cerrada: number
  closer_comision_porcentaje: number
  closer_bonus_cierre: number
  closer_bonus_tasa_minima: number
  closer_penalidad_impago_porcentaje: number
  closer_dias_penalidad: number
}

const defaultComisiones: Comisiones = {
  setter_base_mensual: 500,
  setter_por_cita_show_calificada: 25,
  setter_por_venta_cerrada: 75,
  closer_comision_porcentaje: 8,
  closer_bonus_cierre: 500,
  closer_bonus_tasa_minima: 40,
  closer_penalidad_impago_porcentaje: 50,
  closer_dias_penalidad: 30,
}

export default function ProyectosClient() {
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading] = useState(true)

  // New project form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newNombre, setNewNombre] = useState('')
  const [newEmpresa, setNewEmpresa] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newTipo, setNewTipo] = useState<'evergreen' | 'lanzamiento'>('evergreen')
  const [saving, setSaving] = useState(false)

  // Edit project
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editEmpresa, setEditEmpresa] = useState('')
  const [editTipo, setEditTipo] = useState<'evergreen' | 'lanzamiento'>('evergreen')

  // Members panel
  const [membersProyectoId, setMembersProyectoId] = useState<string | null>(null)
  const [membersProyectoNombre, setMembersProyectoNombre] = useState('')
  const [members, setMembers] = useState<Miembro[]>([])
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [addingMember, setAddingMember] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState('')

  // Commissions panel
  const [comisionesProyectoId, setComisionesProyectoId] = useState<string | null>(null)
  const [comisionesProyectoNombre, setComisionesProyectoNombre] = useState('')
  const [comisiones, setComisiones] = useState<Comisiones>(defaultComisiones)
  const [comisionesSaving, setComisionesSaving] = useState(false)
  const [comisionesSaved, setComisionesSaved] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      if (!profile || profile.rol !== 'director') { router.push('/login'); return }
      setAuthReady(true)
    })
  }, [router])

  const fetchProyectos = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/proyectos')
    if (res.ok) setProyectos(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { if (authReady) fetchProyectos() }, [authReady, fetchProyectos])

  async function handleCreate() {
    if (!newNombre.trim()) return
    setSaving(true)
    await fetch('/api/proyectos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: newNombre, empresa: newEmpresa, descripcion: newDesc, tipo: newTipo }),
    })
    setNewNombre(''); setNewEmpresa(''); setNewDesc(''); setNewTipo('evergreen'); setShowNewForm(false)
    await fetchProyectos()
    setSaving(false)
  }

  async function handleToggleActivo(p: Proyecto) {
    await fetch(`/api/proyectos/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: p.nombre, empresa: p.empresa, descripcion: p.descripcion, activo: !p.activo }),
    })
    await fetchProyectos()
  }

  async function handleSaveEdit(id: string) {
    await fetch(`/api/proyectos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editNombre, empresa: editEmpresa, tipo: editTipo }),
    })
    setEditId(null)
    await fetchProyectos()
  }

  async function openMembers(p: Proyecto) {
    setMembersProyectoId(p.id)
    setMembersProyectoNombre(p.nombre)
    const membRes = await fetch(`/api/proyectos/${p.id}/miembros`)
    if (membRes.ok) setMembers(await membRes.json())
    // Fetch all setter/closer profiles
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('id, nombre, rol').in('rol', ['setter', 'closer']).eq('activo', true)
    setAllProfiles(data || [])
    setSelectedProfileId('')
  }

  async function handleAddMember() {
    if (!selectedProfileId || !membersProyectoId) return
    setAddingMember(true)
    const prof = allProfiles.find(p => p.id === selectedProfileId)
    await fetch(`/api/proyectos/${membersProyectoId}/miembros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: selectedProfileId, rol: prof?.rol }),
    })
    const res = await fetch(`/api/proyectos/${membersProyectoId}/miembros`)
    if (res.ok) setMembers(await res.json())
    setSelectedProfileId('')
    setAddingMember(false)
    await fetchProyectos()
  }

  async function handleRemoveMember(memberId: string) {
    if (!membersProyectoId) return
    await fetch(`/api/proyectos/${membersProyectoId}/miembros?member_id=${memberId}`, { method: 'DELETE' })
    const res = await fetch(`/api/proyectos/${membersProyectoId}/miembros`)
    if (res.ok) setMembers(await res.json())
    await fetchProyectos()
  }

  async function openComisiones(p: Proyecto) {
    setComisionesProyectoId(p.id)
    setComisionesProyectoNombre(p.nombre)
    const res = await fetch(`/api/proyectos/${p.id}/comisiones`)
    if (res.ok) {
      const data = await res.json()
      setComisiones(data)
    } else {
      setComisiones({ ...defaultComisiones, proyecto_id: p.id } as Comisiones)
    }
    setComisionesSaved(false)
  }

  async function handleSaveComisiones() {
    if (!comisionesProyectoId) return
    setComisionesSaving(true)
    await fetch(`/api/proyectos/${comisionesProyectoId}/comisiones`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comisiones),
    })
    setComisionesSaving(false)
    setComisionesSaved(true)
    setTimeout(() => setComisionesSaved(false), 2000)
  }

  const memberIdsInProject = new Set(members.map(m => m.user_id))
  const availableProfiles = allProfiles.filter(p => !memberIdsInProject.has(p.id))

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!authReady) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080B14' }}>
      <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
    </div>
  )

  const inputStyle = {
    background: '#0D1117',
    border: '1px solid #1a2234',
    color: '#F1F5F9',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
  } as React.CSSProperties

  const fieldStyle = (label: string, value: number | string, unit: string, onChange: (v: string) => void) => (
    <div>
      <label className="block text-xs mb-1" style={{ color: '#64748B' }}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={inputStyle}
        />
        <span className="text-xs shrink-0" style={{ color: '#475569' }}>{unit}</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: '#080B14' }}>
      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: 'rgba(8,11,20,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #1a2234' }}>
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/arete.png" alt="Areté" className="w-7 h-7 object-contain" />
            <span className="text-sm font-bold tracking-tight hidden sm:block" style={{ color: '#F1F5F9' }}>Areté Sales OS</span>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ color: '#64748B' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#F1F5F9'; (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#64748B'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
            >Dashboard</Link>
            <Link href="/dashboard/equipo" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ color: '#64748B' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#F1F5F9'; (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#64748B'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
            ><Users size={13} /><span className="hidden sm:block">Equipo</span></Link>
            <Link href="/dashboard/proyectos" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ color: '#818CF8', background: 'rgba(99,102,241,0.08)' }}>
              <FolderOpen size={13} /><span className="hidden sm:block">Proyectos</span>
            </Link>
            <div className="w-px h-4 mx-1" style={{ background: '#1a2234' }} />
            <button onClick={handleLogout} className="p-2 rounded-lg transition-all" style={{ color: '#475569' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#F87171'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            ><LogOut size={14} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-7">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-0.5 h-4 rounded-full" style={{ background: '#6366F1' }} />
            <FolderOpen size={14} style={{ color: '#6366F1' }} />
            <h1 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748B' }}>Proyectos</h1>
          </div>
          <button
            onClick={() => setShowNewForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818CF8' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.25)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.15)'}
          >
            <Plus size={13} />
            Nuevo Proyecto
          </button>
        </div>

        {/* New project form */}
        {showNewForm && (
          <div className="rounded-xl p-5 mb-6" style={{ background: '#0D1117', border: '1px solid #1a2234' }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#818CF8' }}>Nuevo Proyecto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#64748B' }}>Nombre *</label>
                <input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Nombre del proyecto" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#64748B' }}>Empresa</label>
                <input value={newEmpresa} onChange={e => setNewEmpresa(e.target.value)} placeholder="Empresa cliente" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#64748B' }}>Descripción</label>
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descripción breve" style={inputStyle} />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs mb-2" style={{ color: '#64748B' }}>Tipo de Proyecto</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setNewTipo('evergreen')}
                  className="flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left"
                  style={{
                    background: newTipo === 'evergreen' ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.04)',
                    border: `1px solid ${newTipo === 'evergreen' ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.15)'}`,
                    color: newTipo === 'evergreen' ? '#818CF8' : '#475569',
                  }}
                >
                  📞 Evergreen — llamadas y citas continuas
                </button>
                <button
                  type="button"
                  onClick={() => setNewTipo('lanzamiento')}
                  className="flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left"
                  style={{
                    background: newTipo === 'lanzamiento' ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.04)',
                    border: `1px solid ${newTipo === 'lanzamiento' ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.15)'}`,
                    color: newTipo === 'lanzamiento' ? '#A78BFA' : '#475569',
                  }}
                >
                  🚀 Lanzamiento — mensajes y campañas
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={saving || !newNombre.trim()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all" style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818CF8' }}>
                {saving ? <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" /> : <Check size={13} />}
                Crear
              </button>
              <button onClick={() => setShowNewForm(false)} className="px-4 py-2 rounded-lg text-xs transition-all" style={{ color: '#475569' }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Projects grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          </div>
        ) : proyectos.length === 0 ? (
          <div className="text-center py-20" style={{ color: '#334155' }}>
            <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay proyectos. Creá el primero.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {proyectos.map(p => {
              const memberCount = p.proyecto_miembros?.[0]?.count ?? 0
              const isEditing = editId === p.id
              return (
                <div key={p.id} className="rounded-xl p-5 flex flex-col gap-4" style={{ background: '#0D1117', border: `1px solid ${p.activo ? '#1a2234' : 'rgba(26,34,52,0.5)'}` }}>
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input value={editNombre} onChange={e => setEditNombre(e.target.value)} style={{ ...inputStyle, fontSize: '0.8rem' }} />
                          <input value={editEmpresa} onChange={e => setEditEmpresa(e.target.value)} placeholder="Empresa" style={{ ...inputStyle, fontSize: '0.8rem' }} />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditTipo('evergreen')}
                              className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                              style={{
                                background: editTipo === 'evergreen' ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.04)',
                                border: `1px solid ${editTipo === 'evergreen' ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.15)'}`,
                                color: editTipo === 'evergreen' ? '#818CF8' : '#475569',
                              }}
                            >
                              📞 Evergreen
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditTipo('lanzamiento')}
                              className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                              style={{
                                background: editTipo === 'lanzamiento' ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.04)',
                                border: `1px solid ${editTipo === 'lanzamiento' ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.15)'}`,
                                color: editTipo === 'lanzamiento' ? '#A78BFA' : '#475569',
                              }}
                            >
                              🚀 Lanzamiento
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveEdit(p.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)' }}>
                              <Check size={11} /> Guardar
                            </button>
                            <button onClick={() => setEditId(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: '#475569' }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm" style={{ color: p.activo ? '#F1F5F9' : '#475569' }}>{p.nombre}</h3>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={p.tipo === 'lanzamiento'
                                ? { background: 'linear-gradient(90deg, rgba(139,92,246,0.2), rgba(167,139,250,0.15))', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.3)' }
                                : { background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)' }
                              }
                            >
                              {p.tipo === 'lanzamiento' ? '🚀 Lanzamiento' : '📞 Evergreen'}
                            </span>
                            <button onClick={() => { setEditId(p.id); setEditNombre(p.nombre); setEditEmpresa(p.empresa || ''); setEditTipo(p.tipo || 'evergreen') }} className="p-1 rounded transition-all opacity-40 hover:opacity-100" style={{ color: '#818CF8' }}>
                              <Pencil size={11} />
                            </button>
                          </div>
                          {p.empresa && <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{p.empresa}</p>}
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleActivo(p)}
                      title={p.activo ? 'Desactivar' : 'Activar'}
                      style={{ color: p.activo ? '#34D399' : '#475569' }}
                    >
                      {p.activo ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: '#64748B' }}>
                      <Users size={12} />
                      <span>{memberCount} miembro{memberCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-xs px-2 py-0.5 rounded-full" style={{ background: p.activo ? 'rgba(52,211,153,0.1)' : 'rgba(71,85,105,0.15)', color: p.activo ? '#34D399' : '#475569' }}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1 border-t" style={{ borderColor: '#1a2234' }}>
                    <Link
                      href={`/dashboard/proyectos/${p.id}/brief`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', color: '#FBBF24' }}
                      onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(251,191,36,0.12)'}
                      onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(251,191,36,0.06)'}
                    >
                      <BookOpen size={11} /> Brief
                    </Link>
                    <button
                      onClick={() => openMembers(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', color: '#818CF8' }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.15)'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.08)'}
                    >
                      <Users size={11} /> Equipo
                    </button>
                    <button
                      onClick={() => openComisiones(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', color: '#34D399' }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(52,211,153,0.12)'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(52,211,153,0.06)'}
                    >
                      <ChevronDown size={11} /> Comisiones
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Members Panel Modal */}
      {membersProyectoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#0D1117', border: '1px solid #1a2234' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>Equipo del proyecto</h2>
                <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{membersProyectoNombre}</p>
              </div>
              <button onClick={() => setMembersProyectoId(null)} style={{ color: '#475569' }}>
                <X size={16} />
              </button>
            </div>

            {/* Current members */}
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {members.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: '#334155' }}>Sin miembros aún</p>
              ) : members.map(m => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#111827', border: '1px solid #1a2234' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8' }}>
                      {m.profiles?.nombre?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm" style={{ color: '#F1F5F9' }}>{m.profiles?.nombre}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: m.rol === 'setter' ? 'rgba(99,102,241,0.15)' : 'rgba(52,211,153,0.1)', color: m.rol === 'setter' ? '#818CF8' : '#34D399' }}>
                      {m.rol}
                    </span>
                  </div>
                  <button onClick={() => handleRemoveMember(m.id)} className="p-1 rounded transition-all" style={{ color: '#475569' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#F87171'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#475569'}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add member */}
            {availableProfiles.length > 0 && (
              <div className="flex gap-2 pt-4 border-t" style={{ borderColor: '#1a2234' }}>
                <select
                  value={selectedProfileId}
                  onChange={e => setSelectedProfileId(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="">Agregar miembro...</option>
                  {availableProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} ({p.rol})</option>
                  ))}
                </select>
                <button
                  onClick={handleAddMember}
                  disabled={!selectedProfileId || addingMember}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818CF8' }}
                >
                  {addingMember ? <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" /> : <Plus size={12} />}
                  Agregar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Commissions Panel Modal */}
      {comisionesProyectoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: '#0D1117', border: '1px solid #1a2234' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>Configuración de comisiones</h2>
                <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{comisionesProyectoNombre}</p>
              </div>
              <button onClick={() => setComisionesProyectoId(null)} style={{ color: '#475569' }}>
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Setter column */}
              <div className="rounded-xl p-4 space-y-4" style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 rounded-full" style={{ background: '#6366F1' }} />
                  <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#818CF8' }}>Setter</h3>
                </div>
                {fieldStyle('Base mensual', comisiones.setter_base_mensual, '$', v => setComisiones(c => ({ ...c, setter_base_mensual: parseFloat(v) || 0 })))}
                {fieldStyle('Por cita show calificada', comisiones.setter_por_cita_show_calificada, '$', v => setComisiones(c => ({ ...c, setter_por_cita_show_calificada: parseFloat(v) || 0 })))}
                {fieldStyle('Por venta cerrada', comisiones.setter_por_venta_cerrada, '$', v => setComisiones(c => ({ ...c, setter_por_venta_cerrada: parseFloat(v) || 0 })))}
              </div>

              {/* Closer column */}
              <div className="rounded-xl p-4 space-y-4" style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 rounded-full" style={{ background: '#10B981' }} />
                  <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#34D399' }}>Closer</h3>
                </div>
                {fieldStyle('Comisión sobre cobrado', comisiones.closer_comision_porcentaje, '%', v => setComisiones(c => ({ ...c, closer_comision_porcentaje: parseFloat(v) || 0 })))}
                {fieldStyle('Bonus por tasa de cierre', comisiones.closer_bonus_cierre, '$', v => setComisiones(c => ({ ...c, closer_bonus_cierre: parseFloat(v) || 0 })))}
                {fieldStyle('Tasa mínima para bonus', comisiones.closer_bonus_tasa_minima, '%', v => setComisiones(c => ({ ...c, closer_bonus_tasa_minima: parseFloat(v) || 0 })))}
                {fieldStyle('Penalidad por impago', comisiones.closer_penalidad_impago_porcentaje, '%', v => setComisiones(c => ({ ...c, closer_penalidad_impago_porcentaje: parseFloat(v) || 0 })))}
                {fieldStyle('Días para penalidad', comisiones.closer_dias_penalidad, 'días', v => setComisiones(c => ({ ...c, closer_dias_penalidad: parseInt(v) || 0 })))}
              </div>
            </div>

            <div className="flex justify-end mt-5 pt-4 border-t" style={{ borderColor: '#1a2234' }}>
              <button
                onClick={handleSaveComisiones}
                disabled={comisionesSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: comisionesSaved ? 'rgba(52,211,153,0.15)' : 'rgba(99,102,241,0.2)', border: `1px solid ${comisionesSaved ? 'rgba(52,211,153,0.3)' : 'rgba(99,102,241,0.4)'}`, color: comisionesSaved ? '#34D399' : '#818CF8' }}
              >
                {comisionesSaving ? (
                  <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                ) : comisionesSaved ? (
                  <Check size={13} />
                ) : (
                  <Save size={13} />
                )}
                {comisionesSaved ? 'Guardado' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
