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
    .from('comisiones_proyecto')
    .select('*')
    .eq('proyecto_id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify project belongs to this director
  const { data: proyecto } = await supabase.from('proyectos').select('id').eq('id', params.id).eq('director_id', scope.directorId).single()
  if (!proyecto) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const {
    setter_base_mensual,
    setter_por_cita_show_calificada,
    setter_por_venta_cerrada,
    closer_comision_porcentaje,
    closer_bonus_cierre,
    closer_bonus_tasa_minima,
    closer_penalidad_impago_porcentaje,
    closer_dias_penalidad,
  } = body

  const { data, error } = await supabase
    .from('comisiones_proyecto')
    .upsert({
      proyecto_id: params.id,
      setter_base_mensual,
      setter_por_cita_show_calificada,
      setter_por_venta_cerrada,
      closer_comision_porcentaje,
      closer_bonus_cierre,
      closer_bonus_tasa_minima,
      closer_penalidad_impago_porcentaje,
      closer_dias_penalidad,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'proyecto_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
