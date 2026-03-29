interface Stats {
  totalLeads: number
  totalCitas: number
  totalShows: number
  totalVentas: number
}

export default function EmbudoTable({ stats }: { stats: Stats }) {
  const steps = [
    {
      label: 'Leads Recibidos',
      value: stats.totalLeads,
      next: stats.totalCitas,
      gradient: 'linear-gradient(90deg, #6366F1, #818CF8)',
      dotColor: '#6366F1',
      convLabel: 'Lead → Cita',
    },
    {
      label: 'Citas Agendadas',
      value: stats.totalCitas,
      next: stats.totalShows,
      gradient: 'linear-gradient(90deg, #8B5CF6, #A78BFA)',
      dotColor: '#8B5CF6',
      convLabel: 'Cita → Show',
    },
    {
      label: 'Shows (Asistieron)',
      value: stats.totalShows,
      next: stats.totalVentas,
      gradient: 'linear-gradient(90deg, #6366F1, #10B981)',
      dotColor: '#3B82F6',
      convLabel: 'Show → Venta',
    },
    {
      label: 'Ventas Cerradas',
      value: stats.totalVentas,
      next: null,
      gradient: 'linear-gradient(90deg, #10B981, #34D399)',
      dotColor: '#10B981',
      convLabel: null,
    },
  ]

  const maxVal = Math.max(stats.totalLeads, 1)

  return (
    <div className="space-y-4">
      {steps.map((step, idx) => {
        const width = (step.value / maxVal) * 100
        const conv = step.next !== null && step.value > 0
          ? Math.round((step.next / step.value) * 100)
          : null

        return (
          <div key={step.label}>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: step.dotColor }}
                />
                <span className="text-sm" style={{ color: '#94A3B8' }}>{step.label}</span>
              </div>
              <div className="flex items-center gap-3">
                {conv !== null && step.convLabel && (
                  <span
                    className="text-xs font-mono"
                    style={{
                      color: conv >= 40 ? '#34D399' : conv >= 20 ? '#FBBF24' : '#F87171',
                    }}
                  >
                    {step.convLabel}: {conv}%
                  </span>
                )}
                <span className="text-lg font-black tabular-nums" style={{ color: '#F1F5F9' }}>
                  {step.value}
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1a2234' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max(width, step.value > 0 ? 3 : 0)}%`,
                  background: step.gradient,
                  opacity: 1 - idx * 0.08,
                }}
              />
            </div>
          </div>
        )
      })}

      {/* KPI summary */}
      <div
        className="mt-5 pt-5 grid grid-cols-3 gap-3"
        style={{ borderTop: '1px solid #1a2234' }}
      >
        {[
          {
            label: 'Lead → Venta',
            value: stats.totalLeads > 0 ? Math.round((stats.totalVentas / stats.totalLeads) * 100) : 0,
            threshold: 5,
          },
          {
            label: 'Cita → Show',
            value: stats.totalCitas > 0 ? Math.round((stats.totalShows / stats.totalCitas) * 100) : 0,
            threshold: 50,
          },
          {
            label: 'Show → Cierre',
            value: stats.totalShows > 0 ? Math.round((stats.totalVentas / stats.totalShows) * 100) : 0,
            threshold: 35,
          },
        ].map(metric => (
          <div
            key={metric.label}
            className="rounded-xl p-3 text-center"
            style={{ background: '#080B14', border: '1px solid #1a2234' }}
          >
            <p className="text-xs mb-1.5" style={{ color: '#475569', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {metric.label}
            </p>
            <p
              className="text-xl font-black tabular-nums"
              style={{ color: metric.value >= metric.threshold ? '#34D399' : '#FBBF24' }}
            >
              {metric.value}%
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
