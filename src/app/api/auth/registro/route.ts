import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { nombre, apellido, email, password } = await request.json()

  if (!nombre || !email || !password) {
    return NextResponse.json({ error: 'Nombre, email y contraseña son obligatorios' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Create auth user
  const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    if (createError.message.includes('already been registered')) {
      // Check if this is an orphan auth user (has auth but no profile)
      // This happens when a previous registration was interrupted
      const { data: { users } } = await adminSupabase.auth.admin.listUsers()
      const existingUser = users?.find(u => u.email === email)

      if (existingUser) {
        const { data: existingProfile } = await adminSupabase
          .from('profiles')
          .select('id')
          .eq('id', existingUser.id)
          .single()

        if (!existingProfile) {
          // Orphan user: delete and let them re-register cleanly
          await adminSupabase.auth.admin.deleteUser(existingUser.id)

          // Retry creating the user
          const { data: retryUser, error: retryError } = await adminSupabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          })

          if (retryError) {
            return NextResponse.json({ error: retryError.message }, { status: 500 })
          }

          const { error: retryProfileError } = await adminSupabase.from('profiles').insert({
            id: retryUser.user.id,
            nombre,
            apellido: apellido || null,
            rol: 'director',
            activo: true,
            director_id: retryUser.user.id,
          })

          if (retryProfileError) {
            await adminSupabase.auth.admin.deleteUser(retryUser.user.id)
            return NextResponse.json({ error: retryProfileError.message }, { status: 500 })
          }

          return NextResponse.json({ success: true })
        }
      }

      return NextResponse.json(
        { error: 'Este email ya está registrado. Probá iniciar sesión.', code: 'EMAIL_EXISTS' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // Create profile as director with director_id = self
  const { error: profileError } = await adminSupabase.from('profiles').insert({
    id: newUser.user.id,
    nombre,
    apellido: apellido || null,
    rol: 'director',
    activo: true,
    director_id: newUser.user.id,
  })

  if (profileError) {
    // Rollback: delete the auth user if profile creation fails
    await adminSupabase.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
