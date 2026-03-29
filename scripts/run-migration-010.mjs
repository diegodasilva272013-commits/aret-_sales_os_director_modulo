import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Since we can't run DDL via REST, we use the service role key to:
// 1. Insert directly with new columns (they'll fail if columns don't exist)
// 2. Use the Supabase dashboard SQL editor for DDL

// Let's check what we CAN do via the service role key
// The service role bypasses RLS

async function main() {
  console.log('🔧 Ejecutando migración via API...\n')

  // Test existing tables
  const tables = ['ventas', 'audio_notas']
  for (const t of tables) {
    const { error } = await sb.from(t).select('id').limit(0)
    if (error) {
      console.log(`❌ Tabla ${t}: NO existe (${error.message.slice(0, 50)})`)
    } else {
      console.log(`✅ Tabla ${t}: existe`)
    }
  }

  // Test new columns on existing tables
  console.log('\n📋 Verificando columnas en clientes_cartera...')
  const { data: cl, error: clErr } = await sb.from('clientes_cartera').select('producto, fecha_acuerdo, medio_pago, tipo_pago, responsable_id').limit(1)
  if (clErr) {
    console.log('  ❌ Columnas nuevas NO existen:', clErr.message.slice(0, 80))
  } else {
    console.log('  ✅ Columnas nuevas existen')
  }

  console.log('\n📋 Verificando columna medio_pago en transacciones...')
  const { data: tx, error: txErr } = await sb.from('transacciones').select('medio_pago, venta_id').limit(1)
  if (txErr) {
    console.log('  ❌ Columnas nuevas NO existen:', txErr.message.slice(0, 80))
  } else {
    console.log('  ✅ Columnas nuevas existen')
  }

  console.log('\n' + '═'.repeat(50))
  console.log('⚠️  Las tablas nuevas (ventas, audio_notas) necesitan')
  console.log('    ejecutarse manualmente en el Supabase Dashboard')
  console.log('    SQL Editor con el contenido de:')
  console.log('    supabase/migrations/010_expansion.sql')
  console.log('═'.repeat(50))
}

main()
