import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET: Listar cuotas de un cliente
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clienteId = searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  // Auto-marcar cuotas vencidas antes de devolver
  const hoy = new Date().toISOString().split('T')[0]
  await supabase
    .from('cuotas')
    .update({ estado: 'vencida' })
    .eq('cliente_id', clienteId)
    .eq('estado', 'pendiente')
    .lt('fecha_vencimiento', hoy)

  const { data, error } = await supabase
    .from('cuotas')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('numero_cuota', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST: Agregar cuota, pagar (total o parcial), reembolsar, editar
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { action } = body

  // ─── AGREGAR CUOTA ───
  if (action === 'agregar') {
    const { cliente_id, monto, fecha_vencimiento } = body
    if (!cliente_id || !monto || !fecha_vencimiento) {
      return NextResponse.json({ error: 'cliente_id, monto y fecha_vencimiento requeridos' }, { status: 400 })
    }

    const { data: existingCuotas } = await supabase
      .from('cuotas')
      .select('numero_cuota')
      .eq('cliente_id', cliente_id)
      .order('numero_cuota', { ascending: false })
      .limit(1)

    const nextNum = existingCuotas && existingCuotas.length > 0 ? existingCuotas[0].numero_cuota + 1 : 1

    const { data, error } = await supabase
      .from('cuotas')
      .insert({
        cliente_id,
        numero_cuota: nextNum,
        monto: Number(monto),
        fecha_vencimiento,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // ─── PAGAR CUOTA (total o parcial) ───
  if (action === 'pagar') {
    const { cuota_id, comprobante_url, monto_pago } = body
    if (!cuota_id) return NextResponse.json({ error: 'cuota_id requerido' }, { status: 400 })

    // Obtener cuota actual
    const { data: cuotaActual, error: fetchErr } = await supabase
      .from('cuotas')
      .select('*, cliente_id')
      .eq('id', cuota_id)
      .single()

    if (fetchErr || !cuotaActual) return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 })

    const montoCuota = Number(cuotaActual.monto)
    const pagadoPrevio = Number(cuotaActual.monto_pagado || 0)
    const montoPagar = monto_pago ? Math.min(Number(monto_pago), montoCuota - pagadoPrevio) : montoCuota - pagadoPrevio

    if (montoPagar <= 0) return NextResponse.json({ error: 'Cuota ya pagada completamente' }, { status: 400 })

    const nuevoMontoPagado = pagadoPrevio + montoPagar
    const esPagoTotal = nuevoMontoPagado >= montoCuota
    const hoy = new Date().toISOString().split('T')[0]

    // Actualizar cuota
    const { data: cuota, error: cuotaError } = await supabase
      .from('cuotas')
      .update({
        estado: esPagoTotal ? 'pagada' : 'pendiente',
        fecha_pago: esPagoTotal ? hoy : null,
        monto_pagado: nuevoMontoPagado,
        comprobante_url: comprobante_url || cuotaActual.comprobante_url || null,
      })
      .eq('id', cuota_id)
      .select('*, cliente_id')
      .single()

    if (cuotaError) return NextResponse.json({ error: cuotaError.message }, { status: 500 })

    // Crear transacción de ingreso por el monto REAL pagado
    const { data: txData, error: txError } = await supabase
      .from('transacciones')
      .insert({
        cliente_id: cuota.cliente_id,
        cuota_id: cuota.id,
        monto: montoPagar,
        tipo: 'ingreso',
        descripcion: esPagoTotal
          ? `Cuota #${cuota.numero_cuota} pagada completa`
          : `Pago parcial cuota #${cuota.numero_cuota} ($${montoPagar.toLocaleString()} de $${montoCuota.toLocaleString()})`,
      })
      .select()
      .single()

    if (txError) return NextResponse.json({ error: txError.message }, { status: 500 })

    // ─── COMISIÓN DIFERIDA (7 días de garantía) ───
    // Obtener closer y setter del cliente para generar comisiones pendientes
    const { data: clienteInfo } = await supabase
      .from('clientes_cartera')
      .select('closer_id, setter_id')
      .eq('id', cuota.cliente_id)
      .single()

    if (clienteInfo) {
      // Buscar reglas escalonadas o usar porcentaje por defecto
      const comisionEntries: { usuario_id: string; rol: string; porcentaje: number }[] = []

      if (clienteInfo.closer_id) {
        const { data: regla } = await supabase
          .from('reglas_comision')
          .select('tramos')
          .eq('rol', 'closer')
          .eq('activa', true)
          .limit(1)
          .single()

        let pctCloser = 8 // default 8%
        if (regla?.tramos && Array.isArray(regla.tramos)) {
          // Calcular lifetimeCollected del closer para determinar tramo
          const { data: lifetimeTx } = await supabase
            .from('transacciones')
            .select('monto')
            .eq('tipo', 'ingreso')
          // Filter by clients of this closer
          const lifetimeTotal = (lifetimeTx || []).reduce((s, t) => s + Number(t.monto), 0)
          for (const tramo of regla.tramos as { desde: number; hasta: number; porcentaje: number }[]) {
            if (lifetimeTotal >= tramo.desde && (tramo.hasta === 0 || lifetimeTotal <= tramo.hasta)) {
              pctCloser = tramo.porcentaje
            }
          }
        }
        comisionEntries.push({ usuario_id: clienteInfo.closer_id, rol: 'closer', porcentaje: pctCloser })
      }

      if (clienteInfo.setter_id) {
        const { data: reglaSetter } = await supabase
          .from('reglas_comision')
          .select('tramos')
          .eq('rol', 'setter')
          .eq('activa', true)
          .limit(1)
          .single()

        let pctSetter = 3 // default 3%
        if (reglaSetter?.tramos && Array.isArray(reglaSetter.tramos)) {
          for (const tramo of reglaSetter.tramos as { desde: number; hasta: number; porcentaje: number }[]) {
            if (montoPagar >= tramo.desde && (tramo.hasta === 0 || montoPagar <= tramo.hasta)) {
              pctSetter = tramo.porcentaje
            }
          }
        }
        comisionEntries.push({ usuario_id: clienteInfo.setter_id, rol: 'setter', porcentaje: pctSetter })
      }

      // Insert deferred commissions (7-day hold)
      const comisionesInserts = comisionEntries.map(ce => ({
        cuota_id: cuota.id,
        usuario_id: ce.usuario_id,
        rol: ce.rol,
        monto_base: montoPagar,
        porcentaje_aplicado: ce.porcentaje,
        monto_comision: Math.round(montoPagar * ce.porcentaje) / 100,
        estado: 'pendiente',
        disponible_en: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }))

      if (comisionesInserts.length > 0) {
        await supabase.from('comisiones_pendientes').insert(comisionesInserts)
      }

      // ─── DISTRIBUCIÓN DE PAGO ("bolsillos") ───
      const comCloser = comisionEntries.find(c => c.rol === 'closer')
      const comSetter = comisionEntries.find(c => c.rol === 'setter')
      const comisionCloserMonto = comCloser ? Math.round(montoPagar * comCloser.porcentaje) / 100 : 0
      const comisionSetterMonto = comSetter ? Math.round(montoPagar * comSetter.porcentaje) / 100 : 0

      await supabase.from('distribucion_pagos').insert({
        cuota_id: cuota.id,
        transaccion_id: txData?.id || null,
        monto_bruto: montoPagar,
        comision_closer: comisionCloserMonto,
        comision_setter: comisionSetterMonto,
        costos_ads: 0,
        costos_operativos: 0,
        ganancia_empresa: montoPagar - comisionCloserMonto - comisionSetterMonto,
      })
    }

    // Verificar si todas las cuotas del cliente están pagadas → marcar cliente
    if (esPagoTotal) {
      const { data: cuotasRestantes } = await supabase
        .from('cuotas')
        .select('id')
        .eq('cliente_id', cuota.cliente_id)
        .in('estado', ['pendiente', 'vencida'])

      if (!cuotasRestantes || cuotasRestantes.length === 0) {
        await supabase
          .from('clientes_cartera')
          .update({ estado: 'pagado' })
          .eq('id', cuota.cliente_id)
      }
    }

    return NextResponse.json({ ...cuota, monto_pagado_ahora: montoPagar, pago_total: esPagoTotal })
  }

  // ─── REEMBOLSAR CUOTA ───
  if (action === 'reembolsar') {
    const { cuota_id, motivo } = body
    if (!cuota_id) return NextResponse.json({ error: 'cuota_id requerido' }, { status: 400 })

    // Obtener cuota
    const { data: cuota, error: fetchErr } = await supabase
      .from('cuotas')
      .select('*, cliente_id')
      .eq('id', cuota_id)
      .single()

    if (fetchErr || !cuota) return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 })

    const montoReembolso = Number(cuota.monto_pagado || cuota.monto)
    if (montoReembolso <= 0) return NextResponse.json({ error: 'Cuota sin pagos para reembolsar' }, { status: 400 })

    // Revertir cuota a pendiente
    const { error: updateErr } = await supabase
      .from('cuotas')
      .update({
        estado: 'pendiente',
        fecha_pago: null,
        monto_pagado: 0,
      })
      .eq('id', cuota_id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Crear transacción de reembolso
    const { error: txError } = await supabase
      .from('transacciones')
      .insert({
        cliente_id: cuota.cliente_id,
        cuota_id: cuota.id,
        monto: montoReembolso,
        tipo: 'reembolso',
        descripcion: motivo ? `Reembolso cuota #${cuota.numero_cuota}: ${motivo}` : `Reembolso cuota #${cuota.numero_cuota}`,
      })

    if (txError) return NextResponse.json({ error: txError.message }, { status: 500 })

    // ─── REVERTIR COMISIONES DIFERIDAS de esta cuota ───
    await supabase
      .from('comisiones_pendientes')
      .update({ estado: 'revertida', revertida_en: new Date().toISOString() })
      .eq('cuota_id', cuota_id)
      .in('estado', ['pendiente', 'disponible'])

    // Audit log
    await supabase.from('audit_log').insert({
      tabla: 'cuotas', registro_id: cuota_id, accion: 'UPDATE',
      datos_anteriores: { estado: cuota.estado, monto_pagado: cuota.monto_pagado },
      datos_nuevos: { estado: 'pendiente', monto_pagado: 0, razon: 'reembolso' },
      usuario_id: user.id,
    })

    // Re-activar cliente si estaba pagado
    await supabase
      .from('clientes_cartera')
      .update({ estado: 'activo' })
      .eq('id', cuota.cliente_id)
      .eq('estado', 'pagado')

    return NextResponse.json({ reembolsado: true, monto: montoReembolso, cuota_id })
  }

  // ─── EDITAR CUOTA ───
  if (action === 'editar') {
    const { cuota_id, fecha_vencimiento, monto } = body
    if (!cuota_id) return NextResponse.json({ error: 'cuota_id requerido' }, { status: 400 })

    // Obtener cuota actual para detectar si era pagada y el monto cambió
    const { data: cuotaAnterior } = await supabase
      .from('cuotas')
      .select('*, cliente_id')
      .eq('id', cuota_id)
      .single()

    const updateData: Record<string, unknown> = {}
    if (fecha_vencimiento) updateData.fecha_vencimiento = fecha_vencimiento
    if (monto !== undefined) updateData.monto = Number(monto)

    const { data, error } = await supabase
      .from('cuotas')
      .update(updateData)
      .eq('id', cuota_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ─── AJUSTE DE COMISIÓN si la cuota estaba pagada y el monto cambió ───
    if (cuotaAnterior && cuotaAnterior.estado === 'pagada' && monto !== undefined && Number(monto) !== Number(cuotaAnterior.monto)) {
      const montoAnterior = Number(cuotaAnterior.monto)
      const montoNuevo = Number(monto)
      const delta = montoNuevo - montoAnterior

      // Obtener las comisiones existentes de esta cuota para calcular delta
      const { data: comisionesExistentes } = await supabase
        .from('comisiones_pendientes')
        .select('usuario_id, porcentaje_aplicado')
        .eq('cuota_id', cuota_id)
        .in('estado', ['pendiente', 'disponible', 'liquidada'])

      for (const com of (comisionesExistentes || [])) {
        const deltaComision = Math.round(delta * Number(com.porcentaje_aplicado)) / 100
        await supabase.from('ajustes_comision').insert({
          cuota_id,
          usuario_id: com.usuario_id,
          monto_anterior: montoAnterior,
          monto_nuevo: montoNuevo,
          delta_comision: deltaComision,
        })
      }

      // Audit log
      await supabase.from('audit_log').insert({
        tabla: 'cuotas', registro_id: cuota_id, accion: 'UPDATE',
        datos_anteriores: { monto: montoAnterior },
        datos_nuevos: { monto: montoNuevo, delta },
        usuario_id: user.id,
      })
    }

    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'action inválida (agregar|pagar|reembolsar|editar)' }, { status: 400 })
}

// DELETE: Eliminar cuota
export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const cuotaId = searchParams.get('id')
  if (!cuotaId) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabase.from('cuotas').delete().eq('id', cuotaId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
