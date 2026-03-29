import { createClient } from '@/lib/supabase/server'
import { getDirectorScope } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Only allow viewing own team members
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, nombre, telefono, foto_url, rol, activo, horario_inicio, horario_fin, dias_trabajo, notas, created_at')
    .eq('id', params.id)
    .eq('director_id', scope.directorId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: pagos } = await supabase
    .from('metodos_pago')
    .select('*')
    .eq('user_id', params.id)
    .order('created_at')

  const { data: memberships } = await supabase
    .from('proyecto_miembros')
    .select('proyecto_id, proyectos(id, nombre, activo)')
    .eq('user_id', params.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proyectos = (memberships || []).map((m: any) => m.proyectos).filter(Boolean)

  return NextResponse.json({ profile, pagos: pagos || [], proyectos })
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { nombre, apellido, telefono, rol, notas, foto_url, horario_inicio, horario_fin, dias_trabajo, proyectos_ids } = body

  // Only allow editing own team members
  const { error } = await supabase
    .from('profiles')
    .update({ nombre, apellido, telefono, rol, notas, foto_url, horario_inicio, horario_fin, dias_trabajo })
    .eq('id', params.id)
    .eq('director_id', scope.directorId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update project memberships if provided
  if (Array.isArray(proyectos_ids)) {
    await supabase.from('proyecto_miembros').delete().eq('user_id', params.id)
    if (proyectos_ids.length > 0) {
      await supabase.from('proyecto_miembros').insert(
        proyectos_ids.map((pid: string) => ({ user_id: params.id, proyecto_id: pid }))
      )
    }
  }

  return NextResponse.json({ success: true })
}
