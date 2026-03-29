import { createClient } from '@/lib/supabase/server'
import { getDirectorScope } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET: Obtener meta del mes
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const mes = searchParams.get('mes')

  if (mes) {
    const { data } = await supabase.from('metas_mes').select('*').eq('mes', mes).eq('director_id', scope.directorId).single()
    return NextResponse.json(data || null)
  }

  const { data } = await supabase.from('metas_mes').select('*').eq('director_id', scope.directorId).order('mes', { ascending: false })
  return NextResponse.json(data || [])
}

// POST: Crear o actualizar meta del mes
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { mes, meta_objetivo, costos_ads, costos_operativos } = body

  if (!mes || meta_objetivo == null) {
    return NextResponse.json({ error: 'mes y meta_objetivo son requeridos' }, { status: 400 })
  }

  // Upsert: si ya existe el mes para este director, actualiza
  const { data: existing } = await supabase.from('metas_mes').select('id').eq('mes', mes).eq('director_id', scope.directorId).single()

  if (existing) {
    const { data, error } = await supabase
      .from('metas_mes')
      .update({
        meta_objetivo: Number(meta_objetivo),
        costos_ads: Number(costos_ads || 0),
        costos_operativos: Number(costos_operativos || 0),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from('metas_mes')
    .insert({
      mes,
      meta_objetivo: Number(meta_objetivo),
      costos_ads: Number(costos_ads || 0),
      costos_operativos: Number(costos_operativos || 0),
      director_id: scope.directorId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
