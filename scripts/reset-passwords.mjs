import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Listar todos los usuarios
const { data, error } = await supabase.auth.admin.listUsers()
if (error) { console.error('Error listando usuarios:', error); process.exit(1) }

console.log('Usuarios en Auth:')
for (const u of data.users) {
  console.log(` - ${u.email} (${u.id})`)
}

// Resetear password de los 5 usuarios demo
const emails = ['director@demo.com','setter1@demo.com','setter2@demo.com','closer1@demo.com','closer2@demo.com']

for (const u of data.users) {
  if (emails.includes(u.email)) {
    const { error: err } = await supabase.auth.admin.updateUserById(u.id, {
      password: 'Demo1234!',
      email_confirm: true,
    })
    if (err) console.error(`❌ ${u.email}:`, err.message)
    else console.log(`✅ Password reseteado: ${u.email}`)
  }
}
