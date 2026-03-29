import { createClient } from '@/lib/supabase/server'
import { getDirectorScope } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET: Obtener reglas de comisión
export async function GET() {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('reglas_comision')
    .select('*')
    .eq('director_id', scope.directorId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST: Crear nueva regla
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { nombre, rol, tramos, activa } = body

  if (!nombre || !rol || !Array.isArray(tramos) || tramos.length === 0) {
    return NextResponse.json({ error: 'nombre, rol y tramos son requeridos' }, { status: 400 })
  }

  for (const t of tramos) {
    if (typeof t.desde !== 'number' || typeof t.hasta !== 'number' || typeof t.porcentaje !== 'number') {
      return NextResponse.json({ error: 'Cada tramo debe tener desde, hasta y porcentaje numéricos' }, { status: 400 })
    }
    if (t.porcentaje < 0 || t.porcentaje > 100) {
      return NextResponse.json({ error: 'Porcentaje debe estar entre 0 y 100' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('reglas_comision')
    .insert({
      nombre,
      rol,
      tramos,
      activa: activa !== false,
      director_id: scope.directorId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT: Actualizar regla
export async function PUT(request: NextRequest) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 })

  if (updates.tramos) {
    if (!Array.isArray(updates.tramos) || updates.tramos.length === 0) {
      return NextResponse.json({ error: 'tramos debe ser un array no vacío' }, { status: 400 })
    }
    for (const t of updates.tramos) {
      if (typeof t.desde !== 'number' || typeof t.hasta !== 'number' || typeof t.porcentaje !== 'number') {
        return NextResponse.json({ error: 'Cada tramo debe tener desde, hasta y porcentaje numéricos' }, { status: 400 })
      }
    }
  }

  const { data, error } = await supabase
    .from('reglas_comision')
    .update(updates)
    .eq('id', id)
    .eq('director_id', scope.directorId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE: Eliminar regla
export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 })

  const { error } = await supabase.from('reglas_comision').delete().eq('id', id).eq('director_id', scope.directorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
