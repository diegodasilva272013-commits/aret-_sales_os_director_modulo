import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET: Listar clientes de cartera con resumen de cuotas
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const filtroEstado = searchParams.get('estado') // activo | vencido | pagado | null (todos)

  let query = supabase
    .from('clientes_cartera')
    .select('*')
    .order('creado_en', { ascending: false })

  if (filtroEstado) query = query.eq('estado', filtroEstado)

  const { data: clientes, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Obtener todas las cuotas de estos clientes
  const clienteIds = (clientes || []).map(c => c.id)
  const { data: todasCuotas } = clienteIds.length > 0
    ? await supabase.from('cuotas').select('*').in('cliente_id', clienteIds)
    : { data: [] }

  // Obtener nombres de closers y setters
  const userIds = Array.from(new Set([
    ...(clientes || []).map(c => c.closer_id).filter(Boolean),
    ...(clientes || []).map(c => c.setter_id).filter(Boolean),
  ]))
  const { data: perfiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, nombre, apellido').in('id', userIds)
    : { data: [] }

  const perfilMap = Object.fromEntries((perfiles || []).map(p => [p.id, `${p.nombre || ''} ${p.apellido || ''}`.trim()]))

  const result = (clientes || []).map(cliente => {
    const cuotas = (todasCuotas || []).filter(c => c.cliente_id === cliente.id)
    return {
      ...cliente,
      closer_nombre: perfilMap[cliente.closer_id] || '',
      setter_nombre: perfilMap[cliente.setter_id] || '',
      cuotas_pendientes: cuotas.filter(c => c.estado === 'pendiente').length,
      cuotas_vencidas: cuotas.filter(c => c.estado === 'vencida').length,
      cuotas_pagadas: cuotas.filter(c => c.estado === 'pagada').length,
      cuotas_total: cuotas.length,
    }
  })

  return NextResponse.json(result)
}

// POST: Crear nuevo cliente en cartera + cuotas automáticas
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { nombre_cliente, documento, closer_id, setter_id, monto_referencia, notas, cuotas, fuente, campana, canal } = body

  if (!nombre_cliente || !monto_referencia) {
    return NextResponse.json({ error: 'nombre_cliente y monto_referencia son requeridos' }, { status: 400 })
  }

  // Crear cliente
  const { data: cliente, error: clienteError } = await supabase
    .from('clientes_cartera')
    .insert({
      nombre_cliente,
      documento: documento || null,
      closer_id: closer_id || null,
      setter_id: setter_id || null,
      monto_referencia: Number(monto_referencia),
      notas: notas || null,
      fuente: fuente || null,
      campana: campana || null,
      canal: canal || null,
    })
    .select()
    .single()

  if (clienteError) return NextResponse.json({ error: clienteError.message }, { status: 500 })

  // Crear cuotas si se proporcionan
  if (cuotas && Array.isArray(cuotas) && cuotas.length > 0) {
    const cuotasToInsert = cuotas.map((c: { monto: number; fecha_vencimiento: string }, i: number) => ({
      cliente_id: cliente.id,
      numero_cuota: i + 1,
      monto: Number(c.monto),
      fecha_vencimiento: c.fecha_vencimiento,
    }))

    const { error: cuotasError } = await supabase.from('cuotas').insert(cuotasToInsert)
    if (cuotasError) return NextResponse.json({ error: cuotasError.message }, { status: 500 })
  }

  return NextResponse.json(cliente)
}

// PUT: Actualizar cliente
export async function PUT(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { id, nombre_cliente, documento, closer_id, setter_id, monto_referencia, notas, estado, fuente, campana, canal } = body

  if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 })

  // ─── REASIGNACIÓN: detectar cambio de closer/setter ───
  const { data: clienteAnterior } = await supabase
    .from('clientes_cartera')
    .select('closer_id, setter_id')
    .eq('id', id)
    .single()

  const updateData: Record<string, unknown> = {}
  if (nombre_cliente !== undefined) updateData.nombre_cliente = nombre_cliente
  if (documento !== undefined) updateData.documento = documento
  if (closer_id !== undefined) updateData.closer_id = closer_id || null
  if (setter_id !== undefined) updateData.setter_id = setter_id || null
  if (monto_referencia !== undefined) updateData.monto_referencia = Number(monto_referencia)
  if (notas !== undefined) updateData.notas = notas
  if (estado !== undefined) updateData.estado = estado
  if (fuente !== undefined) updateData.fuente = fuente || null
  if (campana !== undefined) updateData.campana = campana || null
  if (canal !== undefined) updateData.canal = canal || null

  const { data, error } = await supabase
    .from('clientes_cartera')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ─── Registrar reasignaciones con trazabilidad ───
  if (clienteAnterior) {
    const reasignaciones: { campo: string; anterior: string | null; nuevo: string | null }[] = []

    if (closer_id !== undefined && clienteAnterior.closer_id !== (closer_id || null)) {
      reasignaciones.push({ campo: 'closer_id', anterior: clienteAnterior.closer_id, nuevo: closer_id || null })
    }
    if (setter_id !== undefined && clienteAnterior.setter_id !== (setter_id || null)) {
      reasignaciones.push({ campo: 'setter_id', anterior: clienteAnterior.setter_id, nuevo: setter_id || null })
    }

    for (const r of reasignaciones) {
      // Contar cuotas futuras (se reasignan) vs en garantía (se quedan con anterior)
      const { data: cuotasFuturas } = await supabase
        .from('cuotas')
        .select('id')
        .eq('cliente_id', id)
        .in('estado', ['pendiente', 'vencida'])

      const { data: cuotasEnGarantia } = await supabase
        .from('comisiones_pendientes')
        .select('cuota_id')
        .eq('estado', 'pendiente')
        .eq('usuario_id', r.anterior || '')

      const cuotasFuturasCount = (cuotasFuturas || []).length
      const cuotasGarantiaCount = (cuotasEnGarantia || []).length

      await supabase.from('reasignaciones').insert({
        cliente_id: id,
        campo: r.campo,
        usuario_anterior: r.anterior,
        usuario_nuevo: r.nuevo,
        razon: body.razon_reasignacion || 'MANUAL',
        notas: body.notas_reasignacion || null,
        cuotas_reasignadas: cuotasFuturasCount,
        cuotas_en_garantia: cuotasGarantiaCount,
        creado_por: user.id,
      })

      // Reasignar comisiones pendientes de cuotas FUTURAS al nuevo usuario
      // Cuotas en garantía (comisiones pendientes aún) se quedan con el anterior
      if (r.nuevo && cuotasFuturas && cuotasFuturas.length > 0) {
        const cuotaIdsFuturas = cuotasFuturas.map(c => c.id)
        await supabase
          .from('comisiones_pendientes')
          .update({ usuario_id: r.nuevo })
          .eq('usuario_id', r.anterior || '')
          .in('cuota_id', cuotaIdsFuturas)
          .eq('estado', 'pendiente')
      }
    }
  }

  return NextResponse.json(data)
}

// DELETE: Eliminar cliente y sus cuotas (cascade)
export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabase.from('clientes_cartera').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
