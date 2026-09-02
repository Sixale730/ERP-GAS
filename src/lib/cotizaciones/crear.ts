/**
 * Creacion de cotizaciones, compartida por la web y por la API del asistente.
 *
 * Recibe el cliente de Supabase ya autenticado, para que apliquen RLS y los
 * permisos del usuario que llama.
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
  /** Precio en la moneda de la cotizacion. Obligatorio para SER-ENV, opcional como override. */
  precio_manual?: number
  descripcion?: string
  margen_porcentaje?: number
}

export interface EntradaCotizacion {
  cliente_id: string
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

  let listaPrecioId = cliente.lista_precio_id as string | null
  if (!listaPrecioId) {
    // Los clientes sin lista asignada caen en Publico General.
    const { data: lista } = await erp
      .from('listas_precios')
      .select('id')
      .eq('organizacion_id', orgId)
      .eq('is_default', true)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (!lista) throw new ErrorCotizacion('El cliente no tiene lista de precios y no hay una por defecto')
    listaPrecioId = lista.id
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

  // --- Productos y precios ------------------------------------------------
  const ids = Array.from(new Set(entrada.items.map((i) => i.producto_id)))
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
    .eq('lista_precio_id', listaPrecioId)
    .in('producto_id', ids)

  const precioDe = new Map(
    (precios ?? []).map((p) => [p.producto_id, { precio: Number(p.precio), moneda: (p.moneda || 'USD') as CodigoMoneda }]),
  )

  // --- Armado de partidas -------------------------------------------------
  const calculados: ItemCalculado[] = []
  let llevaEnvio = false

  for (const it of entrada.items) {
    const prod = porId.get(it.producto_id)!
    const cantidad = Number(it.cantidad)
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new ErrorCotizacion(`Cantidad invalida en ${prod.sku}`)
    }
    if (prod.sku === SKU_ENVIO) llevaEnvio = true

    const lista = precioDe.get(it.producto_id)
    const margen = it.margen_porcentaje ?? 0
    let precioUnitario: number
    let precioLista: number
    let monedaPrecio: CodigoMoneda

    if (it.precio_manual !== undefined && it.precio_manual !== null) {
      // Precio dictado por el vendedor: ya viene en la moneda de la cotizacion.
      // Es el caso de SER-ENV, que se captura en MXN y NO se convierte.
      precioUnitario = Number(it.precio_manual)
      precioLista = precioUnitario
      monedaPrecio = moneda
      if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
        throw new ErrorCotizacion(`Precio invalido en ${prod.sku}`)
      }
    } else {
      if (!lista) {
        throw new ErrorCotizacion(
          `${prod.sku} no tiene precio en la lista asignada. Indica el precio explicitamente.`,
        )
      }
      precioLista = lista.precio
      monedaPrecio = lista.moneda
      if (monedaPrecio !== moneda && !tipoCambio) {
        throw new ErrorCotizacion('Falta el tipo de cambio: hay precios en otra moneda que convertir')
      }
      precioUnitario = calcularPrecioFinal(precioLista, monedaPrecio, moneda, tipoCambio, margen)
    }

    // calcularPrecioFinal ya redondea; esto cubre el caso del precio manual.
    const redondeado = redondear(precioUnitario)
    calculados.push({
      producto_id: prod.id,
      descripcion: it.descripcion?.trim() || prod.nombre,
      cantidad,
      precio_lista: precioLista,
      moneda_precio: monedaPrecio,
      margen_porcentaje: margen,
      precio_unitario: redondeado,
      subtotal: Math.round(cantidad * redondeado * 100) / 100,
    })
  }

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
    sku: porId.get(i.producto_id)!.sku,
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
