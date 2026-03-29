import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Since we can't run DDL directly via PostgREST, we'll use the 
// pg_net extension or create a temporary function approach.
// Actually the simplest way is to use the Supabase HTTP SQL endpoint

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/pg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  
  if (!res.ok) {
    // Try the /sql endpoint
    const res2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ name: '' }),
    })
    return { error: `HTTP ${res.status}` }
  }
  return await res.json()
}

async function main() {
  console.log('🔧 Ejecutando migración 010...\n')

  // Strategy: Create a temporary plpgsql function that runs our DDL
  // then call it via RPC, then drop it

  // Step 1: Create the function
  // We'll create it by inserting into a helper approach
  // Actually, we can use the supabase-js `.rpc()` with a custom function
  
  // Let's try a different approach: create function via PostgREST
  // This won't work either since PostgREST doesn't support DDL
  
  // Best approach: Use the database connection string with psql or pg
  // Since we don't have that, let's use the Supabase DB query HTTP API
  
  // Actually the correct endpoint is:
  const sqlStatements = [
    // Extend roles
    `ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_rol_check`,
    `ALTER TABLE profiles ADD CONSTRAINT profiles_rol_check CHECK (rol IN ('setter', 'closer', 'director', 'lider_ventas', 'cold_caller', 'trasher'))`,
    
    // Create ventas table
    `CREATE TABLE IF NOT EXISTS ventas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      fecha date NOT NULL DEFAULT current_date,
      proyecto_id uuid REFERENCES proyectos(id),
      closer_id uuid REFERENCES profiles(id),
      setter_id uuid REFERENCES profiles(id),
      cliente_nombre text NOT NULL,
      cliente_documento text,
      cliente_id uuid REFERENCES clientes_cartera(id),
      producto text,
      monto numeric(14,2) NOT NULL,
      medio_pago text,
      tipo_pago text DEFAULT 'contado',
      cantidad_cuotas integer DEFAULT 1,
      observaciones text,
      comprobante_url text,
      comprobante_validado boolean DEFAULT false,
      validado_por uuid REFERENCES profiles(id),
      validado_en timestamptz,
      estado text DEFAULT 'pendiente_comprobante',
      reporte_closer_id uuid,
      reporte_setter_id uuid,
      creado_en timestamptz DEFAULT now(),
      actualizado_en timestamptz DEFAULT now()
    )`,
    
    // Create audio_notas table
    `CREATE TABLE IF NOT EXISTS audio_notas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entidad_tipo text NOT NULL,
      entidad_id uuid,
      audio_url text NOT NULL,
      duracion_segundos integer,
      transcripcion text,
      titulo text,
      usuario_id uuid REFERENCES profiles(id) NOT NULL,
      creado_en timestamptz DEFAULT now(),
      actualizado_en timestamptz DEFAULT now()
    )`,
    
    // Add columns to clientes_cartera
    `ALTER TABLE clientes_cartera ADD COLUMN IF NOT EXISTS producto text`,
    `ALTER TABLE clientes_cartera ADD COLUMN IF NOT EXISTS fecha_acuerdo date`,
    `ALTER TABLE clientes_cartera ADD COLUMN IF NOT EXISTS medio_pago text`,
    `ALTER TABLE clientes_cartera ADD COLUMN IF NOT EXISTS tipo_pago text DEFAULT 'cuotas'`,
    `ALTER TABLE clientes_cartera ADD COLUMN IF NOT EXISTS responsable_id uuid REFERENCES profiles(id)`,
    
    // Add columns to transacciones
    `ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS medio_pago text`,
    `ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS venta_id uuid REFERENCES ventas(id)`,
  ]

  // Try using the SQL API endpoint
  for (const sql of sqlStatements) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_migration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ sql_text: sql }),
      })
      if (res.ok) {
        console.log(`✅ ${sql.slice(0, 60)}...`)
      } else {
        const err = await res.text()
        console.log(`❌ ${sql.slice(0, 60)}... → ${err.slice(0, 80)}`)
      }
    } catch (e) {
      console.log(`❌ ${sql.slice(0, 60)}... → ${e.message}`)
    }
  }
}

main()
