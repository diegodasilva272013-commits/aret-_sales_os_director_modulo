import { createClient } from '@/lib/supabase/server'
import { getDirectorScope } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('proyectos')
    .select('*, proyecto_miembros(count)')
    .eq('director_id', scope.directorId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { nombre, empresa, descripcion, tipo } = body

  if (!nombre) return NextResponse.json({ error: 'nombre is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('proyectos')
    .insert({ nombre, empresa, descripcion, tipo: tipo || 'evergreen', director_id: scope.directorId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create default commission config
  await supabase.from('comisiones_proyecto').insert({ proyecto_id: data.id })

  return NextResponse.json(data, { status: 201 })
}
