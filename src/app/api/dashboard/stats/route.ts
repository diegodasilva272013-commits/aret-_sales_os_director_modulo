import { createClient } from '@/lib/supabase/server'
import { getDirectorScope } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const fechaDesde = url.searchParams.get('desde') || new Date().toISOString().split('T')[0]
  const fechaHasta = url.searchParams.get('hasta') || new Date().toISOString().split('T')[0]
  const personaId = url.searchParams.get('persona')
  const proyectoId = url.searchParams.get('proyecto_id')

  // Fetch setters reports — scoped to director's team
  let setterQuery = supabase
    .from('reportes_setter')
    .select('*, profiles!setter_id(nombre, activo)')
    .in('setter_id', scope.teamIds)
    .gte('fecha', fechaDesde)
    .lte('fecha', fechaHasta)

  if (personaId) setterQuery = setterQuery.eq('setter_id', personaId)
  if (proyectoId) setterQuery = setterQuery.eq('proyecto_id', proyectoId)

  // Fetch closers reports — scoped to director's team
  let closerQuery = supabase
    .from('reportes_closer')
    .select('*, profiles!closer_id(nombre, activo)')
    .in('closer_id', scope.teamIds)
    .gte('fecha', fechaDesde)
    .lte('fecha', fechaHasta)

  if (personaId) closerQuery = closerQuery.eq('closer_id', personaId)
  if (proyectoId) closerQuery = closerQuery.eq('proyecto_id', proyectoId)

  const [{ data: setterReports }, { data: closerReports }, { data: allProfiles }] = await Promise.all([
    setterQuery,
    closerQuery,
    supabase.from('profiles').select('*').eq('activo', true).eq('director_id', scope.directorId),
  ])

  const today = new Date().toISOString().split('T')[0]
  const setters = (allProfiles || []).filter(p => p.rol === 'setter')
  const closers = (allProfiles || []).filter(p => p.rol === 'closer')

  const todaySetterReports = (setterReports || []).filter(r => r.fecha === today)
  const todayCloserReports = (closerReports || []).filter(r => r.fecha === today)
  const todaySetterIds = new Set(todaySetterReports.map(r => r.setter_id))
  const todayCloserIds = new Set(todayCloserReports.map(r => r.closer_id))

  // Reunion stats (today only)
  const settersAsistieron = todaySetterReports.filter(r => r.asistio_reunion === true).length
  const closersAsistieron = todayCloserReports.filter(r => r.asistio_reunion === true).length

  // Aggregate stats
  const totalLeads = (setterReports || []).reduce((s, r) => s + (r.leads_recibidos || 0), 0)
  const totalCitas = (setterReports || []).reduce((s, r) => s + (r.citas_agendadas || 0), 0)
  const totalShows = (closerReports || []).reduce((s, r) => s + (r.citas_show || 0), 0)
  const totalVentas = (closerReports || []).reduce((s, r) => s + (r.ventas_cerradas || 0), 0)
  const totalMontoCerrado = (closerReports || []).reduce((s, r) => s + (r.monto_total_cerrado || 0), 0)
  const totalMontoCobrado = (closerReports || []).reduce((s, r) => s + (r.monto_cobrado || 0), 0)
  const totalMontoPendiente = (closerReports || []).reduce((s, r) => s + (r.monto_pendiente || 0), 0)

  // Setter table data
  const setterTableMap = new Map<string, { nombre: string; [key: string]: unknown }>()
  for (const r of (setterReports || [])) {
    const id = r.setter_id
    if (!setterTableMap.has(id)) {
      setterTableMap.set(id, {
        id,
        nombre: (r.profiles as { nombre: string })?.nombre || 'N/A',
        leads_recibidos: 0, intentos_contacto: 0, contactados: 0,
        citas_agendadas: 0, citas_show: 0, citas_noshow: 0,
        citas_calificadas: 0, citas_reprogramadas: 0,
        mensajes_enviados: 0, respuestas_obtenidas: 0,
        asistio_reunion: null as boolean | null,
      })
    }
    const entry = setterTableMap.get(id)!
    entry.leads_recibidos = (entry.leads_recibidos as number) + (r.leads_recibidos || 0)
    entry.intentos_contacto = (entry.intentos_contacto as number) + (r.intentos_contacto || 0)
    entry.contactados = (entry.contactados as number) + (r.contactados || 0)
    entry.citas_agendadas = (entry.citas_agendadas as number) + (r.citas_agendadas || 0)
    entry.citas_show = (entry.citas_show as number) + (r.citas_show || 0)
    entry.citas_noshow = (entry.citas_noshow as number) + (r.citas_noshow || 0)
    entry.citas_calificadas = (entry.citas_calificadas as number) + (r.citas_calificadas || 0)
    entry.citas_reprogramadas = (entry.citas_reprogramadas as number) + (r.citas_reprogramadas || 0)
    entry.mensajes_enviados = (entry.mensajes_enviados as number) + (r.mensajes_enviados || 0)
    entry.respuestas_obtenidas = (entry.respuestas_obtenidas as number) + (r.respuestas_obtenidas || 0)
    if (r.asistio_reunion !== null && r.asistio_reunion !== undefined) entry.asistio_reunion = r.asistio_reunion
  }

  // Closer table data
  const closerTableMap = new Map<string, { nombre: string; [key: string]: unknown }>()
  for (const r of (closerReports || [])) {
    const id = r.closer_id
    if (!closerTableMap.has(id)) {
      closerTableMap.set(id, {
        id,
        nombre: (r.profiles as { nombre: string })?.nombre || 'N/A',
        citas_recibidas: 0, citas_show: 0, citas_noshow: 0,
        ventas_cerradas: 0, ventas_no_cerradas: 0,
        monto_total_cerrado: 0, monto_cobrado: 0, monto_pendiente: 0,
        pagos_completos: 0, pagos_parciales: 0, pagos_nulo: 0,
        motivo_precio: 0, motivo_consultar: 0, motivo_momento: 0,
        motivo_competencia: 0, motivo_otro: 0,
        propuestas_enviadas: 0, seguimientos_realizados: 0,
        asistio_reunion: null as boolean | null,
      })
    }
    const entry = closerTableMap.get(id)!
    entry.citas_recibidas = (entry.citas_recibidas as number) + (r.citas_recibidas || 0)
    entry.citas_show = (entry.citas_show as number) + (r.citas_show || 0)
    entry.citas_noshow = (entry.citas_noshow as number) + (r.citas_noshow || 0)
    entry.ventas_cerradas = (entry.ventas_cerradas as number) + (r.ventas_cerradas || 0)
    entry.ventas_no_cerradas = (entry.ventas_no_cerradas as number) + (r.ventas_no_cerradas || 0)
    entry.monto_total_cerrado = (entry.monto_total_cerrado as number) + (r.monto_total_cerrado || 0)
    entry.monto_cobrado = (entry.monto_cobrado as number) + (r.monto_cobrado || 0)
    entry.monto_pendiente = (entry.monto_pendiente as number) + (r.monto_pendiente || 0)
    entry.pagos_completos = (entry.pagos_completos as number) + (r.pagos_completos || 0)
    entry.pagos_parciales = (entry.pagos_parciales as number) + (r.pagos_parciales || 0)
    entry.pagos_nulo = (entry.pagos_nulo as number) + (r.pagos_nulo || 0)
    entry.motivo_precio = (entry.motivo_precio as number) + (r.motivo_precio || 0)
    entry.motivo_consultar = (entry.motivo_consultar as number) + (r.motivo_consultar || 0)
    entry.motivo_momento = (entry.motivo_momento as number) + (r.motivo_momento || 0)
    entry.motivo_competencia = (entry.motivo_competencia as number) + (r.motivo_competencia || 0)
    entry.motivo_otro = (entry.motivo_otro as number) + (r.motivo_otro || 0)
    entry.propuestas_enviadas = (entry.propuestas_enviadas as number) + (r.propuestas_enviadas || 0)
    entry.seguimientos_realizados = (entry.seguimientos_realizados as number) + (r.seguimientos_realizados || 0)
    if (r.asistio_reunion !== null && r.asistio_reunion !== undefined) entry.asistio_reunion = r.asistio_reunion
  }

  return NextResponse.json({
    stats: {
      totalLeads,
      totalCitas,
      totalShows,
      totalVentas,
      totalMontoCerrado,
      totalMontoCobrado,
      totalMontoPendiente,
      tasaCierre: totalShows > 0 ? totalVentas / totalShows : 0,
      tasaShow: totalCitas > 0 ? totalShows / totalCitas : 0,
    },
    setterTable: Array.from(setterTableMap.values()),
    closerTable: Array.from(closerTableMap.values()),
    setterReports: setterReports || [],
    closerReports: closerReports || [],
    reportesHoy: {
      setters: setters.map(s => {
        const rep = todaySetterReports.find(r => r.setter_id === s.id)
        return { ...s, enviado: todaySetterIds.has(s.id), asistio_reunion: rep?.asistio_reunion ?? null, reporte_id: rep?.id ?? null }
      }),
      closers: closers.map(c => {
        const rep = todayCloserReports.find(r => r.closer_id === c.id)
        return { ...c, enviado: todayCloserIds.has(c.id), asistio_reunion: rep?.asistio_reunion ?? null, reporte_id: rep?.id ?? null }
      }),
    },
    reunionStats: {
      setters_asistieron: settersAsistieron,
      setters_total: todaySetterReports.length,
      closers_asistieron: closersAsistieron,
      closers_total: todayCloserReports.length,
    },
  })
}
