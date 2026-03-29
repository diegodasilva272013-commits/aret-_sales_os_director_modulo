'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Wallet, ChevronDown, ChevronUp, FileText,
  Plus, Users, Activity, Award,
  Calendar, Zap, CheckCircle, X, Trash2, RotateCcw
} from 'lucide-react'

function fmt(n: number) { return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toLocaleString()}`
}

interface Profile { id: string; nombre: string; apellido?: string; rol: string }
interface DetalleItem {
  tipo?: string; cliente: string; cuota_id: string | null; monto?: number; monto_base?: number
  fecha: string; comision_generada: number; porcentaje?: number
  monto_anterior?: number; monto_nuevo?: number
}
interface Liquidacion {
  id: string; usuario_id: string; usuario_nombre: string; usuario_rol: string
  fecha_desde: string; fecha_hasta: string; total_comision: number
  detalle: DetalleItem[]; generado_en: string; total_facturado?: number; total_reembolsado?: number
  ajustes_aplicados?: number; regla_snapshot?: { nombre?: string; tramos?: unknown[] } | null
  estado: 'pendiente' | 'pagada'
}

const fieldStyle: React.CSSProperties = { background: '#111827', borderColor: '#1F2937', color: '#F1F5F9' }

function RolBadge({ rol }: { rol: string }) {
  const c: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
    closer: { bg: 'rgba(52,211,153,0.1)', color: '#34D399', icon: <Zap size={9} /> },
    setter: { bg: 'rgba(129,140,248,0.1)', color: '#818CF8', icon: <Users size={9} /> },
    director: { bg: 'rgba(251,191,36,0.1)', color: '#FBBF24', icon: <Award size={9} /> },
  }
  const s = c[rol] || c.setter
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase flex items-center gap-1 w-fit"
      style={{ background: s.bg, color: s.color }}>
      {s.icon} {rol}
    </span>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #6366F1, #818CF8)' }} />
      <Icon size={14} style={{ color: '#818CF8' }} />
      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#818CF8' }}>{title}</h2>
    </div>
  )
}

function Avatar({ nombre, size = 36 }: { nombre: string; size?: number }) {
  const initials = nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div style={{
      width: size, height: size, borderRadius: 12, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size > 32 ? 12 : 10, fontWeight: 700, color: '#fff', flexShrink: 0
    }}>{initials}</div>
  )
}

export default function LiquidacionesClient() {
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showGenerar, setShowGenerar] = useState(false)
  const [genForm, setGenForm] = useState({ usuario_id: '', fecha_desde: '', fecha_hasta: '' })
  const [generating, setGenerating] = useState(false)
  const [lastResult, setLastResult] = useState<Liquidacion | null>(null)
  // ─── Filters
  const [filterEstado, setFilterEstado] = useState('')
  const [filterUsuario, setFilterUsuario] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
      if (!profile || profile.rol !== 'director') { router.push('/login'); return }
      setAuthReady(true)
    })
  }, [router])

  const fetchLiquidaciones = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/facturacion/liquidaciones')
      if (res.ok) setLiquidaciones(await res.json())
    } catch (e) {
      console.error('Error fetching liquidaciones:', e)
    }
    setLoading(false)
  }, [])

  const fetchProfiles = useCallback(async () => {
    const res = await fetch('/api/equipo')
    if (res.ok) { const data = await res.json(); setProfiles(Array.isArray(data) ? data : data.profiles || []) }
  }, [])

  useEffect(() => { if (authReady) { fetchLiquidaciones(); fetchProfiles() } }, [fetchLiquidaciones, fetchProfiles, authReady])

  async function handleGenerar() {
    if (!genForm.usuario_id || !genForm.fecha_desde || !genForm.fecha_hasta) return
    setGenerating(true); setLastResult(null)
    const res = await fetch('/api/facturacion/liquidaciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(genForm),
    })
    if (res.ok) { const result = await res.json(); setLastResult(result); fetchLiquidaciones() }
    setGenerating(false)
  }

  async function handleToggleEstado(id: string, estadoActual: string) {
    const nuevoEstado = estadoActual === 'pagada' ? 'pendiente' : 'pagada'
    await fetch('/api/facturacion/liquidaciones', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado: nuevoEstado }),
    })
    fetchLiquidaciones()
  }

  async function handleDeleteLiquidacion(id: string) {
    if (!confirm('¿Eliminar esta liquidación? Esta acción no se puede revertir.')) return
    await fetch(`/api/facturacion/liquidaciones?id=${id}`, { method: 'DELETE' })
    fetchLiquidaciones()
  }

  // Stats
  const totalComisiones = liquidaciones.reduce((s, l) => s + Number(l.total_comision), 0)
  const uniqueUsers = new Map<string, string>()
  liquidaciones.forEach(l => uniqueUsers.set(l.usuario_id, l.usuario_nombre))
  const totalPersonas = uniqueUsers.size

  if (!authReady) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080B14' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center"><Activity size={16} className="text-indigo-500" /></div>
        </div>
        <p className="text-xs uppercase tracking-widest" style={{ color: '#334155' }}>Verificando acceso</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: '#080B14', color: '#F1F5F9' }}>
      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50" style={{ background: 'rgba(8,11,20,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #1a2234' }}>
        <div className="max-w-7xl mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet size={15} style={{ color: '#6366F1' }} />
            <span className="text-sm font-bold tracking-tight">Liquidaciones de Comisiones</span>
          </div>
          <button onClick={() => { setShowGenerar(!showGenerar); setLastResult(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
            style={{ background: showGenerar ? '#374151' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff' }}>
            {showGenerar ? <><X size={13} /> Cerrar</> : <><Plus size={13} /> Generar Liquidación</>}
          </button>
        </div>
      </header>

      {/* ═══ HERO STATS ═══ */}
      {!loading && (
        <div style={{ background: 'linear-gradient(135deg, #0D1117 0%, #0a0f1a 100%)', borderBottom: '1px solid #1a2234' }}>
          <div className="max-w-7xl mx-auto px-5 py-6 grid grid-cols-2 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#475569' }}>Total Comisiones</p>
              <p className="text-3xl font-black tracking-tight" style={{ color: '#34D399' }}>{fmtShort(totalComisiones)}</p>
              <p className="text-xs mt-1" style={{ color: '#334155' }}>acumulado histórico</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#475569' }}>Liquidaciones</p>
              <p className="text-3xl font-black tracking-tight" style={{ color: '#818CF8' }}>{liquidaciones.length}</p>
              <p className="text-xs mt-1" style={{ color: '#334155' }}>generadas</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#475569' }}>Personas</p>
              <p className="text-3xl font-black tracking-tight" style={{ color: '#F1F5F9' }}>{totalPersonas}</p>
              <p className="text-xs mt-1" style={{ color: '#334155' }}>con liquidaciones</p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-5 py-6 space-y-6">

        {/* ═══ GENERATE FORM ═══ */}
        {showGenerar && (
          <section className="rounded-2xl overflow-hidden" style={{ background: '#0D1117', border: '1px solid #6366F120', boxShadow: '0 0 40px rgba(99,102,241,0.05)' }}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
                  <Zap size={15} style={{ color: '#818CF8' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Generar Nueva Liquidación</h3>
                  <p className="text-[10px]" style={{ color: '#475569' }}>Calcula comisiones automáticamente según el rol del usuario</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: '#475569' }}>Usuario</label>
                  <select value={genForm.usuario_id} onChange={e => setGenForm({ ...genForm, usuario_id: e.target.value })}
                    className="w-full text-sm px-3 py-2.5 rounded-lg border" style={fieldStyle}>
                    <option value="">Seleccionar persona...</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} {p.apellido || ''} ({p.rol})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: '#475569' }}>Desde</label>
                  <input type="date" value={genForm.fecha_desde} onChange={e => setGenForm({ ...genForm, fecha_desde: e.target.value })}
                    className="w-full text-sm px-3 py-2.5 rounded-lg border" style={fieldStyle} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: '#475569' }}>Hasta</label>
                  <input type="date" value={genForm.fecha_hasta} onChange={e => setGenForm({ ...genForm, fecha_hasta: e.target.value })}
                    className="w-full text-sm px-3 py-2.5 rounded-lg border" style={fieldStyle} />
                </div>
              </div>

              <button onClick={handleGenerar} disabled={generating || !genForm.usuario_id || !genForm.fecha_desde || !genForm.fecha_hasta}
                className="mt-4 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff' }}>
                {generating ? (
                  <><div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white animate-spin" /> Calculando...</>
                ) : (
                  <><Zap size={13} /> Calcular y Guardar Liquidación</>
                )}
              </button>
            </div>

            {/* Last result */}
            {lastResult && (
              <div className="p-5" style={{ borderTop: '1px solid #1a2234', background: '#0a0f1a' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.1)' }}>
                    <CheckCircle size={18} style={{ color: '#34D399' }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold">{lastResult.usuario_nombre}</p>
                      <RolBadge rol={lastResult.usuario_rol} />
                    </div>
                    <p className="text-[11px]" style={{ color: '#475569' }}>
                      Período: {new Date(lastResult.fecha_desde + 'T12:00:00').toLocaleDateString('es-AR')} — {new Date(lastResult.fecha_hasta + 'T12:00:00').toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest" style={{ color: '#475569' }}>Comisión</p>
                    <p className="text-2xl font-black" style={{ color: '#34D399' }}>{fmt(lastResult.total_comision)}</p>
                    <p className="text-[10px]" style={{ color: '#475569' }}>
                      Facturado: {fmt(lastResult.total_facturado || 0)}
                      {(lastResult.ajustes_aplicados ?? 0) !== 0 && (
                        <> · Ajustes: <span style={{ color: (lastResult.ajustes_aplicados || 0) >= 0 ? '#34D399' : '#FB923C' }}>{fmt(lastResult.ajustes_aplicados || 0)}</span></>
                      )}
                    </p>
                  </div>
                </div>

                {Array.isArray(lastResult.detalle) && lastResult.detalle.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1F2937' }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: '#111827' }}>
                          <th className="text-left py-2 px-3 font-semibold" style={{ color: '#475569' }}>Tipo</th>
                          <th className="text-left py-2 px-3 font-semibold" style={{ color: '#475569' }}>Cliente</th>
                          <th className="text-right py-2 px-3 font-semibold" style={{ color: '#475569' }}>Base</th>
                          <th className="text-right py-2 px-3 font-semibold" style={{ color: '#475569' }}>%</th>
                          <th className="text-right py-2 px-3 font-semibold" style={{ color: '#475569' }}>Comisión</th>
                          <th className="text-left py-2 px-3 font-semibold" style={{ color: '#475569' }}>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastResult.detalle.map((d, i) => {
                          const isAjuste = d.tipo === 'ajuste'
                          const base = d.monto_base ?? d.monto ?? 0
                          return (
                          <tr key={i} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid rgba(26,34,52,0.5)' }}>
                            <td className="py-2 px-3">
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                                style={{
                                  background: isAjuste ? 'rgba(251,191,36,0.1)' : 'rgba(52,211,153,0.1)',
                                  color: isAjuste ? '#FBBF24' : '#34D399',
                                }}>{isAjuste ? 'Ajuste' : 'Comisión'}</span>
                            </td>
                            <td className="py-2 px-3 font-medium" style={{ color: '#F1F5F9' }}>{d.cliente}</td>
                            <td className="py-2 px-3 text-right" style={{ color: '#94A3B8' }}>{fmt(Math.abs(base))}</td>
                            <td className="py-2 px-3 text-right" style={{ color: '#94A3B8' }}>{d.porcentaje ? `${d.porcentaje}%` : '-'}</td>
                            <td className="py-2 px-3 text-right font-bold" style={{ color: d.comision_generada >= 0 ? '#34D399' : '#FB923C' }}>
                              {d.comision_generada < 0 ? '-' : ''}{fmt(Math.abs(d.comision_generada))}
                            </td>
                            <td className="py-2 px-3" style={{ color: '#94A3B8' }}>{d.fecha ? new Date(d.fecha).toLocaleDateString('es-AR') : '-'}</td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {Array.isArray(lastResult.detalle) && lastResult.detalle.length === 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                    <Calendar size={13} style={{ color: '#FBBF24' }} />
                    <p className="text-xs" style={{ color: '#FBBF24' }}>No se encontraron transacciones para este usuario en el período seleccionado</p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ═══ HISTORIAL ═══ */}
        <section>
          <SectionHeader icon={FileText} title={`Historial de Liquidaciones (${liquidaciones.length})`} />

          {/* ─── FILTROS ─── */}
          {!loading && liquidaciones.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border" style={fieldStyle}>
                <option value="">Todos los estados</option>
                <option value="pendiente">● Pendiente</option>
                <option value="pagada">✓ Pagada</option>
              </select>
              <select value={filterUsuario} onChange={e => setFilterUsuario(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg border" style={fieldStyle}>
                <option value="">Todos los usuarios</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} {p.apellido || ''}</option>
                ))}
              </select>
              {(filterEstado || filterUsuario) && (
                <button onClick={() => { setFilterEstado(''); setFilterUsuario('') }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:bg-white/10"
                  style={{ color: '#818CF8' }}>
                  <RotateCcw size={10} /> Limpiar filtros
                </button>
              )}
            </div>
          )}

          {(() => {
            const filtered = liquidaciones.filter(l => {
              if (filterEstado && l.estado !== filterEstado) return false
              if (filterUsuario && l.usuario_id !== filterUsuario) return false
              return true
            })
            return loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <p className="text-xs uppercase tracking-widest" style={{ color: '#334155' }}>Cargando liquidaciones</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Wallet size={40} style={{ color: '#1a2234' }} className="mx-auto mb-3" />
              <p className="text-sm mb-1" style={{ color: '#475569' }}>
                {(filterEstado || filterUsuario) ? 'No hay liquidaciones que coincidan con los filtros' : 'No hay liquidaciones generadas'}
              </p>
              <p className="text-xs" style={{ color: '#334155' }}>
                {(filterEstado || filterUsuario) ? 'Probá cambiando los filtros' : 'Usa el botón "Generar Liquidación" para crear la primera'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(liq => {
                let detalle: DetalleItem[] = []
                try { detalle = typeof liq.detalle === 'string' ? JSON.parse(liq.detalle) : (Array.isArray(liq.detalle) ? liq.detalle : []) } catch { /* malformed */ }
                const isExpanded = expandedId === liq.id
                return (
                  <div key={liq.id} className="rounded-2xl overflow-hidden transition-all"
                    style={{ background: '#0D1117', border: `1px solid ${isExpanded ? '#6366F120' : '#1a2234'}`, boxShadow: isExpanded ? '0 0 30px rgba(99,102,241,0.04)' : 'none' }}>

                    <div className="flex items-center gap-4 p-4 cursor-pointer transition-all hover:bg-white/[0.015]"
                      onClick={() => setExpandedId(isExpanded ? null : liq.id)}>

                      <Avatar nombre={liq.usuario_nombre} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold truncate">{liq.usuario_nombre}</p>
                          <RolBadge rol={liq.usuario_rol} />
                        </div>
                        <div className="flex items-center gap-2 text-[11px]" style={{ color: '#475569' }}>
                          <Calendar size={10} />
                          <span>
                            {new Date(liq.fecha_desde + 'T12:00:00').toLocaleDateString('es-AR')} — {new Date(liq.fecha_hasta + 'T12:00:00').toLocaleDateString('es-AR')}
                          </span>
                          <span style={{ color: '#334155' }}>·</span>
                          <span>{detalle.length} transacciones</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-lg font-black" style={{ color: '#34D399' }}>{fmt(Number(liq.total_comision))}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            background: liq.estado === 'pagada' ? 'rgba(52,211,153,0.12)' : 'rgba(250,204,21,0.12)',
                            color: liq.estado === 'pagada' ? '#34D399' : '#FACC15',
                            border: `1px solid ${liq.estado === 'pagada' ? 'rgba(52,211,153,0.2)' : 'rgba(250,204,21,0.2)'}`,
                          }}>
                          {liq.estado === 'pagada' ? '✓ Pagada' : '● Pendiente'}
                        </span>
                      </div>

                      <div className="shrink-0" style={{ color: '#475569' }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {/* Expanded desglose */}
                    {isExpanded && (
                      <div className="px-4 pb-4" style={{ borderTop: '1px solid #1a2234' }}>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-3 mb-3">
                          <button onClick={(e) => { e.stopPropagation(); handleToggleEstado(liq.id, liq.estado) }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                            style={{
                              background: liq.estado === 'pagada' ? 'rgba(250,204,21,0.1)' : 'rgba(52,211,153,0.1)',
                              color: liq.estado === 'pagada' ? '#FACC15' : '#34D399',
                              border: `1px solid ${liq.estado === 'pagada' ? 'rgba(250,204,21,0.2)' : 'rgba(52,211,153,0.2)'}`,
                            }}>
                            {liq.estado === 'pagada' ? <RotateCcw size={12} /> : <CheckCircle size={12} />}
                            {liq.estado === 'pagada' ? 'Volver a Pendiente' : 'Marcar como Pagada'}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteLiquidacion(liq.id) }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-red-500/20"
                            style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                            <Trash2 size={12} /> Eliminar
                          </button>
                          {liq.total_reembolsado && liq.total_reembolsado > 0 ? (
                            <span className="ml-auto text-[11px] font-medium" style={{ color: '#FB923C' }}>
                              Reembolsos: {fmt(liq.total_reembolsado)}
                            </span>
                          ) : null}
                        </div>

                        {detalle.length > 0 ? (
                          <div className="rounded-xl overflow-hidden mt-3" style={{ border: '1px solid #1F2937' }}>
                            <table className="w-full text-xs">
                              <thead>
                                <tr style={{ background: '#111827' }}>
                                  <th className="text-left py-2.5 px-3 font-semibold" style={{ color: '#475569' }}>Tipo</th>
                                  <th className="text-left py-2.5 px-3 font-semibold" style={{ color: '#475569' }}>Cliente</th>
                                  <th className="text-right py-2.5 px-3 font-semibold" style={{ color: '#475569' }}>Base</th>
                                  <th className="text-right py-2.5 px-3 font-semibold" style={{ color: '#475569' }}>Comisión</th>
                                  <th className="text-left py-2.5 px-3 font-semibold" style={{ color: '#475569' }}>Fecha</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detalle.map((d, i) => {
                                  const isAjuste = d.tipo === 'ajuste'
                                  const isReembolso = d.tipo === 'reembolso'
                                  const base = d.monto_base ?? d.monto ?? 0
                                  const typeLabel = isAjuste ? 'Ajuste' : isReembolso ? 'Reembolso' : 'Comisión'
                                  const typeColor = isAjuste ? '#FBBF24' : isReembolso ? '#FB923C' : '#34D399'
                                  return (
                                  <tr key={i} className="transition-colors hover:bg-white/[0.02]"
                                    style={{ borderBottom: i < detalle.length - 1 ? '1px solid rgba(26,34,52,0.5)' : 'none' }}>
                                    <td className="py-2 px-3">
                                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                                        style={{ background: `${typeColor}15`, color: typeColor }}>{typeLabel}</span>
                                    </td>
                                    <td className="py-2 px-3 font-medium" style={{ color: '#F1F5F9' }}>{d.cliente}</td>
                                    <td className="py-2 px-3 text-right" style={{ color: '#94A3B8' }}>{fmt(Math.abs(base))}</td>
                                    <td className="py-2 px-3 text-right font-bold" style={{ color: d.comision_generada >= 0 ? '#34D399' : '#FB923C' }}>
                                      {d.comision_generada < 0 ? '-' : ''}{fmt(Math.abs(d.comision_generada))}
                                    </td>
                                    <td className="py-2 px-3" style={{ color: '#94A3B8' }}>{d.fecha ? new Date(d.fecha).toLocaleDateString('es-AR') : '-'}</td>
                                  </tr>
                                  )
                                })}
                              </tbody>
                              <tfoot>
                                <tr style={{ borderTop: '1px solid #1a2234', background: '#111827' }}>
                                  <td colSpan={3} className="py-2.5 px-3 font-bold" style={{ color: '#F1F5F9' }}>Total</td>
                                  <td className="py-2.5 px-3 text-right font-black" style={{ color: '#34D399' }}>{fmt(Number(liq.total_comision))}</td>
                                  <td />
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs py-4 text-center" style={{ color: '#475569' }}>Sin detalle disponible</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
          })()}
        </section>
      </main>
    </div>
  )
}
