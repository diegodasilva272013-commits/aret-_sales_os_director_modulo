import { CheckCircle, Clock, Users, Pencil } from 'lucide-react'

interface Person {
  id: string
  nombre: string
  enviado: boolean
  asistio_reunion?: boolean | null
  reporte_id?: string | null
}

interface ReportesHoyData {
  setters: Person[]
  closers: Person[]
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function PersonRow({ person, color, onEdit }: { person: Person; color: string; onEdit?: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0"
        style={{ background: `${color}18`, color }}
      >
        {getInitials(person.nombre)}
      </div>
      <span className="flex-1 text-sm font-medium truncate" style={{ color: '#CBD5E1' }}>
        {person.nombre}
      </span>
      {person.enviado && (
        <span
          aria-label={person.asistio_reunion === null || person.asistio_reunion === undefined ? 'Reunión no reportada' : person.asistio_reunion ? 'Asistió a la reunión' : 'No asistió a la reunión'}
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}
        >
          <Users
            size={13}
            style={{
              color: person.asistio_reunion === null || person.asistio_reunion === undefined
                ? '#334155'
                : person.asistio_reunion
                  ? '#10B981'
                  : '#EF4444',
            }}
          />
        </span>
      )}
      {person.enviado && onEdit && (
        <button onClick={onEdit} className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-indigo-400 transition-colors" title="Editar reporte">
          <Pencil size={12} />
        </button>
      )}
      {person.enviado ? (
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.15)' }}
          >
            <CheckCircle size={12} style={{ color: '#10B981' }} />
          </div>
          <span className="text-xs font-medium" style={{ color: '#34D399' }}>Enviado</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.15)' }}
          >
            <Clock size={12} style={{ color: '#F59E0B' }} />
          </div>
          <span className="text-xs font-medium" style={{ color: '#FBBF24' }}>Pendiente</span>
        </div>
      )}
    </div>
  )
}

export default function ReportesHoy({ data, onEditReport }: { data: ReportesHoyData; onEditReport?: (reporteId: string, tipo: 'setter' | 'closer') => void }) {
  const totalPeople = data.setters.length + data.closers.length
  const totalEnviados = data.setters.filter(s => s.enviado).length + data.closers.filter(c => c.enviado).length
  const pct = totalPeople > 0 ? (totalEnviados / totalPeople) * 100 : 0

  return (
    <div>
      {/* Progress bar header */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#475569' }}>
            Reportes Enviados
          </span>
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}
          >
            {totalEnviados}/{totalPeople}
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1a2234' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: pct === 100
                ? 'linear-gradient(90deg, #10B981, #34D399)'
                : 'linear-gradient(90deg, #6366F1, #8B5CF6)',
            }}
          />
        </div>
      </div>

      {/* Two columns: Setters | Closers */}
      <div className="grid grid-cols-2 gap-4">
        {data.setters.length > 0 && (
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: '#6366F1', borderBottom: '1px solid #1a2234', paddingBottom: '0.5rem' }}
            >
              Setters
            </p>
            <div className="space-y-1">
              {data.setters.map(person => (
                <PersonRow key={person.id} person={person} color="#818CF8"
                  onEdit={person.enviado && person.reporte_id && onEditReport ? () => onEditReport(person.reporte_id!, 'setter') : undefined} />
              ))}
            </div>
          </div>
        )}

        {data.closers.length > 0 && (
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: '#10B981', borderBottom: '1px solid #1a2234', paddingBottom: '0.5rem' }}
            >
              Closers
            </p>
            <div className="space-y-1">
              {data.closers.map(person => (
                <PersonRow key={person.id} person={person} color="#34D399"
                  onEdit={person.enviado && person.reporte_id && onEditReport ? () => onEditReport(person.reporte_id!, 'closer') : undefined} />
              ))}
            </div>
          </div>
        )}
      </div>

      {totalPeople === 0 && (
        <p className="text-sm text-center py-6" style={{ color: '#334155' }}>
          Sin miembros en el equipo
        </p>
      )}
    </div>
  )
}
