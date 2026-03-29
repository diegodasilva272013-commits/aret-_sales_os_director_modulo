import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const hasta = searchParams.get('hasta') || new Date().toISOString().split('T')[0]

  // Fetch all team members (setters and closers)
  const { data: teamProfiles } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, foto_url, rol, activo')
    .in('rol', ['setter', 'closer'])
    .order('nombre')

  if (!teamProfiles) return NextResponse.json({ setters: [], closers: [] })

  // Fetch all payment methods for team
  const teamIds = teamProfiles.map(p => p.id)
  const { data: allPagos } = await supabase
    .from('metodos_pago')
    .select('*')
    .in('user_id', teamIds)

  // Fetch setter reports
  const { data: setterReports } = await supabase
    .from('reportes_setter')
    .select('setter_id, proyecto_id, citas_calificadas, citas_show')
    .gte('fecha', desde)
    .lte('fecha', hasta)

  // Fetch closer reports
  const { data: closerReports } = await supabase
    .from('reportes_closer')
    .select('closer_id, proyecto_id, ventas_cerradas, citas_show, monto_cobrado, monto_pendiente')
    .gte('fecha', desde)
    .lte('fecha', hasta)

  // Fetch commission configs per project
  const { data: comisionConfigs } = await supabase
    .from('comisiones_proyecto')
    .select('*')

  // Fetch project names
  const { data: proyectos } = await supabase
    .from('proyectos')
    .select('id, nombre')

  const proyectoMap = Object.fromEntries((proyectos || []).map(p => [p.id, p.nombre]))

  // Build commission config map by project
  const configMap = Object.fromEntries(
    (comisionConfigs || []).map(c => [c.proyecto_id, c])
  )

  // Default config
  const DEFAULT_CONFIG = {
    setter_base_mensual: 500,
    setter_por_cita_show_calificada: 25,
    setter_por_venta_cerrada: 75,
    closer_comision_porcentaje: 8,
    closer_bonus_cierre: 500,
    closer_bonus_tasa_minima: 40,
    closer_penalidad_impago_porcentaje: 50,
    closer_dias_penalidad: 30,
  }

  // Aggregate setter data
  const setterMap: Record<string, {
    id: string
    citas_calificadas: number
    shows: number
    porProyecto: Record<string, { citas_calificadas: number; shows: number }>
  }> = {}

  for (const r of (setterReports || [])) {
    if (!setterMap[r.setter_id]) {
      setterMap[r.setter_id] = { id: r.setter_id, citas_calificadas: 0, shows: 0, porProyecto: {} }
    }
    setterMap[r.setter_id].citas_calificadas += r.citas_calificadas || 0
    setterMap[r.setter_id].shows += r.citas_show || 0

    // Per project
    const pid = r.proyecto_id || 'default'
    if (!setterMap[r.setter_id].porProyecto[pid]) {
      setterMap[r.setter_id].porProyecto[pid] = { citas_calificadas: 0, shows: 0 }
    }
    setterMap[r.setter_id].porProyecto[pid].citas_calificadas += r.citas_calificadas || 0
    setterMap[r.setter_id].porProyecto[pid].shows += r.citas_show || 0
  }

  // We need ventas per setter - infer from closer reports that reference setter-generated citas
  // For now, use total ventas from closer reports for the period to compute setter bonus
  // Simple approach: ventas_cerradas per project total
  const ventasPorProyecto: Record<string, number> = {}
  for (const r of (closerReports || [])) {
    const pid = r.proyecto_id || 'default'
    ventasPorProyecto[pid] = (ventasPorProyecto[pid] || 0) + (r.ventas_cerradas || 0)
  }

  // Aggregate closer data
  const closerMap: Record<string, {
    id: string
    ventas_cerradas: number
    shows: number
    monto_cobrado: number
    monto_pendiente: number
    porProyecto: Record<string, { ventas: number; shows: number; monto_cobrado: number; monto_pendiente: number }>
  }> = {}

  for (const r of (closerReports || [])) {
    if (!closerMap[r.closer_id]) {
      closerMap[r.closer_id] = { id: r.closer_id, ventas_cerradas: 0, shows: 0, monto_cobrado: 0, monto_pendiente: 0, porProyecto: {} }
    }
    closerMap[r.closer_id].ventas_cerradas += r.ventas_cerradas || 0
    closerMap[r.closer_id].shows += r.citas_show || 0
    closerMap[r.closer_id].monto_cobrado += Number(r.monto_cobrado) || 0
    closerMap[r.closer_id].monto_pendiente += Number(r.monto_pendiente) || 0

    const pid = r.proyecto_id || 'default'
    if (!closerMap[r.closer_id].porProyecto[pid]) {
      closerMap[r.closer_id].porProyecto[pid] = { ventas: 0, shows: 0, monto_cobrado: 0, monto_pendiente: 0 }
    }
    closerMap[r.closer_id].porProyecto[pid].ventas += r.ventas_cerradas || 0
    closerMap[r.closer_id].porProyecto[pid].shows += r.citas_show || 0
    closerMap[r.closer_id].porProyecto[pid].monto_cobrado += Number(r.monto_cobrado) || 0
    closerMap[r.closer_id].porProyecto[pid].monto_pendiente += Number(r.monto_pendiente) || 0
  }

  // Build final setter commission objects
  const setters = teamProfiles.filter(p => p.rol === 'setter').map(person => {
    const stats = setterMap[person.id]
    const pagos = (allPagos || []).filter(p => p.user_id === person.id)

    let totalComision = 0
    const desglose: { proyecto: string; base: number; porCitas: number; porVentas: number; subtotal: number }[] = []

    if (stats) {
      // Calculate per project with project-specific config
      const proyectoIds = Object.keys(stats.porProyecto)
      if (proyectoIds.length === 0) proyectoIds.push('default')

      for (const pid of proyectoIds) {
        const config = configMap[pid] || DEFAULT_CONFIG
        const proyData = stats.porProyecto[pid] || { citas_calificadas: 0, shows: 0 }
        const ventas = ventasPorProyecto[pid] || 0

        const base = config.setter_base_mensual ?? DEFAULT_CONFIG.setter_base_mensual
        const porCitas = (proyData.citas_calificadas) * (config.setter_por_cita_show_calificada ?? DEFAULT_CONFIG.setter_por_cita_show_calificada)
        const porVentas = ventas * (config.setter_por_venta_cerrada ?? DEFAULT_CONFIG.setter_por_venta_cerrada)
        const subtotal = base + porCitas + porVentas

        desglose.push({
          proyecto: proyectoMap[pid] || 'General',
          base,
          porCitas,
          porVentas,
          subtotal,
        })

        totalComision += subtotal
      }
    } else {
      // No reports but still get base
      const base = DEFAULT_CONFIG.setter_base_mensual
      desglose.push({ proyecto: 'General', base, porCitas: 0, porVentas: 0, subtotal: base })
      totalComision = base
    }

    return {
      id: person.id,
      nombre: `${person.nombre} ${person.apellido || ''}`.trim(),
      foto_url: person.foto_url,
      activo: person.activo,
      citas_calificadas: stats?.citas_calificadas || 0,
      total_comision: totalComision,
      desglose,
      pagos,
    }
  })

  // Build final closer commission objects
  const closers = teamProfiles.filter(p => p.rol === 'closer').map(person => {
    const stats = closerMap[person.id]
    const pagos = (allPagos || []).filter(p => p.user_id === person.id)

    let totalComision = 0
    const desglose: { proyecto: string; comisionBase: number; bonus: number; bonusCalifica: boolean; tasaCierre: number; subtotal: number }[] = []

    if (stats) {
      for (const [pid, proyData] of Object.entries(stats.porProyecto)) {
        const config = configMap[pid] || DEFAULT_CONFIG
        const pct = (config.closer_comision_porcentaje ?? DEFAULT_CONFIG.closer_comision_porcentaje) / 100
        const bonusAmount = config.closer_bonus_cierre ?? DEFAULT_CONFIG.closer_bonus_cierre
        const tasaMin = (config.closer_bonus_tasa_minima ?? DEFAULT_CONFIG.closer_bonus_tasa_minima) / 100

        const comisionBase = proyData.monto_cobrado * pct
        const tasaCierre = proyData.shows > 0 ? proyData.ventas / proyData.shows : 0
        const bonusCalifica = tasaCierre >= tasaMin
        const subtotal = comisionBase + (bonusCalifica ? bonusAmount : 0)

        desglose.push({
          proyecto: proyectoMap[pid] || 'General',
          comisionBase,
          bonus: bonusCalifica ? bonusAmount : 0,
          bonusCalifica,
          tasaCierre: Math.round(tasaCierre * 100),
          subtotal,
        })

        totalComision += subtotal
      }
    }

    return {
      id: person.id,
      nombre: `${person.nombre} ${person.apellido || ''}`.trim(),
      foto_url: person.foto_url,
      activo: person.activo,
      ventas_cerradas: stats?.ventas_cerradas || 0,
      monto_cobrado: stats?.monto_cobrado || 0,
      tasa_cierre: stats && stats.shows > 0 ? Math.round((stats.ventas_cerradas / stats.shows) * 100) : 0,
      total_comision: totalComision,
      desglose,
      pagos,
    }
  })

  return NextResponse.json({ setters, closers, desde, hasta })
  } catch (e: unknown) {
    console.error('Comisiones API error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal server error' }, { status: 500 })
  }
}
