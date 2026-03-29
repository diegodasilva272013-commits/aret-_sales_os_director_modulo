import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EquipoClient from './EquipoClient'

export default async function EquipoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'director') redirect('/')

  return <EquipoClient />
}
