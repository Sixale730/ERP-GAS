-- =====================================================================
-- Correccion de precios de items de Orden de Compra (post-recepcion)
-- =====================================================================
-- Necesario para conciliar precios contra la factura del proveedor cuando
-- llega despues de la recepcion. El editor /compras/[id]/editar hacia
-- DELETE+INSERT de items, lo que choca con la FK
-- recepciones_orden.orden_compra_item_id (ON DELETE NO ACTION) y rompe
-- "violates foreign key constraint" en cuanto la OC ya tiene recepciones.
--
-- Aqui dos RPCs:
--   - recalcular_totales_oc(p_orden_id): recalcula subtotal/iva/total
--     de erp.ordenes_compra desde la suma de items. IVA fijo 16%
--     (mismo calculo que el frontend en compras/nueva).
--   - corregir_precio_oc_item(p_item_id, p_precio, p_descuento, p_motivo):
--     UPDATE quirurgico (sin tocar el id), recalcula totales de la OC
--     y deja audit en historial_documentos. Gate por rol.
--
-- Estrategia de costo promedio: "going forward". El UPDATE no recalcula
-- erp.productos.costo_promedio para piezas ya recibidas (eso quedaria
-- desfasando reportes historicos). El nuevo precio si se usa cuando
-- llegue el resto de la mercancia via registrar_recepcion (que lee
-- precio_unitario en vivo).
-- =====================================================================


-- 1) Recalcular totales de una OC desde sus items
CREATE OR REPLACE FUNCTION erp.recalcular_totales_oc(p_orden_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_subtotal NUMERIC;
BEGIN
  SELECT COALESCE(SUM(subtotal), 0)
  INTO v_subtotal
  FROM erp.orden_compra_items
  WHERE orden_compra_id = p_orden_id;

  UPDATE erp.ordenes_compra
  SET subtotal   = ROUND(v_subtotal, 2),
      iva        = ROUND(v_subtotal * 0.16, 2),
      total      = ROUND(v_subtotal * 1.16, 2),
      updated_at = NOW()
  WHERE id = p_orden_id;
END;
$function$;


-- 2) Correccion de precio (y opcionalmente descuento) de un item de OC
CREATE OR REPLACE FUNCTION erp.corregir_precio_oc_item(
  p_item_id          uuid,
  p_nuevo_precio     numeric,
  p_nuevo_descuento  numeric DEFAULT NULL,
  p_motivo           text    DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_orden_id        uuid;
  v_status          varchar;
  v_folio           varchar;
  v_org             uuid;
  v_precio_viejo    numeric;
  v_descuento_viejo numeric;
  v_subtotal_viejo  numeric;
  v_descuento_final numeric;
  v_user_id         uuid;
  v_user_nombre     varchar;
  v_user_rol        varchar;
  v_sku             varchar;
  v_producto_nombre varchar;
  v_descripcion     text;
BEGIN
  -- Validar parametros
  IF p_nuevo_precio IS NULL OR p_nuevo_precio < 0 THEN
    RAISE EXCEPTION 'El precio debe ser mayor o igual a 0';
  END IF;

  -- Datos del item + OC + producto
  SELECT oci.orden_compra_id, oc.status, oc.folio, oc.organizacion_id,
         oci.precio_unitario, oci.descuento_porcentaje, oci.subtotal,
         p.sku, p.nombre
  INTO v_orden_id, v_status, v_folio, v_org,
       v_precio_viejo, v_descuento_viejo, v_subtotal_viejo,
       v_sku, v_producto_nombre
  FROM erp.orden_compra_items oci
  JOIN erp.ordenes_compra oc ON oc.id = oci.orden_compra_id
  JOIN erp.productos p ON p.id = oci.producto_id
  WHERE oci.id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de orden de compra no encontrado';
  END IF;

  IF v_status = 'cancelada' THEN
    RAISE EXCEPTION 'No se puede corregir el precio de una OC cancelada';
  END IF;

  v_descuento_final := COALESCE(p_nuevo_descuento, v_descuento_viejo);
  IF v_descuento_final < 0 OR v_descuento_final > 100 THEN
    RAISE EXCEPTION 'El descuento debe estar entre 0 y 100';
  END IF;

  -- Permisos: super_admin o admin_cliente
  SELECT u.id, u.nombre, u.rol
  INTO v_user_id, v_user_nombre, v_user_rol
  FROM erp.usuarios u
  WHERE u.auth_user_id = auth.uid();

  IF v_user_rol IS NULL OR v_user_rol NOT IN ('super_admin', 'admin_cliente') THEN
    RAISE EXCEPTION 'No tienes permiso para corregir precios de orden de compra';
  END IF;

  -- No-op si nada cambio
  IF p_nuevo_precio = v_precio_viejo AND v_descuento_final = v_descuento_viejo THEN
    RAISE EXCEPTION 'No hay cambios que aplicar';
  END IF;

  -- UPDATE (trigger BEFORE UPDATE recalcula subtotal del item)
  UPDATE erp.orden_compra_items
  SET precio_unitario      = p_nuevo_precio,
      descuento_porcentaje = v_descuento_final
  WHERE id = p_item_id;

  -- Recalcular totales de la OC
  PERFORM erp.recalcular_totales_oc(v_orden_id);

  -- Audit en historial_documentos
  v_descripcion := format('%s (%s): precio $%s -> $%s',
    v_sku, v_producto_nombre,
    v_precio_viejo::text, p_nuevo_precio::text);

  IF v_descuento_final IS DISTINCT FROM v_descuento_viejo THEN
    v_descripcion := v_descripcion || format(', descuento %s%% -> %s%%',
      v_descuento_viejo::text, v_descuento_final::text);
  END IF;

  IF p_motivo IS NOT NULL AND length(trim(p_motivo)) > 0 THEN
    v_descripcion := v_descripcion || ' | Motivo: ' || trim(p_motivo);
  END IF;

  INSERT INTO erp.historial_documentos (
    documento_tipo, documento_id, documento_folio,
    usuario_id, usuario_nombre, accion, descripcion,
    datos_anteriores, datos_nuevos
  ) VALUES (
    'orden_compra', v_orden_id, v_folio,
    v_user_id, v_user_nombre, 'correccion_precio', v_descripcion,
    jsonb_build_object(
      'item_id',              p_item_id,
      'sku',                  v_sku,
      'producto',             v_producto_nombre,
      'precio_unitario',      v_precio_viejo,
      'descuento_porcentaje', v_descuento_viejo,
      'subtotal',             v_subtotal_viejo
    ),
    jsonb_build_object(
      'precio_unitario',      p_nuevo_precio,
      'descuento_porcentaje', v_descuento_final,
      'motivo',               p_motivo
    )
  );

  RETURN p_item_id;
END;
$function$;


-- Permisos
GRANT EXECUTE ON FUNCTION erp.recalcular_totales_oc(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION erp.corregir_precio_oc_item(uuid, numeric, numeric, text) TO anon, authenticated;
