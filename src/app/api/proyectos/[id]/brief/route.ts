import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function checkAccess(proyectoId: string): Promise<{ allowed: boolean; userId?: string; rol?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { allowed: false }

  // Check profile role
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!profile) return { allowed: false }

  // Directors have full access
  if (profile.rol === 'director') return { allowed: true, userId: user.id, rol: profile.rol }

  // Other users: must be a project member
  const { data: membership } = await supabase
    .from('proyecto_miembros')
    .select('id')
    .eq('proyecto_id', proyectoId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return { allowed: false }
  return { allowed: true, userId: user.id, rol: profile.rol }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await checkAccess(params.id)
  if (!access.allowed) {
    return NextResponse.json({ error: 'No tienes acceso a este brief' }, { status: 403 })
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from('project_briefs')
    .select('*')
    .eq('proyecto_id', params.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch project info
  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id, nombre, tipo, empresa')
    .eq('id', params.id)
    .single()

  // Fetch comisiones
  const { data: comisiones } = await supabase
    .from('comisiones_proyecto')
    .select('*')
    .eq('proyecto_id', params.id)
    .single()

  return NextResponse.json({ brief: data || null, proyecto: proyecto || null, comisiones: comisiones || null })
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await checkAccess(params.id)
  if (!access.allowed) {
    return NextResponse.json({ error: 'No tienes acceso a este brief' }, { status: 403 })
  }

  // Only directors can edit briefs
  if (access.rol !== 'director') {
    return NextResponse.json({ error: 'Solo el director puede editar el brief' }, { status: 403 })
  }

  const supabase = createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('project_briefs')
    .upsert({ ...body, proyecto_id: params.id, updated_at: new Date().toISOString() }, { onConflict: 'proyecto_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
