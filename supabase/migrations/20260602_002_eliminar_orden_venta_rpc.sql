-- ============================================================================
-- RPC transaccional para eliminar una orden de venta
-- Aplicado en BD el 02-jun-2026
--
-- Reemplaza el patron del frontend que hacia 2 DELETEs separados:
--   1) DELETE FROM cotizacion_items WHERE cotizacion_id = X
--   2) DELETE FROM cotizaciones WHERE id = X
-- Si el segundo fallaba (modo lectura, FK, lock, etc.), items quedaban
-- borrados pero cabecera viva y huerfana. Causa del caso OV-00099.
--
-- La RPC ejecuta ambos pasos en una transaccion: si algo falla, TODO
-- se revierte (incluyendo los snapshots de papelera del trigger AFTER
-- DELETE de la migracion 20260602_001).
-- ============================================================================

CREATE OR REPLACE FUNCTION erp.eliminar_orden_venta(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  v_status   VARCHAR;
  v_factura  UUID;
BEGIN
  SELECT status, factura_id INTO v_status, v_factura
  FROM erp.cotizaciones
  WHERE id = p_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'La orden de venta no existe (id=%)', p_id;
  END IF;

  IF v_status != 'orden_venta' THEN
    RAISE EXCEPTION 'Solo se pueden eliminar ordenes de venta en status orden_venta (actual: %)', v_status;
  END IF;

  IF v_factura IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede eliminar una orden de venta que ya fue facturada (factura_id=%)', v_factura;
  END IF;

  DELETE FROM erp.cotizacion_items WHERE cotizacion_id = p_id;
  DELETE FROM erp.cotizaciones WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.eliminar_orden_venta(p_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = erp, public AS $$
  SELECT erp.eliminar_orden_venta(p_id);
$$;

GRANT EXECUTE ON FUNCTION erp.eliminar_orden_venta(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_orden_venta(UUID) TO authenticated;
