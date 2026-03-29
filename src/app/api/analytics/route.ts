import { createClient } from '@/lib/supabase/server'
import { getDirectorScope } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

function getWeekKey(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `S${String(weekNo).padStart(2, '0')} ${d.getFullYear()}`
}

function getMonthKey(fecha: string): string {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const [year, month] = fecha.split('-')
  return `${months[parseInt(month) - 1]} ${year}`
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const hasta = searchParams.get('hasta') || new Date().toISOString().split('T')[0]
  const proyectoId = searchParams.get('proyecto_id')
  const userId = searchParams.get('user_id')
  const groupBy = searchParams.get('group_by') || 'day' // 'day' | 'week' | 'month'

  // Fetch setter reports - try with joins, fallback to simple query
  let setterQuery = supabase
    .from('reportes_setter')
    .select('*, profiles!setter_id(nombre)')
    .in('setter_id', scope.teamIds)
    .gte('fecha', desde)
    .lte('fecha', hasta)

  if (proyectoId) setterQuery = setterQuery.eq('proyecto_id', proyectoId)
  if (userId) setterQuery = setterQuery.eq('setter_id', userId)

  let { data: setterData, error: setterError } = await setterQuery

  // Fallback: if join fails, query without join
  if (setterError) {
    console.error('Analytics setter join error, falling back:', setterError.message)
    let fallbackQuery = supabase
      .from('reportes_setter')
      .select('*')
      .in('setter_id', scope.teamIds)
      .gte('fecha', desde)
      .lte('fecha', hasta)
    if (proyectoId) fallbackQuery = fallbackQuery.eq('proyecto_id', proyectoId)
    if (userId) fallbackQuery = fallbackQuery.eq('setter_id', userId)
    const fb = await fallbackQuery
    setterData = fb.data
    setterError = fb.error
  }

  // Fetch closer reports - try with joins, fallback to simple query
  let closerQuery = supabase
    .from('reportes_closer')
    .select('*, profiles!closer_id(nombre)')
    .in('closer_id', scope.teamIds)
    .gte('fecha', desde)
    .lte('fecha', hasta)

  if (proyectoId) closerQuery = closerQuery.eq('proyecto_id', proyectoId)
  if (userId) closerQuery = closerQuery.eq('closer_id', userId)

  let { data: closerData, error: closerError } = await closerQuery

  // Fallback: if join fails, query without join
  if (closerError) {
    console.error('Analytics closer join error, falling back:', closerError.message)
    let fallbackQuery = supabase
      .from('reportes_closer')
      .select('*')
      .in('closer_id', scope.teamIds)
      .gte('fecha', desde)
      .lte('fecha', hasta)
    if (proyectoId) fallbackQuery = fallbackQuery.eq('proyecto_id', proyectoId)
    if (userId) fallbackQuery = fallbackQuery.eq('closer_id', userId)
    const fb = await fallbackQuery
    closerData = fb.data
    closerError = fb.error
  }

  if (setterError) console.error('Analytics setter query FINAL error:', setterError.message)
  if (closerError) console.error('Analytics closer query FINAL error:', closerError.message)

  const setters = setterData || []
  const closers = closerData || []

  // Fetch profile names separately (profiles_read_all RLS allows it)
  const perfilNombres: Record<string, string> = {}
  const allUserIds = new Set<string>()
  for (const r of setters) if (r.setter_id) allUserIds.add(r.setter_id)
  for (const r of closers) if (r.closer_id) allUserIds.add(r.closer_id)
  if (allUserIds.size > 0) {
    const { data: perfilesData, error: perfilesError } = await supabase
      .from('profiles')
      .select('id, nombre')
      .in('id', Array.from(allUserIds))
    if (perfilesError) {
      console.error('Error fetching profiles:', perfilesError.message)
    }
    for (const p of perfilesData || []) {
      perfilNombres[p.id] = p.nombre || p.id
    }
  }

  // Helper to get person name from ID
  function getPersonName(id: string): string {
    return perfilNombres[id] || id.slice(0, 6)
  }
  function getPersonFirstName(id: string): string {
    const full = perfilNombres[id]
    if (full) return full.split(' ')[0]
    return id.slice(0, 6)
  }

  // Fetch project names separately (avoids join issues)
  const proyectoNombres: Record<string, string> = {}
  const allPids = new Set<string>()
  for (const r of setters) if (r.proyecto_id) allPids.add(r.proyecto_id)
  for (const r of closers) if (r.proyecto_id) allPids.add(r.proyecto_id)
  if (allPids.size > 0) {
    const { data: proyectosData } = await supabase
      .from('proyectos')
      .select('id, nombre')
      .in('id', Array.from(allPids))
    for (const p of proyectosData || []) {
      proyectoNombres[p.id] = p.nombre
    }
  }

  // Helper to get the grouping key
  function getKey(fecha: string): string {
    if (groupBy === 'week') return getWeekKey(fecha)
    if (groupBy === 'month') return getMonthKey(fecha)
    return fecha.slice(5) // MM-DD for day view
  }

  // Build timeline grouped by period
  const timelineMap: Record<string, { fecha: string; leads: number; citas: number; shows: number; ventas: number; monto_cobrado: number }> = {}

  for (const r of setters) {
    const key = getKey(r.fecha)
    if (!timelineMap[key]) timelineMap[key] = { fecha: key, leads: 0, citas: 0, shows: 0, ventas: 0, monto_cobrado: 0 }
    timelineMap[key].leads += r.leads_recibidos || 0
    timelineMap[key].citas += r.citas_agendadas || 0
    timelineMap[key].shows += r.citas_show || 0
  }

  for (const r of closers) {
    const key = getKey(r.fecha)
    if (!timelineMap[key]) timelineMap[key] = { fecha: key, leads: 0, citas: 0, shows: 0, ventas: 0, monto_cobrado: 0 }
    timelineMap[key].ventas += r.ventas_cerradas || 0
    timelineMap[key].monto_cobrado += Number(r.monto_cobrado) || 0
  }

  const timeline = Object.values(timelineMap).sort((a, b) => a.fecha.localeCompare(b.fecha))

  // Por persona setter
  const setterMap: Record<string, { id: string; nombre: string; leads: number; contactados: number; citas: number; shows: number; citas_calificadas: number; tasa_conversion: number }> = {}
  for (const r of setters) {
    const key = r.setter_id
    const name = getPersonName(key)
    if (!setterMap[key]) setterMap[key] = { id: key, nombre: name, leads: 0, contactados: 0, citas: 0, shows: 0, citas_calificadas: 0, tasa_conversion: 0 }
    setterMap[key].leads += r.leads_recibidos || 0
    setterMap[key].contactados += r.contactados || 0
    setterMap[key].citas += r.citas_agendadas || 0
    setterMap[key].shows += r.citas_show || 0
    setterMap[key].citas_calificadas += r.citas_calificadas || 0
  }
  // Compute conversion rates
  for (const s of Object.values(setterMap)) {
    s.tasa_conversion = s.leads > 0 ? Math.round((s.citas / s.leads) * 100) : 0
  }

  // Por persona closer
  const closerMap: Record<string, { id: string; nombre: string; ventas: number; monto_cobrado: number; shows: number; tasa_cierre: number }> = {}
  for (const r of closers) {
    const key = r.closer_id
    const name = getPersonName(key)
    if (!closerMap[key]) closerMap[key] = { id: key, nombre: name, ventas: 0, monto_cobrado: 0, shows: 0, tasa_cierre: 0 }
    closerMap[key].ventas += r.ventas_cerradas || 0
    closerMap[key].monto_cobrado += Number(r.monto_cobrado) || 0
    closerMap[key].shows += r.citas_show || 0
  }
  for (const c of Object.values(closerMap)) {
    c.tasa_cierre = c.shows > 0 ? Math.round((c.ventas / c.shows) * 100) : 0
  }

  // Por proyecto
  const proyectoSetterMap: Record<string, { nombre: string; leads: number; citas: number; shows: number }> = {}
  for (const r of setters) {
    const pid = r.proyecto_id || 'sin_proyecto'
    const pname = proyectoNombres[pid] || 'Sin proyecto'
    if (!proyectoSetterMap[pid]) proyectoSetterMap[pid] = { nombre: pname, leads: 0, citas: 0, shows: 0 }
    proyectoSetterMap[pid].leads += r.leads_recibidos || 0
    proyectoSetterMap[pid].citas += r.citas_agendadas || 0
    proyectoSetterMap[pid].shows += r.citas_show || 0
  }

  const proyectoCloserMap: Record<string, { nombre: string; ventas: number; monto_cobrado: number }> = {}
  for (const r of closers) {
    const pid = r.proyecto_id || 'sin_proyecto'
    const pname = proyectoNombres[pid] || 'Sin proyecto'
    if (!proyectoCloserMap[pid]) proyectoCloserMap[pid] = { nombre: pname, ventas: 0, monto_cobrado: 0 }
    proyectoCloserMap[pid].ventas += r.ventas_cerradas || 0
    proyectoCloserMap[pid].monto_cobrado += Number(r.monto_cobrado) || 0
  }

  // Merge project data
  const allProjectIds = new Set([...Object.keys(proyectoSetterMap), ...Object.keys(proyectoCloserMap)])
  const porProyecto = Array.from(allProjectIds).map(pid => ({
    nombre: proyectoSetterMap[pid]?.nombre || proyectoCloserMap[pid]?.nombre || 'Sin proyecto',
    leads: proyectoSetterMap[pid]?.leads || 0,
    citas: proyectoSetterMap[pid]?.citas || 0,
    shows: proyectoSetterMap[pid]?.shows || 0,
    ventas: proyectoCloserMap[pid]?.ventas || 0,
    monto_cobrado: proyectoCloserMap[pid]?.monto_cobrado || 0,
  }))

  // Distribución pagos
  const pagosCompleto = closers.reduce((sum, r) => sum + (r.pagos_completos || 0), 0)
  const pagosParcial = closers.reduce((sum, r) => sum + (r.pagos_parciales || 0), 0)
  const pagosSinPagar = closers.reduce((sum, r) => sum + (r.pagos_nulo || 0), 0)

  // Motivos no cierre
  const motivoPrecio = closers.reduce((sum, r) => sum + (r.motivo_precio || 0), 0)
  const motivoConsultar = closers.reduce((sum, r) => sum + (r.motivo_consultar || 0), 0)
  const motivoMomento = closers.reduce((sum, r) => sum + (r.motivo_momento || 0), 0)
  const motivoCompetencia = closers.reduce((sum, r) => sum + (r.motivo_competencia || 0), 0)
  const motivoOtro = closers.reduce((sum, r) => sum + (r.motivo_otro || 0), 0)

  // Per-person evolution over time (setter)
  const setterTimelineMap: Record<string, Record<string, { fecha: string; citas: number; shows: number; leads: number }>> = {}
  for (const r of setters) {
    const pid = r.setter_id
    const name = getPersonFirstName(pid)
    const key = getKey(r.fecha)
    if (!setterTimelineMap[name]) setterTimelineMap[name] = {}
    if (!setterTimelineMap[name][key]) setterTimelineMap[name][key] = { fecha: key, citas: 0, shows: 0, leads: 0 }
    setterTimelineMap[name][key].leads += r.leads_recibidos || 0
    setterTimelineMap[name][key].citas += r.citas_agendadas || 0
    setterTimelineMap[name][key].shows += r.citas_show || 0
  }

  // Merge setter timelines into flat array with dynamic keys per person
  const allSetterDates = new Set<string>()
  for (const person of Object.values(setterTimelineMap)) {
    for (const key of Object.keys(person)) allSetterDates.add(key)
  }
  const setterEvolucion = Array.from(allSetterDates).sort().map(fecha => {
    const entry: Record<string, string | number> = { fecha }
    for (const [name, dates] of Object.entries(setterTimelineMap)) {
      entry[name] = dates[fecha]?.citas || 0
    }
    return entry
  })

  // Per-person evolution over time (closer)
  const closerTimelineMap: Record<string, Record<string, { fecha: string; ventas: number; monto: number }>> = {}
  for (const r of closers) {
    const pid = r.closer_id
    const name = getPersonFirstName(pid)
    const key = getKey(r.fecha)
    if (!closerTimelineMap[name]) closerTimelineMap[name] = {}
    if (!closerTimelineMap[name][key]) closerTimelineMap[name][key] = { fecha: key, ventas: 0, monto: 0 }
    closerTimelineMap[name][key].ventas += r.ventas_cerradas || 0
    closerTimelineMap[name][key].monto += Number(r.monto_cobrado) || 0
  }

  const allCloserDates = new Set<string>()
  for (const person of Object.values(closerTimelineMap)) {
    for (const key of Object.keys(person)) allCloserDates.add(key)
  }
  const closerEvolucion = Array.from(allCloserDates).sort().map(fecha => {
    const entry: Record<string, string | number> = { fecha }
    for (const [name, dates] of Object.entries(closerTimelineMap)) {
      entry[name] = dates[fecha]?.ventas || 0
    }
    return entry
  })

  const setterNombres = Object.keys(setterTimelineMap)
  const closerNombres = Object.keys(closerTimelineMap)

  return NextResponse.json({
    timeline,
    porPersonaSetter: Object.values(setterMap),
    porPersonaCloser: Object.values(closerMap),
    porProyecto,
    distribucionPagos: [
      { name: 'Completo', value: pagosCompleto },
      { name: 'Parcial', value: pagosParcial },
      { name: 'Sin pagar', value: pagosSinPagar },
    ],
    motivosNoCierre: [
      { name: 'Precio', value: motivoPrecio },
      { name: 'Consultar', value: motivoConsultar },
      { name: 'Momento', value: motivoMomento },
      { name: 'Competencia', value: motivoCompetencia },
      { name: 'Otro', value: motivoOtro },
    ],
    setterEvolucion,
    setterNombres,
    closerEvolucion,
    closerNombres,
  })
}
