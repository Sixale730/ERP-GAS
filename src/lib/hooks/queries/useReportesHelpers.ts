import { getSupabaseClient } from '@/lib/supabase/client'

/**
 * Obtiene descripciones de productos para un conjunto de facturas.
 * Retorna Map<facturaId, "Primer producto (+N mas)">
 */
export async function fetchDescripcionesFacturas(
  facturaIds: string[]
): Promise<Map<string, string>> {
  if (facturaIds.length === 0) return new Map()

  const supabase = getSupabaseClient()

  // 1. Items de las facturas
  const { data: items } = await supabase
    .schema('erp')
    .from('factura_items')
    .select('factura_id, descripcion, producto_id')
    .in('factura_id', facturaIds)

  if (!items || items.length === 0) return new Map()

  // 2. Nombres de productos
  const prodIds = Array.from(new Set(items.map((i) => i.producto_id).filter(Boolean)))
  const prodMap = new Map<string, string>()
  if (prodIds.length > 0) {
    const { data: prods } = await supabase
      .schema('erp')
      .from('productos')
      .select('id, nombre')
      .in('id', prodIds)

    for (const p of prods || []) {
      prodMap.set(p.id, p.nombre)
    }
  }

  // 3. Agrupar por factura
  const porFactura = new Map<string, string[]>()
  for (const item of items) {
    const nombre = item.descripcion || prodMap.get(item.producto_id) || 'Producto'
    if (!porFactura.has(item.factura_id)) porFactura.set(item.factura_id, [])
    porFactura.get(item.factura_id)!.push(nombre)
  }

  // 4. Construir descripción
  const result = new Map<string, string>()
  porFactura.forEach((nombres, facturaId) => {
    if (nombres.length === 0) return
    const first = nombres[0]
    result.set(
      facturaId,
      nombres.length > 1 ? `${first} (+${nombres.length - 1} mas)` : first
    )
  })

  return result
}
