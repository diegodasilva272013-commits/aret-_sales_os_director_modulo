import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Verifica que el usuario actual sea director y retorna su ID + los IDs de su equipo.
 * Retorna null si no es director.
 */
export async function getDirectorScope(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profile?.rol !== 'director') return null

  // Obtener IDs de los miembros del equipo de este director
  const { data: team } = await supabase
    .from('profiles')
    .select('id')
    .eq('director_id', user.id)

  const teamIds = (team || []).map((p: { id: string }) => p.id)

  return {
    directorId: user.id,
    teamIds,
    allIds: [user.id, ...teamIds], // director + equipo
  }
}
