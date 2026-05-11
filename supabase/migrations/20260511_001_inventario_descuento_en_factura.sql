-- =====================================================================
-- Inventario: mover descuento de fisico de "OV" a "Factura"
-- =====================================================================
-- Antes: convertir cotizacion -> OV descontaba erp.inventario.cantidad y
--        creaba movimientos tipo='salida'. La factura solo cambiaba estados
--        sin tocar inventario. Resultado: el fisico bajaba antes de que la
--        mercancia realmente saliera; OVs no facturadas dejaban fisico
--        negativo (caso real: producto GP-RN-TP -7 en Almacen Central).
--
-- Ahora: convertir/crear OV NO toca inventario. La OV solo "reserva"
--        (calculo dinamico vivo en v_inventario_detalle desde
--        cotizacion_items con status='orden_venta'). Cuando la OV se
--        factura via cotizacion_a_factura, ahi se descuenta el fisico
--        y se inserta el movimiento de salida con referencia_tipo='factura'.
--
-- Idempotencia para OVs LEGACY (creadas antes de esta migracion, ya
-- descontaron al pasar a OV):
--  - cotizacion_a_factura no descuenta si ya existe movimiento previo
--    de salida con referencia_tipo='cotizacion' y referencia_id=p_cotizacion_id
--    para el mismo producto.
--  - cancelar_orden_venta restaura solo el saldo neto pendiente (salidas
--    menos entradas previas) por producto/cotizacion. OVs nuevas (sin
--    salidas) no producen restauracion.
--
-- Proteccion: CHECK (cantidad >= 0) NOT VALID en erp.inventario para que
-- ningun UPDATE futuro pueda dejar fisico negativo. NOT VALID porque hoy
-- ya hay registros con cantidad < 0 que requieren ajuste manual aparte.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) cotizacion_a_orden_venta: ya no toca inventario ni movimientos.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION erp.cotizacion_a_orden_venta(p_cotizacion_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_cotizacion RECORD;
  v_nuevo_folio VARCHAR;
  v_nueva_ov_id UUID;
BEGIN
  SELECT * INTO v_cotizacion FROM erp.cotizaciones WHERE id = p_cotizacion_id;
  IF v_cotizacion IS NULL THEN RAISE EXCEPTION 'Cotizacion no encontrada'; END IF;
  IF v_cotizacion.status = 'cancelada' THEN RAISE EXCEPTION 'No se puede convertir una cotizacion cancelada'; END IF;

  v_nuevo_folio := erp.generar_folio('orden_venta');

  INSERT INTO erp.cotizaciones (
    folio, cliente_id, almacen_id, lista_precio_id, fecha,
    vigencia_dias, status, subtotal, descuento_porcentaje, descuento_monto,
    iva, total, notas, terminos_condiciones, vendedor_id, vendedor_nombre,
    tipo_cambio, margen_aplicado, moneda,
    cfdi_rfc, cfdi_razon_social, cfdi_regimen_fiscal, cfdi_uso_cfdi, cfdi_codigo_postal,
    envio_direccion, envio_ciudad, envio_estado, envio_codigo_postal, envio_contacto, envio_telefono,
    forma_pago, metodo_pago, condiciones_pago, organizacion_id, oc_cliente, cotizacion_origen_id
  ) VALUES (
    v_nuevo_folio, v_cotizacion.cliente_id, v_cotizacion.almacen_id, v_cotizacion.lista_precio_id, CURRENT_DATE,
    v_cotizacion.vigencia_dias, 'orden_venta', v_cotizacion.subtotal, v_cotizacion.descuento_porcentaje, v_cotizacion.descuento_monto,
    v_cotizacion.iva, v_cotizacion.total, v_cotizacion.notas, v_cotizacion.terminos_condiciones, v_cotizacion.vendedor_id, v_cotizacion.vendedor_nombre,
    v_cotizacion.tipo_cambio, v_cotizacion.margen_aplicado, v_cotizacion.moneda,
    v_cotizacion.cfdi_rfc, v_cotizacion.cfdi_razon_social, v_cotizacion.cfdi_regimen_fiscal, v_cotizacion.cfdi_uso_cfdi, v_cotizacion.cfdi_codigo_postal,
    v_cotizacion.envio_direccion, v_cotizacion.envio_ciudad, v_cotizacion.envio_estado, v_cotizacion.envio_codigo_postal, v_cotizacion.envio_contacto, v_cotizacion.envio_telefono,
    v_cotizacion.forma_pago, v_cotizacion.metodo_pago, v_cotizacion.condiciones_pago, v_cotizacion.organizacion_id, v_cotizacion.oc_cliente,
    p_cotizacion_id
  ) RETURNING id INTO v_nueva_ov_id;

  INSERT INTO erp.cotizacion_items (cotizacion_id, producto_id, descripcion, cantidad, precio_unitario, descuento_porcentaje, subtotal, costo_base, organizacion_id)
  SELECT v_nueva_ov_id, producto_id, descripcion, cantidad, precio_unitario, descuento_porcentaje, subtotal, costo_base, organizacion_id
  FROM erp.cotizacion_items WHERE cotizacion_id = p_cotizacion_id;

  -- INVENTARIO: NO se toca aqui. Se descuenta al facturar via cotizacion_a_factura.
  -- La OV solo "reserva" (calculo dinamico en v_inventario_detalle).

  RETURN v_nueva_ov_id;
END;
$function$;


-- ---------------------------------------------------------------------
-- 2) cotizacion_a_factura: ahora SI descuenta inventario (idempotente).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION erp.cotizacion_a_factura(p_cotizacion_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_cotizacion erp.cotizaciones%ROWTYPE;
    v_cliente erp.clientes%ROWTYPE;
    v_factura_id UUID;
    v_folio VARCHAR(50);
    v_item RECORD;
    v_ya_descontado BOOLEAN;
BEGIN
    SELECT * INTO v_cotizacion FROM erp.cotizaciones WHERE id = p_cotizacion_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cotizacion no encontrada'; END IF;
    IF v_cotizacion.status = 'facturada' THEN RAISE EXCEPTION 'La cotizacion ya fue facturada'; END IF;
    IF v_cotizacion.status != 'orden_venta' THEN RAISE EXCEPTION 'La cotizacion debe estar en estado "orden_venta" para facturar'; END IF;

    SELECT * INTO v_cliente FROM erp.clientes WHERE id = v_cotizacion.cliente_id;
    v_folio := erp.generar_folio('factura');

    INSERT INTO erp.facturas (
        folio, cliente_id, almacen_id, cotizacion_id, direccion_envio_id,
        fecha, fecha_vencimiento, status,
        cliente_rfc, cliente_razon_social, cliente_regimen_fiscal, cliente_uso_cfdi,
        subtotal, descuento_monto, iva, total, saldo, notas,
        vendedor_id, vendedor_nombre, moneda, tipo_cambio, organizacion_id
    ) VALUES (
        v_folio, v_cotizacion.cliente_id, v_cotizacion.almacen_id, p_cotizacion_id, v_cotizacion.direccion_envio_id,
        CURRENT_DATE, CURRENT_DATE + COALESCE(v_cliente.dias_credito, 0), 'pendiente',
        COALESCE(v_cotizacion.cfdi_rfc, v_cliente.rfc),
        COALESCE(v_cotizacion.cfdi_razon_social, v_cliente.razon_social),
        COALESCE(v_cotizacion.cfdi_regimen_fiscal, v_cliente.regimen_fiscal),
        COALESCE(v_cotizacion.cfdi_uso_cfdi, v_cliente.uso_cfdi),
        v_cotizacion.subtotal, v_cotizacion.descuento_monto, v_cotizacion.iva,
        v_cotizacion.total, v_cotizacion.total, v_cotizacion.notas,
        v_cotizacion.vendedor_id, v_cotizacion.vendedor_nombre,
        v_cotizacion.moneda, v_cotizacion.tipo_cambio, v_cotizacion.organizacion_id
    ) RETURNING id INTO v_factura_id;

    FOR v_item IN SELECT * FROM erp.cotizacion_items WHERE cotizacion_id = p_cotizacion_id
    LOOP
        INSERT INTO erp.factura_items (
            factura_id, producto_id, descripcion, cantidad,
            precio_unitario, descuento_porcentaje, subtotal, organizacion_id
        ) VALUES (
            v_factura_id, v_item.producto_id, v_item.descripcion, v_item.cantidad,
            v_item.precio_unitario, v_item.descuento_porcentaje, v_item.subtotal,
            v_cotizacion.organizacion_id
        );

        -- Descontar inventario SOLO si esta OV no descargo previamente
        -- (idempotencia para OVs creadas antes de la migracion 20260511_001).
        -- Servicios no afectan inventario.
        IF NOT EXISTS (
            SELECT 1 FROM erp.productos
            WHERE id = v_item.producto_id AND es_servicio = true
        ) THEN
            v_ya_descontado := EXISTS (
                SELECT 1 FROM erp.movimientos_inventario
                WHERE referencia_tipo = 'cotizacion'
                  AND referencia_id   = p_cotizacion_id
                  AND tipo            = 'salida'
                  AND producto_id     = v_item.producto_id
            );

            IF NOT v_ya_descontado THEN
                UPDATE erp.inventario
                SET cantidad = cantidad - v_item.cantidad,
                    updated_at = NOW()
                WHERE producto_id = v_item.producto_id
                  AND almacen_id  = v_cotizacion.almacen_id;

                INSERT INTO erp.movimientos_inventario (
                    producto_id, almacen_origen_id, tipo, cantidad,
                    referencia_tipo, referencia_id, notas, organizacion_id
                ) VALUES (
                    v_item.producto_id, v_cotizacion.almacen_id, 'salida', v_item.cantidad,
                    'factura', v_factura_id, 'Factura ' || v_folio,
                    v_cotizacion.organizacion_id
                );
            END IF;
        END IF;
    END LOOP;

    UPDATE erp.cotizaciones SET status = 'facturada', factura_id = v_factura_id WHERE id = p_cotizacion_id;
    UPDATE erp.clientes SET saldo_pendiente = saldo_pendiente + v_cotizacion.total WHERE id = v_cotizacion.cliente_id;

    -- Saldo de sucursal si hay direccion_envio_id
    IF v_cotizacion.direccion_envio_id IS NOT NULL THEN
        UPDATE erp.direcciones_envio
        SET saldo_pendiente = saldo_pendiente + v_cotizacion.total
        WHERE id = v_cotizacion.direccion_envio_id;
    END IF;

    RETURN v_factura_id;
END;
$function$;


-- ---------------------------------------------------------------------
-- 3) cancelar_orden_venta: solo restaura el saldo neto pendiente.
--    OVs nuevas (post-migracion, sin movimientos) no tocan inventario.
--    OVs legacy con saldo neto > 0 se restauran cuadrando exactamente.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION erp.cancelar_orden_venta(p_cotizacion_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_cotizacion RECORD;
  v_item RECORD;
  v_saldo_neto NUMERIC;
BEGIN
  SELECT * INTO v_cotizacion FROM erp.cotizaciones WHERE id = p_cotizacion_id;
  IF v_cotizacion IS NULL THEN RAISE EXCEPTION 'Cotizacion no encontrada'; END IF;
  IF v_cotizacion.status != 'orden_venta' THEN RAISE EXCEPTION 'Solo se pueden cancelar ordenes de venta'; END IF;

  FOR v_item IN
    SELECT ci.producto_id, ci.cantidad
    FROM erp.cotizacion_items ci
    JOIN erp.productos p ON p.id = ci.producto_id
    WHERE ci.cotizacion_id = p_cotizacion_id AND NOT p.es_servicio
  LOOP
    -- Saldo neto previo de esta OV+producto: salidas - entradas ya registradas.
    -- Si > 0 hay descuento legacy pendiente de restaurar.
    SELECT COALESCE(SUM(
      CASE
        WHEN m.tipo = 'salida'  THEN  m.cantidad
        WHEN m.tipo = 'entrada' THEN -m.cantidad
        ELSE 0
      END
    ), 0)
    INTO v_saldo_neto
    FROM erp.movimientos_inventario m
    WHERE m.referencia_tipo = 'cotizacion'
      AND m.referencia_id   = p_cotizacion_id
      AND m.producto_id     = v_item.producto_id;

    IF v_saldo_neto > 0 THEN
      UPDATE erp.inventario
      SET cantidad = cantidad + v_saldo_neto, updated_at = NOW()
      WHERE producto_id = v_item.producto_id
        AND almacen_id  = v_cotizacion.almacen_id;

      INSERT INTO erp.movimientos_inventario (
        producto_id, almacen_destino_id, tipo, cantidad,
        referencia_tipo, referencia_id, notas, organizacion_id
      ) VALUES (
        v_item.producto_id, v_cotizacion.almacen_id, 'entrada', v_saldo_neto,
        'cotizacion', p_cotizacion_id, 'Cancelacion OV ' || v_cotizacion.folio,
        v_cotizacion.organizacion_id
      );
    END IF;
  END LOOP;

  UPDATE erp.cotizaciones SET status = 'cancelada', updated_at = NOW() WHERE id = p_cotizacion_id;
END;
$function$;


-- ---------------------------------------------------------------------
-- 4) descontar_inventario_ov: ya no se necesita. La OV no descuenta.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS erp.descontar_inventario_ov(uuid);


-- ---------------------------------------------------------------------
-- 5) Proteccion: CHECK cantidad >= 0 en erp.inventario.
--    NOT VALID porque hoy hay registros con cantidad < 0 que se
--    corregiran via ajuste manual desde /inventario.
-- ---------------------------------------------------------------------
ALTER TABLE erp.inventario
  DROP CONSTRAINT IF EXISTS inventario_cantidad_no_negativa;

ALTER TABLE erp.inventario
  ADD CONSTRAINT inventario_cantidad_no_negativa CHECK (cantidad >= 0) NOT VALID;
