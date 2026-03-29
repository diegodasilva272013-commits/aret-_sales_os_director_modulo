'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Plus, Loader2, Edit2, X, Check, Clock, Phone, CreditCard } from 'lucide-react'

interface MetodoPago {
  id: string
  tipo: string
  datos: string
  titular?: string
  principal: boolean
}

interface Proyecto {
  id: string
  nombre: string
  activo: boolean
}

interface Profile {
  id: string
  nombre: string
  apellido?: string
  telefono?: string
  foto_url?: string
  rol: 'setter' | 'closer' | 'director'
  activo: boolean
  horario_inicio?: string
  horario_fin?: string
  dias_trabajo?: string[]
  notas?: string
  pagos?: MetodoPago[]
  proyectos?: Proyecto[]
}

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue',
  viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom'
}

const ROL_COLORS: Record<string, string> = {
  director: '#818CF8',
  setter: '#34D399',
  closer: '#FBBF24',
}

function Avatar({ profile, size = 56 }: { profile: Profile; size?: number }) {
  const initials = [profile.nombre?.[0], profile.apellido?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  if (profile.foto_url) {
    return (
      <img
        src={profile.foto_url}
        alt={profile.nombre}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid #1a2234' }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
      fontSize: size > 40 ? 18 : 12, fontWeight: 700, color: '#fff',
      border: '2px solid #1a2234', flexShrink: 0
    }}>
      {initials}
    </div>
  )
}

function ProfileCard({ profile, allProyectos, onUpdated }: {
  profile: Profile
  allProyectos: Proyecto[]
  onUpdated: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editData, setEditData] = useState<Profile>({ ...profile })
  const [saving, setSaving] = useState(false)
  const [newPago, setNewPago] = useState({ tipo: 'cbu', datos: '', titular: '' })
  const [addingPago, setAddingPago] = useState(false)

  const pagos = profile.pagos || []
  const proyectos = profile.proyectos || []

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/equipo/${profile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    })
    setSaving(false)
    setExpanded(false)
    onUpdated()
  }

  async function handleAddPago() {
    if (!newPago.datos) return
    await fetch(`/api/equipo/${profile.id}/pagos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPago),
    })
    setNewPago({ tipo: 'cbu', datos: '', titular: '' })
    setAddingPago(false)
    onUpdated()
  }

  async function handleDeletePago(pagoId: string) {
    await fetch(`/api/equipo/${profile.id}/pagos`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pago_id: pagoId }),
    })
    onUpdated()
  }

  const toggleDia = (dia: string) => {
    const dias = editData.dias_trabajo || []
    setEditData(prev => ({
      ...prev,
      dias_trabajo: dias.includes(dia) ? dias.filter(d => d !== dia) : [...dias, dia]
    }))
  }

  const toggleProyecto = (pid: string) => {
    const ids = (editData.proyectos || []).map(p => p.id)
    if (ids.includes(pid)) {
      setEditData(prev => ({ ...prev, proyectos: (prev.proyectos || []).filter(p => p.id !== pid) }))
    } else {
      const p = allProyectos.find(p => p.id === pid)
      if (p) setEditData(prev => ({ ...prev, proyectos: [...(prev.proyectos || []), p] }))
    }
  }

  return (
    <div
      style={{
        background: '#0D1117', border: '1px solid #1a2234', borderRadius: 12,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = '#2d3748'
        el.style.boxShadow = '0 4px 24px rgba(99,102,241,0.08)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = '#1a2234'
        el.style.boxShadow = 'none'
      }}
    >
      {/* Card Header */}
      <div style={{ padding: '1.25rem' }}>
        <div className="flex items-start gap-3">
          <Avatar profile={profile} size={56} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 15 }}>
                {profile.nombre} {profile.apellido || ''}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                color: ROL_COLORS[profile.rol] || '#64748B',
                background: `${ROL_COLORS[profile.rol]}18`,
                border: `1px solid ${ROL_COLORS[profile.rol]}33`,
                borderRadius: 6, padding: '1px 7px'
              }}>
                {profile.rol}
              </span>
            </div>
            {profile.telefono && (
              <div className="flex items-center gap-1.5 mt-1" style={{ color: '#64748B', fontSize: 12 }}>
                <Phone size={11} />
                {profile.telefono}
              </div>
            )}
            {(profile.horario_inicio || profile.horario_fin) && (
              <div className="flex items-center gap-1.5 mt-0.5" style={{ color: '#64748B', fontSize: 12 }}>
                <Clock size={11} />
                {profile.dias_trabajo?.map(d => DIAS_LABEL[d] || d).join('-') || 'Lun-Vie'}{' '}
                {profile.horario_inicio || '09:00'}–{profile.horario_fin || '18:00'}
              </div>
            )}
          </div>
          <button
            onClick={() => { setExpanded(!expanded); setEditData({ ...profile }) }}
            style={{
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 8, padding: '5px 10px', color: '#818CF8', fontSize: 12,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
            }}
          >
            <Edit2 size={12} />
            Editar
          </button>
        </div>

        {/* Projects */}
        {proyectos.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {proyectos.map(p => (
              <span key={p.id} style={{
                fontSize: 11, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 6, padding: '2px 8px', color: '#818CF8'
              }}>
                {p.nombre}
              </span>
            ))}
          </div>
        )}

        {/* Payment methods */}
        {pagos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <CreditCard size={11} style={{ color: '#475569' }} />
            {pagos.map(p => (
              <span key={p.id} style={{ fontSize: 11, color: '#475569' }}>
                {p.tipo.toUpperCase()} {p.datos.length > 12 ? p.datos.slice(0, 12) + '…' : p.datos}
              </span>
            ))}
            <button
              onClick={() => { setExpanded(true); setAddingPago(true) }}
              style={{ fontSize: 11, color: '#818CF8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              + agregar
            </button>
          </div>
        )}
        {pagos.length === 0 && (
          <div className="mt-2">
            <button
              onClick={() => { setExpanded(true); setAddingPago(true) }}
              style={{ fontSize: 11, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              + agregar método de pago
            </button>
          </div>
        )}
      </div>

      {/* Expanded Edit Panel */}
      {expanded && (
        <div style={{ borderTop: '1px solid #1a2234', padding: '1.25rem', background: '#080B14' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nombre */}
            <div>
              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Nombre</label>
              <input
                value={editData.nombre || ''}
                onChange={e => setEditData(p => ({ ...p, nombre: e.target.value }))}
                style={inputStyle}
              />
            </div>
            {/* Apellido */}
            <div>
              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Apellido</label>
              <input
                value={editData.apellido || ''}
                onChange={e => setEditData(p => ({ ...p, apellido: e.target.value }))}
                style={inputStyle}
              />
            </div>
            {/* Teléfono */}
            <div>
              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Teléfono</label>
              <input
                value={editData.telefono || ''}
                onChange={e => setEditData(p => ({ ...p, telefono: e.target.value }))}
                style={inputStyle}
              />
            </div>
            {/* Rol */}
            <div>
              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Rol</label>
              <select
                value={editData.rol}
                onChange={e => setEditData(p => ({ ...p, rol: e.target.value as Profile['rol'] }))}
                style={inputStyle}
              >
                <option value="setter">Setter</option>
                <option value="closer">Closer</option>
                <option value="director">Director</option>
              </select>
            </div>
            {/* Foto URL */}
            <div className="sm:col-span-2">
              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Foto URL</label>
              <div className="flex gap-2 items-center">
                <input
                  value={editData.foto_url || ''}
                  onChange={e => setEditData(p => ({ ...p, foto_url: e.target.value }))}
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="https://..."
                />
                {editData.foto_url && (
                  <img src={editData.foto_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                )}
              </div>
            </div>
            {/* Horario */}
            <div>
              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Horario inicio</label>
              <input
                type="time"
                value={editData.horario_inicio || '09:00'}
                onChange={e => setEditData(p => ({ ...p, horario_inicio: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Horario fin</label>
              <input
                type="time"
                value={editData.horario_fin || '18:00'}
                onChange={e => setEditData(p => ({ ...p, horario_fin: e.target.value }))}
                style={inputStyle}
              />
            </div>
            {/* Días */}
            <div className="sm:col-span-2">
              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 6 }}>Días que trabaja</label>
              <div className="flex flex-wrap gap-2">
                {DIAS.map(dia => {
                  const active = (editData.dias_trabajo || []).includes(dia)
                  return (
                    <button
                      key={dia}
                      type="button"
                      onClick={() => toggleDia(dia)}
                      style={{
                        fontSize: 11, borderRadius: 8, padding: '3px 10px', cursor: 'pointer',
                        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                        border: `1px solid ${active ? 'rgba(99,102,241,0.4)' : '#1a2234'}`,
                        color: active ? '#818CF8' : '#475569',
                        transition: 'all 0.15s'
                      }}
                    >
                      {DIAS_LABEL[dia]}
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Proyectos asignados */}
            <div className="sm:col-span-2">
              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 6 }}>Proyectos asignados</label>
              <div className="flex flex-wrap gap-2">
                {allProyectos.filter(p => p.activo).map(p => {
                  const active = (editData.proyectos || []).some(ep => ep.id === p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProyecto(p.id)}
                      style={{
                        fontSize: 11, borderRadius: 8, padding: '3px 10px', cursor: 'pointer',
                        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                        border: `1px solid ${active ? 'rgba(99,102,241,0.4)' : '#1a2234'}`,
                        color: active ? '#818CF8' : '#475569',
                      }}
                    >
                      {p.nombre}
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Notas */}
            <div className="sm:col-span-2">
              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Notas</label>
              <textarea
                value={editData.notas || ''}
                onChange={e => setEditData(p => ({ ...p, notas: e.target.value }))}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Payment methods management */}
          <div style={{ marginTop: 16 }}>
            <div className="flex items-center justify-between mb-3">
              <label style={{ fontSize: 11, color: '#64748B' }}>Métodos de pago</label>
              <button
                onClick={() => setAddingPago(!addingPago)}
                style={{ fontSize: 11, color: '#818CF8', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                + Agregar
              </button>
            </div>
            {pagos.map(p => (
              <div key={p.id} className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 11, color: '#64748B', background: '#0D1117', border: '1px solid #1a2234', borderRadius: 6, padding: '3px 8px' }}>
                  {p.tipo.toUpperCase()}
                </span>
                <span style={{ fontSize: 11, color: '#94A3B8', flex: 1 }}>{p.datos}</span>
                {p.titular && <span style={{ fontSize: 11, color: '#475569' }}>{p.titular}</span>}
                <button
                  onClick={() => handleDeletePago(p.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 2 }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {addingPago && (
              <div className="flex flex-wrap gap-2 mt-2">
                <select
                  value={newPago.tipo}
                  onChange={e => setNewPago(p => ({ ...p, tipo: e.target.value }))}
                  style={{ ...inputStyle, width: 'auto' }}
                >
                  {['cbu', 'alias', 'paypal', 'usdt', 'transferencia', 'otro'].map(t => (
                    <option key={t} value={t}>{t.toUpperCase()}</option>
                  ))}
                </select>
                <input
                  placeholder="Datos"
                  value={newPago.datos}
                  onChange={e => setNewPago(p => ({ ...p, datos: e.target.value }))}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  placeholder="Titular"
                  value={newPago.titular}
                  onChange={e => setNewPago(p => ({ ...p, titular: e.target.value }))}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={handleAddPago} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: '4px 12px', color: '#818CF8', fontSize: 12, cursor: 'pointer' }}>
                  <Check size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                border: 'none', borderRadius: 8, padding: '7px 18px',
                color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1
              }}
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              Guardar cambios
            </button>
            <button
              onClick={() => setExpanded(false)}
              style={{ background: 'transparent', border: '1px solid #1a2234', borderRadius: 8, padding: '7px 14px', color: '#64748B', fontSize: 12, cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0D1117',
  border: '1px solid #1a2234',
  borderRadius: 8,
  padding: '6px 10px',
  color: '#F1F5F9',
  fontSize: 12,
  outline: 'none',
}

export default function EquipoClient() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [allProyectos, setAllProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({ nombre: '', apellido: '', email: '', password: '', rol: 'setter' as Profile['rol'], telefono: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  async function fetchAll() {
    setLoading(true)
    const [equipoRes, proyRes] = await Promise.all([
      fetch('/api/equipo'),
      fetch('/api/proyectos'),
    ])
    const equipoJson = equipoRes.ok ? await equipoRes.json() : { profiles: [] }
    const proyJson = proyRes.ok ? await proyRes.json() : []

    const baseProfiles: Profile[] = equipoJson.profiles || []
    setAllProyectos(Array.isArray(proyJson) ? proyJson : [])

    // Fetch detail for each profile to get pagos + proyectos
    const detailed = await Promise.all(
      baseProfiles.map(async p => {
        const res = await fetch(`/api/equipo/${p.id}`)
        if (res.ok) {
          const d = await res.json()
          return { ...p, pagos: d.pagos || [], proyectos: d.proyectos || [] }
        }
        return { ...p, pagos: [], proyectos: [] }
      })
    )
    setProfiles(detailed)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    const res = await fetch('/api/equipo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    const json = await res.json()
    if (!res.ok) {
      setFormError(json.error || 'Error al crear usuario')
    } else {
      setShowAddForm(false)
      setFormData({ nombre: '', apellido: '', email: '', password: '', rol: 'setter', telefono: '' })
      await fetchAll()
    }
    setFormLoading(false)
  }

  return (
    <div className="min-h-screen" style={{ background: '#080B14' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" style={{ color: '#475569' }}>
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <Users size={18} style={{ color: '#6366F1' }} />
              <h1 style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 18 }}>Equipo</h1>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              border: 'none', borderRadius: 10, padding: '8px 16px',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Plus size={14} />
            Agregar miembro
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div style={{ background: '#0D1117', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#818CF8', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Nuevo miembro</h3>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Nombre</label>
                <input required value={formData.nombre} onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))} placeholder="Juan" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Apellido</label>
                <input value={formData.apellido} onChange={e => setFormData(p => ({ ...p, apellido: e.target.value }))} placeholder="Pérez" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Teléfono</label>
                <input value={formData.telefono} onChange={e => setFormData(p => ({ ...p, telefono: e.target.value }))} placeholder="+54 11 1234-5678" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Email</label>
                <input type="email" required value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Contraseña</label>
                <input type="password" required minLength={6} value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Rol</label>
                <select value={formData.rol} onChange={e => setFormData(p => ({ ...p, rol: e.target.value as Profile['rol'] }))} style={inputStyle}>
                  <option value="setter">Setter</option>
                  <option value="closer">Closer</option>
                  <option value="director">Director</option>
                </select>
              </div>
              {formError && (
                <div className="sm:col-span-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  <p style={{ color: '#F87171', fontSize: 12 }}>{formError}</p>
                </div>
              )}
              <div className="sm:col-span-3 flex gap-2">
                <button type="submit" disabled={formLoading} style={{
                  background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', border: 'none', borderRadius: 8,
                  padding: '8px 18px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: formLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, opacity: formLoading ? 0.7 : 1
                }}>
                  {formLoading && <Loader2 size={12} className="animate-spin" />}
                  Crear usuario
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} style={{ background: 'transparent', border: '1px solid #1a2234', borderRadius: 8, padding: '8px 14px', color: '#64748B', fontSize: 12, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Grid of cards */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profiles.map(profile => (
              <ProfileCard key={profile.id} profile={profile} allProyectos={allProyectos} onUpdated={fetchAll} />
            ))}
            {profiles.length === 0 && (
              <div className="md:col-span-2 text-center py-12" style={{ color: '#475569' }}>
                No hay miembros en el equipo
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
