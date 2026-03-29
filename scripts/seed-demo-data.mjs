import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rsljkwgdyrfafkmltyou.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Helpers ──────────────────────────────────────────────
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick(arr) { return arr[rand(0, arr.length - 1)] }
function money(min, max) { return Math.round((Math.random() * (max - min) + min) * 100) / 100 }
function dateStr(d) { return d.toISOString().slice(0, 10) }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// ── Get existing users ──────────────────────────────────
async function getProfiles() {
  const { data, error } = await supabase.from('profiles').select('*')
  if (error) throw new Error('No se pudieron obtener profiles: ' + error.message)
  return data
}

async function main() {
  console.log('🚀 Iniciando seed de datos de demostración...\n')

  const profiles = await getProfiles()
  const director = profiles.find(p => p.rol === 'director')
  const setters  = profiles.filter(p => p.rol === 'setter')
  const closers  = profiles.filter(p => p.rol === 'closer')

  if (!director || setters.length === 0 || closers.length === 0) {
    console.error('❌ Faltan usuarios. Ejecuta primero: node scripts/create-users.mjs')
    process.exit(1)
  }

  console.log(`👤 Director: ${director.nombre}`)
  console.log(`📞 Setters:  ${setters.map(s => s.nombre).join(', ')}`)
  console.log(`💼 Closers:  ${closers.map(c => c.nombre).join(', ')}\n`)

  // ══════════════════════════════════════════════════════
  // 1. PROYECTOS
  // ══════════════════════════════════════════════════════
  console.log('📁 Creando proyectos...')
  const proyectosData = [
    { nombre: 'Curso Liderazgo 360', empresa: 'Academia Élite', descripcion: 'Programa de liderazgo ejecutivo 12 semanas', tipo: 'evergreen', activo: true },
    { nombre: 'Mentoring Negocios', empresa: 'BizGrow Latam', descripcion: 'Mentoría grupal para emprendedores', tipo: 'evergreen', activo: true },
    { nombre: 'Lanzamiento Método X', empresa: 'MetodoX Corp', descripcion: 'Lanzamiento intensivo método de ventas', tipo: 'lanzamiento', activo: true },
  ]

  const { data: proyectos, error: pErr } = await supabase
    .from('proyectos').upsert(proyectosData, { onConflict: 'nombre' }).select()
  if (pErr) {
    // Try insert instead
    const { data: p2, error: p2Err } = await supabase.from('proyectos').insert(proyectosData).select()
    if (p2Err) { console.error('  ❌ Error proyectos:', p2Err.message); return }
    var proyectosResult = p2
  } else {
    var proyectosResult = proyectos
  }
  console.log(`  ✅ ${proyectosResult.length} proyectos creados`)

  // ══════════════════════════════════════════════════════
  // 2. MIEMBROS DE PROYECTO
  // ══════════════════════════════════════════════════════
  console.log('👥 Asignando miembros a proyectos...')
  const miembros = []
  for (const proy of proyectosResult) {
    for (const s of setters) {
      miembros.push({ proyecto_id: proy.id, user_id: s.id, rol: 'setter', activo: true })
    }
    for (const c of closers) {
      miembros.push({ proyecto_id: proy.id, user_id: c.id, rol: 'closer', activo: true })
    }
  }
  const { error: mErr } = await supabase.from('proyecto_miembros').upsert(miembros, { onConflict: 'proyecto_id,user_id' })
  if (mErr) console.error('  ⚠️  Miembros:', mErr.message)
  else console.log(`  ✅ ${miembros.length} asignaciones`)

  // ══════════════════════════════════════════════════════
  // 3. COMISIONES POR PROYECTO
  // ══════════════════════════════════════════════════════
  console.log('💰 Configurando comisiones por proyecto...')
  const comisionesProyecto = proyectosResult.map((p, i) => ({
    proyecto_id: p.id,
    setter_base_mensual: [500, 600, 400][i] || 500,
    setter_por_cita_show_calificada: [25, 30, 20][i] || 25,
    setter_por_venta_cerrada: [75, 100, 50][i] || 75,
    closer_comision_porcentaje: [8, 10, 12][i] || 8,
    closer_bonus_cierre: [500, 750, 1000][i] || 500,
    closer_bonus_tasa_minima: 40,
    closer_penalidad_impago_porcentaje: 50,
    closer_dias_penalidad: 30,
  }))
  const { error: cpErr } = await supabase.from('comisiones_proyecto').upsert(comisionesProyecto, { onConflict: 'proyecto_id' })
  if (cpErr) console.error('  ⚠️  Comisiones proyecto:', cpErr.message)
  else console.log(`  ✅ ${comisionesProyecto.length} configs`)

  // ══════════════════════════════════════════════════════
  // 4. REPORTES SETTER (últimos 30 días)
  // ══════════════════════════════════════════════════════
  console.log('📊 Generando reportes setter...')
  const hoy = new Date()
  const reportesSetter = []

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const fecha = dateStr(addDays(hoy, -dayOffset))
    const dow = addDays(hoy, -dayOffset).getDay()
    if (dow === 0) continue // skip sundays

    for (const setter of setters) {
      const proy = pick(proyectosResult)
      const leads = rand(8, 25)
      const contactados = rand(Math.floor(leads * 0.4), Math.floor(leads * 0.8))
      const citas_agendadas = rand(Math.floor(contactados * 0.3), Math.floor(contactados * 0.7))
      const citas_show = rand(Math.floor(citas_agendadas * 0.5), citas_agendadas)
      const citas_noshow = citas_agendadas - citas_show
      const citas_calificadas = rand(Math.floor(citas_show * 0.6), citas_show)

      reportesSetter.push({
        setter_id: setter.id,
        fecha,
        proyecto_id: proy.id,
        leads_recibidos: leads,
        intentos_contacto: rand(leads, leads * 2),
        contactados,
        citas_agendadas,
        citas_show,
        citas_noshow,
        citas_reprogramadas: rand(0, 3),
        citas_calificadas,
        motivos_noshow: citas_noshow > 0 ? pick(['No atendió', 'Canceló última hora', 'Error de agenda', 'Se olvidó']) : null,
        comentario: pick([
          'Buen día, leads de calidad',
          'Leads fríos hoy',
          'Excelente respuesta a la campaña',
          'Varios no-show, seguir insistiendo',
          'Buena tasa de calificación',
          null
        ]),
        tipo_proyecto: proy.tipo,
        asistio_reunion: rand(0, 1) === 1,
        nota_reunion: pick(['Revisamos métricas semanales', 'Daily normal', null, null]),
        mensajes_enviados: rand(20, 80),
        respuestas_obtenidas: rand(5, 30),
        conversaciones_activas: rand(3, 15),
        leads_calificados_chat: rand(1, 8),
        llamadas_agendadas_dm: rand(0, 5),
      })
    }
  }

  // Insert in batches
  for (let i = 0; i < reportesSetter.length; i += 50) {
    const batch = reportesSetter.slice(i, i + 50)
    const { error } = await supabase.from('reportes_setter').insert(batch)
    if (error) { console.error('  ⚠️  Batch setter:', error.message); break }
  }
  console.log(`  ✅ ${reportesSetter.length} reportes setter`)

  // ══════════════════════════════════════════════════════
  // 5. REPORTES CLOSER (últimos 30 días)
  // ══════════════════════════════════════════════════════
  console.log('📊 Generando reportes closer...')
  const reportesCloser = []
  const motivosList = ['precio', 'consultar', 'momento', 'competencia', 'otro']

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const fecha = dateStr(addDays(hoy, -dayOffset))
    const dow = addDays(hoy, -dayOffset).getDay()
    if (dow === 0) continue

    for (const closer of closers) {
      const proy = pick(proyectosResult)
      const citas_recibidas = rand(3, 8)
      const citas_show = rand(Math.floor(citas_recibidas * 0.6), citas_recibidas)
      const citas_noshow = citas_recibidas - citas_show
      const ventas_cerradas = rand(0, Math.min(citas_show, 4))
      const ventas_no_cerradas = citas_show - ventas_cerradas
      const monto_por_venta = pick([1500, 2000, 2500, 3000, 3500, 5000])
      const monto_cerrado = ventas_cerradas * monto_por_venta
      const pagos_completos = rand(0, ventas_cerradas)
      const pagos_parciales = rand(0, ventas_cerradas - pagos_completos)
      const pagos_nulo = ventas_cerradas - pagos_completos - pagos_parciales
      const monto_cobrado = pagos_completos * monto_por_venta + pagos_parciales * Math.round(monto_por_venta * 0.5)

      // Distribuir motivos no-cierre en columnas individuales
      const motivoCounts = { precio: 0, consultar: 0, momento: 0, competencia: 0, otro: 0 }
      for (let m = 0; m < ventas_no_cerradas; m++) {
        const motivo = pick(motivosList)
        motivoCounts[motivo]++
      }

      const detalleVentas = []
      for (let v = 0; v < ventas_cerradas; v++) {
        detalleVentas.push({
          cliente: pick(['Juan Pérez', 'Ana García', 'Roberto Lima', 'Laura Méndez', 'Pedro Sánchez',
            'María López', 'Carlos Ruiz', 'Lucía Martín', 'Diego Torres', 'Valentina Cruz']),
          monto: monto_por_venta,
          tipo_pago: pick(['completo', 'parcial', 'plan_cuotas']),
        })
      }

      reportesCloser.push({
        closer_id: closer.id,
        fecha,
        proyecto_id: proy.id,
        citas_recibidas,
        citas_show,
        citas_noshow,
        ventas_cerradas,
        ventas_no_cerradas,
        pagos_completos,
        pagos_parciales,
        pagos_nulo,
        monto_total_cerrado: monto_cerrado,
        monto_cobrado,
        monto_pendiente: monto_cerrado - monto_cobrado,
        detalle_ventas: detalleVentas,
        motivo_precio: motivoCounts.precio,
        motivo_consultar: motivoCounts.consultar,
        motivo_momento: motivoCounts.momento,
        motivo_competencia: motivoCounts.competencia,
        motivo_otro: motivoCounts.otro,
        tipo_proyecto: proy.tipo,
        asistio_reunion: rand(0, 1) === 1,
        nota_reunion: pick(['Revisamos pipeline', 'Ajustamos estrategia', null, null]),
        propuestas_enviadas: rand(citas_show, citas_show + 3),
        seguimientos_realizados: rand(2, 10),
        conversaciones_cerradas: ventas_cerradas + rand(0, 2),
        tiempo_respuesta_avg: rand(5, 60),
        objeciones_resueltas: rand(1, 6),
      })
    }
  }

  for (let i = 0; i < reportesCloser.length; i += 50) {
    const batch = reportesCloser.slice(i, i + 50)
    const { error } = await supabase.from('reportes_closer').insert(batch)
    if (error) { console.error('  ⚠️  Batch closer:', error.message); break }
  }
  console.log(`  ✅ ${reportesCloser.length} reportes closer`)

  // ══════════════════════════════════════════════════════
  // 6. CLIENTES CARTERA (25 clientes con cuotas)
  // ══════════════════════════════════════════════════════
  console.log('🧾 Creando clientes en cartera...')
  const nombresClientes = [
    'Alejandro Martínez', 'Isabella Rodríguez', 'Sebastián López', 'Valentina García',
    'Mateo Hernández', 'Camila Pérez', 'Santiago Gómez', 'Luciana Díaz',
    'Nicolás Torres', 'Florencia Romero', 'Emiliano Vargas', 'Julieta Morales',
    'Tomás Jiménez', 'Renata Ruiz', 'Benjamín Ortiz', 'Antonella Silva',
    'Felipe Castro', 'Martina Medina', 'Joaquín Herrera', 'Catalina Rojas',
    'Daniel Núñez', 'Victoria Arias', 'Maximiliano Vega', 'Sofía Campos',
    'Gabriel Reyes',
  ]

  const fuentes = ['Instagram Ads', 'Facebook Ads', 'Google Ads', 'Orgánico', 'Referido', 'YouTube', 'TikTok']
  const campanas = ['Campaña Marzo', 'Campaña Febrero', 'Lanzamiento Q1', 'Evergreen Principal', 'Retargeting']
  const canales = ['WhatsApp', 'DM Instagram', 'Llamada', 'Email', 'Zoom']
  const estados = ['activo', 'activo', 'activo', 'vencido', 'pagado'] // weighted

  const clientesData = nombresClientes.map((nombre, i) => ({
    nombre_cliente: nombre,
    documento: `${20000000 + i * 1234567}`,
    closer_id: pick(closers).id,
    setter_id: pick(setters).id,
    monto_referencia: pick([1500, 2000, 2500, 3000, 3500, 5000, 7500, 10000]),
    estado: pick(estados),
    notas: pick([
      'Cliente muy interesado, decidió rápido',
      'Necesitó seguimiento, cerró en segunda llamada',
      'Pagó de contado',
      'Plan de 3 cuotas',
      'Plan de 6 cuotas',
      'Referido de otro cliente',
      null, null,
    ]),
    fuente: pick(fuentes),
    campana: pick(campanas),
    canal: pick(canales),
  }))

  const { data: clientes, error: clErr } = await supabase.from('clientes_cartera').insert(clientesData).select()
  if (clErr) { console.error('  ❌ Error clientes:', clErr.message); return }
  console.log(`  ✅ ${clientes.length} clientes creados`)

  // ══════════════════════════════════════════════════════
  // 7. CUOTAS para cada cliente
  // ══════════════════════════════════════════════════════
  console.log('📅 Generando cuotas...')
  const todasCuotas = []

  for (const cli of clientes) {
    const numCuotas = cli.monto_referencia >= 5000 ? rand(3, 6) : rand(1, 3)
    const montoCuota = Math.round(cli.monto_referencia / numCuotas)
    const fechaInicio = addDays(hoy, -rand(10, 60))

    for (let c = 1; c <= numCuotas; c++) {
      const fechaVenc = addDays(fechaInicio, (c - 1) * 30)
      const vencida = fechaVenc < hoy
      let estado = 'pendiente'
      let fecha_pago = null
      let monto_pagado = 0

      if (cli.estado === 'pagado') {
        estado = 'pagada'
        fecha_pago = dateStr(addDays(fechaVenc, -rand(0, 5)))
        monto_pagado = montoCuota
      } else if (vencida && rand(0, 10) > 3) {
        estado = 'pagada'
        fecha_pago = dateStr(addDays(fechaVenc, rand(0, 3)))
        monto_pagado = montoCuota
      } else if (vencida) {
        estado = 'vencida'
      }

      todasCuotas.push({
        cliente_id: cli.id,
        numero_cuota: c,
        monto: montoCuota,
        fecha_vencimiento: dateStr(fechaVenc),
        fecha_pago,
        estado,
        monto_pagado,
      })
    }
  }

  const { data: cuotasInserted, error: cuErr } = await supabase.from('cuotas').insert(todasCuotas).select()
  if (cuErr) console.error('  ⚠️  Cuotas:', cuErr.message)
  else console.log(`  ✅ ${cuotasInserted.length} cuotas generadas`)

  // ══════════════════════════════════════════════════════
  // 8. TRANSACCIONES para cuotas pagadas
  // ══════════════════════════════════════════════════════
  console.log('💳 Generando transacciones...')
  const transacciones = []
  const cuotasPagadas = (cuotasInserted || []).filter(c => c.estado === 'pagada')

  for (const cuota of cuotasPagadas) {
    const cli = clientes.find(c => c.id === cuota.cliente_id)
    transacciones.push({
      cliente_id: cuota.cliente_id,
      cuota_id: cuota.id,
      monto: cuota.monto_pagado || cuota.monto,
      tipo: 'ingreso',
      descripcion: `Pago cuota ${cuota.numero_cuota} - ${cli?.nombre_cliente || 'Cliente'}`,
      fecha: cuota.fecha_pago || dateStr(hoy),
    })
  }

  // Agregar algunos egresos
  const egresos = [
    { monto: 1500, tipo: 'egreso', descripcion: 'Facebook Ads - Semana 1 Marzo', fecha: dateStr(addDays(hoy, -21)) },
    { monto: 1200, tipo: 'egreso', descripcion: 'Instagram Ads - Semana 2 Marzo', fecha: dateStr(addDays(hoy, -14)) },
    { monto: 800, tipo: 'egreso', descripcion: 'Google Ads - Semana 3 Marzo', fecha: dateStr(addDays(hoy, -7)) },
    { monto: 2000, tipo: 'egreso', descripcion: 'Facebook Ads - Semana 4 Marzo', fecha: dateStr(addDays(hoy, -3)) },
    { monto: 450, tipo: 'egreso', descripcion: 'Herramientas (CRM, Zoom, etc)', fecha: dateStr(addDays(hoy, -5)) },
    { monto: 350, tipo: 'egreso', descripcion: 'Diseño gráfico freelance', fecha: dateStr(addDays(hoy, -10)) },
  ]
  transacciones.push(...egresos)

  // Un reembolso
  if (cuotasPagadas.length > 3) {
    const cuotaReembolso = cuotasPagadas[2]
    const cliR = clientes.find(c => c.id === cuotaReembolso.cliente_id)
    transacciones.push({
      cliente_id: cuotaReembolso.cliente_id,
      cuota_id: cuotaReembolso.id,
      monto: cuotaReembolso.monto,
      tipo: 'reembolso',
      descripcion: `Reembolso cuota ${cuotaReembolso.numero_cuota} - ${cliR?.nombre_cliente || 'Cliente'}`,
      fecha: dateStr(addDays(hoy, -2)),
    })
  }

  for (let i = 0; i < transacciones.length; i += 50) {
    const batch = transacciones.slice(i, i + 50)
    const { error } = await supabase.from('transacciones').insert(batch)
    if (error) { console.error('  ⚠️  Batch transacciones:', error.message); break }
  }
  console.log(`  ✅ ${transacciones.length} transacciones (${cuotasPagadas.length} ingresos, ${egresos.length} egresos, 1 reembolso)`)

  // ══════════════════════════════════════════════════════
  // 9. COMISIONES PENDIENTES
  // ══════════════════════════════════════════════════════
  console.log('⏳ Generando comisiones pendientes...')
  const comisionesPendientes = []

  for (const cuota of cuotasPagadas.slice(0, 15)) {
    const cli = clientes.find(c => c.id === cuota.cliente_id)
    if (!cli) continue

    // Comisión closer
    comisionesPendientes.push({
      cuota_id: cuota.id,
      usuario_id: cli.closer_id,
      rol: 'closer',
      monto_base: cuota.monto,
      porcentaje_aplicado: 8,
      monto_comision: Math.round(cuota.monto * 0.08 * 100) / 100,
      estado: pick(['pendiente', 'disponible', 'disponible', 'liquidada']),
      disponible_en: dateStr(addDays(new Date(cuota.fecha_pago || hoy), 7)),
    })

    // Comisión setter
    comisionesPendientes.push({
      cuota_id: cuota.id,
      usuario_id: cli.setter_id,
      rol: 'setter',
      monto_base: cuota.monto,
      porcentaje_aplicado: 3,
      monto_comision: Math.round(cuota.monto * 0.03 * 100) / 100,
      estado: pick(['pendiente', 'disponible', 'disponible', 'liquidada']),
      disponible_en: dateStr(addDays(new Date(cuota.fecha_pago || hoy), 7)),
    })
  }

  const { error: cpendErr } = await supabase.from('comisiones_pendientes').insert(comisionesPendientes)
  if (cpendErr) console.error('  ⚠️  Comisiones pendientes:', cpendErr.message)
  else console.log(`  ✅ ${comisionesPendientes.length} comisiones pendientes`)

  // ══════════════════════════════════════════════════════
  // 10. DISTRIBUCIÓN DE PAGOS
  // ══════════════════════════════════════════════════════
  console.log('📦 Generando distribución de pagos...')
  const distribuciones = []

  // Get transacciones de ingreso insertadas
  const { data: txIngreso } = await supabase
    .from('transacciones').select('id, cuota_id, monto').eq('tipo', 'ingreso').limit(20)

  for (const tx of (txIngreso || [])) {
    if (!tx.cuota_id) continue
    const monto = tx.monto
    const comCloser = Math.round(monto * 0.08 * 100) / 100
    const comSetter = Math.round(monto * 0.03 * 100) / 100
    const costoAds = Math.round(monto * 0.12 * 100) / 100
    const costoOps = Math.round(monto * 0.05 * 100) / 100

    distribuciones.push({
      cuota_id: tx.cuota_id,
      transaccion_id: tx.id,
      monto_bruto: monto,
      comision_closer: comCloser,
      comision_setter: comSetter,
      costos_ads: costoAds,
      costos_operativos: costoOps,
      ganancia_empresa: Math.round((monto - comCloser - comSetter - costoAds - costoOps) * 100) / 100,
    })
  }

  const { error: distErr } = await supabase.from('distribucion_pagos').insert(distribuciones)
  if (distErr) console.error('  ⚠️  Distribución:', distErr.message)
  else console.log(`  ✅ ${distribuciones.length} distribuciones`)

  // ══════════════════════════════════════════════════════
  // 11. METAS DEL MES
  // ══════════════════════════════════════════════════════
  console.log('🎯 Creando metas mensuales...')
  const totalIngresos = transacciones.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const totalAds = egresos.filter(e => e.descripcion.includes('Ads')).reduce((s, e) => s + e.monto, 0)
  const totalOps = egresos.filter(e => !e.descripcion.includes('Ads')).reduce((s, e) => s + e.monto, 0)

  const metas = [
    {
      mes: '2026-01-01',
      meta_objetivo: 80000,
      facturacion_alcanzada: 72500,
      costos_ads: 4500,
      costos_operativos: 2200,
    },
    {
      mes: '2026-02-01',
      meta_objetivo: 90000,
      facturacion_alcanzada: 85000,
      costos_ads: 5200,
      costos_operativos: 2500,
    },
    {
      mes: '2026-03-01',
      meta_objetivo: 100000,
      facturacion_alcanzada: Math.round(totalIngresos),
      costos_ads: Math.round(totalAds),
      costos_operativos: Math.round(totalOps),
    },
  ]

  const { error: metErr } = await supabase.from('metas_mes').upsert(metas, { onConflict: 'mes' })
  if (metErr) console.error('  ⚠️  Metas:', metErr.message)
  else console.log(`  ✅ ${metas.length} metas mensuales`)

  // ══════════════════════════════════════════════════════
  // 12. REGLAS DE COMISIÓN ESCALONADAS
  // ══════════════════════════════════════════════════════
  console.log('📐 Creando reglas de comisión...')
  const reglas = [
    {
      nombre: 'Closer Estándar',
      rol: 'closer',
      tramos: [
        { desde: 0, hasta: 30000, porcentaje: 8 },
        { desde: 30001, hasta: 60000, porcentaje: 10 },
        { desde: 60001, hasta: 999999, porcentaje: 12 },
      ],
      activa: true,
    },
    {
      nombre: 'Setter Estándar',
      rol: 'setter',
      tramos: [
        { desde: 0, hasta: 20000, porcentaje: 3 },
        { desde: 20001, hasta: 50000, porcentaje: 4 },
        { desde: 50001, hasta: 999999, porcentaje: 5 },
      ],
      activa: true,
    },
  ]

  const { error: regErr } = await supabase.from('reglas_comision').insert(reglas)
  if (regErr) console.error('  ⚠️  Reglas:', regErr.message)
  else console.log(`  ✅ ${reglas.length} reglas de comisión`)

  // ══════════════════════════════════════════════════════
  // 13. PROJECT BRIEFS
  // ══════════════════════════════════════════════════════
  console.log('📋 Creando briefs de proyecto...')
  const briefs = proyectosResult.map((p, i) => ({
    proyecto_id: p.id,
    nombre_producto: p.nombre,
    descripcion_producto: p.descripcion,
    precio_desde: [1500, 2000, 3000][i],
    precio_hasta: [3000, 5000, 7500][i],
    pagina_web: [`https://academiaelite.com`, `https://bizgrow.lat`, `https://metodox.com`][i],
    instagram: [`@academiaelite`, `@bizgrowlatam`, `@metodox`][i],
    avatar_nombre: ['Carlos Emprendedor', 'María Profesional', 'Roberto CEO'][i],
    avatar_edad_rango: '30-45',
    avatar_ocupacion: ['Emprendedor', 'Gerente de marketing', 'Dueño de empresa'][i],
    avatar_dolores: ['Falta de liderazgo en equipo', 'Estancamiento en ventas', 'No puede escalar'][i],
    avatar_deseos: ['Equipo autónomo', 'Facturar $100k/mes', 'Escalar sin quemarse'][i],
    avatar_objeciones: ['Es caro', 'No tengo tiempo', 'Ya probé otros programas'][i],
    experto_nombre: ['Dr. Marcos Vidal', 'Lic. Andrea Suárez', 'Ing. Tomás Rey'][i],
    experto_bio: [
      '15 años en desarrollo organizacional',
      'Consultora de negocios y ventas digitales',
      'Founder con 3 exits, mentor de startups'
    ][i],
    proceso_setter: 'Contacto → Calificación → Agendar llamada → Confirmar cita',
    proceso_closer: 'Rapport → Diagnóstico → Presentación → Cierre → Seguimiento',
    mensajes_apertura: JSON.stringify(['¡Hola! Vi que te interesó nuestro programa', 'Gracias por agendar tu llamada']),
    argumentos_cierre: JSON.stringify(['Garantía de 30 días', 'Comunidad exclusiva', 'Soporte personalizado']),
    manejo_objeciones: JSON.stringify({'Es caro': 'Inversión vs gasto...', 'No tengo tiempo': 'Solo 2h/semana...'}),
  }))

  const { error: brErr } = await supabase.from('project_briefs').upsert(briefs, { onConflict: 'proyecto_id' })
  if (brErr) console.error('  ⚠️  Briefs:', brErr.message)
  else console.log(`  ✅ ${briefs.length} briefs de proyecto`)

  // ══════════════════════════════════════════════════════
  // 14. LIQUIDACIONES
  // ══════════════════════════════════════════════════════
  console.log('📄 Generando liquidaciones...')
  const liquidaciones = []
  const allSalesTeam = [...setters, ...closers]

  for (const user of allSalesTeam) {
    liquidaciones.push({
      usuario_id: user.id,
      fecha_desde: '2026-02-01',
      fecha_hasta: '2026-02-28',
      total_comision: user.rol === 'closer' ? money(3000, 8000) : money(1500, 4000),
      detalle: {
        proyectos: proyectosResult.map(p => ({
          nombre: p.nombre,
          comision: money(500, 2500),
        })),
      },
      estado: 'pagada',
    })
    liquidaciones.push({
      usuario_id: user.id,
      fecha_desde: '2026-03-01',
      fecha_hasta: '2026-03-28',
      total_comision: user.rol === 'closer' ? money(2500, 7000) : money(1000, 3500),
      detalle: {
        proyectos: proyectosResult.map(p => ({
          nombre: p.nombre,
          comision: money(400, 2000),
        })),
      },
      estado: 'pendiente',
    })
  }

  const { error: liqErr } = await supabase.from('liquidaciones').insert(liquidaciones)
  if (liqErr) console.error('  ⚠️  Liquidaciones:', liqErr.message)
  else console.log(`  ✅ ${liquidaciones.length} liquidaciones`)

  // ══════════════════════════════════════════════════════
  // RESUMEN FINAL
  // ══════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════')
  console.log('✅ SEED COMPLETADO')
  console.log('══════════════════════════════════════════')
  console.log(`  📁 ${proyectosResult.length} proyectos`)
  console.log(`  👥 ${miembros.length} asignaciones`)
  console.log(`  📊 ${reportesSetter.length} reportes setter`)
  console.log(`  📊 ${reportesCloser.length} reportes closer`)
  console.log(`  🧾 ${clientes.length} clientes`)
  console.log(`  📅 ${todasCuotas.length} cuotas`)
  console.log(`  💳 ${transacciones.length} transacciones`)
  console.log(`  ⏳ ${comisionesPendientes.length} comisiones pendientes`)
  console.log(`  📦 ${distribuciones.length} distribuciones de pago`)
  console.log(`  🎯 ${metas.length} metas mensuales`)
  console.log(`  📐 ${reglas.length} reglas de comisión`)
  console.log(`  📋 ${briefs.length} briefs de proyecto`)
  console.log(`  📄 ${liquidaciones.length} liquidaciones`)
  console.log('══════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message)
  process.exit(1)
})
