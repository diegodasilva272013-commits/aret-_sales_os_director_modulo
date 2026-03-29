import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requesterProfile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (requesterProfile?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, telefono, foto_url, rol, activo, horario_inicio, horario_fin, dias_trabajo, notas, created_at')
    .order('nombre')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ profiles: data })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requesterProfile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (requesterProfile?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { nombre, apellido, email, password, rol, telefono } = await request.json()

  // Use admin client to create user
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) return NextResponse.json({ error: createError.message }, { status: 500 })

  const { error: profileError } = await adminSupabase.from('profiles').insert({
    id: newUser.user.id,
    nombre,
    apellido: apellido || null,
    telefono: telefono || null,
    rol,
    activo: true,
  })

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  return NextResponse.json({ success: true, userId: newUser.user.id })
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requesterProfile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (requesterProfile?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, activo } = await request.json()

  const { error } = await supabase.from('profiles').update({ activo }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
