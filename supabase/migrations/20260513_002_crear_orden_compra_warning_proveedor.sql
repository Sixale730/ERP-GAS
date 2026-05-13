-- =====================================================================
-- crear_orden_compra: warning suave si proveedor de OC != proveedor
--                     principal del producto
-- =====================================================================
-- No bloquea la operacion. Registra entrada informativa en
-- historial_documentos con accion='warning_proveedor' por cada item
-- cuyo proveedor_principal_id no coincida con el proveedor de la OC.
--
-- La UI en /compras/nueva ya muestra warning visual antes de crear,
-- pero esta validacion garantiza traza si la OC se crea desde codigo
-- (RPC, scripts, futura API) sin pasar por la UI.
-- =====================================================================

CREATE OR REPLACE FUNCTION erp.crear_orden_compra(p_orden jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_orden_id uuid;
  v_folio varchar;
  v_org_id uuid;
  v_item jsonb;
  v_items_count int;
  v_oc_proveedor_id uuid;
  v_prod_proveedor_id uuid;
  v_prod_sku varchar;
  v_prod_nombre varchar;
  v_oc_proveedor_nombre varchar;
  v_warnings text[] := ARRAY[]::text[];
  v_user_id uuid;
  v_user_nombre varchar;
BEGIN
  v_org_id := erp.get_my_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organizacion no identificada';
  END IF;

  -- Validaciones basicas
  IF (p_orden->>'proveedor_id') IS NULL THEN
    RAISE EXCEPTION 'proveedor_id es requerido';
  END IF;
  IF (p_orden->>'almacen_destino_id') IS NULL THEN
    RAISE EXCEPTION 'almacen_destino_id es requerido';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items debe ser un array JSON';
  END IF;
  SELECT jsonb_array_length(p_items) INTO v_items_count;
  IF v_items_count = 0 THEN
    RAISE EXCEPTION 'La OC debe incluir al menos un item';
  END IF;

  v_oc_proveedor_id := (p_orden->>'proveedor_id')::uuid;

  -- Cabecera
  INSERT INTO erp.ordenes_compra (
    proveedor_id, almacen_destino_id, organizacion_id,
    fecha, fecha_esperada, status, moneda, tipo_cambio,
    subtotal, iva, total, notas, creado_por, creado_por_nombre
  ) VALUES (
    v_oc_proveedor_id,
    (p_orden->>'almacen_destino_id')::uuid,
    v_org_id,
    COALESCE((p_orden->>'fecha')::date, CURRENT_DATE),
    NULLIF(p_orden->>'fecha_esperada','')::date,
    COALESCE(p_orden->>'status', 'borrador'),
    COALESCE(p_orden->>'moneda', 'USD'),
    NULLIF(p_orden->>'tipo_cambio','')::numeric,
    COALESCE((p_orden->>'subtotal')::numeric, 0),
    COALESCE((p_orden->>'iva')::numeric, 0),
    COALESCE((p_orden->>'total')::numeric, 0),
    NULLIF(p_orden->>'notas',''),
    NULLIF(p_orden->>'creado_por','')::uuid,
    NULLIF(p_orden->>'creado_por_nombre','')
  ) RETURNING id, folio INTO v_orden_id, v_folio;

  -- Items + chequeo de coherencia proveedor
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'producto_id') IS NULL THEN
      RAISE EXCEPTION 'Todos los items requieren producto_id';
    END IF;
    IF COALESCE((v_item->>'cantidad_solicitada')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'cantidad_solicitada debe ser > 0 para producto %', v_item->>'producto_id';
    END IF;

    INSERT INTO erp.orden_compra_items (
      orden_compra_id, producto_id,
      cantidad_solicitada, precio_unitario, descuento_porcentaje, organizacion_id
    ) VALUES (
      v_orden_id,
      (v_item->>'producto_id')::uuid,
      (v_item->>'cantidad_solicitada')::numeric,
      COALESCE((v_item->>'precio_unitario')::numeric, 0),
      COALESCE((v_item->>'descuento_porcentaje')::numeric, 0),
      v_org_id
    );

    -- P7: warning si proveedor del producto != proveedor de la OC
    SELECT proveedor_principal_id, sku, nombre
    INTO v_prod_proveedor_id, v_prod_sku, v_prod_nombre
    FROM erp.productos
    WHERE id = (v_item->>'producto_id')::uuid;

    IF v_prod_proveedor_id IS NOT NULL AND v_prod_proveedor_id <> v_oc_proveedor_id THEN
      v_warnings := array_append(v_warnings,
        format('%s (%s) - proveedor principal en producto difiere del proveedor de la OC',
          COALESCE(v_prod_sku, '?'), COALESCE(v_prod_nombre, '?')));
    END IF;
  END LOOP;

  -- Si hubo warnings, registrar en historial (no bloquea)
  IF array_length(v_warnings, 1) > 0 THEN
    SELECT u.id, u.nombre INTO v_user_id, v_user_nombre
    FROM erp.usuarios u WHERE u.auth_user_id = auth.uid() LIMIT 1;

    SELECT pr.razon_social INTO v_oc_proveedor_nombre
    FROM erp.proveedores pr WHERE pr.id = v_oc_proveedor_id;

    INSERT INTO erp.historial_documentos (
      documento_tipo, documento_id, documento_folio,
      usuario_id, usuario_nombre, accion, descripcion, datos_nuevos
    ) VALUES (
      'orden_compra', v_orden_id, v_folio,
      v_user_id, v_user_nombre,
      'warning_proveedor',
      format('OC creada con %s producto(s) cuyo proveedor principal difiere del proveedor de la OC (%s): %s',
        array_length(v_warnings, 1),
        COALESCE(v_oc_proveedor_nombre, v_oc_proveedor_id::text),
        array_to_string(v_warnings, ' | ')),
      jsonb_build_object(
        'oc_proveedor_id', v_oc_proveedor_id,
        'oc_proveedor_nombre', v_oc_proveedor_nombre,
        'items_con_proveedor_distinto', v_warnings
      )
    );
  END IF;

  RETURN jsonb_build_object('id', v_orden_id, 'folio', v_folio);
END;
$function$;
