'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  DollarSign, TrendingUp, Users, Award, AlertTriangle,
  Receipt, Target, Wallet, PieChart as PieChartIcon, BarChart2,
  Activity, Download, RotateCcw, Megaphone, Shield,
  Clock, CheckCircle, XCircle, Zap, Calendar, Edit3, Save, X, Plus,
  AlertCircle, Trophy, CreditCard
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

// ═══════════════════════════════════════════════════
// DESIGN TOKENS  (matching Areté Sales OS)
// ═══════════════════════════════════════════════════
const COLORS = {
  bg: '#080B14', surface: '#0D1117', card: '#111827',
  border: '#1a2234', borderLight: '#1F2937',
  text: '#F1F5F9', textMuted: '#94A3B8', textDim: '#475569', textDark: '#334155',
  accent: '#6366F1', accentLight: '#818CF8',
  green: '#34D399', red: '#F87171', yellow: '#FBBF24', orange: '#FB923C', cyan: '#22D3EE',
}
const CHART_GRID = '#1a2234'
const CHART_AXIS = '#334155'
const CHART_TEXT = '#64748B'
const CHART_TOOLTIP: React.CSSProperties = { backgroundColor: '#0D1117', border: '1px solid #1a2234', borderRadius: 8, color: '#F1F5F9', fontSize: 12 }
const PIE_COLORS = ['#6366F1', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#38BDF8']
const BAR_COLORS = ['#6366F1', '#34D399', '#FBBF24', '#F87171', '#A78BFA']

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════
interface Meta {
  mes: string; meta_objetivo: number; facturacion_alcanzada: number; faltante: number
  porcentaje_rendimiento: number; costos_ads: number; costos_operativos: number
  ganancia_neta: number; total_egresos: number; total_reembolsos: number
}
interface Cartera {
  total: number; vencida: number; cobrada_mes: number
  total_clientes: number; activos: number; vencidos: number; pagados: number
}
interface RankingItem {
  id: string; nombre: string; foto_url: string | null
  ventas: number; totalClientes: number; facturado: number; porcentajeMeta: number
}
interface Transaccion {
  id: string; cliente_id: string; cuota_id: string | null; monto: number
  tipo: 'ingreso' | 'egreso' | 'reembolso'; fecha: string; descripcion: string
  cliente_nombre: string
}
interface TimelineItem {
  fecha: string; ingresos: number; egresos: number; reembolsos: number; acumulado: number; meta: number
}
interface Alerta { tipo: string; nivel: string; mensaje: string; icono: string }
interface ReglaComision {
  id: string; nombre: string; rol: string; activa: boolean
  tramos: { desde: number; hasta: number; porcentaje: number }[]
  created_at?: string
}
interface DashboardData {
  meta: Meta; cartera: Cartera
  rankingClosers: RankingItem[]; rankingSetters: RankingItem[]
  ultimasTransacciones: Transaccion[]; timeline: TimelineItem[]
  tendenciaMetas: { mes: string; meta: number; alcanzado: number }[]
  distribucionCartera: { name: string; value: number; color: string }[]
  ingresosPorCloser: { name: string; value: number }[]
  ingresosPorFuente: { name: string; value: number }[]
  ingresosPorCanal: { name: string; value: number }[]
  alertas: Alerta[]
  comisionesDiferidas?: { pendiente: number; disponible: number; revertida_mes: number }
  carteraVencidaCategoria?: { ligera: number; pesada: number; default_cobranza: number }
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
function fmt(n: number) { return '$' + Math.round(n).toLocaleString('es-AR') }
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n).toLocaleString()}`
}
function pct(n: number) { return `${Math.round(n * 10) / 10}%` }

// ═══════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════
function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #6366F1, #818CF8)' }} />
      <Icon size={14} style={{ color: COLORS.accentLight }} />
      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: COLORS.accentLight }}>{title}</h2>
    </div>
  )
}

function ChartCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-4 ${className}`} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: COLORS.textDim }}>{title}</p>
      {children}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color, glow }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string; glow?: boolean
}) {
  return (
    <div className="rounded-2xl p-4 transition-all hover:scale-[1.02]" style={{
      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
      boxShadow: glow ? `0 0 30px ${color}15` : 'none',
    }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textDim }}>{label}</p>
      </div>
      <p className="text-xl font-black tracking-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: COLORS.textDark }}>{sub}</p>}
    </div>
  )
}

function AlertCard({ alerta }: { alerta: Alerta }) {
  const colorMap: Record<string, string> = { critico: COLORS.red, warning: COLORS.yellow, ok: COLORS.green }
  const iconMap: Record<string, React.ElementType> = {
    alert: AlertTriangle, refund: RotateCcw, target: Target, users: Users, trophy: Trophy, trending: TrendingUp,
  }
  const color = colorMap[alerta.nivel] || COLORS.textMuted
  const Icon = iconMap[alerta.icono] || AlertCircle
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
      <Icon size={14} style={{ color }} />
      <p className="text-xs font-medium" style={{ color }}>{alerta.mensaje}</p>
    </div>
  )
}

function RankingRow({ r, index, metaGlobal }: { r: RankingItem; index: number; metaGlobal: number }) {
  const barPct = metaGlobal > 0 ? Math.min(100, (r.facturado / metaGlobal) * 100) : 0
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-white/[0.02]" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <span className="text-sm w-6 text-center">{medals[index] || <span style={{ color: COLORS.textDark }}>{index + 1}</span>}</span>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{
        background: `linear-gradient(135deg, ${COLORS.accent}40, ${COLORS.accentLight}20)`,
        color: COLORS.accentLight,
      }}>
        {r.nombre.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: COLORS.text }}>{r.nombre}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.border }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.green})` }} />
          </div>
          <span className="text-[10px] font-semibold shrink-0" style={{ color: COLORS.textMuted }}>{pct(r.porcentajeMeta)}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold" style={{ color: COLORS.green }}>{fmtShort(r.facturado)}</p>
        <p className="text-[10px]" style={{ color: COLORS.textDark }}>{r.ventas} ventas · {r.totalClientes} clientes</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════
export default function FacturacionClient() {
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [mes, setMes] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01` })
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaForm, setMetaForm] = useState({ meta_objetivo: '', costos_ads: '', costos_operativos: '' })
  const [savingMeta, setSavingMeta] = useState(false)
  // ─── Reglas de Comisión
  const [reglas, setReglas] = useState<ReglaComision[]>([])
  const [showReglas, setShowReglas] = useState(false)
  const [showReglaForm, setShowReglaForm] = useState(false)
  const [editingRegla, setEditingRegla] = useState<ReglaComision | null>(null)
  const [reglaForm, setReglaForm] = useState({ nombre: '', rol: 'closer', tramos: [{ desde: 0, hasta: 100000, porcentaje: 10 }] as { desde: number; hasta: number; porcentaje: number }[] })
  const [savingRegla, setSavingRegla] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      if (!profile || profile.rol !== 'director') { router.push('/login'); return }
      setAuthReady(true)
    })
  }, [router])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/facturacion/dashboard?mes=${mes}`)
      if (!res.ok) { setError(`Error ${res.status}: ${res.statusText}`); setLoading(false); return }
      const json = await res.json()
      setData(json)
      setMetaForm({
        meta_objetivo: String(json.meta?.meta_objetivo || ''),
        costos_ads: String(json.meta?.costos_ads || ''),
        costos_operativos: String(json.meta?.costos_operativos || ''),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    }
    setLoading(false)
  }, [mes])

  useEffect(() => { if (authReady) fetchData() }, [fetchData, authReady])

  async function handleSaveMeta() {
    setSavingMeta(true)
    await fetch('/api/facturacion/metas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, meta_objetivo: Number(metaForm.meta_objetivo) || 0, costos_ads: Number(metaForm.costos_ads) || 0, costos_operativos: Number(metaForm.costos_operativos) || 0 }),
    })
    setEditingMeta(false)
    setSavingMeta(false)
    fetchData()
  }

  // ─── Reglas de Comisión CRUD
  const fetchReglas = useCallback(async () => {
    try {
      const res = await fetch('/api/facturacion/reglas')
      if (res.ok) setReglas(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { if (authReady) fetchReglas() }, [fetchReglas, authReady])

  function openNewRegla() {
    setEditingRegla(null)
    setReglaForm({ nombre: '', rol: 'closer', tramos: [{ desde: 0, hasta: 100000, porcentaje: 10 }] })
    setShowReglaForm(true)
  }

  function openEditRegla(r: ReglaComision) {
    setEditingRegla(r)
    setReglaForm({ nombre: r.nombre, rol: r.rol, tramos: [...r.tramos] })
    setShowReglaForm(true)
  }

  function addTramo() {
    const last = reglaForm.tramos[reglaForm.tramos.length - 1]
    setReglaForm({ ...reglaForm, tramos: [...reglaForm.tramos, { desde: last?.hasta || 0, hasta: (last?.hasta || 0) + 100000, porcentaje: (last?.porcentaje || 10) + 2 }] })
  }

  function removeTramo(i: number) {
    if (reglaForm.tramos.length <= 1) return
    setReglaForm({ ...reglaForm, tramos: reglaForm.tramos.filter((_, idx) => idx !== i) })
  }

  function updateTramo(i: number, field: string, value: number) {
    const tramos = [...reglaForm.tramos]
    tramos[i] = { ...tramos[i], [field]: value }
    setReglaForm({ ...reglaForm, tramos })
  }

  async function handleSaveRegla() {
    if (!reglaForm.nombre || reglaForm.tramos.length === 0) return
    setSavingRegla(true)
    if (editingRegla) {
      await fetch('/api/facturacion/reglas', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingRegla.id, nombre: reglaForm.nombre, rol: reglaForm.rol, tramos: reglaForm.tramos }),
      })
    } else {
      await fetch('/api/facturacion/reglas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: reglaForm.nombre, rol: reglaForm.rol, tramos: reglaForm.tramos }),
      })
    }
    setSavingRegla(false); setShowReglaForm(false); setEditingRegla(null)
    fetchReglas()
  }

  async function handleToggleRegla(id: string, activa: boolean) {
    await fetch('/api/facturacion/reglas', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activa: !activa }),
    })
    fetchReglas()
  }

  async function handleDeleteRegla(id: string) {
    if (!confirm('¿Eliminar esta regla de comisión?')) return
    await fetch(`/api/facturacion/reglas?id=${id}`, { method: 'DELETE' })
    fetchReglas()
  }

  function exportCSV() {
    if (!data) return
    const { meta: m, rankingClosers, rankingSetters, ultimasTransacciones } = data
    let csv = 'sep=,\n'
    csv += `REPORTE FACTURACIÓN - ${m.mes}\n\n`
    csv += 'RESUMEN\n'
    csv += `Meta,${m.meta_objetivo}\nFacturado,${m.facturacion_alcanzada}\nFaltante,${m.faltante}\nRendimiento,${m.porcentaje_rendimiento}%\n`
    csv += `Costos Ads,${m.costos_ads}\nCostos Operativos,${m.costos_operativos}\nGanancia Neta,${m.ganancia_neta}\nReembolsos,${m.total_reembolsos}\n\n`
    csv += 'RANKING CLOSERS\nNombre,Facturado,Ventas,Clientes,%Meta\n'
    rankingClosers.forEach(r => { csv += `${r.nombre},${r.facturado},${r.ventas},${r.totalClientes},${r.porcentajeMeta}%\n` })
    csv += '\nRANKING SETTERS\nNombre,Facturado,Ventas,Clientes,%Meta\n'
    rankingSetters.forEach(r => { csv += `${r.nombre},${r.facturado},${r.ventas},${r.totalClientes},${r.porcentajeMeta}%\n` })
    csv += '\nTRANSACCIONES\nFecha,Tipo,Cliente,Monto,Descripción\n'
    ultimasTransacciones.forEach(t => { csv += `${t.fecha},${t.tipo},${t.cliente_nombre},${t.monto},"${t.descripcion || ''}"\n` })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `facturacion-${m.mes}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function handleMesChange(direction: number) {
    const d = new Date(mes)
    d.setMonth(d.getMonth() + direction)
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }

  // ─── Auth Loading
  if (!authReady) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bg }}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center"><Activity size={16} className="text-indigo-500" /></div>
        </div>
        <p className="text-xs uppercase tracking-widest" style={{ color: COLORS.textDark }}>Verificando acceso</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg, color: COLORS.text }}>

      {/* ═══ STICKY HEADER ═══ */}
      <header className="sticky top-0 z-50" style={{ background: 'rgba(8,11,20,0.92)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${COLORS.border}` }}>
        <div className="max-w-7xl mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt size={16} style={{ color: COLORS.accentLight }} />
            <span className="text-sm font-bold tracking-tight">Facturación & Comisiones</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowReglas(!showReglas)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/5"
              style={{ color: showReglas ? COLORS.accentLight : COLORS.textDim, background: showReglas ? `${COLORS.accent}15` : 'transparent' }}>
              <Shield size={13} /> Reglas
            </button>
            <div className="w-px h-4 mx-1" style={{ background: COLORS.border }} />
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/5" style={{ color: COLORS.textDim }}>
              <Download size={13} /> Exportar
            </button>
          </div>
        </div>
        {/* Month selector */}
        <div className="max-w-7xl mx-auto px-5 h-10 flex items-center justify-center gap-3" style={{ borderTop: `1px solid rgba(26,34,52,0.5)` }}>
          <button onClick={() => handleMesChange(-1)} className="px-2 py-1 rounded text-xs font-medium transition-all hover:bg-white/5" style={{ color: COLORS.textMuted }}>◄</button>
          <div className="flex items-center gap-2">
            <Calendar size={13} style={{ color: COLORS.accentLight }} />
            <span className="text-sm font-semibold" style={{ color: COLORS.text }}>
              {new Date(mes).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
            </span>
          </div>
          <button onClick={() => handleMesChange(1)} className="px-2 py-1 rounded text-xs font-medium transition-all hover:bg-white/5" style={{ color: COLORS.textMuted }}>►</button>
          {!editingMeta ? (
            <button onClick={() => setEditingMeta(true)} className="ml-4 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:bg-white/5" style={{ color: COLORS.accent, border: `1px solid ${COLORS.accent}30` }}>
              <Edit3 size={11} /> Editar Meta
            </button>
          ) : (
            <div className="ml-4 flex items-center gap-2">
              <input value={metaForm.meta_objetivo} onChange={e => setMetaForm({ ...metaForm, meta_objetivo: e.target.value })} placeholder="Meta" className="w-24 px-2 py-1 rounded text-xs" style={{ background: COLORS.card, border: `1px solid ${COLORS.borderLight}`, color: COLORS.text }} />
              <input value={metaForm.costos_ads} onChange={e => setMetaForm({ ...metaForm, costos_ads: e.target.value })} placeholder="Ads" className="w-20 px-2 py-1 rounded text-xs" style={{ background: COLORS.card, border: `1px solid ${COLORS.borderLight}`, color: COLORS.text }} />
              <input value={metaForm.costos_operativos} onChange={e => setMetaForm({ ...metaForm, costos_operativos: e.target.value })} placeholder="Ops" className="w-20 px-2 py-1 rounded text-xs" style={{ background: COLORS.card, border: `1px solid ${COLORS.borderLight}`, color: COLORS.text }} />
              <button onClick={handleSaveMeta} disabled={savingMeta} className="p-1 rounded transition-all hover:bg-green-500/20" style={{ color: COLORS.green }}><Save size={14} /></button>
              <button onClick={() => setEditingMeta(false)} className="p-1 rounded transition-all hover:bg-red-500/20" style={{ color: COLORS.red }}><X size={14} /></button>
            </div>
          )}
        </div>
      </header>

      {/* ─── LOADING ─── */}
      {loading && (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <p className="text-xs uppercase tracking-widest" style={{ color: COLORS.textDark }}>Cargando datos</p>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="max-w-7xl mx-auto px-5 py-20 text-center">
          <AlertTriangle size={40} style={{ color: COLORS.red }} className="mx-auto mb-3" />
          <p className="text-sm font-semibold mb-2" style={{ color: COLORS.red }}>Error al cargar datos</p>
          <p className="text-xs mb-4" style={{ color: COLORS.textDim }}>{error}</p>
          <button onClick={fetchData} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: `${COLORS.accent}20`, color: COLORS.accentLight, border: `1px solid ${COLORS.accent}40` }}>Reintentar</button>
        </div>
      )}

      {!loading && !error && data && (() => {
        const m = data.meta
        const c = data.cartera

        return (
          <>
            {/* ═══ HERO STAT BAR ═══ */}
            <div style={{ background: 'linear-gradient(135deg, #0D1117 0%, #0a0f1a 100%)', borderBottom: `1px solid ${COLORS.border}` }}>
              <div className="max-w-7xl mx-auto px-5 py-7 flex flex-col sm:flex-row items-center gap-8">
                {/* Progress Ring */}
                <div className="shrink-0 relative flex items-center justify-center">
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r="58" fill="none" stroke={COLORS.border} strokeWidth="10" />
                    <circle cx="70" cy="70" r="58" fill="none" stroke={m.porcentaje_rendimiento >= 80 ? COLORS.green : m.porcentaje_rendimiento >= 50 ? COLORS.yellow : COLORS.red}
                      strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${Math.min(m.porcentaje_rendimiento, 100) * 3.64} 364`}
                      transform="rotate(-90 70 70)"
                      style={{ transition: 'stroke-dasharray 0.8s ease' }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-2xl font-black" style={{ color: m.porcentaje_rendimiento >= 80 ? COLORS.green : m.porcentaje_rendimiento >= 50 ? COLORS.yellow : COLORS.red }}>
                      {pct(m.porcentaje_rendimiento)}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: COLORS.textDim }}>Completado</p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: COLORS.textDim }}>Facturado</p>
                    <p className="text-3xl font-black tracking-tight" style={{ color: COLORS.green }}>{fmtShort(m.facturacion_alcanzada)}</p>
                    <p className="text-xs mt-1" style={{ color: COLORS.textDark }}>de {fmtShort(m.meta_objetivo)} meta</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: COLORS.textDim }}>Faltante</p>
                    <p className="text-3xl font-black tracking-tight" style={{ color: m.faltante > 0 ? COLORS.yellow : COLORS.green }}>{fmtShort(m.faltante)}</p>
                    <p className="text-xs mt-1" style={{ color: COLORS.textDark }}>para alcanzar meta</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: COLORS.textDim }}>Ganancia Neta</p>
                    <p className="text-3xl font-black tracking-tight" style={{ color: m.ganancia_neta >= 0 ? COLORS.green : COLORS.red }}>
                      {fmtShort(m.ganancia_neta)}
                    </p>
                    <p className="text-xs mt-1" style={{ color: COLORS.textDark }}>ingresos - costos</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: COLORS.textDim }}>Cartera</p>
                    <p className="text-3xl font-black tracking-tight" style={{ color: COLORS.accentLight }}>{fmtShort(c.total)}</p>
                    <p className="text-xs mt-1" style={{ color: COLORS.textDark }}>{c.total_clientes} clientes</p>
                  </div>
                </div>
              </div>
            </div>

            <main className="max-w-7xl mx-auto px-5 py-7 space-y-8">

              {/* ═══ ALERTAS ═══ */}
              {data.alertas.length > 0 && (
                <section>
                  <SectionHeader icon={AlertTriangle} title="Alertas" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.alertas.map((a, i) => <AlertCard key={i} alerta={a} />)}
                  </div>
                </section>
              )}

              {/* ═══ KPI CARDS ═══ */}
              <section>
                <SectionHeader icon={BarChart2} title="Indicadores del Mes" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <StatCard icon={Target} label="Meta" value={fmtShort(m.meta_objetivo)} color={COLORS.accentLight} />
                  <StatCard icon={DollarSign} label="Facturado" value={fmtShort(m.facturacion_alcanzada)} sub={pct(m.porcentaje_rendimiento)} color={COLORS.green} glow />
                  <StatCard icon={Megaphone} label="Costos Ads" value={fmtShort(m.costos_ads)} color={COLORS.orange} />
                  <StatCard icon={CreditCard} label="Costos Ops" value={fmtShort(m.costos_operativos)} color={COLORS.yellow} />
                  <StatCard icon={RotateCcw} label="Reembolsos" value={fmtShort(m.total_reembolsos)} color={COLORS.orange} />
                  <StatCard icon={AlertTriangle} label="Cartera Vencida" value={fmtShort(c.vencida)} sub={`${c.vencidos} clientes`} color={COLORS.red} glow={c.vencida > 0} />
                </div>
              </section>

              {/* ═══ COMISIONES DIFERIDAS + CARTERA VENCIDA CATEGORÍAS ═══ */}
              {(data.comisionesDiferidas || data.carteraVencidaCategoria) && (
                <section>
                  <SectionHeader icon={Clock} title="Comisiones Diferidas & Cartera Vencida" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {data.comisionesDiferidas && <>
                      <StatCard icon={Clock} label="Com. en Garantía" value={fmtShort(data.comisionesDiferidas.pendiente)} sub="7 días de espera" color={COLORS.yellow} />
                      <StatCard icon={CheckCircle} label="Com. Disponibles" value={fmtShort(data.comisionesDiferidas.disponible)} sub="Listas para liquidar" color={COLORS.green} glow={data.comisionesDiferidas.disponible > 0} />
                      <StatCard icon={XCircle} label="Com. Revertidas" value={fmtShort(data.comisionesDiferidas.revertida_mes)} sub="Este mes" color={COLORS.red} />
                    </>}
                    {data.carteraVencidaCategoria && <>
                      <StatCard icon={AlertCircle} label="Vencida Ligera" value={fmtShort(data.carteraVencidaCategoria.ligera)} sub="1-7 días" color={COLORS.yellow} />
                      <StatCard icon={AlertTriangle} label="Vencida Pesada" value={fmtShort(data.carteraVencidaCategoria.pesada)} sub="8-30 días" color={COLORS.orange} />
                      <StatCard icon={XCircle} label="Default / Cobranza" value={fmtShort(data.carteraVencidaCategoria.default_cobranza)} sub=">30 días" color={COLORS.red} glow={data.carteraVencidaCategoria.default_cobranza > 0} />
                    </>}
                  </div>
                </section>
              )}

              {/* ═══ CHARTS ROW 1: Timeline + Meta Progress ═══ */}
              <section>
                <SectionHeader icon={TrendingUp} title="Evolución del Mes" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <ChartCard title="Facturación Diaria (Acumulado vs Meta)" className="lg:col-span-2">
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={data.timeline} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <defs>
                          <linearGradient id="gradAcum" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradIng" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                        <XAxis dataKey="fecha" tick={{ fill: CHART_TEXT, fontSize: 10 }} axisLine={{ stroke: CHART_AXIS }} tickLine={false} />
                        <YAxis tick={{ fill: CHART_TEXT, fontSize: 10 }} axisLine={{ stroke: CHART_AXIS }} tickLine={false} tickFormatter={(v) => fmtShort(v)} />
                        <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [fmtShort(Number(value)), '']} />
                        <Area type="monotone" dataKey="acumulado" stroke={COLORS.accent} fill="url(#gradAcum)" strokeWidth={2} name="Acumulado" />
                        <Area type="monotone" dataKey="ingresos" stroke={COLORS.green} fill="url(#gradIng)" strokeWidth={1.5} name="Ingresos" />
                        <Line type="monotone" dataKey="meta" stroke={COLORS.red} strokeDasharray="6 3" strokeWidth={1} dot={false} name="Meta" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Distribución Cartera">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={data.distribucionCartera} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                          {data.distribucionCartera.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [value, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-4 mt-2">
                      {data.distribucionCartera.map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                          <span className="text-[10px]" style={{ color: COLORS.textMuted }}>{d.name} ({d.value})</span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                </div>
              </section>

              {/* ═══ CARTERA SUMMARY CARDS ═══ */}
              <section>
                <SectionHeader icon={Wallet} title="Resumen de Cartera" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard icon={Users} label="Total Clientes" value={String(c.total_clientes)} color={COLORS.accentLight} />
                  <StatCard icon={CheckCircle} label="Activos" value={String(c.activos)} color={COLORS.green} />
                  <StatCard icon={AlertTriangle} label="Vencidos" value={String(c.vencidos)} color={COLORS.red} />
                  <StatCard icon={Shield} label="Pagados" value={String(c.pagados)} color={COLORS.accent} />
                </div>
              </section>

              {/* ═══ RANKINGS ═══ */}
              <section>
                <SectionHeader icon={Award} title="Rankings de Facturación" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <Target size={13} style={{ color: COLORS.green }} />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.textDim }}>Closers</span>
                      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${COLORS.green}15`, color: COLORS.green }}>{data.rankingClosers.length}</span>
                    </div>
                    {data.rankingClosers.length > 0 ? data.rankingClosers.map((r, i) => (
                      <RankingRow key={r.id} r={r} index={i} metaGlobal={m.meta_objetivo} />
                    )) : (
                      <p className="text-xs text-center py-8" style={{ color: COLORS.textDark }}>Sin datos de closers</p>
                    )}
                  </div>
                  <div className="rounded-2xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                    <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <Award size={13} style={{ color: COLORS.accentLight }} />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.textDim }}>Setters</span>
                      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${COLORS.accent}15`, color: COLORS.accentLight }}>{data.rankingSetters.length}</span>
                    </div>
                    {data.rankingSetters.length > 0 ? data.rankingSetters.map((r, i) => (
                      <RankingRow key={r.id} r={r} index={i} metaGlobal={m.meta_objetivo} />
                    )) : (
                      <p className="text-xs text-center py-8" style={{ color: COLORS.textDark }}>Sin datos de setters</p>
                    )}
                  </div>
                </div>
              </section>

              {/* ═══ CHARTS ROW 2: Fuente + Canal + Closer ═══ */}
              <section>
                <SectionHeader icon={PieChartIcon} title="Análisis de Ingresos" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <ChartCard title="Ingresos por Closer">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data.ingresosPorCloser} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                        <XAxis dataKey="name" tick={{ fill: CHART_TEXT, fontSize: 10 }} axisLine={{ stroke: CHART_AXIS }} tickLine={false} />
                        <YAxis tick={{ fill: CHART_TEXT, fontSize: 10 }} axisLine={{ stroke: CHART_AXIS }} tickLine={false} tickFormatter={(v) => fmtShort(v)} />
                        <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [fmtShort(Number(value)), '']} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Facturado">
                          {data.ingresosPorCloser.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Ingresos por Fuente">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data.ingresosPorFuente} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                        <XAxis type="number" tick={{ fill: CHART_TEXT, fontSize: 10 }} axisLine={{ stroke: CHART_AXIS }} tickLine={false} tickFormatter={(v) => fmtShort(v)} />
                        <YAxis type="category" dataKey="name" tick={{ fill: CHART_TEXT, fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                        <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [fmtShort(Number(value)), '']} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={COLORS.accent} name="Ingreso" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Ingresos por Canal">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={data.ingresosPorCanal} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                          {data.ingresosPorCanal.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [fmtShort(Number(value)), '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                      {data.ingresosPorCanal.map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-[10px]" style={{ color: COLORS.textMuted }}>{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                </div>
              </section>

              {/* ═══ TENDENCIA HISTÓRICA ═══ */}
              {data.tendenciaMetas.length > 1 && (
                <section>
                  <SectionHeader icon={TrendingUp} title="Tendencia Histórica" />
                  <ChartCard title="Meta vs Alcanzado (últimos meses)">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data.tendenciaMetas} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                        <XAxis dataKey="mes" tick={{ fill: CHART_TEXT, fontSize: 10 }} axisLine={{ stroke: CHART_AXIS }} tickLine={false} />
                        <YAxis tick={{ fill: CHART_TEXT, fontSize: 10 }} axisLine={{ stroke: CHART_AXIS }} tickLine={false} tickFormatter={(v) => fmtShort(v)} />
                        <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [fmtShort(Number(value)), '']} />
                        <Bar dataKey="meta" fill={COLORS.accent} opacity={0.3} radius={[4, 4, 0, 0]} name="Meta" />
                        <Bar dataKey="alcanzado" fill={COLORS.green} radius={[4, 4, 0, 0]} name="Alcanzado" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </section>
              )}

              {/* ═══ ÚLTIMAS TRANSACCIONES ═══ */}
              <section>
                <SectionHeader icon={Receipt} title="Últimas Transacciones" />
                <div className="rounded-2xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                  {data.ultimasTransacciones.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: COLORS.card }}>
                          <th className="text-left py-2.5 px-4 font-semibold" style={{ color: COLORS.textDim }}>Fecha</th>
                          <th className="text-left py-2.5 px-4 font-semibold" style={{ color: COLORS.textDim }}>Tipo</th>
                          <th className="text-left py-2.5 px-4 font-semibold" style={{ color: COLORS.textDim }}>Cliente</th>
                          <th className="text-right py-2.5 px-4 font-semibold" style={{ color: COLORS.textDim }}>Monto</th>
                          <th className="text-left py-2.5 px-4 font-semibold" style={{ color: COLORS.textDim }}>Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ultimasTransacciones.map((tx) => {
                          const typeColor = tx.tipo === 'ingreso' ? COLORS.green : tx.tipo === 'reembolso' ? COLORS.orange : COLORS.red
                          return (
                            <tr key={tx.id} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                              <td className="py-2 px-4" style={{ color: COLORS.textMuted }}>{new Date(tx.fecha).toLocaleDateString('es-AR')}</td>
                              <td className="py-2 px-4">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase" style={{ background: `${typeColor}12`, color: typeColor }}>
                                  {tx.tipo}
                                </span>
                              </td>
                              <td className="py-2 px-4 font-medium" style={{ color: COLORS.text }}>{tx.cliente_nombre}</td>
                              <td className="py-2 px-4 text-right font-bold" style={{ color: typeColor }}>
                                {tx.tipo === 'reembolso' ? '-' : ''}{fmt(tx.monto)}
                              </td>
                              <td className="py-2 px-4 truncate max-w-[200px]" style={{ color: COLORS.textMuted }}>{tx.descripcion || '-'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-center py-10" style={{ color: COLORS.textDark }}>Sin transacciones en este mes</p>
                  )}
                </div>
              </section>

              {/* ═══ REGLAS DE COMISIÓN ═══ */}
              {showReglas && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <SectionHeader icon={Shield} title="Reglas de Comisión" />
                    <button onClick={openNewRegla}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: `${COLORS.accent}20`, color: COLORS.accentLight, border: `1px solid ${COLORS.accent}40` }}>
                      <Plus size={13} /> Nueva Regla
                    </button>
                  </div>

                  {/* Regla Form Modal */}
                  {showReglaForm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
                      <div className="w-full max-w-lg rounded-2xl p-6 max-h-[85vh] overflow-y-auto" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="text-sm font-bold">{editingRegla ? 'Editar Regla' : 'Nueva Regla de Comisión'}</h3>
                          <button onClick={() => setShowReglaForm(false)} className="p-1 rounded hover:bg-white/5"><X size={16} style={{ color: COLORS.textDim }} /></button>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: COLORS.textDim }}>Nombre</label>
                              <input value={reglaForm.nombre} onChange={e => setReglaForm({ ...reglaForm, nombre: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: COLORS.card, borderColor: COLORS.borderLight, color: COLORS.text }}
                                placeholder="Ej: Closer Estándar" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: COLORS.textDim }}>Rol</label>
                              <select value={reglaForm.rol} onChange={e => setReglaForm({ ...reglaForm, rol: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: COLORS.card, borderColor: COLORS.borderLight, color: COLORS.text }}>
                                <option value="closer">Closer</option>
                                <option value="setter">Setter</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.textDim }}>Tramos Escalonados</label>
                              <button onClick={addTramo} className="text-[10px] font-semibold px-2 py-0.5 rounded transition-all hover:bg-white/5" style={{ color: COLORS.accentLight }}>
                                + Agregar Tramo
                              </button>
                            </div>

                            <div className="space-y-2">
                              {reglaForm.tramos.map((t, i) => (
                                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: COLORS.card, border: `1px solid ${COLORS.borderLight}` }}>
                                  <div className="flex-1">
                                    <span className="text-[9px] uppercase font-semibold" style={{ color: COLORS.textDark }}>Desde</span>
                                    <input type="number" value={t.desde} onChange={e => updateTramo(i, 'desde', Number(e.target.value))}
                                      className="w-full px-2 py-1 rounded text-xs border mt-0.5" style={{ background: COLORS.bg, borderColor: COLORS.borderLight, color: COLORS.text }} />
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-[9px] uppercase font-semibold" style={{ color: COLORS.textDark }}>Hasta</span>
                                    <input type="number" value={t.hasta} onChange={e => updateTramo(i, 'hasta', Number(e.target.value))}
                                      className="w-full px-2 py-1 rounded text-xs border mt-0.5" style={{ background: COLORS.bg, borderColor: COLORS.borderLight, color: COLORS.text }} />
                                  </div>
                                  <div className="w-20">
                                    <span className="text-[9px] uppercase font-semibold" style={{ color: COLORS.textDark }}>%</span>
                                    <input type="number" value={t.porcentaje} onChange={e => updateTramo(i, 'porcentaje', Number(e.target.value))}
                                      className="w-full px-2 py-1 rounded text-xs border mt-0.5" style={{ background: COLORS.bg, borderColor: COLORS.borderLight, color: COLORS.text }}
                                      min="0" max="100" step="0.5" />
                                  </div>
                                  {reglaForm.tramos.length > 1 && (
                                    <button onClick={() => removeTramo(i)} className="p-1 rounded hover:bg-red-500/20 mt-3" style={{ color: COLORS.red }}>
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="p-3 rounded-lg" style={{ background: `${COLORS.accent}08`, border: `1px solid ${COLORS.accent}15` }}>
                            <p className="text-[11px]" style={{ color: COLORS.accentLight }}>
                              Los tramos definen el porcentaje de comisión según el monto facturado. Si un pago cae en el rango &quot;Desde&quot; - &quot;Hasta&quot;, se aplica el porcentaje correspondiente.
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-5">
                          <button onClick={() => setShowReglaForm(false)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: COLORS.textDim }}>Cancelar</button>
                          <button onClick={handleSaveRegla} disabled={savingRegla || !reglaForm.nombre}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            style={{ background: COLORS.accent, color: '#fff' }}>
                            {savingRegla ? 'Guardando...' : <><Save size={13} /> {editingRegla ? 'Actualizar' : 'Crear Regla'}</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reglas List */}
                  {reglas.length === 0 ? (
                    <div className="text-center py-12 rounded-2xl" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                      <Shield size={32} style={{ color: COLORS.border }} className="mx-auto mb-2" />
                      <p className="text-sm" style={{ color: COLORS.textDim }}>No hay reglas de comisión configuradas</p>
                      <p className="text-xs mt-1" style={{ color: COLORS.textDark }}>Crea una regla para definir porcentajes de comisión por tramos</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reglas.map(r => (
                        <div key={r.id} className="rounded-2xl p-4 transition-all" style={{ background: COLORS.surface, border: `1px solid ${r.activa ? COLORS.border : COLORS.borderLight}`, opacity: r.activa ? 1 : 0.6 }}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: r.rol === 'closer' ? `${COLORS.green}15` : `${COLORS.accent}15` }}>
                                {r.rol === 'closer' ? <Zap size={14} style={{ color: COLORS.green }} /> : <Award size={14} style={{ color: COLORS.accentLight }} />}
                              </div>
                              <div>
                                <p className="text-sm font-bold">{r.nombre}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full"
                                    style={{ background: r.rol === 'closer' ? `${COLORS.green}12` : `${COLORS.accent}12`, color: r.rol === 'closer' ? COLORS.green : COLORS.accentLight }}>
                                    {r.rol}
                                  </span>
                                  <span className="text-[10px] font-semibold" style={{ color: r.activa ? COLORS.green : COLORS.textDark }}>
                                    {r.activa ? '● Activa' : '○ Inactiva'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleToggleRegla(r.id, r.activa)}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all hover:bg-white/5"
                                style={{ color: r.activa ? COLORS.yellow : COLORS.green, border: `1px solid ${r.activa ? COLORS.yellow : COLORS.green}20` }}>
                                {r.activa ? 'Desactivar' : 'Activar'}
                              </button>
                              <button onClick={() => openEditRegla(r)}
                                className="p-1.5 rounded-lg transition-all hover:bg-white/5" style={{ color: COLORS.textDim }}>
                                <Edit3 size={13} />
                              </button>
                              <button onClick={() => handleDeleteRegla(r.id)}
                                className="p-1.5 rounded-lg transition-all hover:bg-red-500/10" style={{ color: COLORS.red }}>
                                <X size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Tramos visual */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {r.tramos.map((t, i) => (
                              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: COLORS.card, border: `1px solid ${COLORS.borderLight}` }}>
                                <span className="text-[10px] font-bold" style={{ color: COLORS.textDark }}>Tramo {i + 1}</span>
                                <span className="text-[11px]" style={{ color: COLORS.textMuted }}>
                                  {fmtShort(t.desde)} — {fmtShort(t.hasta)}
                                </span>
                                <span className="ml-auto text-sm font-black" style={{ color: COLORS.green }}>{t.porcentaje}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

            </main>
          </>
        )
      })()}
    </div>
  )
}
