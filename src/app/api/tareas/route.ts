import { createClient } from '@/lib/supabase/server'
import { getDirectorScope } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  const estado = searchParams.get('estado')
  const tipo = searchParams.get('tipo')

  let query = supabase
    .from('tareas')
    .select('*')
    .eq('director_id', scope.directorId)
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true, nullsFirst: false })

  if (desde) query = query.gte('fecha', desde)
  if (hasta) query = query.lte('fecha', hasta)
  if (estado) query = query.eq('estado', estado)
  if (tipo) query = query.eq('tipo', tipo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tareas: data })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()

  const { titulo, descripcion, fecha, hora_inicio, hora_fin, tipo, prioridad, participantes_ids, enlace_reunion, recurrente, recurrencia_tipo, recurrencia_fin, notas } = body

  if (!titulo || !fecha) {
    return NextResponse.json({ error: 'Título y fecha son obligatorios' }, { status: 400 })
  }

  const { data, error } = await supabase.from('tareas').insert({
    director_id: scope.directorId,
    titulo,
    descripcion: descripcion || null,
    fecha,
    hora_inicio: hora_inicio || null,
    hora_fin: hora_fin || null,
    tipo: tipo || 'tarea',
    prioridad: prioridad || 'media',
    participantes_ids: participantes_ids || [],
    enlace_reunion: enlace_reunion || null,
    recurrente: recurrente || false,
    recurrencia_tipo: recurrencia_tipo || null,
    recurrencia_fin: recurrencia_fin || null,
    notas: notas || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tarea: data })
}
