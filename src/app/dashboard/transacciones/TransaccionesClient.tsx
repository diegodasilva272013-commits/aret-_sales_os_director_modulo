'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Receipt, Search, ChevronDown, ChevronUp, Calendar,
  Plus, X, DollarSign, TrendingUp, TrendingDown, RotateCcw,
  ArrowUpRight, ArrowDownLeft, Trash2, Filter, Download
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

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

interface Transaccion {
  id: string
  cliente_id: string | null
  cuota_id: string | null
  monto: number
  fecha: string
  tipo: 'ingreso' | 'egreso' | 'reembolso'
  descripcion: string | null
  creado_en: string
  cliente_nombre?: string
  closer_nombre?: string
  setter_nombre?: string
}

const tipoConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  ingreso: { label: 'Ingreso', color: C.green, bg: `${C.green}15`, icon: ArrowDownLeft },
  egreso: { label: 'Egreso', color: C.red, bg: `${C.red}15`, icon: ArrowUpRight },
  reembolso: { label: 'Reembolso', color: C.orange, bg: `${C.orange}15`, icon: RotateCcw },
}

export default function TransaccionesClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [filtroTipo, setFiltroTipo] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newTx, setNewTx] = useState({ monto: '', tipo: 'ingreso', descripcion: '' })

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    if (filtroTipo) params.set('tipo', filtroTipo)
    params.set('limit', '200')

    const res = await fetch(`/api/facturacion/transacciones?${params}`)
    if (res.ok) {
      const data = await res.json()
      setTransacciones(data)
    }
    setLoading(false)
  }, [desde, hasta, filtroTipo])

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      fetchData()
    }
    checkAuth()
  }, [fetchData, router, supabase.auth])

  const handleCreate = async () => {
    if (!newTx.monto || !newTx.tipo) return
    setSaving(true)
    const res = await fetch('/api/facturacion/transacciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monto: Number(newTx.monto),
        tipo: newTx.tipo,
        descripcion: newTx.descripcion || null,
      }),
    })
    if (res.ok) {
      setNewTx({ monto: '', tipo: 'ingreso', descripcion: '' })
      setShowNewForm(false)
      fetchData()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta transacción?')) return
    const res = await fetch(`/api/facturacion/transacciones?id=${id}`, { method: 'DELETE' })
    if (res.ok) fetchData()
  }

  const exportCSV = () => {
    const headers = ['Fecha', 'Tipo', 'Monto', 'Cliente', 'Closer', 'Setter', 'Descripción']
    const rows = filtered.map(t => [
      fmtDate(t.fecha), t.tipo, t.monto, t.cliente_nombre || '', t.closer_nombre || '', t.setter_nombre || '', t.descripcion || ''
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transacciones_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filter
  const filtered = transacciones.filter(t => {
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const match = (t.cliente_nombre || '').toLowerCase().includes(q) ||
        (t.descripcion || '').toLowerCase().includes(q) ||
        (t.closer_nombre || '').toLowerCase().includes(q) ||
        (t.setter_nombre || '').toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  // Stats
  const totalIngresos = filtered.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.monto), 0)
  const totalEgresos = filtered.filter(t => t.tipo === 'egreso').reduce((s, t) => s + Number(t.monto), 0)
  const totalReembolsos = filtered.filter(t => t.tipo === 'reembolso').reduce((s, t) => s + Number(t.monto), 0)
  const neto = totalIngresos - totalEgresos - totalReembolsos

  const inputStyle: React.CSSProperties = { background: C.card, border: `1px solid ${C.borderLight}`, color: C.text }

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>

      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50" style={{ background: 'rgba(8,11,20,0.92)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.border}` }}>
        <div className="max-w-7xl mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt size={16} style={{ color: C.accentLight }} />
            <span className="text-sm font-bold tracking-tight">Transacciones</span>
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
                placeholder="Buscar..."
                className="pl-8 pr-3 py-1.5 rounded-lg text-xs w-44"
                style={inputStyle}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: showFilters ? `${C.accent}20` : 'transparent', color: showFilters ? C.accentLight : C.textDim, border: `1px solid ${showFilters ? C.accent + '40' : C.border}` }}
            >
              <Filter size={13} /> Filtros
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-white/5"
              style={{ color: C.textDim }}
            >
              <Download size={13} /> Exportar
            </button>
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: `${C.accent}20`, color: C.accentLight, border: `1px solid ${C.accent}40` }}
            >
              <Plus size={13} /> Nueva
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="max-w-7xl mx-auto px-5 h-9 flex items-center gap-1" style={{ borderTop: '1px solid rgba(26,34,52,0.5)' }}>
          {[
            { key: '', label: 'Todas', count: transacciones.length },
            { key: 'ingreso', label: 'Ingresos', count: transacciones.filter(t => t.tipo === 'ingreso').length },
            { key: 'egreso', label: 'Egresos', count: transacciones.filter(t => t.tipo === 'egreso').length },
            { key: 'reembolso', label: 'Reembolsos', count: transacciones.filter(t => t.tipo === 'reembolso').length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFiltroTipo(tab.key)}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all"
              style={{
                color: filtroTipo === tab.key ? C.accentLight : C.textDim,
                background: filtroTipo === tab.key ? `${C.accent}15` : 'transparent'
              }}
            >
              {tab.label} <span style={{ color: C.textDark }}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Date filters */}
        {showFilters && (
          <div className="max-w-7xl mx-auto px-5 py-3 flex items-center gap-3 flex-wrap" style={{ borderTop: '1px solid rgba(26,34,52,0.5)' }}>
            <div className="flex items-center gap-2">
              <Calendar size={13} style={{ color: C.textDim }} />
              <span className="text-xs" style={{ color: C.textDim }}>Desde</span>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="px-2 py-1 rounded text-xs" style={inputStyle} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: C.textDim }}>Hasta</span>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="px-2 py-1 rounded text-xs" style={inputStyle} />
            </div>
            {(desde || hasta) && (
              <button onClick={() => { setDesde(''); setHasta('') }} className="text-xs px-2 py-1 rounded hover:bg-white/5" style={{ color: C.red }}>
                Limpiar
              </button>
            )}
          </div>
        )}
      </header>

      {/* ═══ NEW TX FORM ═══ */}
      {showNewForm && (
        <div className="max-w-7xl mx-auto px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textDim }}>Nueva Transacción Manual</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: C.textDark }}>Tipo</label>
                <select value={newTx.tipo} onChange={e => setNewTx({ ...newTx, tipo: e.target.value })} className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle}>
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                  <option value="reembolso">Reembolso</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: C.textDark }}>Monto</label>
                <input type="number" value={newTx.monto} onChange={e => setNewTx({ ...newTx, monto: e.target.value })} placeholder="0.00" className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: C.textDark }}>Descripción</label>
                <input value={newTx.descripcion} onChange={e => setNewTx({ ...newTx, descripcion: e.target.value })} placeholder="Descripción opcional..." className="w-full px-3 py-2 rounded-lg text-xs" style={inputStyle} />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={handleCreate} disabled={saving || !newTx.monto} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40" style={{ background: `linear-gradient(135deg, ${C.accent}, #8B5CF6)`, color: '#fff' }}>
                {saving ? 'Guardando...' : 'Crear Transacción'}
              </button>
              <button onClick={() => setShowNewForm(false)} className="px-3 py-2 rounded-lg text-xs" style={{ color: C.textDim }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STATS CARDS ═══ */}
      {!loading && (
        <div style={{ background: `linear-gradient(135deg, ${C.surface} 0%, #0a0f1a 100%)`, borderBottom: `1px solid ${C.border}` }}>
          <div className="max-w-7xl mx-auto px-5 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Ingresos', value: totalIngresos, color: C.green, icon: TrendingUp },
              { label: 'Egresos', value: totalEgresos, color: C.red, icon: TrendingDown },
              { label: 'Reembolsos', value: totalReembolsos, color: C.orange, icon: RotateCcw },
              { label: 'Neto', value: neto, color: neto >= 0 ? C.green : C.red, icon: DollarSign },
            ].map((card, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg" style={{ background: `${card.color}15` }}>
                    <card.icon size={14} style={{ color: card.color }} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.textDim }}>{card.label}</span>
                </div>
                <p className="text-lg font-bold" style={{ color: card.color }}>{fmt(card.value)}</p>
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
            <span className="text-xs" style={{ color: C.textDim }}>Cargando transacciones...</span>
          </div>
        </div>
      )}

      {/* ═══ TRANSACTIONS LIST ═══ */}
      {!loading && (
        <div className="max-w-7xl mx-auto px-5 py-6">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <Receipt size={32} style={{ color: C.textDark }} className="mx-auto mb-3" />
              <p className="text-sm" style={{ color: C.textDim }}>No hay transacciones</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(tx => {
                const cfg = tipoConfig[tx.tipo] || tipoConfig.ingreso
                const isExpanded = expandedId === tx.id
                return (
                  <div key={tx.id} className="rounded-xl overflow-hidden transition-all" style={{ background: C.card, border: `1px solid ${isExpanded ? C.accent + '40' : C.border}` }}>
                    {/* Row */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                      className="w-full px-4 py-3 flex items-center gap-4 text-left transition-all hover:bg-white/[0.02]"
                    >
                      {/* Icon */}
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
                        <cfg.icon size={14} style={{ color: cfg.color }} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold truncate" style={{ color: C.text }}>
                            {tx.cliente_nombre && tx.cliente_nombre !== 'N/A' ? tx.cliente_nombre : (tx.descripcion || 'Transacción manual')}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: C.textDim }}>
                          {fmtDate(tx.fecha)} · {fmtTime(tx.fecha)}
                          {tx.closer_nombre && ` · Closer: ${tx.closer_nombre}`}
                          {tx.setter_nombre && ` · Setter: ${tx.setter_nombre}`}
                        </p>
                      </div>

                      {/* Amount */}
                      <span className="text-sm font-bold shrink-0" style={{ color: cfg.color }}>
                        {tx.tipo === 'egreso' || tx.tipo === 'reembolso' ? '-' : '+'}{fmt(Number(tx.monto))}
                      </span>

                      {/* Expand */}
                      <div className="shrink-0" style={{ color: C.textDark }}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1" style={{ borderTop: `1px solid ${C.border}` }}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.textDark }}>Monto</p>
                            <p className="text-sm font-bold" style={{ color: cfg.color }}>{fmt(Number(tx.monto))}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.textDark }}>Tipo</p>
                            <p className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.textDark }}>Fecha</p>
                            <p className="text-xs" style={{ color: C.textMuted }}>{fmtDate(tx.fecha)} {fmtTime(tx.fecha)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.textDark }}>Cliente</p>
                            <p className="text-xs" style={{ color: C.textMuted }}>{tx.cliente_nombre || 'Sin cliente'}</p>
                          </div>
                        </div>
                        {tx.descripcion && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.textDark }}>Descripción</p>
                            <p className="text-xs" style={{ color: C.textMuted }}>{tx.descripcion}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          {tx.closer_nombre && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${C.accent}15`, color: C.accentLight }}>
                              Closer: {tx.closer_nombre}
                            </span>
                          )}
                          {tx.setter_nombre && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${C.green}15`, color: C.green }}>
                              Setter: {tx.setter_nombre}
                            </span>
                          )}
                          <div className="flex-1" />
                          <button onClick={() => handleDelete(tx.id)} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all hover:bg-red-500/10" style={{ color: C.red }}>
                            <Trash2 size={11} /> Eliminar
                          </button>
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
