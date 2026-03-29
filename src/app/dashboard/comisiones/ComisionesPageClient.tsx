'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Award, Copy, Check, ChevronDown, ChevronUp, CreditCard } from 'lucide-react'

interface MetodoPago {
  id: string
  tipo: string
  datos: string
  titular?: string
  principal: boolean
}

interface DesgloseSetterItem {
  proyecto: string
  base: number
  porCitas: number
  porVentas: number
  subtotal: number
}

interface DesgloseCloserItem {
  proyecto: string
  comisionBase: number
  bonus: number
  bonusCalifica: boolean
  tasaCierre: number
  subtotal: number
}

interface SetterComision {
  id: string
  nombre: string
  foto_url?: string
  activo: boolean
  citas_calificadas: number
  total_comision: number
  desglose: DesgloseSetterItem[]
  pagos: MetodoPago[]
}

interface CloserComision {
  id: string
  nombre: string
  foto_url?: string
  activo: boolean
  ventas_cerradas: number
  monto_cobrado: number
  tasa_cierre: number
  total_comision: number
  desglose: DesgloseCloserItem[]
  pagos: MetodoPago[]
}

function formatCurrency(n: number) {
  return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function Avatar({ nombre, foto_url, size = 36 }: { nombre: string; foto_url?: string; size?: number }) {
  const initials = nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  if (foto_url) {
    return <img src={foto_url} alt={nombre} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid #1a2234' }} />
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size > 32 ? 13 : 10, fontWeight: 700, color: '#fff', flexShrink: 0, border: '2px solid #1a2234'
    }}>
      {initials}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={handleCopy}
      title="Copiar"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: copied ? '#34D399' : '#475569', display: 'flex', alignItems: 'center' }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

function PagoTag({ pago }: { pago: MetodoPago }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0D1117', border: '1px solid #1a2234', borderRadius: 8, padding: '5px 10px' }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: '#6366F1', textTransform: 'uppercase' }}>{pago.tipo}</span>
      <span style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'monospace' }}>{pago.datos}</span>
      {pago.titular && <span style={{ fontSize: 11, color: '#475569' }}>· {pago.titular}</span>}
      <CopyButton text={pago.datos} />
    </div>
  )
}

function SetterCard({ setter }: { setter: SetterComision }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ background: '#0D1117', border: '1px solid #1a2234', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar nombre={setter.nombre} foto_url={setter.foto_url} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 14 }}>{setter.nombre}</span>
            <span style={{ fontSize: 10, color: '#34D399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 6, padding: '1px 7px', fontWeight: 600 }}>
              SETTER
            </span>
            {!setter.activo && <span style={{ fontSize: 10, color: '#64748B', background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 6, padding: '1px 7px' }}>inactivo</span>}
          </div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
            {setter.citas_calificadas} citas cal.
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#34D399', lineHeight: 1 }}>
            {formatCurrency(setter.total_comision)}
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>a pagar</div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: '#818CF8', display: 'flex', alignItems: 'center' }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Payment methods */}
      {setter.pagos.length > 0 && (
        <div style={{ padding: '0 1.25rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <CreditCard size={12} style={{ color: '#475569' }} />
          {setter.pagos.map(p => <PagoTag key={p.id} pago={p} />)}
        </div>
      )}
      {setter.pagos.length === 0 && (
        <div style={{ padding: '0 1.25rem 0.75rem' }}>
          <span style={{ fontSize: 11, color: '#334155' }}>Sin método de pago cargado</span>
        </div>
      )}

      {/* Expanded desglose */}
      {expanded && (
        <div style={{ borderTop: '1px solid #1a2234', padding: '1rem 1.25rem', background: '#080B14' }}>
          <p style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Desglose por proyecto</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1a2234' }}>
                {['Proyecto', 'Base', 'x Citas cal.', 'x Ventas', 'Subtotal'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Proyecto' ? 'left' : 'right', padding: '6px 10px', color: '#475569', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {setter.desglose.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < setter.desglose.length - 1 ? '1px solid rgba(26,34,52,0.5)' : 'none' }}>
                  <td style={{ padding: '7px 10px', color: '#94A3B8' }}>{row.proyecto}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#64748B' }}>{formatCurrency(row.base)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#818CF8' }}>{formatCurrency(row.porCitas)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#A78BFA' }}>{formatCurrency(row.porVentas)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#34D399', fontWeight: 700 }}>{formatCurrency(row.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CloserCard({ closer }: { closer: CloserComision }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ background: '#0D1117', border: '1px solid #1a2234', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar nombre={closer.nombre} foto_url={closer.foto_url} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 14 }}>{closer.nombre}</span>
            <span style={{ fontSize: 10, color: '#FBBF24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 6, padding: '1px 7px', fontWeight: 600 }}>
              CLOSER
            </span>
            {!closer.activo && <span style={{ fontSize: 10, color: '#64748B', background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 6, padding: '1px 7px' }}>inactivo</span>}
          </div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
            {closer.ventas_cerradas} ventas · {closer.tasa_cierre}% cierre · {formatCurrency(closer.monto_cobrado)} cobrado
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#34D399', lineHeight: 1 }}>
            {formatCurrency(closer.total_comision)}
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>a pagar</div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: '#818CF8', display: 'flex', alignItems: 'center' }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Payment methods */}
      {closer.pagos.length > 0 && (
        <div style={{ padding: '0 1.25rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <CreditCard size={12} style={{ color: '#475569' }} />
          {closer.pagos.map(p => <PagoTag key={p.id} pago={p} />)}
        </div>
      )}
      {closer.pagos.length === 0 && (
        <div style={{ padding: '0 1.25rem 0.75rem' }}>
          <span style={{ fontSize: 11, color: '#334155' }}>Sin método de pago cargado</span>
        </div>
      )}

      {/* Expanded desglose */}
      {expanded && (
        <div style={{ borderTop: '1px solid #1a2234', padding: '1rem 1.25rem', background: '#080B14' }}>
          <p style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Desglose por proyecto</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1a2234' }}>
                {['Proyecto', '% Cobrado', 'Bonus', 'Tasa cierre', 'Subtotal'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Proyecto' ? 'left' : 'right', padding: '6px 10px', color: '#475569', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {closer.desglose.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < closer.desglose.length - 1 ? '1px solid rgba(26,34,52,0.5)' : 'none' }}>
                  <td style={{ padding: '7px 10px', color: '#94A3B8' }}>{row.proyecto}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#818CF8' }}>{formatCurrency(row.comisionBase)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                    {row.bonusCalifica
                      ? <span style={{ color: '#34D399', fontWeight: 600 }}>{formatCurrency(row.bonus)}</span>
                      : <span style={{ color: '#334155', fontSize: 11 }}>No califica</span>
                    }
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                    <span style={{ color: row.tasaCierre >= 40 ? '#34D399' : '#F87171' }}>{row.tasaCierre}%</span>
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#34D399', fontWeight: 700 }}>{formatCurrency(row.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#0D1117', border: '1px solid #1a2234', borderRadius: 8,
  padding: '5px 10px', color: '#F1F5F9', fontSize: 12, outline: 'none',
}

export default function ComisionesPageClient() {
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<{ setters: SetterComision[]; closers: CloserComision[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/comisiones?desde=${desde}&hasta=${hasta}`)
      if (!res.ok) { setError(`Error ${res.status}: ${res.statusText}`); setLoading(false); return }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    }
    setLoading(false)
  }, [desde, hasta])

  useEffect(() => { fetchData() }, [fetchData])

  const totalSetters = data?.setters.reduce((s, x) => s + x.total_comision, 0) || 0
  const totalClosers = data?.closers.reduce((s, x) => s + x.total_comision, 0) || 0
  const totalGeneral = totalSetters + totalClosers

  return (
    <div className="min-h-screen" style={{ background: '#080B14' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" style={{ color: '#475569' }}>
              <ArrowLeft size={18} />
            </Link>
            <Award size={18} style={{ color: '#6366F1' }} />
            <h1 style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 18 }}>Comisiones</h1>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={inputStyle} />
            <span style={{ color: '#475569', fontSize: 12 }}>→</span>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={inputStyle} />
            <button
              onClick={fetchData}
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '5px 14px', color: '#818CF8', fontSize: 12, cursor: 'pointer' }}
            >
              Aplicar
            </button>
          </div>
        </div>

        {/* Summary totals */}
        {data && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Total Setters', value: totalSetters, color: '#34D399' },
              { label: 'Total Closers', value: totalClosers, color: '#FBBF24' },
              { label: 'Total a pagar', value: totalGeneral, color: '#818CF8' },
            ].map(item => (
              <div key={item.label} style={{ background: '#0D1117', border: '1px solid #1a2234', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: item.color }}>{formatCurrency(item.value)}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          </div>
        ) : data ? (
          <div className="space-y-8">

            {/* Setters */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div style={{ width: 3, height: 14, borderRadius: 2, background: '#34D399' }} />
                <h2 style={{ color: '#34D399', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Setters — {formatCurrency(totalSetters)}
                </h2>
              </div>
              <div className="space-y-3">
                {data.setters.length === 0
                  ? <p style={{ color: '#334155', fontSize: 13 }}>Sin setters registrados</p>
                  : data.setters.map(s => <SetterCard key={s.id} setter={s} />)
                }
              </div>
            </section>

            {/* Closers */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div style={{ width: 3, height: 14, borderRadius: 2, background: '#FBBF24' }} />
                <h2 style={{ color: '#FBBF24', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Closers — {formatCurrency(totalClosers)}
                </h2>
              </div>
              <div className="space-y-3">
                {data.closers.length === 0
                  ? <p style={{ color: '#334155', fontSize: 13 }}>Sin closers registrados</p>
                  : data.closers.map(c => <CloserCard key={c.id} closer={c} />)
                }
              </div>
            </section>

            {/* Commission rules info */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div style={{ width: 3, height: 14, borderRadius: 2, background: '#475569' }} />
                <h2 style={{ color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Reglas de comisión (default)</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div style={{ background: '#0D1117', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, padding: '1rem' }}>
                  <h3 style={{ fontSize: 12, fontWeight: 600, color: '#818CF8', marginBottom: 10 }}>Setters</h3>
                  <ul style={{ fontSize: 12, color: '#64748B', lineHeight: 1.8 }}>
                    <li>• Base mensual: <span style={{ color: '#F1F5F9', fontWeight: 600 }}>$500</span></li>
                    <li>• Por cita show calificada: <span style={{ color: '#F1F5F9', fontWeight: 600 }}>$25</span></li>
                    <li>• Por venta cerrada de sus citas: <span style={{ color: '#F1F5F9', fontWeight: 600 }}>$75</span></li>
                  </ul>
                </div>
                <div style={{ background: '#0D1117', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 10, padding: '1rem' }}>
                  <h3 style={{ fontSize: 12, fontWeight: 600, color: '#FBBF24', marginBottom: 10 }}>Closers</h3>
                  <ul style={{ fontSize: 12, color: '#64748B', lineHeight: 1.8 }}>
                    <li>• Comisión sobre cobrado: <span style={{ color: '#F1F5F9', fontWeight: 600 }}>8%</span></li>
                    <li>• Bonus tasa cierre ≥40%: <span style={{ color: '#F1F5F9', fontWeight: 600 }}>$500</span></li>
                    <li>• Penalidad impago 30 días: <span style={{ color: '#F1F5F9', fontWeight: 600 }}>−50%</span></li>
                  </ul>
                </div>
              </div>
            </section>

          </div>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <p style={{ color: '#F87171', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Error al cargar datos</p>
            {error && <p style={{ color: '#475569', fontSize: 12, marginBottom: 16 }}>{error}</p>}
            <button onClick={fetchData} style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '8px 20px', color: '#818CF8', fontSize: 12, cursor: 'pointer' }}>Reintentar</button>
          </div>
        )}
      </div>
    </div>
  )
}
