import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('metodos_pago')
    .select('*')
    .eq('user_id', params.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requester } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (requester?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { tipo, datos, titular, principal } = body

  const { data, error } = await supabase
    .from('metodos_pago')
    .insert({ user_id: params.id, tipo, datos, titular, principal: principal || false })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requester } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (requester?.rol !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { pago_id } = await request.json()
  // Ensure the pago belongs to this user
  const { error } = await supabase.from('metodos_pago').delete().eq('id', pago_id).eq('user_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
