import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET: Listar transacciones con filtros
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  const tipo = searchParams.get('tipo')
  const limit = parseInt(searchParams.get('limit') || '50')

  let query = supabase
    .from('transacciones')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(limit)

  if (desde) query = query.gte('fecha', desde)
  if (hasta) query = query.lte('fecha', hasta + 'T23:59:59')
  if (tipo) query = query.eq('tipo', tipo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with client names and assigned team
  const clienteIds = Array.from(new Set((data || []).map(t => t.cliente_id).filter(Boolean)))
  let clienteMap: Record<string, { nombre_cliente: string; closer_id: string; setter_id: string }> = {}

  if (clienteIds.length > 0) {
    const { data: clientes } = await supabase
      .from('clientes_cartera')
      .select('id, nombre_cliente, closer_id, setter_id')
      .in('id', clienteIds)

    clienteMap = Object.fromEntries((clientes || []).map(c => [c.id, c]))
  }

  // Get profile names for closers/setters
  const userIds = Array.from(new Set(Object.values(clienteMap).flatMap(c => [c.closer_id, c.setter_id]).filter(Boolean)))
  let perfilMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: perfiles } = await supabase
      .from('profiles')
      .select('id, nombre, apellido')
      .in('id', userIds)

    perfilMap = Object.fromEntries((perfiles || []).map(p => [p.id, `${p.nombre || ''} ${p.apellido || ''}`.trim()]))
  }

  const enriched = (data || []).map(tx => {
    const cliente = clienteMap[tx.cliente_id] || {}
    return {
      ...tx,
      cliente_nombre: (cliente as Record<string, string>).nombre_cliente || 'N/A',
      closer_nombre: perfilMap[(cliente as Record<string, string>).closer_id] || '',
      setter_nombre: perfilMap[(cliente as Record<string, string>).setter_id] || '',
    }
  })

  return NextResponse.json(enriched)
}

// POST: Crear transacción manual (egreso, o ingreso no vinculado a cuota)
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { cliente_id, monto, tipo, descripcion } = body

  if (!monto || !tipo) {
    return NextResponse.json({ error: 'monto y tipo son requeridos' }, { status: 400 })
  }

  if (!['ingreso', 'egreso', 'reembolso'].includes(tipo)) {
    return NextResponse.json({ error: 'tipo debe ser ingreso, egreso o reembolso' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('transacciones')
    .insert({
      cliente_id: cliente_id || null,
      monto: Number(monto),
      tipo,
      descripcion: descripcion || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE: Eliminar transacción
export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabase.from('transacciones').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
