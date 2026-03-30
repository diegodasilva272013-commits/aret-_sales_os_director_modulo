import { createClient } from '@/lib/supabase/server'
import { getDirectorScope } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const allowed = ['titulo', 'descripcion', 'fecha', 'hora_inicio', 'hora_fin', 'tipo', 'prioridad', 'estado', 'participantes_ids', 'enlace_reunion', 'recurrente', 'recurrencia_tipo', 'recurrencia_fin', 'notas']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // Track completada_at
  if (body.estado === 'completada') {
    updates.completada_at = new Date().toISOString()
  } else if (body.estado && body.estado !== 'completada') {
    updates.completada_at = null
  }

  // Track posponer
  if (body.estado === 'pospuesta' && body.fecha) {
    const { data: current } = await supabase.from('tareas').select('fecha, fecha_original, veces_pospuesta').eq('id', params.id).eq('director_id', scope.directorId).single()
    if (current) {
      updates.fecha_original = current.fecha_original || current.fecha
      updates.veces_pospuesta = (current.veces_pospuesta || 0) + 1
      updates.estado = 'pendiente' // Reset to pendiente with new date
    }
  }

  const { data, error } = await supabase
    .from('tareas')
    .update(updates)
    .eq('id', params.id)
    .eq('director_id', scope.directorId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })

  return NextResponse.json({ tarea: data })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('tareas')
    .delete()
    .eq('id', params.id)
    .eq('director_id', scope.directorId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
