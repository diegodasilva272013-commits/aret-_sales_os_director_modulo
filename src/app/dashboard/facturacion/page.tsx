import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FacturacionClient from './FacturacionClient'

export default async function FacturacionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'director') redirect('/')

  return <FacturacionClient />
}
