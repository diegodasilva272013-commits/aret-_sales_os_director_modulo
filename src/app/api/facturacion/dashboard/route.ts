import { createClient } from '@/lib/supabase/server'
import { getDirectorScope } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
  const supabase = createClient()
  const scope = await getDirectorScope(supabase)
  if (!scope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const mesParam = searchParams.get('mes')
  const now = new Date()
  const mes = mesParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const mesDate = new Date(mes)
  const mesStart = mes
  const mesEnd = new Date(mesDate.getFullYear(), mesDate.getMonth() + 1, 0).toISOString().split('T')[0]
  const hoy = now.toISOString().split('T')[0]

  // ─── Auto-marcar cuotas vencidas ───
  await supabase
    .from('cuotas')
    .update({ estado: 'vencida' })
    .eq('estado', 'pendiente')
    .lt('fecha_vencimiento', hoy)

  // Categorizar cuotas vencidas (ligera/pesada/default)
  await supabase.rpc('categorizar_cuotas_vencidas')

  // Liberar comisiones diferidas cuyo plazo de 7 días ya pasó
  await supabase.rpc('liberar_comisiones_disponibles')

  // Auto-marcar clientes con cuotas vencidas (only this director's clients)
  const { data: clientesConVencidas } = await supabase
    .from('cuotas')
    .select('cliente_id')
    .eq('estado', 'vencida')

  if (clientesConVencidas && clientesConVencidas.length > 0) {
    // Get this director's client IDs first
    const { data: misClientes } = await supabase.from('clientes_cartera').select('id').eq('director_id', scope.directorId)
    const misClienteIds = (misClientes || []).map(c => c.id)
    const idsVencidos = Array.from(new Set(clientesConVencidas.map(c => c.cliente_id).filter(id => misClienteIds.includes(id))))
    if (idsVencidos.length > 0) {
      await supabase
        .from('clientes_cartera')
        .update({ estado: 'vencido' })
        .eq('estado', 'activo')
        .in('id', idsVencidos)
    }
  }

  // ─── Parallel fetches ───
  const [
    { data: meta },
    { data: allTx },
    { data: cuotasPend },
    { data: cuotasVenc },
    { data: cuotasPagadas },
    { data: closers },
    { data: setters },
    { data: clientesCartera },
    { data: allMetas },
  ] = await Promise.all([
    supabase.from('metas_mes').select('*').eq('mes', mes).eq('director_id', scope.directorId).single(),
    supabase.from('transacciones').select('id, cliente_id, cuota_id, monto, tipo, fecha, descripcion').eq('director_id', scope.directorId).gte('fecha', mesStart).lte('fecha', mesEnd + 'T23:59:59').order('fecha', { ascending: false }),
    supabase.from('cuotas').select('monto, cliente_id').eq('estado', 'pendiente'),
    supabase.from('cuotas').select('monto, cliente_id').eq('estado', 'vencida'),
    supabase.from('cuotas').select('monto, fecha_pago, cliente_id').eq('estado', 'pagada').gte('fecha_pago', mesStart).lte('fecha_pago', mesEnd),
    supabase.from('profiles').select('id, nombre, apellido, foto_url').eq('rol', 'closer').eq('activo', true).eq('director_id', scope.directorId),
    supabase.from('profiles').select('id, nombre, apellido, foto_url').eq('rol', 'setter').eq('activo', true).eq('director_id', scope.directorId),
    supabase.from('clientes_cartera').select('id, nombre_cliente, closer_id, setter_id, monto_referencia, estado, creado_en, fuente, campana, canal').eq('director_id', scope.directorId),
    supabase.from('metas_mes').select('mes, meta_objetivo, facturacion_alcanzada').eq('director_id', scope.directorId).order('mes', { ascending: true }).limit(12),
  ])

  // ─── Comisiones diferidas (stats) ───
  const directorClienteIds = (clientesCartera || []).map(c => c.id)

  // Filter cuotas to only this director's clients
  const myPend = (cuotasPend || []).filter(c => directorClienteIds.includes(c.cliente_id))
  const myVenc = (cuotasVenc || []).filter(c => directorClienteIds.includes(c.cliente_id))
  const myPagadas = (cuotasPagadas || []).filter(c => directorClienteIds.includes(c.cliente_id))

  const [
    { data: comPendientes },
    { data: comDisponibles },
    { data: comRevertidas },
    { data: cuotasLigera },
    { data: cuotasPesada },
    { data: cuotasDefault },
  ] = await Promise.all([
    supabase.from('comisiones_pendientes').select('monto_comision').eq('estado', 'pendiente').in('usuario_id', scope.teamIds),
    supabase.from('comisiones_pendientes').select('monto_comision').eq('estado', 'disponible').in('usuario_id', scope.teamIds),
    supabase.from('comisiones_pendientes').select('monto_comision').eq('estado', 'revertida').in('usuario_id', scope.teamIds).gte('revertida_en', mesStart).lte('revertida_en', mesEnd + 'T23:59:59'),
    supabase.from('cuotas').select('monto, cliente_id').eq('estado', 'vencida').eq('categoria_vencimiento', 'ligera'),
    supabase.from('cuotas').select('monto, cliente_id').eq('estado', 'vencida').eq('categoria_vencimiento', 'pesada'),
    supabase.from('cuotas').select('monto, cliente_id').eq('estado', 'vencida').eq('categoria_vencimiento', 'default'),
  ])

  const comisionesDiferidas = {
    pendiente: (comPendientes || []).reduce((s, c) => s + Number(c.monto_comision), 0),
    disponible: (comDisponibles || []).reduce((s, c) => s + Number(c.monto_comision), 0),
    revertida_mes: (comRevertidas || []).reduce((s, c) => s + Number(c.monto_comision), 0),
  }

  const carteraVencidaCategoria = {
    ligera: (cuotasLigera || []).filter(c => directorClienteIds.includes(c.cliente_id)).reduce((s, c) => s + Number(c.monto), 0),
    pesada: (cuotasPesada || []).filter(c => directorClienteIds.includes(c.cliente_id)).reduce((s, c) => s + Number(c.monto), 0),
    default_cobranza: (cuotasDefault || []).filter(c => directorClienteIds.includes(c.cliente_id)).reduce((s, c) => s + Number(c.monto), 0),
  }

  const transacciones = allTx || []
  const clientes = clientesCartera || []

  // ─── Facturación (basada SOLO en transacciones — source of truth) ───
  const ingresos = transacciones.filter(t => t.tipo === 'ingreso')
  const egresos = transacciones.filter(t => t.tipo === 'egreso')
  const reembolsos = transacciones.filter(t => t.tipo === 'reembolso')
  const totalIngresos = ingresos.reduce((s, t) => s + Number(t.monto), 0)
  const totalEgresos = egresos.reduce((s, t) => s + Number(t.monto), 0)
  const totalReembolsos = reembolsos.reduce((s, t) => s + Number(t.monto), 0)
  const facturacionAlcanzada = totalIngresos - totalReembolsos
  const metaObjetivo = meta?.meta_objetivo ? Number(meta.meta_objetivo) : 0
  const faltante = Math.max(0, metaObjetivo - facturacionAlcanzada)
  const porcentaje = metaObjetivo > 0 ? (facturacionAlcanzada / metaObjetivo) * 100 : 0

  // ─── Cartera ───
  const carteraTotal = myPend.reduce((s, c) => s + Number(c.monto), 0)
    + myVenc.reduce((s, c) => s + Number(c.monto), 0)
  const carteraVencida = myVenc.reduce((s, c) => s + Number(c.monto), 0)
  const carteraCobrada = myPagadas.reduce((s, c) => s + Number(c.monto), 0)
  const totalClientes = clientes.length
  const clientesActivos = clientes.filter(c => c.estado === 'activo').length
  const clientesVencidos = clientes.filter(c => c.estado === 'vencido').length
  const clientesPagados = clientes.filter(c => c.estado === 'pagado').length

  // ─── Rankings ───
  const buildRanking = (personas: typeof closers, field: 'closer_id' | 'setter_id') => {
    return (personas || []).map(p => {
      const misClientes = clientes.filter(c => c[field] === p.id)
      const clienteIds = misClientes.map(c => c.id)
      const misTxIngresos = ingresos.filter(t => clienteIds.includes(t.cliente_id))
      const misTxReembolsos = reembolsos.filter(t => clienteIds.includes(t.cliente_id))
      const facturado = misTxIngresos.reduce((s, t) => s + Number(t.monto), 0)
        - misTxReembolsos.reduce((s, t) => s + Number(t.monto), 0)
      const clientesMes = misClientes.filter(c => {
        const d = new Date(c.creado_en)
        return d >= mesDate && d <= new Date(mesEnd + 'T23:59:59')
      }).length
      return {
        id: p.id,
        nombre: `${p.nombre || ''} ${p.apellido || ''}`.trim(),
        foto_url: p.foto_url,
        ventas: clientesMes,
        totalClientes: misClientes.length,
        facturado,
        porcentajeMeta: metaObjetivo > 0 ? Math.round((facturado / metaObjetivo) * 1000) / 10 : 0,
      }
    }).sort((a, b) => b.facturado - a.facturado)
  }

  const rankingClosers = buildRanking(closers, 'closer_id')
  const rankingSetters = buildRanking(setters, 'setter_id')

  // ─── Timeline diario ───
  const diasDelMes: Record<string, { ingresos: number; egresos: number; reembolsos: number }> = {}
  const daysInMonth = new Date(mesDate.getFullYear(), mesDate.getMonth() + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${mes.slice(0, 7)}-${String(d).padStart(2, '0')}`
    diasDelMes[key] = { ingresos: 0, egresos: 0, reembolsos: 0 }
  }
  for (const tx of transacciones) {
    const day = tx.fecha.split('T')[0]
    if (diasDelMes[day]) {
      if (tx.tipo === 'ingreso') diasDelMes[day].ingresos += Number(tx.monto)
      else if (tx.tipo === 'egreso') diasDelMes[day].egresos += Number(tx.monto)
      else if (tx.tipo === 'reembolso') diasDelMes[day].reembolsos += Number(tx.monto)
    }
  }
  let acum = 0
  const timeline = Object.entries(diasDelMes).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, val]) => {
    acum += val.ingresos - val.reembolsos
    return { fecha: fecha.slice(5), ingresos: val.ingresos, egresos: val.egresos, reembolsos: val.reembolsos, acumulado: acum, meta: metaObjetivo }
  })

  // ─── Tendencia metas (calculada desde transacciones, no desde campo metas_mes) ───
  const tendenciaMetas = (allMetas || []).map(m => ({
    mes: m.mes.slice(0, 7),
    meta: Number(m.meta_objetivo),
    alcanzado: Number(m.facturacion_alcanzada),
  }))

  // ─── Distribuciones ───
  const distribucionCartera = [
    { name: 'Al día', value: clientesActivos, color: '#34D399' },
    { name: 'Vencidos', value: clientesVencidos, color: '#F87171' },
    { name: 'Pagados', value: clientesPagados, color: '#818CF8' },
  ].filter(d => d.value > 0)

  const ingresosPorCloser = rankingClosers.filter(c => c.facturado > 0).map(c => ({
    name: c.nombre.split(' ')[0],
    value: c.facturado,
  }))

  // ─── Ingresos por Fuente/Canal ───
  const fuenteMap: Record<string, number> = {}
  const canalMap: Record<string, number> = {}
  for (const tx of ingresos) {
    const cliente = clientes.find(c => c.id === tx.cliente_id)
    if (cliente) {
      const fuente = cliente.fuente || 'Sin fuente'
      const canal = cliente.canal || 'Sin canal'
      fuenteMap[fuente] = (fuenteMap[fuente] || 0) + Number(tx.monto)
      canalMap[canal] = (canalMap[canal] || 0) + Number(tx.monto)
    }
  }
  const ingresosPorFuente = Object.entries(fuenteMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const ingresosPorCanal = Object.entries(canalMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  // ─── Enrich transactions ───
  const clienteNombres = Object.fromEntries(clientes.map(c => [c.id, c.nombre_cliente]))
  const ultimas = transacciones.slice(0, 20).map(tx => ({
    ...tx,
    cliente_nombre: clienteNombres[tx.cliente_id] || 'N/A',
  }))

  // ─── Alertas ───
  const alertas: { tipo: string; nivel: string; mensaje: string; icono: string }[] = []
  if (carteraVencida > 0) alertas.push({ tipo: 'cartera', nivel: 'critico', mensaje: `$${carteraVencida.toLocaleString()} en cuotas vencidas sin cobrar`, icono: 'alert' })
  if (totalReembolsos > 0) alertas.push({ tipo: 'reembolsos', nivel: 'warning', mensaje: `$${totalReembolsos.toLocaleString()} en reembolsos este mes`, icono: 'refund' })
  if (porcentaje < 50 && metaObjetivo > 0) alertas.push({ tipo: 'meta', nivel: 'warning', mensaje: `Solo ${Math.round(porcentaje)}% de la meta alcanzada`, icono: 'target' })
  if (clientesVencidos > 0) alertas.push({ tipo: 'clientes', nivel: 'warning', mensaje: `${clientesVencidos} cliente(s) con cuotas vencidas`, icono: 'users' })
  if (porcentaje >= 100) alertas.push({ tipo: 'meta', nivel: 'ok', mensaje: `¡Meta superada! ${Math.round(porcentaje)}% alcanzado`, icono: 'trophy' })
  else if (porcentaje >= 80) alertas.push({ tipo: 'meta', nivel: 'ok', mensaje: `¡Buen ritmo! ${Math.round(porcentaje)}% de la meta`, icono: 'trending' })

  return NextResponse.json({
    meta: {
      mes,
      meta_objetivo: metaObjetivo,
      facturacion_alcanzada: facturacionAlcanzada,
      faltante,
      porcentaje_rendimiento: Math.round(porcentaje * 10) / 10,
      costos_ads: meta?.costos_ads ? Number(meta.costos_ads) : 0,
      costos_operativos: meta?.costos_operativos ? Number(meta.costos_operativos) : 0,
      ganancia_neta: facturacionAlcanzada - (meta?.costos_ads ? Number(meta.costos_ads) : 0) - (meta?.costos_operativos ? Number(meta.costos_operativos) : 0),
      total_egresos: totalEgresos,
      total_reembolsos: totalReembolsos,
    },
    cartera: {
      total: carteraTotal,
      vencida: carteraVencida,
      cobrada_mes: carteraCobrada,
      total_clientes: totalClientes,
      activos: clientesActivos,
      vencidos: clientesVencidos,
      pagados: clientesPagados,
    },
    rankingClosers,
    rankingSetters,
    ultimasTransacciones: ultimas,
    timeline,
    tendenciaMetas,
    distribucionCartera,
    ingresosPorCloser,
    ingresosPorFuente,
    ingresosPorCanal,
    alertas,
    comisionesDiferidas,
    carteraVencidaCategoria,
  })
  } catch (e: unknown) {
    console.error('Facturacion dashboard error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal server error' }, { status: 500 })
  }
}
