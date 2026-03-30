'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, ChevronLeft, ChevronRight, Calendar as CalIcon, Clock,
  CheckCircle2, Circle, AlertCircle, X, Users2, Video,
  ArrowRight, RotateCcw, Trash2, Flag, StickyNote, Phone,
  LayoutGrid, List, CalendarDays
} from 'lucide-react'

const C = {
  bg: '#080B14', surface: '#0D1117', card: '#111827',
  border: '#1a2234', borderLight: '#1F2937',
  text: '#F1F5F9', textMuted: '#94A3B8', textDim: '#475569', textDark: '#334155',
  accent: '#6366F1', accentLight: '#818CF8',
  green: '#34D399', red: '#F87171', yellow: '#FBBF24', orange: '#FB923C',
}

const TIPOS = [
  { value: 'tarea', label: 'Tarea', icon: CheckCircle2, color: C.accent },
  { value: 'reunion', label: 'Reunión', icon: Video, color: C.green },
  { value: 'recordatorio', label: 'Recordatorio', icon: Clock, color: C.yellow },
  { value: 'llamada', label: 'Llamada', icon: Phone, color: C.orange },
]

const PRIORIDADES = [
  { value: 'baja', label: 'Baja', color: C.textDim },
  { value: 'media', label: 'Media', color: C.accent },
  { value: 'alta', label: 'Alta', color: C.orange },
  { value: 'urgente', label: 'Urgente', color: C.red },
]

const ESTADOS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_progreso', label: 'En progreso' },
  { value: 'completada', label: 'Completada' },
  { value: 'cancelada', label: 'Cancelada' },
]

interface Tarea {
  id: string
  titulo: string
  descripcion: string | null
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  tipo: string
  prioridad: string
  estado: string
  participantes_ids: string[]
  enlace_reunion: string | null
  recurrente: boolean
  recurrencia_tipo: string | null
  notas: string | null
  fecha_original: string | null
  veces_pospuesta: number
  completada_at: string | null
  created_at: string
}

interface TeamMember {
  id: string
  nombre: string
  rol: string
}

type Vista = 'dia' | 'semana' | 'mes'

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function startOfWeek(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)) // Monday start
  return r
}

function getDaysInMonth(d: Date): Date[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const start = startOfWeek(first)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) days.push(addDays(start, i))
  return days
}

function getWeekDays(d: Date): Date[] {
  const start = startOfWeek(d)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function AgendaPage() {
  const [vista, setVista] = useState<Vista>('semana')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTarea, setEditTarea] = useState<Tarea | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const today = formatDate(new Date())

  const fetchRange = useCallback(() => {
    let desde: string, hasta: string
    if (vista === 'dia') {
      desde = hasta = formatDate(currentDate)
    } else if (vista === 'semana') {
      const days = getWeekDays(currentDate)
      desde = formatDate(days[0])
      hasta = formatDate(days[6])
    } else {
      const days = getDaysInMonth(currentDate)
      desde = formatDate(days[0])
      hasta = formatDate(days[days.length - 1])
    }
    return { desde, hasta }
  }, [vista, currentDate])

  useEffect(() => {
    loadData()
  }, [vista, currentDate])

  async function loadData() {
    setLoading(true)
    const { desde, hasta } = fetchRange()
    const [tareasRes, teamRes] = await Promise.all([
      fetch(`/api/tareas?desde=${desde}&hasta=${hasta}`),
      fetch('/api/equipo'),
    ])
    if (tareasRes.ok) {
      const { tareas } = await tareasRes.json()
      setTareas(tareas || [])
    }
    if (teamRes.ok) {
      const { profiles } = await teamRes.json()
      setTeam(profiles || [])
    }
    setLoading(false)
  }

  function navigate(dir: number) {
    const d = new Date(currentDate)
    if (vista === 'dia') d.setDate(d.getDate() + dir)
    else if (vista === 'semana') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCurrentDate(d)
  }

  function getTitle(): string {
    if (vista === 'dia') {
      return currentDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    } else if (vista === 'semana') {
      const days = getWeekDays(currentDate)
      const s = days[0], e = days[6]
      if (s.getMonth() === e.getMonth()) {
        return `${s.getDate()} - ${e.getDate()} ${MONTH_NAMES[s.getMonth()]} ${s.getFullYear()}`
      }
      return `${s.getDate()} ${MONTH_NAMES[s.getMonth()].slice(0, 3)} - ${e.getDate()} ${MONTH_NAMES[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`
    }
    return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  }

  async function toggleComplete(tarea: Tarea) {
    const newEstado = tarea.estado === 'completada' ? 'pendiente' : 'completada'
    await fetch(`/api/tareas/${tarea.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: newEstado }),
    })
    loadData()
  }

  async function postpone(tarea: Tarea) {
    const tomorrow = formatDate(addDays(new Date(tarea.fecha + 'T12:00:00'), 1))
    await fetch(`/api/tareas/${tarea.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'pospuesta', fecha: tomorrow }),
    })
    loadData()
  }

  async function deleteTarea(id: string) {
    await fetch(`/api/tareas/${id}`, { method: 'DELETE' })
    loadData()
  }

  function openNew(fecha?: string) {
    setEditTarea(null)
    setSelectedDate(fecha || formatDate(currentDate))
    setShowModal(true)
  }

  function openEdit(tarea: Tarea) {
    setEditTarea(tarea)
    setSelectedDate(tarea.fecha)
    setShowModal(true)
  }

  function getTareasForDate(fecha: string): Tarea[] {
    return tareas.filter(t => t.fecha === fecha)
  }

  const tipoConfig = (tipo: string) => TIPOS.find(t => t.value === tipo) || TIPOS[0]
  const prioridadConfig = (p: string) => PRIORIDADES.find(x => x.value === p) || PRIORIDADES[1]
  const getMemberName = (id: string) => team.find(m => m.id === id)?.nombre || '?'

  // Stats
  const pendientes = tareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length
  const completadas = tareas.filter(t => t.estado === 'completada').length
  const reuniones = tareas.filter(t => t.tipo === 'reunion' && t.estado !== 'cancelada').length

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: C.bg }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: C.text }}>Agenda</h1>
          <p className="text-sm" style={{ color: C.textDim }}>Organizá tus tareas, reuniones y recordatorios</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats mini */}
          <div className="hidden md:flex items-center gap-4 mr-4">
            <span className="text-xs" style={{ color: C.textDim }}>
              <span className="font-bold" style={{ color: C.yellow }}>{pendientes}</span> pendientes
            </span>
            <span className="text-xs" style={{ color: C.textDim }}>
              <span className="font-bold" style={{ color: C.green }}>{completadas}</span> completadas
            </span>
            <span className="text-xs" style={{ color: C.textDim }}>
              <span className="font-bold" style={{ color: C.accent }}>{reuniones}</span> reuniones
            </span>
          </div>

          <button
            onClick={() => openNew()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: `linear-gradient(135deg, ${C.accent}, #8B5CF6)` }}
          >
            <Plus size={16} />
            Nueva
          </button>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: C.textMuted }}>
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-sm font-semibold min-w-[200px] text-center capitalize" style={{ color: C.text }}>
            {getTitle()}
          </h2>
          <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: C.textMuted }}>
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/5"
            style={{ border: `1px solid ${C.borderLight}`, color: C.textMuted }}
          >
            Hoy
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: C.card }}>
          {([
            { v: 'dia' as Vista, icon: List, label: 'Día' },
            { v: 'semana' as Vista, icon: CalendarDays, label: 'Semana' },
            { v: 'mes' as Vista, icon: LayoutGrid, label: 'Mes' },
          ]).map(({ v, icon: Ic, label }) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: vista === v ? C.accent : 'transparent',
                color: vista === v ? 'white' : C.textDim,
              }}
            >
              <Ic size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar views */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : vista === 'dia' ? (
        <DayView
          fecha={formatDate(currentDate)}
          tareas={getTareasForDate(formatDate(currentDate))}
          today={today}
          tipoConfig={tipoConfig}
          prioridadConfig={prioridadConfig}
          getMemberName={getMemberName}
          toggleComplete={toggleComplete}
          postpone={postpone}
          deleteTarea={deleteTarea}
          openEdit={openEdit}
          openNew={openNew}
        />
      ) : vista === 'semana' ? (
        <WeekView
          currentDate={currentDate}
          tareas={tareas}
          today={today}
          tipoConfig={tipoConfig}
          prioridadConfig={prioridadConfig}
          toggleComplete={toggleComplete}
          openEdit={openEdit}
          openNew={openNew}
        />
      ) : (
        <MonthView
          currentDate={currentDate}
          tareas={tareas}
          today={today}
          tipoConfig={tipoConfig}
          openEdit={openEdit}
          openNew={openNew}
        />
      )}

      {/* Modal */}
      {showModal && (
        <TareaModal
          tarea={editTarea}
          fecha={selectedDate || today}
          team={team}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); loadData() }}
        />
      )}
    </div>
  )
}

// =================== DAY VIEW ===================
function DayView({ fecha, tareas, today, tipoConfig, prioridadConfig, getMemberName, toggleComplete, postpone, deleteTarea, openEdit, openNew }: {
  fecha: string; tareas: Tarea[]; today: string;
  tipoConfig: (t: string) => (typeof TIPOS)[0]; prioridadConfig: (p: string) => (typeof PRIORIDADES)[0]; getMemberName: (id: string) => string;
  toggleComplete: (t: Tarea) => void; postpone: (t: Tarea) => void; deleteTarea: (id: string) => void; openEdit: (t: Tarea) => void; openNew: (f: string) => void;
}) {
  const isToday = fecha === today
  const sorted = [...tareas].sort((a, b) => {
    if (a.estado === 'completada' && b.estado !== 'completada') return 1
    if (a.estado !== 'completada' && b.estado === 'completada') return -1
    return (a.hora_inicio || '').localeCompare(b.hora_inicio || '')
  })

  return (
    <div className="space-y-2">
      {sorted.length === 0 && (
        <div className="text-center py-16 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <CalIcon size={40} className="mx-auto mb-3" style={{ color: C.textDark }} />
          <p className="text-sm" style={{ color: C.textDim }}>
            {isToday ? 'No tenés tareas para hoy' : 'Sin tareas para este día'}
          </p>
          <button
            onClick={() => openNew(fecha)}
            className="mt-3 px-4 py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/5"
            style={{ border: `1px solid ${C.borderLight}`, color: C.accentLight }}
          >
            <Plus size={14} className="inline mr-1 -mt-0.5" />
            Agregar tarea
          </button>
        </div>
      )}
      {sorted.map(tarea => {
        const tp = tipoConfig(tarea.tipo)
        const pr = prioridadConfig(tarea.prioridad)
        const done = tarea.estado === 'completada'
        const TpIcon = tp.icon
        return (
          <div
            key={tarea.id}
            className="rounded-xl p-4 transition-all hover:brightness-110 cursor-pointer"
            style={{ background: C.surface, border: `1px solid ${C.border}`, opacity: done ? 0.6 : 1 }}
            onClick={() => openEdit(tarea)}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={e => { e.stopPropagation(); toggleComplete(tarea) }}
                className="mt-0.5 shrink-0 transition-colors"
                style={{ color: done ? C.green : C.textDark }}
              >
                {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <TpIcon size={14} style={{ color: tp.color }} />
                  <span className={`text-sm font-semibold ${done ? 'line-through' : ''}`} style={{ color: C.text }}>{tarea.titulo}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${pr.color}20`, color: pr.color }}>
                    {pr.label}
                  </span>
                </div>

                {tarea.descripcion && <p className="text-xs mb-1.5" style={{ color: C.textDim }}>{tarea.descripcion}</p>}

                <div className="flex items-center flex-wrap gap-3 text-xs" style={{ color: C.textDim }}>
                  {tarea.hora_inicio && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {tarea.hora_inicio?.slice(0, 5)}{tarea.hora_fin ? ` - ${tarea.hora_fin.slice(0, 5)}` : ''}
                    </span>
                  )}
                  {tarea.participantes_ids.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Users2 size={12} />
                      {tarea.participantes_ids.map(id => getMemberName(id)).join(', ')}
                    </span>
                  )}
                  {tarea.enlace_reunion && (
                    <a
                      href={tarea.enlace_reunion}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 hover:underline"
                      style={{ color: C.accentLight }}
                    >
                      <Video size={12} /> Unirse
                    </a>
                  )}
                  {tarea.veces_pospuesta > 0 && (
                    <span className="flex items-center gap-1" style={{ color: C.orange }}>
                      <RotateCcw size={12} /> Pospuesta {tarea.veces_pospuesta}x
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!done && (
                  <button
                    onClick={e => { e.stopPropagation(); postpone(tarea) }}
                    title="Posponer a mañana"
                    className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                    style={{ color: C.textDark }}
                  >
                    <ArrowRight size={14} />
                  </button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); deleteTarea(tarea.id) }}
                  title="Eliminar"
                  className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                  style={{ color: C.textDark }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// =================== WEEK VIEW ===================
function WeekView({ currentDate, tareas, today, tipoConfig, prioridadConfig, toggleComplete, openEdit, openNew }: {
  currentDate: Date; tareas: Tarea[]; today: string;
  tipoConfig: (t: string) => (typeof TIPOS)[0]; prioridadConfig: (p: string) => (typeof PRIORIDADES)[0];
  toggleComplete: (t: Tarea) => void; openEdit: (t: Tarea) => void; openNew: (f: string) => void;
}) {
  const days = getWeekDays(currentDate)

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
      {days.map((day) => {
        const fecha = formatDate(day)
        const isToday = fecha === today
        const dayTareas = tareas.filter(t => t.fecha === fecha)
        const isWeekend = day.getDay() === 0 || day.getDay() === 6

        return (
          <div
            key={fecha}
            className="rounded-xl p-3 min-h-[180px] transition-all"
            style={{
              background: isToday ? `${C.accent}08` : C.surface,
              border: `1px solid ${isToday ? `${C.accent}40` : C.border}`,
              opacity: isWeekend ? 0.7 : 1,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium" style={{ color: C.textDim }}>
                  {DAY_NAMES[day.getDay() === 0 ? 6 : day.getDay() - 1]}
                </span>
                <span
                  className={`text-sm font-bold px-1.5 py-0.5 rounded-md ${isToday ? 'text-white' : ''}`}
                  style={{ background: isToday ? C.accent : 'transparent', color: isToday ? 'white' : C.text }}
                >
                  {day.getDate()}
                </span>
              </div>
              <button
                onClick={() => openNew(fecha)}
                className="p-1 rounded-md hover:bg-white/5 transition-colors"
                style={{ color: C.textDark }}
              >
                <Plus size={13} />
              </button>
            </div>

            <div className="space-y-1">
              {dayTareas.map(tarea => {
                const tp = tipoConfig(tarea.tipo)
                const done = tarea.estado === 'completada'
                const TpIcon = tp.icon
                return (
                  <div
                    key={tarea.id}
                    className="flex items-center gap-1.5 p-1.5 rounded-lg cursor-pointer hover:bg-white/5 transition-all"
                    style={{ opacity: done ? 0.5 : 1 }}
                    onClick={() => openEdit(tarea)}
                  >
                    <button
                      onClick={e => { e.stopPropagation(); toggleComplete(tarea) }}
                      className="shrink-0"
                      style={{ color: done ? C.green : C.textDark }}
                    >
                      {done ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    </button>
                    <TpIcon size={11} style={{ color: tp.color }} className="shrink-0" />
                    <span className={`text-[11px] truncate ${done ? 'line-through' : ''}`} style={{ color: C.text }}>
                      {tarea.hora_inicio ? tarea.hora_inicio.slice(0, 5) + ' ' : ''}{tarea.titulo}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// =================== MONTH VIEW ===================
function MonthView({ currentDate, tareas, today, tipoConfig, openEdit, openNew }: {
  currentDate: Date; tareas: Tarea[]; today: string;
  tipoConfig: (t: string) => (typeof TIPOS)[0]; openEdit: (t: Tarea) => void; openNew: (f: string) => void;
}) {
  const days = getDaysInMonth(currentDate)
  const currentMonth = currentDate.getMonth()

  return (
    <div>
      <div className="grid grid-cols-7 gap-px mb-px">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold py-2" style={{ color: C.textDim }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {days.map((day) => {
          const fecha = formatDate(day)
          const isToday = fecha === today
          const isCurrentMonth = day.getMonth() === currentMonth
          const dayTareas = tareas.filter(t => t.fecha === fecha)

          return (
            <div
              key={fecha}
              onClick={() => openNew(fecha)}
              className="min-h-[90px] p-1.5 rounded-lg cursor-pointer transition-all hover:brightness-110"
              style={{
                background: isToday ? `${C.accent}10` : C.surface,
                border: `1px solid ${isToday ? `${C.accent}40` : C.border}`,
                opacity: isCurrentMonth ? 1 : 0.35,
              }}
            >
              <span
                className={`text-xs font-medium block mb-1 ${isToday ? 'text-white' : ''}`}
                style={{ color: isToday ? C.accentLight : C.textDim }}
              >
                {day.getDate()}
              </span>
              {dayTareas.slice(0, 3).map(tarea => {
                const tp = tipoConfig(tarea.tipo)
                return (
                  <div
                    key={tarea.id}
                    onClick={e => { e.stopPropagation(); openEdit(tarea) }}
                    className="text-[10px] truncate px-1 py-0.5 rounded mb-0.5"
                    style={{
                      background: `${tp.color}15`,
                      color: tp.color,
                      opacity: tarea.estado === 'completada' ? 0.5 : 1,
                    }}
                  >
                    {tarea.titulo}
                  </div>
                )
              })}
              {dayTareas.length > 3 && (
                <span className="text-[10px]" style={{ color: C.textDim }}>+{dayTareas.length - 3} más</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =================== MODAL ===================
function TareaModal({ tarea, fecha, team, onClose, onSave }: {
  tarea: Tarea | null; fecha: string; team: TeamMember[];
  onClose: () => void; onSave: () => void;
}) {
  const isEdit = !!tarea
  const [form, setForm] = useState({
    titulo: tarea?.titulo || '',
    descripcion: tarea?.descripcion || '',
    fecha: tarea?.fecha || fecha,
    hora_inicio: tarea?.hora_inicio?.slice(0, 5) || '',
    hora_fin: tarea?.hora_fin?.slice(0, 5) || '',
    tipo: tarea?.tipo || 'tarea',
    prioridad: tarea?.prioridad || 'media',
    estado: tarea?.estado || 'pendiente',
    participantes_ids: tarea?.participantes_ids || [],
    enlace_reunion: tarea?.enlace_reunion || '',
    recurrente: tarea?.recurrente || false,
    recurrencia_tipo: tarea?.recurrencia_tipo || 'semanal',
    notas: tarea?.notas || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return }
    setSaving(true)
    setError('')

    const url = isEdit ? `/api/tareas/${tarea!.id}` : '/api/tareas'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        hora_inicio: form.hora_inicio || null,
        hora_fin: form.hora_fin || null,
        enlace_reunion: form.enlace_reunion || null,
        recurrencia_tipo: form.recurrente ? form.recurrencia_tipo : null,
        notas: form.notas || null,
      }),
    })

    if (!res.ok) {
      const { error } = await res.json()
      setError(error || 'Error al guardar')
      setSaving(false)
      return
    }
    onSave()
  }

  function toggleParticipante(id: string) {
    setForm(f => ({
      ...f,
      participantes_ids: f.participantes_ids.includes(id)
        ? f.participantes_ids.filter(x => x !== id)
        : [...f.participantes_ids, id],
    }))
  }

  const inputStyle: React.CSSProperties = { background: C.card, border: `1px solid ${C.borderLight}`, color: C.text }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: C.text }}>
            {isEdit ? 'Editar tarea' : 'Nueva tarea'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: C.textDim }}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>Título</label>
            <input
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="¿Qué tenés que hacer?"
              className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              style={inputStyle}
            />
          </div>

          {/* Tipo + Prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>Tipo</label>
              <div className="flex flex-wrap gap-1.5">
                {TIPOS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                    style={{
                      background: form.tipo === t.value ? `${t.color}20` : C.card,
                      border: `1px solid ${form.tipo === t.value ? t.color : C.borderLight}`,
                      color: form.tipo === t.value ? t.color : C.textDim,
                    }}
                  >
                    <t.icon size={12} />{t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>Prioridad</label>
              <div className="flex flex-wrap gap-1.5">
                {PRIORIDADES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setForm(f => ({ ...f, prioridad: p.value }))}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                    style={{
                      background: form.prioridad === p.value ? `${p.color}20` : C.card,
                      border: `1px solid ${form.prioridad === p.value ? p.color : C.borderLight}`,
                      color: form.prioridad === p.value ? p.color : C.textDim,
                    }}
                  >
                    <Flag size={11} />{p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Fecha + Horarios */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>Hora inicio</label>
              <input
                type="time"
                value={form.hora_inicio}
                onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>Hora fin</label>
              <input
                type="time"
                value={form.hora_fin}
                onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))}
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Estado (only in edit) */}
          {isEdit && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>Estado</label>
              <div className="flex flex-wrap gap-1.5">
                {ESTADOS.map(e => (
                  <button
                    key={e.value}
                    onClick={() => setForm(f => ({ ...f, estado: e.value }))}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                    style={{
                      background: form.estado === e.value ? `${C.accent}20` : C.card,
                      border: `1px solid ${form.estado === e.value ? C.accent : C.borderLight}`,
                      color: form.estado === e.value ? C.accentLight : C.textDim,
                    }}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              rows={2}
              placeholder="Opcional"
              className="w-full rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              style={inputStyle}
            />
          </div>

          {/* Participantes */}
          {team.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>
                <Users2 size={12} className="inline mr-1 -mt-0.5" />
                Participantes del equipo
              </label>
              <div className="flex flex-wrap gap-1.5">
                {team.map(m => {
                  const sel = form.participantes_ids.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleParticipante(m.id)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                      style={{
                        background: sel ? `${C.green}20` : C.card,
                        border: `1px solid ${sel ? C.green : C.borderLight}`,
                        color: sel ? C.green : C.textDim,
                      }}
                    >
                      {m.nombre} <span style={{ color: C.textDark }}>({m.rol})</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Link reunión */}
          {(form.tipo === 'reunion' || form.tipo === 'llamada') && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>
                <Video size={12} className="inline mr-1 -mt-0.5" />
                Link de reunión (Zoom, Meet, Calendly)
              </label>
              <input
                value={form.enlace_reunion}
                onChange={e => setForm(f => ({ ...f, enlace_reunion: e.target.value }))}
                placeholder="https://meet.google.com/..."
                className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                style={inputStyle}
              />
            </div>
          )}

          {/* Recurrencia */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.recurrente}
                onChange={e => setForm(f => ({ ...f, recurrente: e.target.checked }))}
                className="rounded accent-indigo-500"
              />
              <span className="text-xs font-medium" style={{ color: C.textMuted }}>Recurrente</span>
            </label>
            {form.recurrente && (
              <select
                value={form.recurrencia_tipo}
                onChange={e => setForm(f => ({ ...f, recurrencia_tipo: e.target.value }))}
                className="rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                style={inputStyle}
              >
                <option value="diaria">Diaria</option>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
              </select>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: C.textMuted }}>
              <StickyNote size={12} className="inline mr-1 -mt-0.5" />
              Notas
            </label>
            <textarea
              value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={2}
              placeholder="Notas internas..."
              className="w-full rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              style={inputStyle}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: C.red }}>
              <AlertCircle size={14} />{error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${C.accent}, #8B5CF6)` }}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                isEdit ? 'Guardar cambios' : 'Crear tarea'
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-white/5 transition-all"
              style={{ color: C.textMuted, border: `1px solid ${C.borderLight}` }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
