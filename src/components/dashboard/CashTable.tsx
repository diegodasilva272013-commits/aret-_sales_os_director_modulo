'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface CashRow {
  id: string
  nombre: string
  pagos_completos: number
  pagos_parciales: number
  pagos_nulo: number
  monto_total_cerrado: number
  monto_cobrado: number
  monto_pendiente: number
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

type SortKey = keyof CashRow
type SortDir = 'asc' | 'desc'

export default function CashTable({ data }: { data: CashRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('monto_cobrado')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  const cols: { key: SortKey; label: string }[] = [
    { key: 'nombre', label: 'Closer' },
    { key: 'pagos_completos', label: 'Completos' },
    { key: 'pagos_parciales', label: 'Parciales' },
    { key: 'pagos_nulo', label: 'Sin Pago' },
    { key: 'monto_total_cerrado', label: 'Total Cerrado' },
    { key: 'monto_cobrado', label: 'Cobrado' },
    { key: 'monto_pendiente', label: 'Pendiente' },
  ]

  if (data.length === 0) return (
    <p className="text-center py-8 text-sm" style={{ color: '#334155' }}>Sin datos</p>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid #1a2234' }}>
            {cols.map(col => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="text-left px-4 py-3 cursor-pointer select-none whitespace-nowrap transition-colors"
                style={{ color: sortKey === col.key ? '#6366F1' : '#475569', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key
                    ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
                    : <ChevronDown size={11} style={{ opacity: 0.2 }} />}
                </div>
              </th>
            ))}
            <th
              className="text-left px-4 py-3 whitespace-nowrap"
              style={{ color: '#475569', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              % Cobrado
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const pctCobrado = row.monto_total_cerrado > 0 ? (row.monto_cobrado / row.monto_total_cerrado) * 100 : 0
            const pctColor = pctCobrado >= 80 ? '#34D399' : pctCobrado >= 50 ? '#FBBF24' : '#F87171'
            const barGradient = pctCobrado >= 80
              ? 'linear-gradient(90deg, #10B981, #34D399)'
              : pctCobrado >= 50
                ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                : 'linear-gradient(90deg, #EF4444, #F87171)'

            return (
              <tr
                key={row.id}
                style={{
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.008)',
                  borderBottom: '1px solid rgba(26,34,52,0.6)',
                }}
                className="transition-colors hover:bg-white/[0.015]"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0"
                      style={{ background: 'rgba(16,185,129,0.12)', color: '#34D399' }}
                    >
                      {getInitials(row.nombre)}
                    </div>
                    <span className="font-medium" style={{ color: '#F1F5F9' }}>{row.nombre}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono font-semibold" style={{ color: '#34D399' }}>{row.pagos_completos}</td>
                <td className="px-4 py-3 font-mono" style={{ color: '#FBBF24' }}>{row.pagos_parciales}</td>
                <td className="px-4 py-3 font-mono" style={{ color: '#F87171' }}>{row.pagos_nulo}</td>
                <td className="px-4 py-3 font-mono" style={{ color: '#94A3B8' }}>{formatCurrency(row.monto_total_cerrado)}</td>
                <td className="px-4 py-3 font-mono font-semibold" style={{ color: '#34D399' }}>{formatCurrency(row.monto_cobrado)}</td>
                <td className="px-4 py-3 font-mono" style={{ color: '#FBBF24' }}>{formatCurrency(row.monto_pendiente)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: '#1a2234' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, pctCobrado)}%`, background: barGradient }}
                      />
                    </div>
                    <span className="text-xs font-mono font-semibold tabular-nums" style={{ color: pctColor }}>
                      {Math.round(pctCobrado)}%
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
