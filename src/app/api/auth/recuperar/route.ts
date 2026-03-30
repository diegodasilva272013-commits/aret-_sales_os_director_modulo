import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { email } = await request.json()

  if (!email) {
    return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 })
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Build the redirect URL dynamically from the request
  const origin = request.headers.get('origin') || request.nextUrl.origin
  const redirectTo = `${origin}/reset-password`

  const { error } = await adminSupabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Always return success to avoid email enumeration
  return NextResponse.json({ success: true })
}
