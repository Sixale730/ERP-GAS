/**
 * Creacion de cotizaciones, compartida por la web y por la API del asistente.
 *
 * Recibe el cliente de Supabase ya autenticado, para que apliquen RLS y los
 * permisos del usuario que llama.
 *
 * Las piezas (lista de precios, sucursal, armado de partidas) se exportan para
 * que la edicion (editar.ts) aplique exactamente las mismas reglas.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CodigoMoneda } from '@/lib/config/moneda'
import {
  SKU_ENVIO,
  armarNotas,
  calcularPrecioFinal,
  calcularTotales,
  redondear,
  type ItemCalculado,
} from './calculo'

export const VIGENCIA_DIAS_COTIZACION = 30

export interface ItemEntrada {
  producto_id: string
  cantidad: number
  /** Precio dictado por el vendedor. Obligatorio para SER-ENV, opcional como override. */
  precio_manual?: number
  /**
   * Moneda en que viene precio_manual; si no viene, la de la cotizacion. Sirve
   * para "ponlo a 300 dolares" en una cotizacion en pesos: la conversion la hace
   * el sistema con el tipo de cambio, no el asistente.
   */
  moneda_precio_manual?: CodigoMoneda
  descripcion?: string
  margen_porcentaje?: number
}

export interface EntradaCotizacion {
  cliente_id: string
  /** Sucursal del cliente (erp.direcciones_envio). La cobranza se lleva por sucursal. */
  direccion_envio_id?: string | null
  items: ItemEntrada[]
  moneda?: CodigoMoneda
  tipo_cambio?: number
  descuento_porcentaje?: number
  /** "inmediata" | "15" | "10-12" | "2 semanas" */
  entrega?: string
  /** Lineas extra para las notas, tal cual las dicto el vendedor. */
  notas_extra?: string[]
  vigencia_dias?: number
  almacen_id?: string
  status?: string
  /**
   * true = calcula todo y devuelve el resultado SIN guardar ni consumir folio.
   * Sirve para que el asistente le muestre a Jose los numeros exactos que se
   * van a guardar, en vez de describirlos de memoria.
   */
  dry_run?: boolean
}

export interface ResultadoCotizacion {
  /** null en dry_run: todavia no se guardo. */
  id: string | null
  /** null en dry_run: el folio se pide al guardar, no antes. */
  folio: string | null
  guardada: boolean
  /** Alias de la sucursal, o null si va sin sucursal. */
  sucursal: string | null
  vigencia_dias: number
  subtotal: number
  descuento_monto: number
  iva: number
  total: number
  moneda: CodigoMoneda
  tipo_cambio: number | null
  notas: string
  items: Array<{ sku: string; descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }>
}

export class ErrorCotizacion extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'ErrorCotizacion'
  }
}

// ---------------------------------------------------------------------------
// Piezas compartidas con la edicion
// ---------------------------------------------------------------------------

/** La lista indicada o, si no hay, la default de la organizacion (Publico General). */
export async function resolverListaPrecio(
  supabase: SupabaseClient,
  orgId: string,
  listaPrecioId: string | null,
): Promise<string> {
  if (listaPrecioId) return listaPrecioId
  const { data: lista } = await supabase
    .schema('erp')
    .from('listas_precios')
    .select('id')
    .eq('organizacion_id', orgId)
    .eq('is_default', true)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (!lista) throw new ErrorCotizacion('El cliente no tiene lista de precios y no hay una por defecto')
  return lista.id
}

/** La sucursal debe ser del cliente y estar activa. */
export async function validarSucursal(
  supabase: SupabaseClient,
  clienteId: string,
  direccionEnvioId: string,
): Promise<{ id: string; alias: string | null }> {
  const { data: dir } = await supabase
    .schema('erp')
    .from('direcciones_envio')
    .select('id, cliente_id, alias, is_active')
    .eq('id', direccionEnvioId)
    .maybeSingle()
  if (!dir || dir.cliente_id !== clienteId || !dir.is_active) {
    throw new ErrorCotizacion('La sucursal no existe, esta inactiva o no es de ese cliente')
  }
  return { id: dir.id, alias: (dir.alias ?? '').trim() || null }
}

/** Lo que una partida ya tenia en la cotizacion (al editar). */
export interface PartidaPrevia {
  precio_unitario: number
  descripcion: string
}

export interface OpcionesPartidas {
  items: ItemEntrada[]
  listaPrecioId: string
  moneda: CodigoMoneda
  tipoCambio: number
  /** Al editar: precio y descripcion que cada producto ya tenia. */
  previas?: Map<string, PartidaPrevia>
  /** true = los productos con precio de lista se vuelven a valorar aunque ya tuvieran precio. */
  recalcular?: boolean
  /** false = si un producto no tiene precio de lista NO se conserva el previo (cambio de moneda). */
  conservarSinLista?: boolean
}

/**
 * Arma y valora las partidas con las reglas de SOLAC. Precio de cada una:
 *   1. precio_manual, si viene (SER-ENV siempre, o si el vendedor lo dicta),
 *      convertido si viene en otra moneda
 *   2. el que ya tenia en la cotizacion, al editar y sin recalcular
 *   3. el de la lista del cliente, convertido por tipo de cambio
 *   4. el que ya tenia, si el producto no tiene precio de lista (ej. SER-ENV)
 */
export async function armarPartidas(
  supabase: SupabaseClient,
  orgId: string,
  op: OpcionesPartidas,
): Promise<{ calculados: ItemCalculado[]; llevaEnvio: boolean; skuDe: Map<string, string> }> {
  const erp = supabase.schema('erp')
  const ids = Array.from(new Set(op.items.map((i) => i.producto_id)))

  const { data: productos, error: errProd } = await erp
    .from('productos')
    .select('id, sku, nombre, es_servicio')
    .in('id', ids)
    .eq('organizacion_id', orgId)
    .eq('is_active', true)
  if (errProd) throw new ErrorCotizacion('Error al leer productos: ' + errProd.message, 500)

  const porId = new Map((productos ?? []).map((p) => [p.id, p]))
  const faltantes = ids.filter((id) => !porId.has(id))
  if (faltantes.length) throw new ErrorCotizacion(`Productos no encontrados o inactivos: ${faltantes.join(', ')}`, 404)

  const { data: precios } = await erp
    .from('precios_productos')
    .select('producto_id, precio, moneda')
    .eq('lista_precio_id', op.listaPrecioId)
    .in('producto_id', ids)

  const precioDe = new Map(
    (precios ?? []).map((p) => [p.producto_id, { precio: Number(p.precio), moneda: (p.moneda || 'USD') as CodigoMoneda }]),
  )

  const calculados: ItemCalculado[] = []
  let llevaEnvio = false

  for (const it of op.items) {
    const prod = porId.get(it.producto_id)!
    const cantidad = Number(it.cantidad)
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new ErrorCotizacion(`Cantidad invalida en ${prod.sku}`)
    }
    if (prod.sku === SKU_ENVIO) llevaEnvio = true

    const lista = precioDe.get(it.producto_id)
    const previa = op.previas?.get(it.producto_id)
    const margen = it.margen_porcentaje ?? 0
    let precioUnitario: number
    let precioLista: number
    let monedaPrecio: CodigoMoneda

    if (it.precio_manual !== undefined && it.precio_manual !== null) {
      // Precio dictado por el vendedor. SER-ENV se captura en MXN y, en una
      // cotizacion en MXN, NO se convierte.
      const manual = Number(it.precio_manual)
      if (!Number.isFinite(manual) || manual < 0) {
        throw new ErrorCotizacion(`Precio invalido en ${prod.sku}`)
      }
      const monedaManual = it.moneda_precio_manual ?? op.moneda
      if (monedaManual !== op.moneda && !op.tipoCambio) {
        throw new ErrorCotizacion(`Falta el tipo de cambio para convertir el precio de ${prod.sku}`)
      }
      precioUnitario = calcularPrecioFinal(manual, monedaManual, op.moneda, op.tipoCambio)
      precioLista = manual
      monedaPrecio = monedaManual
    } else if (previa && !op.recalcular) {
      precioUnitario = previa.precio_unitario
      precioLista = previa.precio_unitario
      monedaPrecio = op.moneda
    } else if (lista) {
      precioLista = lista.precio
      monedaPrecio = lista.moneda
      if (monedaPrecio !== op.moneda && !op.tipoCambio) {
        throw new ErrorCotizacion('Falta el tipo de cambio: hay precios en otra moneda que convertir')
      }
      precioUnitario = calcularPrecioFinal(precioLista, monedaPrecio, op.moneda, op.tipoCambio, margen)
    } else if (previa && op.conservarSinLista !== false) {
      precioUnitario = previa.precio_unitario
      precioLista = previa.precio_unitario
      monedaPrecio = op.moneda
    } else {
      throw new ErrorCotizacion(
        `${prod.sku} no tiene precio en la lista asignada. Indica el precio explicitamente.`,
      )
    }

    // calcularPrecioFinal ya redondea; esto cubre el precio conservado.
    const redondeado = redondear(precioUnitario)
    calculados.push({
      producto_id: prod.id,
      descripcion: it.descripcion?.trim() || previa?.descripcion || prod.nombre,
      cantidad,
      precio_lista: precioLista,
      moneda_precio: monedaPrecio,
      margen_porcentaje: margen,
      precio_unitario: redondeado,
      subtotal: Math.round(cantidad * redondeado * 100) / 100,
    })
  }

  return { calculados, llevaEnvio, skuDe: new Map((productos ?? []).map((p) => [p.id, p.sku])) }
}

// ---------------------------------------------------------------------------
// Creacion
// ---------------------------------------------------------------------------

export async function crearCotizacion(
  supabase: SupabaseClient,
  orgId: string,
  vendedor: { id: string; nombre: string },
  entrada: EntradaCotizacion,
): Promise<ResultadoCotizacion> {
  const erp = supabase.schema('erp')

  if (!entrada.cliente_id) throw new ErrorCotizacion('Falta cliente_id')
  if (!entrada.items?.length) throw new ErrorCotizacion('La cotizacion no tiene partidas')

  const moneda: CodigoMoneda = entrada.moneda ?? 'MXN'
  const tipoCambio = entrada.tipo_cambio ?? 0

  // --- Cliente y su lista de precios -------------------------------------
  const { data: cliente, error: errCli } = await erp
    .from('clientes')
    .select('id, nombre_comercial, lista_precio_id, is_active')
    .eq('id', entrada.cliente_id)
    .eq('organizacion_id', orgId)
    .single()
  if (errCli || !cliente) throw new ErrorCotizacion('Cliente no encontrado', 404)
  if (!cliente.is_active) throw new ErrorCotizacion('El cliente esta inactivo')

  // Los clientes sin lista asignada caen en Publico General.
  const listaPrecioId = await resolverListaPrecio(supabase, orgId, cliente.lista_precio_id as string | null)

  // --- Sucursal -------------------------------------------------------------
  let direccionEnvioId: string | null = null
  let sucursal: string | null = null
  if (entrada.direccion_envio_id) {
    const s = await validarSucursal(supabase, cliente.id, entrada.direccion_envio_id)
    direccionEnvioId = s.id
    sucursal = s.alias
  }

  // --- Almacen ------------------------------------------------------------
  let almacenId = entrada.almacen_id
  if (!almacenId) {
    const { data: alm } = await erp
      .from('almacenes')
      .select('id')
      .eq('organizacion_id', orgId)
      .eq('is_active', true)
      .order('nombre')
      .limit(1)
      .maybeSingle()
    if (!alm) throw new ErrorCotizacion('No hay almacenes activos')
    almacenId = alm.id
  }

  // --- Partidas -------------------------------------------------------------
  const { calculados, llevaEnvio, skuDe } = await armarPartidas(supabase, orgId, {
    items: entrada.items,
    listaPrecioId,
    moneda,
    tipoCambio,
  })

  const { subtotal, descuentoMonto, iva, total } = calcularTotales(
    calculados,
    entrada.descuento_porcentaje ?? 0,
  )

  const notas = armarNotas({
    entrega: entrada.entrega,
    llevaEnvio,
    extras: entrada.notas_extra,
  })

  const vigenciaDias = entrada.vigencia_dias ?? VIGENCIA_DIAS_COTIZACION

  const detalle = calculados.map((i) => ({
    sku: skuDe.get(i.producto_id)!,
    descripcion: i.descripcion,
    cantidad: i.cantidad,
    precio_unitario: i.precio_unitario,
    subtotal: i.subtotal,
  }))

  // --- Ensayo: se calcula todo pero no se guarda ni se consume folio -------
  if (entrada.dry_run) {
    return {
      id: null,
      folio: null,
      guardada: false,
      sucursal,
      vigencia_dias: vigenciaDias,
      subtotal,
      descuento_monto: descuentoMonto,
      iva,
      total,
      moneda,
      tipo_cambio: moneda === 'MXN' ? tipoCambio || null : null,
      notas,
      items: detalle,
    }
  }

  // --- Folio y guardado ---------------------------------------------------
  const { data: folioData, error: errFolio } = await erp.rpc('generar_folio', { tipo: 'cotizacion' })
  if (errFolio) throw new ErrorCotizacion('No se pudo generar el folio: ' + errFolio.message, 500)
  const folio = folioData as string

  const { data: cot, error: errCot } = await erp
    .from('cotizaciones')
    .insert({
      folio,
      cliente_id: cliente.id,
      direccion_envio_id: direccionEnvioId,
      almacen_id: almacenId,
      lista_precio_id: listaPrecioId,
      status: entrada.status ?? 'propuesta',
      subtotal,
      descuento_porcentaje: entrada.descuento_porcentaje ?? 0,
      descuento_monto: descuentoMonto,
      iva,
      total,
      moneda,
      tipo_cambio: moneda === 'MXN' ? tipoCambio || null : null,
      vigencia_dias: vigenciaDias,
      notas,
      condiciones_pago: 'CONTADO',
      vendedor_id: vendedor.id,
      vendedor_nombre: vendedor.nombre,
      organizacion_id: orgId,
    })
    .select('id, folio')
    .single()
  if (errCot || !cot) throw new ErrorCotizacion('No se pudo crear la cotizacion: ' + errCot?.message, 500)

  const { error: errItems } = await erp.from('cotizacion_items').insert(
    calculados.map((i) => ({
      cotizacion_id: cot.id,
      producto_id: i.producto_id,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      descuento_porcentaje: 0,
      subtotal: i.subtotal,
      organizacion_id: orgId,
    })),
  )
  if (errItems) {
    // La cabecera quedaria huerfana: la borramos para no dejar basura.
    await erp.from('cotizaciones').delete().eq('id', cot.id)
    throw new ErrorCotizacion('No se pudieron guardar las partidas: ' + errItems.message, 500)
  }

  return {
    id: cot.id,
    folio: cot.folio,
    guardada: true,
    sucursal,
    vigencia_dias: vigenciaDias,
    subtotal,
    descuento_monto: descuentoMonto,
    iva,
    total,
    moneda,
    tipo_cambio: moneda === 'MXN' ? tipoCambio || null : null,
    notas,
    items: detalle,
  }
}
