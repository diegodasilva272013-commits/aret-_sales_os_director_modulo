import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const users = [
  { email: 'director@demo.com', nombre: 'Director Demo',  rol: 'director' },
  { email: 'setter1@demo.com',  nombre: 'María Setter',   rol: 'setter'   },
  { email: 'setter2@demo.com',  nombre: 'Carlos Setter',  rol: 'setter'   },
  { email: 'closer1@demo.com',  nombre: 'Lucas Closer',   rol: 'closer'   },
  { email: 'closer2@demo.com',  nombre: 'Sofía Closer',   rol: 'closer'   },
]

for (const user of users) {
  // Crear usuario en Auth
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: 'Demo1234!',
    email_confirm: true,
  })

  if (error) {
    if (error.message.includes('already been registered')) {
      console.log(`⚠️  Ya existe: ${user.email}`)
      // Buscar el ID existente
      const { data: list } = await supabase.auth.admin.listUsers()
      const existing = list?.users?.find(u => u.email === user.email)
      if (existing) {
        await supabase.from('profiles').upsert({
          id: existing.id, nombre: user.nombre, rol: user.rol, activo: true
        })
        console.log(`✅ Profile actualizado: ${user.email} → ${user.rol}`)
      }
    } else {
      console.error(`❌ Error ${user.email}:`, error.message)
    }
    continue
  }

  // Crear profile
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: data.user.id, nombre: user.nombre, rol: user.rol, activo: true
  })

  if (profileError) {
    console.error(`❌ Profile error ${user.email}:`, profileError.message)
  } else {
    console.log(`✅ Creado: ${user.email} → ${user.rol}`)
  }
}

console.log('\n✅ Listo. Password de todos: Demo1234!')
