'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users2, Search, Edit2, Save, Trash2, ChevronDown, ChevronUp,
  DollarSign, Calendar, Activity, Eye,
  Download
} from 'lucide-react'

const C = {
  bg: '#080B14', surface: '#0D1117', card: '#111827',
  border: '#1a2234', borderLight: '#1F2937',
  text: '#F1F5F9', textMuted: '#94A3B8', textDim: '#475569', textDark: '#334155',
  accent: '#6366F1', accentLight: '#818CF8',
  green: '#34D399', red: '#F87171', yellow: '#FBBF24', orange: '#FB923C',
}

function fmt(n: number) {
  return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Profile { id: string; nombre: string; apellido: string; rol: string }

interface Cliente {
  id: string
  nombre_cliente: string
  documento: string | null
  closer_id: string | null
  setter_id: string | null
  monto_referencia: number
  estado: string
  notas: string | null
  creado_en: string
  fuente: string | null
  campana: string | null
  canal: string | null
  // Enriched
  closer_nombre?: string
  setter_nombre?: string
  total_cuotas?: number
  cuotas_pagadas?: number
  total_pagado?: number
}

const estadoStyle: Record<string, { color: string; bg: string; label: string }> = {
  activo: { color: C.green, bg: `${C.green}15`, label: 'Activo' },
  vencido: { color: C.red, bg: `${C.red}15`, label: 'Vencido' },
  pagado: { color: C.accent, bg: `${C.accent}15`, label: 'Pagado' },
}

export default function ClientesClient() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Cliente>>({})
  const [saving, setSaving] = useState(false)
  const [sortKey, setSortKey] = useState<'nombre' | 'monto' | 'fecha' | 'estado'>('fecha')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const fetchData = useCallback(async () => {
    setLoading(true)

    // Fetch clients
    const { data: clientesData } = await supabase
      .from('clientes_cartera')
      .select('*')
      .order('creado_en', { ascending: false })

    // Fetch profiles
    const res = await fetch('/api/equipo')
    const profilesData = await res.json()
    const profs: Profile[] = Array.isArray(profilesData) ? profilesData : profilesData.profiles || []
    setProfiles(profs)

    const profMap = Object.fromEntries(profs.map(p => [p.id, `${p.nombre || ''} ${p.apellido || ''}`.trim()]))

    // Fetch cuota stats per client
    const clienteIds = (clientesData || []).map(c => c.id)
    let cuotaStats: Record<string, { total: number; pagadas: number; total_pagado: number }> = {}
    if (clienteIds.length > 0) {
      const { data: cuotas } = await supabase
        .from('cuotas')
        .select('cliente_id, estado, monto')
        .in('cliente_id', clienteIds)

      const grouped: Record<string, { total: number; pagadas: number; total_pagado: number }> = {}
      for (const c of cuotas || []) {
        if (!grouped[c.cliente_id]) grouped[c.cliente_id] = { total: 0, pagadas: 0, total_pagado: 0 }
        grouped[c.cliente_id].total++
        if (c.estado === 'pagada') {
          grouped[c.cliente_id].pagadas++
          grouped[c.cliente_id].total_pagado += Number(c.monto)
        }
      }
      cuotaStats = grouped
    }

    // Enrich
    const enriched = (clientesData || []).map(c => ({
      ...c,
      closer_nombre: profMap[c.closer_id] || '',
      setter_nombre: profMap[c.setter_id] || '',
      total_cuotas: cuotaStats[c.id]?.total || 0,
      cuotas_pagadas: cuotaStats[c.id]?.pagadas || 0,
      total_pagado: cuotaStats[c.id]?.total_pagado || 0,
    }))

    setClientes(enriched)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      fetchData()
    }
    checkAuth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async (id: string) => {
    setSaving(true)
    const { error } = await supabase
      .from('clientes_cartera')
      .update({
        nombre_cliente: editForm.nombre_cliente,
        documento: editForm.documento || null,
        closer_id: editForm.closer_id || null,
        setter_id: editForm.setter_id || null,
        notas: editForm.notas || null,
        fuente: editForm.fuente || null,
        campana: editForm.campana || null,
        canal: editForm.canal || null,
      })
      .eq('id', id)

    if (!error) {
      setEditingId(null)
      fetchData()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente y todas sus cuotas?')) return
    const { error } = await supabase.from('clientes_cartera').delete().eq('id', id)
    if (!error) fetchData()
  }

  const startEdit = (c: Cliente) => {
    setEditingId(c.id)
    setEditForm({
      nombre_cliente: c.nombre_cliente,
      documento: c.documento,
      closer_id: c.closer_id,
      setter_id: c.setter_id,
      notas: c.notas,
      fuente: c.fuente,
      campana: c.campana,
      canal: c.canal,
    })
  }

  // Filter
  const filtered = clientes.filter(c => {
    if (filtroEstado && c.estado !== filtroEstado) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return (c.nombre_cliente || '').toLowerCase().includes(q) ||
        (c.documento || '').toLowerCase().includes(q) ||
        (c.closer_nombre || '').toLowerCase().includes(q) ||
        (c.setter_nombre || '').toLowerCase().includes(q) ||
        (c.fuente || '').toLowerCase().includes(q) ||
        (c.canal || '').toLowerCase().includes(q)
    }
    return true
  }).sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortKey) {
      case 'nombre': return dir * a.nombre_cliente.localeCompare(b.nombre_cliente)
      case 'monto': return dir * (Number(a.monto_referencia) - Number(b.monto_referencia))
      case 'fecha': return dir * (a.creado_en.localeCompare(b.creado_en))
      case 'estado': return dir * (a.estado.localeCompare(b.estado))
      default: return 0
    }
  })

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function exportCSV() {
    let csv = 'sep=,\nNombre,Documento,Estado,Monto,Closer,Setter,Fuente,Canal,Campaña,Cuotas Pagadas,Total Pagado,Creado\n'
    filtered.forEach(c => {
      csv += `"${c.nombre_cliente}","${c.documento || ''}",${c.estado},${c.monto_referencia},"${c.closer_nombre || ''}","${c.setter_nombre || ''}","${c.fuente || ''}","${c.canal || ''}","${c.campana || ''}",${c.cuotas_pagadas || 0}/${c.total_cuotas || 0},${c.total_pagado || 0},${c.creado_en}\n`
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'clientes.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // Stats
  const totalClientes = clientes.length
  const activos = clientes.filter(c => c.estado === 'activo').length
  const vencidos = clientes.filter(c => c.estado === 'vencido').length
  const totalMonto = clientes.reduce((s, c) => s + Number(c.monto_referencia), 0)

  const inputStyle: React.CSSProperties = { background: C.card, border: `1px solid ${C.borderLight}`, color: C.text }
  const closers = profiles.filter(p => p.rol === 'closer')
  const setters = profiles.filter(p => p.rol === 'setter')

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>

      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50" style={{ background: 'rgba(8,11,20,0.92)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.border}` }}>
        <div className="max-w-7xl mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users2 size={16} style={{ color: C.accentLight }} />
            <span className="text-sm font-bold tracking-tight">Clientes</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${C.accent}20`, color: C.accentLight }}>
              {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: C.textDark }} />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar cliente, doc..."
                className="pl-8 pr-3 py-1.5 rounded-lg text-xs w-48"
                style={inputStyle}
              />
            </div>
            <button onClick={exportCSV} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/5" style={{ color: C.textDim }}>
              <Download size={12} /> CSV
            </button>
          </div>
        </div>
        {/* Filter tabs + Sort */}
        <div className="max-w-7xl mx-auto px-5 h-9 flex items-center gap-1" style={{ borderTop: '1px solid rgba(26,34,52,0.5)' }}>
          {[
            { key: '', label: 'Todos', count: clientes.length },
            { key: 'activo', label: 'Activos', count: activos },
            { key: 'vencido', label: 'Vencidos', count: vencidos },
            { key: 'pagado', label: 'Pagados', count: clientes.filter(c => c.estado === 'pagado').length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFiltroEstado(tab.key)}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all"
              style={{
                color: filtroEstado === tab.key ? C.accentLight : C.textDim,
                background: filtroEstado === tab.key ? `${C.accent}15` : 'transparent'
              }}
            >
              {tab.label} <span style={{ color: C.textDark }}>{tab.count}</span>
            </button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center gap-0.5">
            <span className="text-[10px] mr-1" style={{ color: C.textDark }}>Ordenar:</span>
            {([['nombre', 'Nombre'], ['monto', 'Monto'], ['fecha', 'Fecha']] as const).map(([key, label]) => (
              <button key={key} onClick={() => toggleSort(key)}
                className="px-2 py-0.5 rounded text-[10px] font-medium transition-all"
                style={{ color: sortKey === key ? C.accentLight : C.textDark, background: sortKey === key ? `${C.accent}12` : 'transparent' }}>
                {label} {sortKey === key && (sortDir === 'asc' ? '↑' : '↓')}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ═══ STATS ═══ */}
      {!loading && (
        <div style={{ background: `linear-gradient(135deg, ${C.surface} 0%, #0a0f1a 100%)`, borderBottom: `1px solid ${C.border}` }}>
          <div className="max-w-7xl mx-auto px-5 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Clientes', value: totalClientes.toString(), color: C.accentLight, icon: Users2 },
              { label: 'Activos', value: activos.toString(), color: C.green, icon: Activity },
              { label: 'Vencidos', value: vencidos.toString(), color: C.red, icon: Calendar },
              { label: 'Monto Total', value: fmt(totalMonto), color: C.yellow, icon: DollarSign },
            ].map((card, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg" style={{ background: `${card.color}15` }}>
                    <card.icon size={14} style={{ color: card.color }} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textDim }}>{card.label}</span>
                </div>
                <p className="text-lg font-bold" style={{ color: card.color }}>{card.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ LOADING ═══ */}
      {loading && (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${C.accent} transparent ${C.accent} ${C.accent}` }} />
            <span className="text-xs" style={{ color: C.textDim }}>Cargando clientes...</span>
          </div>
        </div>
      )}

      {/* ═══ CLIENT LIST ═══ */}
      {!loading && (
        <div className="max-w-7xl mx-auto px-5 py-6">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <Users2 size={32} style={{ color: C.textDark }} className="mx-auto mb-3" />
              <p className="text-sm" style={{ color: C.textDim }}>No hay clientes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(cliente => {
                const est = estadoStyle[cliente.estado] || estadoStyle.activo
                const isExpanded = expandedId === cliente.id
                const isEditing = editingId === cliente.id
                const progress = cliente.total_cuotas ? Math.round((cliente.cuotas_pagadas! / cliente.total_cuotas) * 100) : 0

                return (
                  <div key={cliente.id} className="rounded-xl overflow-hidden transition-all" style={{ background: C.card, border: `1px solid ${isExpanded ? C.accent + '40' : C.border}` }}>
                    {/* Row */}
                    <button
                      onClick={() => { setExpandedId(isExpanded ? null : cliente.id); setEditingId(null) }}
                      className="w-full px-4 py-3 flex items-center gap-4 text-left transition-all hover:bg-white/[0.02]"
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: `${C.accent}15`, color: C.accentLight }}>
                        {cliente.nombre_cliente.slice(0, 2).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold truncate" style={{ color: C.text }}>{cliente.nombre_cliente}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0" style={{ background: est.bg, color: est.color }}>
                            {est.label}
                          </span>
                        </div>
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: C.textDim }}>
                          {cliente.documento || 'Sin doc'}
                          {cliente.closer_nombre && ` · Closer: ${cliente.closer_nombre}`}
                          {cliente.setter_nombre && ` · Setter: ${cliente.setter_nombre}`}
                        </p>
                      </div>

                      {/* Cuotas progress */}
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: progress === 100 ? C.green : C.accent }} />
                        </div>
                        <span className="text-[10px]" style={{ color: C.textDim }}>{cliente.cuotas_pagadas}/{cliente.total_cuotas}</span>
                      </div>

                      {/* Amount */}
                      <span className="text-sm font-bold shrink-0" style={{ color: C.text }}>{fmt(Number(cliente.monto_referencia))}</span>

                      <div className="shrink-0" style={{ color: C.textDark }}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && !isEditing && (
                      <div className="px-4 pb-4 pt-1" style={{ borderTop: `1px solid ${C.border}` }}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.textDark }}>Documento</p>
                            <p className="text-xs" style={{ color: C.textMuted }}>{cliente.documento || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.textDark }}>Fuente</p>
                            <p className="text-xs" style={{ color: C.textMuted }}>{cliente.fuente || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.textDark }}>Canal</p>
                            <p className="text-xs" style={{ color: C.textMuted }}>{cliente.canal || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.textDark }}>Campaña</p>
                            <p className="text-xs" style={{ color: C.textMuted }}>{cliente.campana || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.textDark }}>Closer</p>
                            <p className="text-xs" style={{ color: C.accentLight }}>{cliente.closer_nombre || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.textDark }}>Setter</p>
                            <p className="text-xs" style={{ color: C.green }}>{cliente.setter_nombre || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.textDark }}>Pagado</p>
                            <p className="text-xs font-semibold" style={{ color: C.green }}>{fmt(cliente.total_pagado || 0)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.textDark }}>Creado</p>
                            <p className="text-xs" style={{ color: C.textMuted }}>{fmtDate(cliente.creado_en)}</p>
                          </div>
                        </div>
                        {cliente.notas && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.textDark }}>Notas</p>
                            <p className="text-xs" style={{ color: C.textMuted }}>{cliente.notas}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEdit(cliente)} className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold transition-all hover:bg-white/5" style={{ color: C.accentLight }}>
                            <Edit2 size={11} /> Editar
                          </button>
                          <button onClick={() => router.push(`/dashboard/facturacion/cartera`)} className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold transition-all hover:bg-white/5" style={{ color: C.yellow }}>
                            <Eye size={11} /> Ver en Cartera
                          </button>
                          <div className="flex-1" />
                          <button onClick={() => handleDelete(cliente.id)} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all hover:bg-red-500/10" style={{ color: C.red }}>
                            <Trash2 size={11} /> Eliminar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Edit form */}
                    {isExpanded && isEditing && (
                      <div className="px-4 pb-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                          <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: C.textDark }}>Nombre</label>
                            <input value={editForm.nombre_cliente || ''} onChange={e => setEditForm({ ...editForm, nombre_cliente: e.target.value })} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: C.textDark }}>Documento</label>
                            <input value={editForm.documento || ''} onChange={e => setEditForm({ ...editForm, documento: e.target.value })} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: C.textDark }}>Fuente</label>
                            <input value={editForm.fuente || ''} onChange={e => setEditForm({ ...editForm, fuente: e.target.value })} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: C.textDark }}>Canal</label>
                            <input value={editForm.canal || ''} onChange={e => setEditForm({ ...editForm, canal: e.target.value })} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: C.textDark }}>Campaña</label>
                            <input value={editForm.campana || ''} onChange={e => setEditForm({ ...editForm, campana: e.target.value })} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: C.textDark }}>Closer</label>
                            <select value={editForm.closer_id || ''} onChange={e => setEditForm({ ...editForm, closer_id: e.target.value || null })} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle}>
                              <option value="">Sin asignar</option>
                              {closers.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: C.textDark }}>Setter</label>
                            <select value={editForm.setter_id || ''} onChange={e => setEditForm({ ...editForm, setter_id: e.target.value || null })} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle}>
                              <option value="">Sin asignar</option>
                              {setters.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: C.textDark }}>Notas</label>
                            <textarea value={editForm.notas || ''} onChange={e => setEditForm({ ...editForm, notas: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-xs resize-none" style={inputStyle} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleSave(cliente.id)} disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                            style={{ background: `linear-gradient(135deg, ${C.accent}, #8B5CF6)`, color: '#fff' }}>
                            <Save size={12} /> {saving ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-2 rounded-lg text-xs" style={{ color: C.textDim }}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
