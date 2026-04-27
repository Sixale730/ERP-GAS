-- Historial Producto v2: anade delta_stock, stock_despues (anclado al stock real
-- actual), afecta_stock + parametro p_tipos[] para filtro server-side.
-- DROP+CREATE porque cambia la firma de retorno y la firma de argumentos.

DROP FUNCTION IF EXISTS erp.historial_producto_unificado(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.historial_producto_unificado(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS erp.historial_producto_unificado(UUID, INTEGER, INTEGER, TEXT[]) CASCADE;
DROP FUNCTION IF EXISTS public.historial_producto_unificado(UUID, INTEGER, INTEGER, TEXT[]) CASCADE;

CREATE OR REPLACE FUNCTION erp.historial_producto_unificado(
  p_producto_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_tipos TEXT[] DEFAULT NULL
) RETURNS TABLE (
  id TEXT, fecha TIMESTAMPTZ, tipo_documento TEXT, documento_id UUID,
  folio TEXT, entidad_nombre TEXT, cantidad NUMERIC, monto NUMERIC,
  status TEXT, moneda TEXT, notas TEXT,
  delta_stock NUMERIC, stock_despues NUMERIC, afecta_stock BOOLEAN
) AS $$
  WITH stock_actual AS (
    SELECT COALESCE(SUM(cantidad), 0) AS total
    FROM erp.inventario WHERE producto_id = p_producto_id
  ),
  movs AS (
    SELECT
      mi.id, mi.created_at::timestamptz AS fecha, mi.tipo, mi.cantidad, mi.notas,
      COALESCE(a_dest.nombre, a_orig.nombre, 'N/A') AS entidad_nombre,
      CASE mi.tipo WHEN 'entrada' THEN mi.cantidad ELSE -mi.cantidad END AS delta
    FROM erp.movimientos_inventario mi
    LEFT JOIN erp.almacenes a_orig ON a_orig.id = mi.almacen_origen_id
    LEFT JOIN erp.almacenes a_dest ON a_dest.id = mi.almacen_destino_id
    WHERE mi.producto_id = p_producto_id
  ),
  delta_total AS (SELECT COALESCE(SUM(delta), 0) AS total FROM movs),
  movs_balance AS (
    SELECT m.*, SUM(m.delta) OVER (ORDER BY m.fecha ASC, m.id ASC) AS cum_sum
    FROM movs m
  ),
  -- Anclar al stock real actual: offset = stock_actual - SUM(deltas).
  -- Garantiza que el stock_despues del ultimo movimiento siempre coincida
  -- con la suma observable de inventario.cantidad, aun cuando haya cambios
  -- historicos no registrados como movimiento.
  movs_anclado AS (
    SELECT mb.*,
      mb.cum_sum + ((SELECT total FROM stock_actual) - (SELECT total FROM delta_total)) AS stock_despues_real
    FROM movs_balance mb
  ),
  todos AS (
    SELECT
      'cot-' || ci.id::text AS id,
      c.created_at::timestamptz AS fecha,
      'cotizacion'::text AS tipo_documento,
      c.id AS documento_id,
      c.folio,
      cl.nombre_comercial AS entidad_nombre,
      ci.cantidad,
      ci.subtotal AS monto,
      c.status,
      c.moneda::text AS moneda,
      c.notas,
      NULL::numeric AS delta_stock,
      NULL::numeric AS stock_despues,
      false AS afecta_stock
    FROM erp.cotizacion_items ci
    JOIN erp.cotizaciones c ON c.id = ci.cotizacion_id
    JOIN erp.clientes cl ON cl.id = c.cliente_id
    WHERE ci.producto_id = p_producto_id AND c.folio NOT LIKE 'OV-%'
    UNION ALL
    SELECT 'ov-' || ci.id::text, c.created_at::timestamptz, 'orden_venta'::text,
           c.id, c.folio, cl.nombre_comercial,
           ci.cantidad, ci.subtotal, c.status, c.moneda::text, c.notas,
           NULL::numeric, NULL::numeric, false
    FROM erp.cotizacion_items ci
    JOIN erp.cotizaciones c ON c.id = ci.cotizacion_id
    JOIN erp.clientes cl ON cl.id = c.cliente_id
    WHERE ci.producto_id = p_producto_id AND c.folio LIKE 'OV-%'
    UNION ALL
    SELECT 'fac-' || fi.id::text, f.created_at::timestamptz, 'factura'::text,
           f.id, f.folio, cl.nombre_comercial,
           fi.cantidad, fi.subtotal, f.status, COALESCE(f.moneda::text, 'MXN'), f.notas,
           NULL::numeric, NULL::numeric, false
    FROM erp.factura_items fi
    JOIN erp.facturas f ON f.id = fi.factura_id
    JOIN erp.clientes cl ON cl.id = f.cliente_id
    WHERE fi.producto_id = p_producto_id
    UNION ALL
    SELECT 'oc-' || oci.id::text, oc.created_at::timestamptz, 'orden_compra'::text,
           oc.id, oc.folio, COALESCE(p.nombre_comercial, p.razon_social),
           oci.cantidad_solicitada, oci.subtotal, oc.status::text, oc.moneda::text, oc.notas,
           NULL::numeric, NULL::numeric, false
    FROM erp.orden_compra_items oci
    JOIN erp.ordenes_compra oc ON oc.id = oci.orden_compra_id
    JOIN erp.proveedores p ON p.id = oc.proveedor_id
    WHERE oci.producto_id = p_producto_id
    UNION ALL
    SELECT 'mov-' || ma.id::text, ma.fecha, 'movimiento'::text,
           ma.id, NULL::text, ma.entidad_nombre,
           ma.cantidad, NULL::numeric, ma.tipo::text, NULL::text, ma.notas,
           ma.delta, ma.stock_despues_real, true
    FROM movs_anclado ma
  )
  SELECT *
  FROM todos
  WHERE p_tipos IS NULL OR tipo_documento = ANY(p_tipos)
  ORDER BY fecha DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.historial_producto_unificado(
  p_producto_id UUID, p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0, p_tipos TEXT[] DEFAULT NULL
) RETURNS TABLE (
  id TEXT, fecha TIMESTAMPTZ, tipo_documento TEXT, documento_id UUID,
  folio TEXT, entidad_nombre TEXT, cantidad NUMERIC, monto NUMERIC,
  status TEXT, moneda TEXT, notas TEXT,
  delta_stock NUMERIC, stock_despues NUMERIC, afecta_stock BOOLEAN
) AS $$
  SELECT * FROM erp.historial_producto_unificado(p_producto_id, p_limit, p_offset, p_tipos);
$$ LANGUAGE sql STABLE;

-- Count que respeta filtros opcionales
DROP FUNCTION IF EXISTS erp.historial_producto_unificado_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.historial_producto_unificado_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS erp.historial_producto_unificado_count(UUID, TEXT[]) CASCADE;
DROP FUNCTION IF EXISTS public.historial_producto_unificado_count(UUID, TEXT[]) CASCADE;

CREATE OR REPLACE FUNCTION erp.historial_producto_unificado_count(
  p_producto_id UUID,
  p_tipos TEXT[] DEFAULT NULL
) RETURNS BIGINT AS $$
  SELECT COUNT(*)::bigint FROM (
    SELECT 'cotizacion'::text AS tipo_documento FROM erp.cotizacion_items ci
      JOIN erp.cotizaciones c ON c.id=ci.cotizacion_id
      WHERE ci.producto_id=p_producto_id AND c.folio NOT LIKE 'OV-%'
    UNION ALL
    SELECT 'orden_venta' FROM erp.cotizacion_items ci
      JOIN erp.cotizaciones c ON c.id=ci.cotizacion_id
      WHERE ci.producto_id=p_producto_id AND c.folio LIKE 'OV-%'
    UNION ALL
    SELECT 'factura' FROM erp.factura_items WHERE producto_id=p_producto_id
    UNION ALL
    SELECT 'orden_compra' FROM erp.orden_compra_items WHERE producto_id=p_producto_id
    UNION ALL
    SELECT 'movimiento' FROM erp.movimientos_inventario WHERE producto_id=p_producto_id
  ) t WHERE p_tipos IS NULL OR tipo_documento = ANY(p_tipos);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.historial_producto_unificado_count(
  p_producto_id UUID, p_tipos TEXT[] DEFAULT NULL
) RETURNS BIGINT AS $$
  SELECT erp.historial_producto_unificado_count(p_producto_id, p_tipos);
$$ LANGUAGE sql STABLE;

-- Conteo por tipo (para badges en chips de filtro)
DROP FUNCTION IF EXISTS erp.historial_producto_counts_por_tipo(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.historial_producto_counts_por_tipo(UUID) CASCADE;

CREATE OR REPLACE FUNCTION erp.historial_producto_counts_por_tipo(
  p_producto_id UUID
) RETURNS TABLE (tipo_documento TEXT, total BIGINT) AS $$
  SELECT t.tipo, COUNT(*)::bigint FROM (
    SELECT 'cotizacion'::text AS tipo FROM erp.cotizacion_items ci
      JOIN erp.cotizaciones c ON c.id=ci.cotizacion_id
      WHERE ci.producto_id=p_producto_id AND c.folio NOT LIKE 'OV-%'
    UNION ALL
    SELECT 'orden_venta' FROM erp.cotizacion_items ci
      JOIN erp.cotizaciones c ON c.id=ci.cotizacion_id
      WHERE ci.producto_id=p_producto_id AND c.folio LIKE 'OV-%'
    UNION ALL
    SELECT 'factura' FROM erp.factura_items WHERE producto_id=p_producto_id
    UNION ALL
    SELECT 'orden_compra' FROM erp.orden_compra_items WHERE producto_id=p_producto_id
    UNION ALL
    SELECT 'movimiento' FROM erp.movimientos_inventario WHERE producto_id=p_producto_id
  ) t GROUP BY t.tipo;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.historial_producto_counts_por_tipo(
  p_producto_id UUID
) RETURNS TABLE (tipo_documento TEXT, total BIGINT) AS $$
  SELECT * FROM erp.historial_producto_counts_por_tipo(p_producto_id);
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION erp.historial_producto_unificado(UUID, INTEGER, INTEGER, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION erp.historial_producto_unificado_count(UUID, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION erp.historial_producto_counts_por_tipo(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.historial_producto_unificado(UUID, INTEGER, INTEGER, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.historial_producto_unificado_count(UUID, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.historial_producto_counts_por_tipo(UUID) TO anon, authenticated;
