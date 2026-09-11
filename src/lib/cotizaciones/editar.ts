/**
 * Edicion de cotizaciones desde el asistente de Telegram.
 *
 * Recibe la lista COMPLETA de partidas como debe quedar (las que no vengan se
 * quitan), recalcula con las mismas reglas que al crear (crear.ts) y guarda
 * cabecera + partidas en UNA transaccion (RPC erp.bot_guardar_edicion_cotizacion):
 * o queda todo o no queda nada. Las partidas reemplazadas quedan en
 * erp.items_eliminados_papelera por el trigger trg_papelera.
 *
 * Precios: se conservan los que ya tenia la cotizacion, para que corregir una
 * cantidad no mueva los demas precios. Se vuelven a tomar de la lista solo si se
 * pide (recalcular_precios) o si cambia algo que los afecta: cliente, moneda o
 * tipo de cambio.
 *
 * Solo cotizaciones en 'propuesta'. Las ordenes de venta reservan inventario y
 * se editan en la web.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CodigoMoneda } from '@/lib/config/moneda'
import { formatMoneyCurrency } from '@/lib/utils/format'
import { SKU_ENVIO, armarNotas, calcularTotales, redondear } from './calculo'
import {
  ErrorCotizacion,
  armarPartidas,
  resolverListaPrecio,
  validarSucursal,
  type ItemEntrada,
  type PartidaPrevia,
} from './crear'

export interface EntradaEdicion {
  /** Lista COMPLETA de partidas como debe quedar. Las que no vengan se quitan. */
  items: ItemEntrada[]
  cliente_id?: string
  /** id de sucursal; null = quitarla; sin mandar = no cambia. */
  direccion_envio_id?: string | null
  moneda?: CodigoMoneda
  tipo_cambio?: number
  descuento_porcentaje?: number
  /** Reemplaza la linea de entrega ("15", "inmediata"...). '' la quita. */
  entrega?: string
  /** Reemplaza las lineas extra de las notas. LAB GDL y ENVIO POR COBRAR se ponen solos. */
  notas_extra?: string[]
  vigencia_dias?: number
  /** true = la fecha de la cotizacion pasa a hoy (renovarla). */
  actualizar_fecha?: boolean
  /** true = volver a tomar TODOS los precios de la lista actual. */
  recalcular_precios?: boolean
  dry_run?: boolean
}

export interface ResultadoEdicion {
  id: string
  folio: string
  guardada: boolean
  cliente: string
  sucursal: string | null
  fecha: string
  vigencia_dias: number
  subtotal: number
  descuento_monto: number
  iva: number
  total: number
  moneda: CodigoMoneda
  tipo_cambio: number | null
  notas: string
  items: Array<{ sku: string; descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }>
  /** Lo que cambia respecto a como estaba, listo para mostrarle a Jose tal cual. */
  cambios: string[]
}

const LINEA_ENTREGA = /^(ENTREGA INMEDIATA|TIEMPO DE ENTREGA\b.*)$/i
const LINEA_AUTOMATICA = /^(LAB GDL|ENVIO POR COBRAR|ENTREGA INMEDIATA|TIEMPO DE ENTREGA\b.*)$/i

function hoyMexico(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
}

type Linea = { sku: string; cantidad: number; precio: number }

/** Agrupa por producto: si viene dos veces, suma cantidades y toma el primer precio. */
function porProducto(lineas: Array<Linea & { producto_id: string }>): Map<string, Linea> {
  const m = new Map<string, Linea>()
  for (const l of lineas) {
    const a = m.get(l.producto_id)
    if (a) a.cantidad += l.cantidad
    else m.set(l.producto_id, { sku: l.sku, cantidad: l.cantidad, precio: l.precio })
  }
  return m
}

export async function editarCotizacion(
  supabase: SupabaseClient,
  orgId: string,
  cotizacionId: string,
  entrada: EntradaEdicion,
  usuario: { id: string; nombre: string },
): Promise<ResultadoEdicion> {
  const erp = supabase.schema('erp')

  if (!entrada.items?.length) {
    throw new ErrorCotizacion('La cotizacion quedaria sin partidas. Para cancelarla, hazlo en el ERP.')
  }

  // --- Como esta hoy ------------------------------------------------------
  const { data: cot, error: errCot } = await erp
    .from('cotizaciones')
    .select(
      'id, folio, status, fecha, cliente_id, direccion_envio_id, lista_precio_id, moneda, tipo_cambio, ' +
        'descuento_porcentaje, notas, vigencia_dias, subtotal, iva, total',
    )
    .eq('id', cotizacionId)
    .eq('organizacion_id', orgId)
    .maybeSingle()
  if (errCot) throw new ErrorCotizacion('Error al leer la cotizacion: ' + errCot.message, 500)
  if (!cot) throw new ErrorCotizacion('Cotizacion no encontrada', 404)
  const c = cot as unknown as {
    id: string; folio: string; status: string; fecha: string; cliente_id: string
    direccion_envio_id: string | null; lista_precio_id: string | null; moneda: CodigoMoneda | null
    tipo_cambio: number | null; descuento_porcentaje: number | null; notas: string | null
    vigencia_dias: number | null; subtotal: number; iva: number; total: number
  }
  if (c.status !== 'propuesta') {
    throw new ErrorCotizacion(
      `La ${c.folio} esta en "${c.status}": desde aqui solo se editan cotizaciones en propuesta. Hazlo en el ERP.`,
      409,
    )
  }

  const { data: itemsAntes, error: errItems } = await erp
    .from('cotizacion_items')
    .select('producto_id, descripcion, cantidad, precio_unitario, productos:producto_id (sku)')
    .eq('cotizacion_id', c.id)
    .order('created_at')
  if (errItems) throw new ErrorCotizacion('Error al leer las partidas: ' + errItems.message, 500)
  const antes = (itemsAntes ?? []).map((i) => ({
    producto_id: i.producto_id as string,
    descripcion: i.descripcion as string,
    cantidad: Number(i.cantidad),
    precio_unitario: Number(i.precio_unitario),
    sku: (i.productos as unknown as { sku?: string } | null)?.sku ?? '?',
  }))

  // --- Cliente, lista, moneda y tipo de cambio ------------------------------
  const clienteId = entrada.cliente_id ?? c.cliente_id
  const cambiaCliente = clienteId !== c.cliente_id
  const { data: cliente } = await erp
    .from('clientes')
    .select('id, nombre_comercial, lista_precio_id, is_active')
    .eq('id', clienteId)
    .eq('organizacion_id', orgId)
    .maybeSingle()
  if (!cliente) throw new ErrorCotizacion('Cliente no encontrado', 404)
  if (cambiaCliente && !cliente.is_active) throw new ErrorCotizacion('El cliente esta inactivo')

  // Mismo cliente: se respeta la lista con la que se cotizo.
  const listaPrecioId = await resolverListaPrecio(
    supabase,
    orgId,
    cambiaCliente ? cliente.lista_precio_id : c.lista_precio_id ?? cliente.lista_precio_id,
  )

  const monedaAntes = (c.moneda ?? 'MXN') as CodigoMoneda
  const moneda = (entrada.moneda ?? monedaAntes) as CodigoMoneda
  const cambiaMoneda = moneda !== monedaAntes
  const tcAntes = Number(c.tipo_cambio ?? 0)
  const tipoCambio = entrada.tipo_cambio !== undefined ? Number(entrada.tipo_cambio) : tcAntes
  const cambiaTC = entrada.tipo_cambio !== undefined && tipoCambio !== tcAntes
  const recalcular = !!entrada.recalcular_precios || cambiaCliente || cambiaMoneda || cambiaTC

  // --- Sucursal -------------------------------------------------------------
  let direccionEnvioId: string | null = cambiaCliente ? null : c.direccion_envio_id
  if (entrada.direccion_envio_id !== undefined) direccionEnvioId = entrada.direccion_envio_id || null
  const sucursal = direccionEnvioId
    ? (await validarSucursal(supabase, clienteId, direccionEnvioId)).alias
    : null

  // --- Partidas ---------------------------------------------------------------
  const previas = new Map<string, PartidaPrevia>()
  for (const a of antes) {
    if (!previas.has(a.producto_id)) {
      previas.set(a.producto_id, { precio_unitario: a.precio_unitario, descripcion: a.descripcion })
    }
  }
  const { calculados, llevaEnvio, skuDe } = await armarPartidas(supabase, orgId, {
    items: entrada.items,
    listaPrecioId,
    moneda,
    tipoCambio,
    previas,
    recalcular,
    conservarSinLista: !cambiaMoneda,
  })

  const descuentoAntes = Number(c.descuento_porcentaje ?? 0)
  const descuentoPct = entrada.descuento_porcentaje ?? descuentoAntes
  const { subtotal, descuentoMonto, iva, total } = calcularTotales(calculados, descuentoPct)

  // --- Notas ------------------------------------------------------------------
  // Si no se tocan y el envio sigue igual, quedan exactamente como estaban.
  // Si no, se rearman: entrega + LAB GDL + ENVIO POR COBRAR (si no hay SER-ENV) + extras.
  const notasAntes = c.notas ?? ''
  const teniaEnvio = antes.some((a) => a.sku === SKU_ENVIO)
  const tocaNotas = entrada.entrega !== undefined || entrada.notas_extra !== undefined || teniaEnvio !== llevaEnvio
  let notas = notasAntes
  if (tocaNotas) {
    const lineas = notasAntes.split('\n').map((l) => l.trim()).filter(Boolean)
    notas = armarNotas({
      entrega: entrada.entrega !== undefined ? entrada.entrega : lineas.find((l) => LINEA_ENTREGA.test(l)),
      llevaEnvio,
      extras: entrada.notas_extra ?? lineas.filter((l) => !LINEA_AUTOMATICA.test(l)),
    })
  }

  const vigenciaDias = entrada.vigencia_dias ?? c.vigencia_dias ?? 30
  const fecha = entrada.actualizar_fecha ? hoyMexico() : c.fecha
  const tcFinal = moneda === 'MXN' ? tipoCambio || null : null

  // --- Que cambia -------------------------------------------------------------
  const fmt = (n: number, m: CodigoMoneda = moneda) => formatMoneyCurrency(n, m)
  const cambios: string[] = []
  if (cambiaCliente) cambios.push(`Cliente: ${cliente.nombre_comercial}`)
  if (direccionEnvioId !== c.direccion_envio_id) cambios.push(`Sucursal: ${sucursal ?? 'sin sucursal'}`)
  if (cambiaMoneda) cambios.push(`Moneda: ${monedaAntes} → ${moneda} (precios recalculados)`)
  if (cambiaTC) cambios.push(`Tipo de cambio: ${tcAntes || '-'} → ${tipoCambio} (precios de lista recalculados)`)
  else if (entrada.recalcular_precios) cambios.push('Precios recalculados con la lista actual')
  if (descuentoPct !== descuentoAntes) cambios.push(`Descuento: ${descuentoAntes}% → ${descuentoPct}%`)

  const A = porProducto(antes.map((a) => ({ producto_id: a.producto_id, sku: a.sku, cantidad: a.cantidad, precio: a.precio_unitario })))
  const D = porProducto(
    calculados.map((d) => ({ producto_id: d.producto_id, sku: skuDe.get(d.producto_id)!, cantidad: d.cantidad, precio: d.precio_unitario })),
  )
  for (const [pid, a] of Array.from(A)) {
    if (!D.has(pid)) cambios.push(`Se quita: ${a.sku} (${a.cantidad} pza)`)
  }
  for (const [pid, d] of Array.from(D)) {
    const a = A.get(pid)
    if (!a) {
      cambios.push(`Se agrega: ${d.sku} × ${d.cantidad} a ${fmt(d.precio)}`)
      continue
    }
    if (a.cantidad !== d.cantidad) cambios.push(`${d.sku}: cantidad ${a.cantidad} → ${d.cantidad}`)
    if (redondear(a.precio) !== redondear(d.precio)) {
      cambios.push(`${d.sku}: precio ${fmt(a.precio, monedaAntes)} → ${fmt(d.precio)}`)
    }
  }
  if (notas !== notasAntes) cambios.push(`Notas: ${notas.replace(/\n/g, ' · ')}`)
  if (vigenciaDias !== c.vigencia_dias) cambios.push(`Vigencia: ${c.vigencia_dias ?? '-'} → ${vigenciaDias} días`)
  if (fecha !== c.fecha) cambios.push(`Fecha: ${c.fecha} → ${fecha}`)
  if (!cambios.length) cambios.push('Sin cambios')
  cambios.push(`Total: ${fmt(Number(c.total), monedaAntes)} → ${fmt(total)}`)

  const resultado: ResultadoEdicion = {
    id: c.id,
    folio: c.folio,
    guardada: false,
    cliente: cliente.nombre_comercial,
    sucursal,
    fecha,
    vigencia_dias: vigenciaDias,
    subtotal,
    descuento_monto: descuentoMonto,
    iva,
    total,
    moneda,
    tipo_cambio: tcFinal,
    notas,
    items: calculados.map((i) => ({
      sku: skuDe.get(i.producto_id)!,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      subtotal: i.subtotal,
    })),
    cambios,
  }
  if (entrada.dry_run) return resultado

  // --- Guardado atomico ---------------------------------------------------------
  const { error: errGuardar } = await erp.rpc('bot_guardar_edicion_cotizacion', {
    p_cotizacion_id: c.id,
    p_cabecera: {
      cliente_id: clienteId,
      direccion_envio_id: direccionEnvioId,
      lista_precio_id: listaPrecioId,
      fecha,
      subtotal,
      descuento_porcentaje: descuentoPct,
      descuento_monto: descuentoMonto,
      iva,
      total,
      moneda,
      tipo_cambio: tcFinal,
      notas,
      vigencia_dias: vigenciaDias,
    },
    p_items: calculados.map((i) => ({
      producto_id: i.producto_id,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      subtotal: i.subtotal,
    })),
  })
  if (errGuardar) throw new ErrorCotizacion('No se pudo guardar la edicion: ' + errGuardar.message, 500)

  // Historial, igual que la web. Si falla, la edicion ya quedo guardada.
  const { error: errHist } = await erp.from('historial_documentos').insert({
    documento_tipo: 'cotizacion',
    documento_id: c.id,
    documento_folio: c.folio,
    usuario_id: usuario.id,
    usuario_nombre: usuario.nombre,
    accion: 'editado',
    descripcion: ('Editada desde el asistente: ' + cambios.join('; ')).slice(0, 1000),
    datos_anteriores: { subtotal: c.subtotal, iva: c.iva, total: c.total, items: antes },
    datos_nuevos: { subtotal, iva, total, items: resultado.items },
  })
  if (errHist && process.env.NODE_ENV === 'development') {
    console.error('[editarCotizacion] historial:', errHist.message)
  }

  return { ...resultado, guardada: true }
}
