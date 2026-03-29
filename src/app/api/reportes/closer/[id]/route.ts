import { createClient } from '@/lib/supabase/server'
import { getDirectorScope } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify the report belongs to a team member
  const { data: report } = await supabase.from('reportes_closer').select('closer_id').eq('id', params.id).single()
  if (!report || !scope.teamIds.includes(report.closer_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  delete body.id
  delete body.closer_id
  delete body.fecha
  delete body.enviado_at

  const { data, error } = await supabase
    .from('reportes_closer')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ report: data })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('reportes_closer')
    .select('*, profiles!closer_id(nombre)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Verify the report belongs to a team member
  if (!scope.teamIds.includes(data.closer_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ report: data })
}
