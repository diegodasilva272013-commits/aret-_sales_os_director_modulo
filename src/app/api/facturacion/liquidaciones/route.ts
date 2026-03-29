import { createClient } from '@/lib/supabase/server'
import { getDirectorScope } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET: Listar liquidaciones
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const usuarioId = searchParams.get('usuario_id')

  let query = supabase
    .from('liquidaciones')
    .select('*')
    .order('generado_en', { ascending: false })

  if (usuarioId) {
    // Verify this user belongs to director's team
    if (!scope.teamIds.includes(usuarioId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    query = query.eq('usuario_id', usuarioId)
  } else {
    query = query.in('usuario_id', scope.teamIds)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with user names
  const userIds = Array.from(new Set((data || []).map(l => l.usuario_id).filter(Boolean)))
  let perfilMap: Record<string, { nombre: string; rol: string }> = {}
  if (userIds.length > 0) {
    const { data: perfiles } = await supabase
      .from('profiles')
      .select('id, nombre, apellido, rol')
      .in('id', userIds)

    perfilMap = Object.fromEntries((perfiles || []).map(p => [p.id, {
      nombre: `${p.nombre || ''} ${p.apellido || ''}`.trim(),
      rol: p.rol,
    }]))
  }

  const enriched = (data || []).map(l => ({
    ...l,
    usuario_nombre: perfilMap[l.usuario_id]?.nombre || '',
    usuario_rol: perfilMap[l.usuario_id]?.rol || '',
  }))

  return NextResponse.json(enriched)
}

// POST: Generar liquidación para un usuario en un período
// Usa comisiones_pendientes (disponibles) + ajustes_comision pendientes
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { usuario_id, fecha_desde, fecha_hasta } = body

  if (!usuario_id || !fecha_desde || !fecha_hasta) {
    return NextResponse.json({ error: 'usuario_id, fecha_desde y fecha_hasta son requeridos' }, { status: 400 })
  }

  // Fetch user (must be in director's team)
  if (!scope.teamIds.includes(usuario_id)) return NextResponse.json({ error: 'Usuario no es parte de tu equipo' }, { status: 403 })

  const { data: usuario } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, rol')
    .eq('id', usuario_id)
    .single()

  if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // ─── Liberar comisiones diferidas cuyo plazo de 7 días ya pasó ───
  await supabase.rpc('liberar_comisiones_disponibles')

  // ─── 1. Buscar comisiones DISPONIBLES del usuario en el período ───
  const { data: comisionesDisponibles } = await supabase
    .from('comisiones_pendientes')
    .select('*, cuota:cuotas(id, numero_cuota, monto, cliente_id)')
    .eq('usuario_id', usuario_id)
    .eq('estado', 'disponible')
    .gte('creado_en', fecha_desde)
    .lte('creado_en', fecha_hasta + 'T23:59:59')

  // ─── 2. Buscar ajustes pendientes de este usuario ───
  const { data: ajustesPendientes } = await supabase
    .from('ajustes_comision')
    .select('*')
    .eq('usuario_id', usuario_id)
    .eq('aplicado', false)

  // ─── 3. Obtener regla activa (snapshot para auditoría) ───
  const { data: reglaActiva } = await supabase
    .from('reglas_comision')
    .select('*')
    .eq('rol', usuario.rol)
    .eq('activa', true)
    .eq('director_id', scope.directorId)
    .limit(1)
    .maybeSingle()

  // ─── 4. Calcular totales ───
  const comisionesArr = comisionesDisponibles || []
  const ajustesArr = ajustesPendientes || []

  const totalComisionBase = comisionesArr.reduce((s, c) => s + Number(c.monto_comision), 0)
  const totalAjustes = ajustesArr.reduce((s, a) => s + Number(a.delta_comision), 0)
  const comisionNeta = Math.max(0, totalComisionBase + totalAjustes)

  // Calcular facturado y reembolsado del período para este usuario (usando transacciones)
  const { data: clientes } = await supabase
    .from('clientes_cartera')
    .select('id, nombre_cliente, closer_id, setter_id')
    .eq('director_id', scope.directorId)

  const clienteMap = Object.fromEntries((clientes || []).map(c => [c.id, c]))
  const roleField = usuario.rol === 'closer' ? 'closer_id' : usuario.rol === 'setter' ? 'setter_id' : null
  const misClienteIds = roleField
    ? (clientes || []).filter(c => c[roleField as 'closer_id' | 'setter_id'] === usuario_id).map(c => c.id)
    : (clientes || []).map(c => c.id)

  const { data: txPeriodo } = await supabase
    .from('transacciones')
    .select('monto, tipo, cliente_id')
    .gte('fecha', fecha_desde)
    .lte('fecha', fecha_hasta + 'T23:59:59')

  const misTx = (txPeriodo || []).filter(t => misClienteIds.includes(t.cliente_id))
  const totalFacturado = misTx.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.monto), 0)
  const totalReembolsado = misTx.filter(t => t.tipo === 'reembolso').reduce((s, t) => s + Number(t.monto), 0)

  // ─── 5. Armar detalle ───
  const detalle = [
    ...comisionesArr.map(c => {
      const cuotaData = c.cuota as { id: string; numero_cuota: number; monto: number; cliente_id: string } | null
      const cliente = cuotaData ? clienteMap[cuotaData.cliente_id] : null
      return {
        tipo: 'comision' as const,
        cliente: cliente?.nombre_cliente || 'N/A',
        cuota_id: c.cuota_id,
        monto_base: Number(c.monto_base),
        porcentaje: Number(c.porcentaje_aplicado),
        comision_generada: Number(c.monto_comision),
        fecha: c.creado_en,
        comision_pendiente_id: c.id,
      }
    }),
    ...ajustesArr.map(a => ({
      tipo: 'ajuste' as const,
      cliente: 'Ajuste post-pago',
      cuota_id: a.cuota_id,
      monto_anterior: Number(a.monto_anterior),
      monto_nuevo: Number(a.monto_nuevo),
      comision_generada: Number(a.delta_comision),
      fecha: a.creado_en,
      ajuste_id: a.id,
    })),
  ]

  // ─── 6. Guardar liquidación ───
  const { data: liquidacion, error } = await supabase
    .from('liquidaciones')
    .insert({
      usuario_id,
      fecha_desde,
      fecha_hasta,
      total_comision: comisionNeta,
      detalle: JSON.stringify(detalle),
      estado: 'pendiente',
      regla_snapshot: reglaActiva ? { id: reglaActiva.id, nombre: reglaActiva.nombre, tramos: reglaActiva.tramos } : null,
      total_facturado: totalFacturado,
      total_reembolsado: totalReembolsado,
      ajustes_aplicados: totalAjustes,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ─── 7. Marcar comisiones como 'liquidada' ───
  const comisionIds = comisionesArr.map(c => c.id)
  if (comisionIds.length > 0) {
    await supabase
      .from('comisiones_pendientes')
      .update({ estado: 'liquidada', liquidada_en: new Date().toISOString(), liquidacion_id: liquidacion.id })
      .in('id', comisionIds)
  }

  // ─── 8. Marcar ajustes como aplicados ───
  const ajusteIds = ajustesArr.map(a => a.id)
  if (ajusteIds.length > 0) {
    await supabase
      .from('ajustes_comision')
      .update({ aplicado: true, liquidacion_id: liquidacion.id })
      .in('id', ajusteIds)
  }

  // Audit log
  await supabase.from('audit_log').insert({
    tabla: 'liquidaciones', registro_id: liquidacion.id, accion: 'INSERT',
    datos_nuevos: { total_comision: comisionNeta, comisiones_count: comisionIds.length, ajustes_count: ajusteIds.length },
    usuario_id: scope.directorId,
  })

  return NextResponse.json({
    ...liquidacion,
    usuario_nombre: `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim(),
    usuario_rol: usuario.rol,
    total_facturado: totalFacturado,
    total_reembolsado: totalReembolsado,
    ajustes_aplicados: totalAjustes,
    detalle,
  })
}

// PUT: Marcar liquidación como pagada/pendiente
export async function PUT(request: NextRequest) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { id, estado } = body

  if (!id || !estado || !['pendiente', 'pagada'].includes(estado)) {
    return NextResponse.json({ error: 'id y estado (pendiente|pagada) requeridos' }, { status: 400 })
  }

  // Verify liquidacion belongs to a team member
  const { data: liq } = await supabase.from('liquidaciones').select('usuario_id').eq('id', id).single()
  if (!liq || !scope.teamIds.includes(liq.usuario_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('liquidaciones')
    .update({ estado })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE: Eliminar liquidación
export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  // Verify liquidacion belongs to a team member
  const { data: liq } = await supabase.from('liquidaciones').select('usuario_id').eq('id', id).single()
  if (!liq || !scope.teamIds.includes(liq.usuario_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('liquidaciones').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
