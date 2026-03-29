'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Users, AlertTriangle, CheckCircle2, Clock,
  ChevronDown, ChevronUp, X, DollarSign, Save, Edit2, Activity,
  Wallet, TrendingUp, Shield, Search, RotateCcw, Trash2, Megaphone,
  FileText, Calendar, Upload, Eye, Receipt, UserCheck, CreditCard
} from 'lucide-react'

// ═══════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════
const C = {
  bg: '#080B14', surface: '#0D1117', card: '#111827',
  border: '#1a2234', borderLight: '#1F2937',
  text: '#F1F5F9', textMuted: '#94A3B8', textDim: '#475569', textDark: '#334155',
  accent: '#6366F1', accentLight: '#818CF8',
  green: '#34D399', red: '#F87171', yellow: '#FBBF24', orange: '#FB923C',
}
const inputStyle: React.CSSProperties = { background: C.card, borderColor: C.borderLight, color: C.text }

function fmt(n: number) { return '$' + Math.round(n).toLocaleString('es-AR') }
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n).toLocaleString()}`
}

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════
interface ClienteCartera {
  id: string; nombre_cliente: string; documento: string | null
  closer_id: string | null; setter_id: string | null
  closer_nombre: string; setter_nombre: string
  monto_referencia: number; estado: string; notas: string | null
  cuotas_pendientes: number; cuotas_vencidas: number; cuotas_pagadas: number; cuotas_total: number
  fuente?: string | null; campana?: string | null; canal?: string | null
}
interface Cuota {
  id: string; numero_cuota: number; monto: number; monto_pagado: number; fecha_vencimiento: string
  fecha_pago: string | null; estado: string; comprobante_url: string | null
}
interface Profile { id: string; nombre: string; apellido?: string; rol: string }

// ═══════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════
function StatusBadge({ estado }: { estado: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    activo:    { bg: `${C.green}15`, color: C.green, label: '● Activo' },
    vencido:   { bg: `${C.red}15`, color: C.red, label: '⚠ Vencido' },
    pagado:    { bg: `${C.accent}15`, color: C.accentLight, label: '✓ Pagado' },
    pendiente: { bg: `${C.yellow}15`, color: C.yellow, label: '◔ Pendiente' },
    pagada:    { bg: `${C.green}15`, color: C.green, label: '✓ Pagada' },
    vencida:   { bg: `${C.red}15`, color: C.red, label: '⚠ Vencida' },
  }
  const s = map[estado] || map.activo
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}20` }}>{s.label}</span>
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #6366F1, #818CF8)' }} />
      <Icon size={14} style={{ color: C.accentLight }} />
      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accentLight }}>{title}</h2>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="rounded-2xl p-4 transition-all hover:scale-[1.02]" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.textDim }}>{label}</p>
      </div>
      <p className="text-xl font-black tracking-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: C.textDark }}>{sub}</p>}
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: C.textDim }}>{label}</label>
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════
export default function CarteraClient() {
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientes, setClientes] = useState<ClienteCartera[]>([])
  const [filtro, setFiltro] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [loadingCuotas, setLoadingCuotas] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [newCuota, setNewCuota] = useState({ monto: '', fecha_vencimiento: '' })
  const [partialPayId, setPartialPayId] = useState<string | null>(null)
  const [partialAmount, setPartialAmount] = useState('')
  const [editingCuotaId, setEditingCuotaId] = useState<string | null>(null)
  const [editCuotaForm, setEditCuotaForm] = useState({ monto: '', fecha_vencimiento: '' })
  // ─── Advanced filters
  const [filterCloser, setFilterCloser] = useState('')
  const [filterSetter, setFilterSetter] = useState('')
  const [filterFuente, setFilterFuente] = useState('')
  const [filterCanal, setFilterCanal] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  // ─── Bulk selection + assignment
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkAssign, setShowBulkAssign] = useState(false)
  const [bulkAssignField, setBulkAssignField] = useState<'closer_id' | 'setter_id'>('closer_id')
  const [bulkAssignValue, setBulkAssignValue] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  // ─── Edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [newForm, setNewForm] = useState({
    nombre_cliente: '', documento: '', closer_id: '', setter_id: '',
    monto_referencia: '', notas: '', num_cuotas: '1',
    fuente: '', campana: '', canal: '',
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      if (!profile || profile.rol !== 'director') { router.push('/login'); return }
      setAuthReady(true)
    })
  }, [router])

  const fetchClientes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = filtro ? `?estado=${filtro}` : ''
      const res = await fetch(`/api/facturacion/cartera${params}`)
      if (!res.ok) { setError(`Error ${res.status}: ${res.statusText}`); setLoading(false); return }
      setClientes(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    }
    setLoading(false)
  }, [filtro])

  const fetchProfiles = useCallback(async () => {
    const res = await fetch('/api/equipo')
    if (res.ok) { const data = await res.json(); setProfiles(Array.isArray(data) ? data : data.profiles || []) }
  }, [])

  useEffect(() => { if (authReady) { fetchClientes(); fetchProfiles() } }, [fetchClientes, fetchProfiles, authReady])

  async function fetchCuotas(clienteId: string) {
    setLoadingCuotas(true)
    const res = await fetch(`/api/facturacion/cuotas?cliente_id=${clienteId}`)
    if (res.ok) setCuotas(await res.json())
    setLoadingCuotas(false)
  }

  function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); setCuotas([]) }
    else { setExpandedId(id); fetchCuotas(id) }
  }

  // ─── CRUD Handlers
  async function handleCreateClient() {
    if (!newForm.nombre_cliente || !newForm.monto_referencia) return
    setSaving(true)
    const montoTotal = Number(newForm.monto_referencia)
    const numCuotas = Math.max(1, parseInt(newForm.num_cuotas) || 1)
    const montoPorCuota = Math.round((montoTotal / numCuotas) * 100) / 100
    const cuotasArr = []
    for (let i = 0; i < numCuotas; i++) {
      const fecha = new Date(); fecha.setMonth(fecha.getMonth() + i + 1)
      cuotasArr.push({ monto: montoPorCuota, fecha_vencimiento: fecha.toISOString().split('T')[0] })
    }
    await fetch('/api/facturacion/cartera', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_cliente: newForm.nombre_cliente, documento: newForm.documento || null,
        closer_id: newForm.closer_id || null, setter_id: newForm.setter_id || null,
        monto_referencia: montoTotal, notas: newForm.notas || null, cuotas: cuotasArr,
        fuente: newForm.fuente || null, campana: newForm.campana || null, canal: newForm.canal || null,
      }),
    })
    setSaving(false); setShowNewForm(false)
    setNewForm({ nombre_cliente: '', documento: '', closer_id: '', setter_id: '', monto_referencia: '', notas: '', num_cuotas: '1', fuente: '', campana: '', canal: '' })
    fetchClientes()
  }

  async function handleUpdateClient(id: string) {
    await fetch('/api/facturacion/cartera', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editForm }),
    })
    setEditingId(null); fetchClientes()
  }

  async function handleDeleteClient(clienteId: string) {
    if (!confirm('¿Eliminar este cliente y todas sus cuotas?')) return
    await fetch(`/api/facturacion/cartera?id=${clienteId}`, { method: 'DELETE' })
    setExpandedId(null); fetchClientes()
  }

  async function handlePayCuota(cuotaId: string, montoParcial?: number) {
    const payload: Record<string, unknown> = { action: 'pagar', cuota_id: cuotaId }
    if (montoParcial && montoParcial > 0) payload.monto_pago = montoParcial
    await fetch('/api/facturacion/cuotas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setPartialPayId(null); setPartialAmount('')
    if (expandedId) fetchCuotas(expandedId); fetchClientes()
  }

  async function handleRefundCuota(cuotaId: string) {
    if (!confirm('¿Reembolsar esta cuota? Se revertirá el cobro.')) return
    await fetch('/api/facturacion/cuotas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reembolsar', cuota_id: cuotaId }) })
    if (expandedId) fetchCuotas(expandedId); fetchClientes()
  }

  async function handleEditCuota(cuotaId: string) {
    const payload: Record<string, unknown> = { action: 'editar', cuota_id: cuotaId }
    if (editCuotaForm.monto) payload.monto = Number(editCuotaForm.monto)
    if (editCuotaForm.fecha_vencimiento) payload.fecha_vencimiento = editCuotaForm.fecha_vencimiento
    await fetch('/api/facturacion/cuotas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setEditingCuotaId(null); setEditCuotaForm({ monto: '', fecha_vencimiento: '' })
    if (expandedId) fetchCuotas(expandedId); fetchClientes()
  }

  async function handleDeleteCuota(cuotaId: string) {
    if (!confirm('¿Eliminar esta cuota?')) return
    await fetch(`/api/facturacion/cuotas?id=${cuotaId}`, { method: 'DELETE' })
    if (expandedId) fetchCuotas(expandedId); fetchClientes()
  }

  async function handleAddCuota(clienteId: string) {
    if (!newCuota.monto || !newCuota.fecha_vencimiento) return
    await fetch('/api/facturacion/cuotas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'agregar', cliente_id: clienteId, monto: Number(newCuota.monto), fecha_vencimiento: newCuota.fecha_vencimiento }) })
    setNewCuota({ monto: '', fecha_vencimiento: '' })
    fetchCuotas(clienteId); fetchClientes()
  }

  const closers = profiles.filter(p => p.rol === 'closer')
  const setters = profiles.filter(p => p.rol === 'setter')

  // Unique values for filter dropdowns
  const uniqueFuentes = Array.from(new Set(clientes.map(c => c.fuente).filter(Boolean))) as string[]
  const uniqueCanales = Array.from(new Set(clientes.map(c => c.canal).filter(Boolean))) as string[]

  // Stats
  const totalCartera = clientes.reduce((s, c) => s + Number(c.monto_referencia), 0)
  const totalVencidos = clientes.filter(c => c.estado === 'vencido').length
  const totalActivos = clientes.filter(c => c.estado === 'activo').length
  const totalPagados = clientes.filter(c => c.estado === 'pagado').length

  // Cartera por Closer
  const carteraPorCloser = (() => {
    const map: Record<string, { nombre: string; total: number; pendiente: number; pagado: number; clientes: number }> = {}
    for (const c of clientes) {
      const key = c.closer_id || '_sin'
      if (!map[key]) map[key] = { nombre: c.closer_nombre || 'Sin asignar', total: 0, pendiente: 0, pagado: 0, clientes: 0 }
      map[key].total += Number(c.monto_referencia)
      map[key].clientes++
      if (c.estado === 'pagado') map[key].pagado += Number(c.monto_referencia)
      else map[key].pendiente += Number(c.monto_referencia)
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  })()

  // Cartera por Setter
  const carteraPorSetter = (() => {
    const map: Record<string, { nombre: string; total: number; pendiente: number; pagado: number; clientes: number }> = {}
    for (const c of clientes) {
      const key = c.setter_id || '_sin'
      if (!map[key]) map[key] = { nombre: c.setter_nombre || 'Sin asignar', total: 0, pendiente: 0, pagado: 0, clientes: 0 }
      map[key].total += Number(c.monto_referencia)
      map[key].clientes++
      if (c.estado === 'pagado') map[key].pagado += Number(c.monto_referencia)
      else map[key].pendiente += Number(c.monto_referencia)
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  })()

  // Próximos vencimientos (cuotas con vencimiento en los próximos 7 días)
  const proximosVencimientos = (() => {
    const hoy = new Date()
    const en7dias = new Date()
    en7dias.setDate(hoy.getDate() + 7)
    const result: { cliente: string; cuota_num: number; monto: number; vencimiento: string; estado: string }[] = []
    // Only for expanded clients we have cuotas loaded; for overview we use cuotas_vencidas count
    // But we can show clients with upcoming issues based on estado
    for (const c of clientes) {
      if (c.estado === 'vencido' || c.cuotas_vencidas > 0) {
        result.push({
          cliente: c.nombre_cliente,
          cuota_num: c.cuotas_vencidas,
          monto: Number(c.monto_referencia) / Math.max(c.cuotas_total, 1),
          vencimiento: '',
          estado: 'vencida'
        })
      }
    }
    return result.slice(0, 5)
  })()

  // Advanced filtering
  const filteredClientes = clientes.filter(c => {
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!c.nombre_cliente.toLowerCase().includes(q) && !c.closer_nombre?.toLowerCase().includes(q) && !c.setter_nombre?.toLowerCase().includes(q) && !(c.documento || '').toLowerCase().includes(q)) return false
    }
    if (filterCloser && c.closer_id !== filterCloser) return false
    if (filterSetter && c.setter_id !== filterSetter) return false
    if (filterFuente && c.fuente !== filterFuente) return false
    if (filterCanal && c.canal !== filterCanal) return false
    return true
  })

  const activeFiltersCount = [filterCloser, filterSetter, filterFuente, filterCanal].filter(Boolean).length

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleSelectAll() {
    if (selectedIds.size === filteredClientes.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredClientes.map(c => c.id)))
  }

  async function handleBulkAssign() {
    if (!bulkAssignValue || selectedIds.size === 0) return
    setBulkSaving(true)
    const promises = Array.from(selectedIds).map(id =>
      fetch('/api/facturacion/cartera', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [bulkAssignField]: bulkAssignValue }),
      })
    )
    await Promise.all(promises)
    setBulkSaving(false); setShowBulkAssign(false); setSelectedIds(new Set()); setBulkAssignValue('')
    fetchClientes()
  }

  function clearFilters() {
    setFilterCloser(''); setFilterSetter(''); setFilterFuente(''); setFilterCanal('')
  }

  if (!authReady) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center"><Activity size={16} className="text-indigo-500" /></div>
        </div>
        <p className="text-xs uppercase tracking-widest" style={{ color: C.textDark }}>Verificando acceso</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>

      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50" style={{ background: 'rgba(8,11,20,0.92)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.border}` }}>
        <div className="max-w-7xl mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet size={16} style={{ color: C.accentLight }} />
            <span className="text-sm font-bold tracking-tight">Gestión de Cartera</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: C.textDark }} />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar cliente, doc..."
                className="pl-8 pr-3 py-1.5 rounded-lg text-xs w-48" style={inputStyle} />
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative"
              style={{ background: showFilters || activeFiltersCount > 0 ? `${C.accent}20` : 'transparent', color: showFilters || activeFiltersCount > 0 ? C.accentLight : C.textDim, border: `1px solid ${showFilters || activeFiltersCount > 0 ? C.accent + '40' : C.border}` }}>
              <ChevronDown size={13} /> Filtros
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center" style={{ background: C.accent, color: '#fff' }}>{activeFiltersCount}</span>
              )}
            </button>
            <button onClick={() => setShowNewForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: `${C.accent}20`, color: C.accentLight, border: `1px solid ${C.accent}40` }}>
              <Plus size={13} /> Nuevo Cliente
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="max-w-7xl mx-auto px-5 h-9 flex items-center gap-1" style={{ borderTop: `1px solid rgba(26,34,52,0.5)` }}>
          {[
            { key: '', label: 'Todos', count: clientes.length },
            { key: 'activo', label: 'Activos', count: totalActivos },
            { key: 'vencido', label: 'Vencidos', count: totalVencidos },
            { key: 'pagado', label: 'Pagados', count: totalPagados },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFiltro(tab.key)}
              className="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all"
              style={{
                background: filtro === tab.key ? `${C.accent}20` : 'transparent',
                color: filtro === tab.key ? C.accentLight : C.textDim,
                border: filtro === tab.key ? `1px solid ${C.accent}30` : '1px solid transparent',
              }}>
              {tab.label} <span style={{ color: C.textDark }}>({tab.count})</span>
            </button>
          ))}

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] font-semibold" style={{ color: C.accentLight }}>
                {selectedIds.size} seleccionados
              </span>
              <button onClick={() => setShowBulkAssign(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                style={{ background: `${C.green}15`, color: C.green, border: `1px solid ${C.green}30` }}>
                <UserCheck size={11} /> Reasignar
              </button>
              <button onClick={() => setSelectedIds(new Set())}
                className="p-1 rounded hover:bg-white/5" style={{ color: C.textDark }}><X size={12} /></button>
            </div>
          )}
        </div>

        {/* ═══ DROPDOWN FILTERS ═══ */}
        {showFilters && (
          <div className="max-w-7xl mx-auto px-5 py-3 flex items-end gap-3 flex-wrap" style={{ borderTop: `1px solid rgba(26,34,52,0.5)`, background: 'rgba(13,17,23,0.6)' }}>
            <div>
              <label className="block text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: C.textDark }}>Closer</label>
              <select value={filterCloser} onChange={e => setFilterCloser(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs border min-w-[140px]" style={inputStyle}>
                <option value="">Todos los closers</option>
                {closers.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido || ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: C.textDark }}>Setter</label>
              <select value={filterSetter} onChange={e => setFilterSetter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs border min-w-[140px]" style={inputStyle}>
                <option value="">Todos los setters</option>
                {setters.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido || ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: C.textDark }}>Fuente</label>
              <select value={filterFuente} onChange={e => setFilterFuente(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs border min-w-[120px]" style={inputStyle}>
                <option value="">Todas</option>
                {uniqueFuentes.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: C.textDark }}>Canal</label>
              <select value={filterCanal} onChange={e => setFilterCanal(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs border min-w-[120px]" style={inputStyle}>
                <option value="">Todos</option>
                {uniqueCanales.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            {activeFiltersCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:bg-white/5"
                style={{ color: C.red }}><X size={11} /> Limpiar filtros</button>
            )}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-5 py-7 space-y-7">

        {/* ═══ STATS ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={DollarSign} label="Cartera Total" value={fmtShort(totalCartera)} color={C.accentLight} />
          <StatCard icon={Users} label="Clientes Activos" value={String(totalActivos)} color={C.green} />
          <StatCard icon={AlertTriangle} label="Clientes Vencidos" value={String(totalVencidos)} color={C.red} sub={totalVencidos > 0 ? '¡Atención!' : ''} />
          <StatCard icon={CheckCircle2} label="Pagados" value={String(totalPagados)} color={C.accent} />
        </div>

        {/* ═══ NEW CLIENT MODAL ═══ */}
        {showNewForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-lg rounded-2xl p-6 max-h-[85vh] overflow-y-auto" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Plus size={16} style={{ color: C.accentLight }} />
                  <h3 className="text-sm font-bold">Nuevo Cliente</h3>
                </div>
                <button onClick={() => setShowNewForm(false)} className="p-1 rounded hover:bg-white/5"><X size={16} style={{ color: C.textDim }} /></button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Nombre del cliente *">
                  <input value={newForm.nombre_cliente} onChange={e => setNewForm({ ...newForm, nombre_cliente: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} placeholder="Juan Pérez" />
                </FormField>
                <FormField label="Documento">
                  <input value={newForm.documento} onChange={e => setNewForm({ ...newForm, documento: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} placeholder="DNI / CUIT" />
                </FormField>
                <FormField label="Monto Total *">
                  <input type="number" value={newForm.monto_referencia} onChange={e => setNewForm({ ...newForm, monto_referencia: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} placeholder="5000" />
                </FormField>
                <FormField label="Cantidad de Cuotas">
                  <input type="number" value={newForm.num_cuotas} onChange={e => setNewForm({ ...newForm, num_cuotas: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} min="1" />
                </FormField>
                <FormField label="Closer asignado">
                  <select value={newForm.closer_id} onChange={e => setNewForm({ ...newForm, closer_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle}>
                    <option value="">Sin asignar</option>
                    {closers.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido || ''}</option>)}
                  </select>
                </FormField>
                <FormField label="Setter asignado">
                  <select value={newForm.setter_id} onChange={e => setNewForm({ ...newForm, setter_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle}>
                    <option value="">Sin asignar</option>
                    {setters.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido || ''}</option>)}
                  </select>
                </FormField>
                <FormField label="Fuente">
                  <input value={newForm.fuente} onChange={e => setNewForm({ ...newForm, fuente: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} placeholder="Instagram, Google..." />
                </FormField>
                <FormField label="Campaña">
                  <input value={newForm.campana} onChange={e => setNewForm({ ...newForm, campana: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} placeholder="Black Friday..." />
                </FormField>
                <FormField label="Canal">
                  <input value={newForm.canal} onChange={e => setNewForm({ ...newForm, canal: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} placeholder="WhatsApp, Email..." />
                </FormField>
                <FormField label="Notas">
                  <input value={newForm.notas} onChange={e => setNewForm({ ...newForm, notas: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} placeholder="Notas internas..." />
                </FormField>
              </div>

              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowNewForm(false)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: C.textDim }}>Cancelar</button>
                <button onClick={handleCreateClient} disabled={saving || !newForm.nombre_cliente || !newForm.monto_referencia}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  style={{ background: C.accent, color: '#fff' }}>
                  {saving ? 'Guardando...' : <><Plus size={13} /> Crear Cliente</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ BULK ASSIGN MODAL ═══ */}
        {showBulkAssign && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <UserCheck size={16} style={{ color: C.green }} />
                  <h3 className="text-sm font-bold">Reasignar {selectedIds.size} cliente(s)</h3>
                </div>
                <button onClick={() => setShowBulkAssign(false)} className="p-1 rounded hover:bg-white/5"><X size={16} style={{ color: C.textDim }} /></button>
              </div>

              <FormField label="Campo a cambiar">
                <select value={bulkAssignField} onChange={e => setBulkAssignField(e.target.value as 'closer_id' | 'setter_id')}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle}>
                  <option value="closer_id">Closer</option>
                  <option value="setter_id">Setter</option>
                </select>
              </FormField>

              <div className="mt-3">
                <FormField label={`Nuevo ${bulkAssignField === 'closer_id' ? 'Closer' : 'Setter'}`}>
                  <select value={bulkAssignValue} onChange={e => setBulkAssignValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle}>
                    <option value="">Seleccionar persona...</option>
                    {(bulkAssignField === 'closer_id' ? closers : setters).map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} {p.apellido || ''}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="mt-3 p-3 rounded-lg" style={{ background: `${C.yellow}08`, border: `1px solid ${C.yellow}15` }}>
                <p className="text-[11px]" style={{ color: C.yellow }}>
                  Se actualizará el {bulkAssignField === 'closer_id' ? 'closer' : 'setter'} de {selectedIds.size} cliente(s). Las comisiones futuras se reasignarán al nuevo usuario.
                </p>
              </div>

              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowBulkAssign(false)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: C.textDim }}>Cancelar</button>
                <button onClick={handleBulkAssign} disabled={bulkSaving || !bulkAssignValue}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  style={{ background: C.green, color: '#fff' }}>
                  {bulkSaving ? 'Asignando...' : <><UserCheck size={13} /> Confirmar Asignación</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ EDIT CLIENT MODAL ═══ */}
        {showEditModal && editingId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-lg rounded-2xl p-6 max-h-[85vh] overflow-y-auto" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Edit2 size={16} style={{ color: C.accentLight }} />
                  <h3 className="text-sm font-bold">Editar Cliente</h3>
                </div>
                <button onClick={() => { setShowEditModal(false); setEditingId(null) }} className="p-1 rounded hover:bg-white/5"><X size={16} style={{ color: C.textDim }} /></button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Nombre del Cliente">
                  <input value={editForm.nombre_cliente || ''} onChange={e => setEditForm({ ...editForm, nombre_cliente: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
                </FormField>
                <FormField label="Documento">
                  <input value={editForm.documento || ''} onChange={e => setEditForm({ ...editForm, documento: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} placeholder="DNI / CUIT" />
                </FormField>
                <FormField label="Closer asignado">
                  <select value={editForm.closer_id || ''} onChange={e => setEditForm({ ...editForm, closer_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle}>
                    <option value="">Sin asignar</option>
                    {closers.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido || ''}</option>)}
                  </select>
                </FormField>
                <FormField label="Setter asignado">
                  <select value={editForm.setter_id || ''} onChange={e => setEditForm({ ...editForm, setter_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle}>
                    <option value="">Sin asignar</option>
                    {setters.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido || ''}</option>)}
                  </select>
                </FormField>
                <FormField label="Monto Referencia">
                  <input type="number" value={editForm.monto_referencia || ''} onChange={e => setEditForm({ ...editForm, monto_referencia: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
                </FormField>
                <FormField label="Fuente">
                  <input value={editForm.fuente || ''} onChange={e => setEditForm({ ...editForm, fuente: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} placeholder="Instagram, Google..." />
                </FormField>
                <FormField label="Campaña">
                  <input value={editForm.campana || ''} onChange={e => setEditForm({ ...editForm, campana: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} placeholder="Black Friday..." />
                </FormField>
                <FormField label="Canal">
                  <input value={editForm.canal || ''} onChange={e => setEditForm({ ...editForm, canal: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} placeholder="WhatsApp, Email..." />
                </FormField>
                <div className="col-span-2">
                  <FormField label="Notas">
                    <input value={editForm.notas || ''} onChange={e => setEditForm({ ...editForm, notas: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} placeholder="Notas internas..." />
                  </FormField>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => { setShowEditModal(false); setEditingId(null) }} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: C.textDim }}>Cancelar</button>
                <button onClick={() => { handleUpdateClient(editingId); setShowEditModal(false) }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                  style={{ background: C.accent, color: '#fff' }}>
                  <Save size={13} /> Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CLIENT LIST ═══ */}

        {/* ─── Próximos Vencimientos & Rankings ─── */}
        {!loading && clientes.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Próximos Vencimientos */}
            {proximosVencimientos.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} style={{ color: C.orange }} />
                  <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.orange }}>Vencimientos Pendientes</h3>
                </div>
                <div className="space-y-2">
                  {proximosVencimientos.map((v, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${C.red}15` }}>
                        <AlertTriangle size={12} style={{ color: C.red }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: C.text }}>{v.cliente}</p>
                        <p className="text-[10px]" style={{ color: C.textDim }}>{v.cuota_num} cuota(s) vencida(s)</p>
                      </div>
                      <p className="text-xs font-bold shrink-0" style={{ color: C.red }}>{fmt(v.monto)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cartera por Closer */}
            <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <UserCheck size={14} style={{ color: C.accentLight }} />
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.accentLight }}>Cartera por Closer</h3>
              </div>
              <div className="space-y-2">
                {carteraPorCloser.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black" style={{ background: i < 3 ? `${C.accent}20` : `${C.textDark}20`, color: i < 3 ? C.accentLight : C.textDim }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: C.text }}>{item.nombre}</p>
                      <p className="text-[10px]" style={{ color: C.textDim }}>{item.clientes} clientes</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold" style={{ color: C.green }}>{fmtShort(item.pagado)}</p>
                      <p className="text-[10px]" style={{ color: C.textDim }}>{fmtShort(item.total)}</p>
                    </div>
                  </div>
                ))}
                {carteraPorCloser.length === 0 && <p className="text-xs text-center py-4" style={{ color: C.textDim }}>Sin datos</p>}
              </div>
            </div>

            {/* Cartera por Setter */}
            <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <Megaphone size={14} style={{ color: C.green }} />
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.green }}>Cartera por Setter</h3>
              </div>
              <div className="space-y-2">
                {carteraPorSetter.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black" style={{ background: i < 3 ? `${C.green}20` : `${C.textDark}20`, color: i < 3 ? C.green : C.textDim }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: C.text }}>{item.nombre}</p>
                      <p className="text-[10px]" style={{ color: C.textDim }}>{item.clientes} clientes</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold" style={{ color: C.green }}>{fmtShort(item.pagado)}</p>
                      <p className="text-[10px]" style={{ color: C.textDim }}>{fmtShort(item.total)}</p>
                    </div>
                  </div>
                ))}
                {carteraPorSetter.length === 0 && <p className="text-xs text-center py-4" style={{ color: C.textDim }}>Sin datos</p>}
              </div>
            </div>
          </div>
        )}

        <section>
          <SectionHeader icon={Users} title={`Clientes (${filteredClientes.length})`} />

          {/* Select all toggle */}
          {filteredClientes.length > 0 && !loading && (
            <div className="flex items-center gap-2 mb-3">
              <button onClick={toggleSelectAll}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:bg-white/5"
                style={{ color: C.textDim, border: `1px solid ${C.border}` }}>
                <div className="w-3.5 h-3.5 rounded border flex items-center justify-center transition-all"
                  style={{ background: selectedIds.size === filteredClientes.length ? C.accent : 'transparent', borderColor: selectedIds.size === filteredClientes.length ? C.accent : C.borderLight }}>
                  {selectedIds.size === filteredClientes.length && <span className="text-white text-[8px]">✓</span>}
                </div>
                {selectedIds.size === filteredClientes.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
              {selectedIds.size > 0 && (
                <span className="text-[11px]" style={{ color: C.accentLight }}>
                  {selectedIds.size} de {filteredClientes.length}
                </span>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <p className="text-xs uppercase tracking-widest" style={{ color: C.textDark }}>Cargando clientes</p>
              </div>
            </div>
          ) : filteredClientes.length === 0 ? (
            <div className="text-center py-20">
              <Users size={40} style={{ color: C.border }} className="mx-auto mb-3" />
              <p className="text-sm mb-1" style={{ color: C.textDim }}>No hay clientes</p>
              <p className="text-xs" style={{ color: C.textDark }}>Usa &quot;Nuevo Cliente&quot; para agregar el primero</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClientes.map(cliente => {
                const isExpanded = expandedId === cliente.id
                const isSelected = selectedIds.has(cliente.id)
                const progressPct = cliente.cuotas_total > 0 ? (cliente.cuotas_pagadas / cliente.cuotas_total) * 100 : 0

                return (
                  <div key={cliente.id} className="rounded-2xl overflow-hidden transition-all"
                    style={{ background: C.surface, border: `1px solid ${isExpanded ? `${C.accent}20` : isSelected ? `${C.green}30` : C.border}`, boxShadow: isExpanded ? `0 0 30px ${C.accent}06` : 'none' }}>

                    {/* ─── Client Row ─── */}
                    <div className="flex items-center gap-3 p-4 cursor-pointer transition-all hover:bg-white/[0.015]">

                      {/* Checkbox */}
                      <button onClick={(e) => { e.stopPropagation(); toggleSelect(cliente.id) }}
                        className="w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all"
                        style={{ background: isSelected ? C.accent : 'transparent', borderColor: isSelected ? C.accent : C.borderLight }}>
                        {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                      </button>

                      {/* Avatar */}
                      <div onClick={() => toggleExpand(cliente.id)} className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{
                        background: cliente.estado === 'vencido' ? `${C.red}15` : cliente.estado === 'pagado' ? `${C.accent}15` : `${C.green}15`,
                        color: cliente.estado === 'vencido' ? C.red : cliente.estado === 'pagado' ? C.accentLight : C.green,
                      }}>
                        {cliente.nombre_cliente.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0" onClick={() => toggleExpand(cliente.id)}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold truncate">{cliente.nombre_cliente}</p>
                          <StatusBadge estado={cliente.estado} />
                        </div>
                        <div className="flex items-center gap-3 text-[11px]" style={{ color: C.textDim }}>
                          {cliente.closer_nombre && <span>Closer: <span style={{ color: C.textMuted }}>{cliente.closer_nombre}</span></span>}
                          {cliente.setter_nombre && <span>Setter: <span style={{ color: C.textMuted }}>{cliente.setter_nombre}</span></span>}
                          {cliente.documento && <span>Doc: {cliente.documento}</span>}
                        </div>
                        {/* Progress bar */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${progressPct}%`,
                              background: progressPct === 100 ? C.green : `linear-gradient(90deg, ${C.accent}, ${C.green})`,
                            }} />
                          </div>
                          <span className="text-[10px] font-semibold shrink-0" style={{ color: C.textMuted }}>
                            {cliente.cuotas_pagadas}/{cliente.cuotas_total} cuotas
                          </span>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-right shrink-0" onClick={() => toggleExpand(cliente.id)}>
                        <p className="text-lg font-black" style={{ color: C.green }}>{fmt(cliente.monto_referencia)}</p>
                        <div className="flex items-center justify-end gap-2 text-[10px]" style={{ color: C.textDark }}>
                          {cliente.cuotas_vencidas > 0 && <span style={{ color: C.red }}>⚠ {cliente.cuotas_vencidas} vencidas</span>}
                          {cliente.cuotas_pendientes > 0 && <span>{cliente.cuotas_pendientes} pendientes</span>}
                        </div>
                      </div>

                      <div className="shrink-0" onClick={() => toggleExpand(cliente.id)} style={{ color: C.textDim }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {/* ─── Expanded Panel ─── */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4" style={{ borderTop: `1px solid ${C.border}` }}>

                        {/* Action bar */}
                        <div className="flex items-center gap-2 pt-3 flex-wrap">
                          <button onClick={(e) => {
                            e.stopPropagation()
                            setEditingId(cliente.id)
                            setEditForm({
                              nombre_cliente: cliente.nombre_cliente, documento: cliente.documento || '',
                              closer_id: cliente.closer_id || '', setter_id: cliente.setter_id || '',
                              monto_referencia: String(cliente.monto_referencia), notas: cliente.notas || '',
                              fuente: cliente.fuente || '', campana: cliente.campana || '', canal: cliente.canal || '',
                            })
                            setShowEditModal(true)
                          }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-white/5"
                            style={{ color: C.accentLight, border: `1px solid ${C.accent}30` }}>
                            <Edit2 size={12} /> Editar
                          </button>

                          {/* Quick assign closer */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold" style={{ color: C.textDark }}>Closer:</span>
                            <select value={cliente.closer_id || ''} onChange={async (e) => {
                              await fetch('/api/facturacion/cartera', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cliente.id, closer_id: e.target.value || null }) })
                              fetchClientes()
                            }} className="px-2 py-1 rounded text-[11px] border" style={inputStyle}>
                              <option value="">Sin asignar</option>
                              {closers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                          </div>

                          {/* Quick assign setter */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold" style={{ color: C.textDark }}>Setter:</span>
                            <select value={cliente.setter_id || ''} onChange={async (e) => {
                              await fetch('/api/facturacion/cartera', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cliente.id, setter_id: e.target.value || null }) })
                              fetchClientes()
                            }} className="px-2 py-1 rounded text-[11px] border" style={inputStyle}>
                              <option value="">Sin asignar</option>
                              {setters.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                          </div>

                          <button onClick={(e) => { e.stopPropagation(); handleDeleteClient(cliente.id) }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-red-500/20 ml-auto"
                            style={{ color: C.red, border: `1px solid ${C.red}20` }}>
                            <Trash2 size={12} /> Eliminar
                          </button>
                        </div>

                        {/* Client details */}
                        {(cliente.fuente || cliente.campana || cliente.canal || cliente.notas) && (
                          <div className="flex flex-wrap gap-3 text-[11px]" style={{ color: C.textMuted }}>
                            {cliente.fuente && <span className="px-2 py-0.5 rounded" style={{ background: `${C.accent}10` }}>Fuente: {cliente.fuente}</span>}
                            {cliente.campana && <span className="px-2 py-0.5 rounded" style={{ background: `${C.orange}10` }}>Campaña: {cliente.campana}</span>}
                            {cliente.canal && <span className="px-2 py-0.5 rounded" style={{ background: `${C.green}10` }}>Canal: {cliente.canal}</span>}
                            {cliente.notas && <span className="italic" style={{ color: C.textDark }}>📝 {cliente.notas}</span>}
                          </div>
                        )}

                        {/* Cuotas table */}
                        {loadingCuotas ? (
                          <div className="flex justify-center py-6">
                            <div className="w-6 h-6 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                          </div>
                        ) : (
                          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.borderLight}` }}>
                            <table className="w-full text-xs">
                              <thead>
                                <tr style={{ background: C.card }}>
                                  <th className="text-left py-2.5 px-3 font-semibold" style={{ color: C.textDim }}>#</th>
                                  <th className="text-right py-2.5 px-3 font-semibold" style={{ color: C.textDim }}>Monto</th>
                                  <th className="text-right py-2.5 px-3 font-semibold" style={{ color: C.textDim }}>Pagado</th>
                                  <th className="text-left py-2.5 px-3 font-semibold" style={{ color: C.textDim }}>Vencimiento</th>
                                  <th className="text-left py-2.5 px-3 font-semibold" style={{ color: C.textDim }}>Estado</th>
                                  <th className="text-right py-2.5 px-3 font-semibold" style={{ color: C.textDim }}>Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cuotas.map((cuota) => {
                                  const pagadoPct = cuota.monto > 0 ? (Number(cuota.monto_pagado) / Number(cuota.monto)) * 100 : 0
                                  const isEditingCuota = editingCuotaId === cuota.id
                                  const restante = Number(cuota.monto) - Number(cuota.monto_pagado)

                                  return (
                                    <tr key={cuota.id} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: `1px solid ${C.border}` }}>
                                      <td className="py-2 px-3 font-bold" style={{ color: C.text }}>#{cuota.numero_cuota}</td>
                                      <td className="py-2 px-3 text-right">
                                        {isEditingCuota ? (
                                          <input value={editCuotaForm.monto} onChange={e => setEditCuotaForm({ ...editCuotaForm, monto: e.target.value })}
                                            className="w-20 px-1 py-0.5 rounded text-xs text-right border" style={inputStyle} type="number" />
                                        ) : (
                                          <span style={{ color: C.text }}>{fmt(cuota.monto)}</span>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                          {pagadoPct > 0 && pagadoPct < 100 && (
                                            <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                                              <div className="h-full rounded-full" style={{ width: `${pagadoPct}%`, background: C.green }} />
                                            </div>
                                          )}
                                          <span style={{ color: pagadoPct >= 100 ? C.green : C.textMuted }}>{fmt(cuota.monto_pagado)}</span>
                                        </div>
                                      </td>
                                      <td className="py-2 px-3">
                                        {isEditingCuota ? (
                                          <input type="date" value={editCuotaForm.fecha_vencimiento} onChange={e => setEditCuotaForm({ ...editCuotaForm, fecha_vencimiento: e.target.value })}
                                            className="px-1 py-0.5 rounded text-xs border" style={inputStyle} />
                                        ) : (
                                          <span style={{ color: C.textMuted }}>{new Date(cuota.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR')}</span>
                                        )}
                                      </td>
                                      <td className="py-2 px-3"><StatusBadge estado={cuota.estado} /></td>
                                      <td className="py-2 px-3">
                                        <div className="flex items-center justify-end gap-1">
                                          {isEditingCuota ? (
                                            <>
                                              <button onClick={() => handleEditCuota(cuota.id)} className="p-1 rounded hover:bg-green-500/20" style={{ color: C.green }}><Save size={12} /></button>
                                              <button onClick={() => setEditingCuotaId(null)} className="p-1 rounded hover:bg-red-500/20" style={{ color: C.red }}><X size={12} /></button>
                                            </>
                                          ) : (
                                            <>
                                              {/* Pay button */}
                                              {cuota.estado !== 'pagada' && (
                                                <>
                                                  <button onClick={(e) => { e.stopPropagation(); handlePayCuota(cuota.id) }}
                                                    className="px-2 py-0.5 rounded text-[10px] font-semibold transition-all hover:bg-green-500/20"
                                                    style={{ color: C.green, border: `1px solid ${C.green}30` }}>
                                                    Cobrar
                                                  </button>
                                                  {/* Partial payment toggle */}
                                                  {partialPayId === cuota.id ? (
                                                    <div className="flex items-center gap-1">
                                                      <input value={partialAmount} onChange={e => setPartialAmount(e.target.value)} type="number"
                                                        className="w-16 px-1 py-0.5 rounded text-[10px] border" style={inputStyle} placeholder={String(restante)} />
                                                      <button onClick={() => handlePayCuota(cuota.id, Number(partialAmount))}
                                                        className="p-0.5 rounded hover:bg-green-500/20" style={{ color: C.green }}><Save size={10} /></button>
                                                      <button onClick={() => setPartialPayId(null)}
                                                        className="p-0.5 rounded hover:bg-red-500/20" style={{ color: C.red }}><X size={10} /></button>
                                                    </div>
                                                  ) : (
                                                    <button onClick={(e) => { e.stopPropagation(); setPartialPayId(cuota.id); setPartialAmount('') }}
                                                      className="px-1.5 py-0.5 rounded text-[10px] transition-all hover:bg-yellow-500/20"
                                                      style={{ color: C.yellow }}>Parcial</button>
                                                  )}
                                                </>
                                              )}
                                              {/* Refund button */}
                                              {cuota.estado === 'pagada' && (
                                                <button onClick={(e) => { e.stopPropagation(); handleRefundCuota(cuota.id) }}
                                                  className="px-2 py-0.5 rounded text-[10px] font-semibold transition-all hover:bg-orange-500/20"
                                                  style={{ color: C.orange, border: `1px solid ${C.orange}30` }}>
                                                  <RotateCcw size={10} className="inline mr-1" />Reembolsar
                                                </button>
                                              )}
                                              {/* Edit */}
                                              <button onClick={(e) => { e.stopPropagation(); setEditingCuotaId(cuota.id); setEditCuotaForm({ monto: String(cuota.monto), fecha_vencimiento: cuota.fecha_vencimiento }) }}
                                                className="p-1 rounded transition-all hover:bg-white/5" style={{ color: C.textDim }}><Edit2 size={11} /></button>
                                              {/* Delete */}
                                              <button onClick={(e) => { e.stopPropagation(); handleDeleteCuota(cuota.id) }}
                                                className="p-1 rounded transition-all hover:bg-red-500/20" style={{ color: C.textDark }}><Trash2 size={11} /></button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>

                            {/* Add cuota inline */}
                            <div className="flex items-center gap-2 p-3" style={{ background: C.card, borderTop: `1px solid ${C.border}` }}>
                              <Plus size={12} style={{ color: C.textDim }} />
                              <input value={newCuota.monto} onChange={e => setNewCuota({ ...newCuota, monto: e.target.value })} type="number"
                                className="w-24 px-2 py-1 rounded text-xs border" style={inputStyle} placeholder="Monto" />
                              <input type="date" value={newCuota.fecha_vencimiento} onChange={e => setNewCuota({ ...newCuota, fecha_vencimiento: e.target.value })}
                                className="px-2 py-1 rounded text-xs border" style={inputStyle} />
                              <button onClick={() => handleAddCuota(cliente.id)} disabled={!newCuota.monto || !newCuota.fecha_vencimiento}
                                className="px-3 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-30"
                                style={{ background: `${C.accent}20`, color: C.accentLight }}>
                                Agregar Cuota
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
