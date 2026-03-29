import { createClient } from '@/lib/supabase/server'
import { getDirectorScope } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify project belongs to this director
  const { data: proyecto } = await supabase.from('proyectos').select('id').eq('id', params.id).eq('director_id', scope.directorId).single()
  if (!proyecto) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('proyecto_miembros')
    .select('*, profiles(id, nombre, rol)')
    .eq('proyecto_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify project belongs to this director
  const { data: proyecto } = await supabase.from('proyectos').select('id').eq('id', params.id).eq('director_id', scope.directorId).single()
  if (!proyecto) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { user_id, rol } = body

  // Verify the user being added belongs to this director's team
  if (!scope.teamIds.includes(user_id)) return NextResponse.json({ error: 'El usuario no pertenece a tu equipo' }, { status: 403 })

  const { data, error } = await supabase
    .from('proyecto_miembros')
    .insert({ proyecto_id: params.id, user_id, rol })
    .select('*, profiles(id, nombre, rol)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify project belongs to this director
  const { data: proyecto } = await supabase.from('proyectos').select('id').eq('id', params.id).eq('director_id', scope.directorId).single()
  if (!proyecto) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const memberId = url.searchParams.get('member_id')

  if (!memberId) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

  const { error } = await supabase
    .from('proyecto_miembros')
    .delete()
    .eq('id', memberId)
    .eq('proyecto_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
