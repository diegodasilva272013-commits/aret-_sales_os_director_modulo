import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { getDirectorScope } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/tareas/[id]/adjuntos — list attachments
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()
  const { data, error } = await admin
    .from('tarea_adjuntos')
    .select('*')
    .eq('tarea_id', params.id)
    .eq('director_id', scope.directorId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/tareas/[id]/adjuntos — upload attachment
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Máximo 10MB' }, { status: 400 })
  }

  const admin = getAdmin()

  // Verify task belongs to director
  const { data: tarea } = await admin
    .from('tareas')
    .select('id')
    .eq('id', params.id)
    .eq('director_id', scope.directorId)
    .single()

  if (!tarea) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })

  const ext = file.name.split('.').pop() || 'bin'
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const storagePath = `${scope.directorId}/${params.id}/${safeName}`

  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('tarea-adjuntos')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = admin.storage.from('tarea-adjuntos').getPublicUrl(storagePath)

  const { data: adjunto, error: dbError } = await admin
    .from('tarea_adjuntos')
    .insert({
      tarea_id: params.id,
      director_id: scope.directorId,
      nombre: file.name,
      tipo_mime: file.type,
      tamano_bytes: file.size,
      storage_path: storagePath,
      url: urlData.publicUrl,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(adjunto)
}

// DELETE /api/tareas/[id]/adjuntos?adjuntoId=xxx
export async function DELETE(req: NextRequest, { params: _p }: { params: { id: string } }) {
  void _p
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adjuntoId = new URL(req.url).searchParams.get('adjuntoId')
  if (!adjuntoId) return NextResponse.json({ error: 'Missing adjuntoId' }, { status: 400 })

  const admin = getAdmin()

  const { data: adjunto } = await admin
    .from('tarea_adjuntos')
    .select('storage_path')
    .eq('id', adjuntoId)
    .eq('director_id', scope.directorId)
    .single()

  if (!adjunto) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await admin.storage.from('tarea-adjuntos').remove([adjunto.storage_path])
  await admin.from('tarea_adjuntos').delete().eq('id', adjuntoId)

  return NextResponse.json({ ok: true })
}
