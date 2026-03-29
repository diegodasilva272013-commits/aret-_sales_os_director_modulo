import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LiquidacionesClient from './LiquidacionesClient'

export default async function LiquidacionesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'director') redirect('/')

  return <LiquidacionesClient />
}
