import { createClient } from '@/lib/supabase/server'
import { getDirectorScope } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify project belongs to this director
  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id, nombre, tipo, empresa')
    .eq('id', params.id)
    .eq('director_id', scope.directorId)
    .single()

  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('project_briefs')
    .select('*')
    .eq('proyecto_id', params.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: comisiones } = await supabase
    .from('comisiones_proyecto')
    .select('*')
    .eq('proyecto_id', params.id)
    .single()

  return NextResponse.json({ brief: data || null, proyecto: proyecto || null, comisiones: comisiones || null })
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify project belongs to this director
  const { data: proyecto } = await supabase.from('proyectos').select('id').eq('id', params.id).eq('director_id', scope.directorId).single()
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const body = await request.json()

  const { data, error } = await supabase
    .from('project_briefs')
    .upsert({ ...body, proyecto_id: params.id, updated_at: new Date().toISOString() }, { onConflict: 'proyecto_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
