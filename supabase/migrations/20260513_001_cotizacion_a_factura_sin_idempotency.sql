-- =====================================================================
-- cotizacion_a_factura: quitar idempotency check
-- =====================================================================
-- El idempotency check introducido en 20260511_001 detectaba si ya habia
-- movimientos previos `tipo='salida' referencia_tipo='cotizacion'` para
-- esa OV (escenario "OV legacy que descontaba al pasar a OV") y NO
-- volvia a descontar al facturar. La intencion era evitar doble descuento.
--
-- Problema real (caso OV-00071, 13/05/2026): si entre el descuento previo
-- y la facturacion se hizo un AJUSTE manual que compenso ese descuento
-- (sumando al inventario las piezas que la OV iba a sacar), el idempotency
-- bloquea el descuento al facturar y el inventario queda inflado.
--
-- Es decir: el idempotency mira movimientos historicos pero NO ve si el
-- inventario actual ya fue compensado por un ajuste posterior. No hay
-- senal en el modelo para distinguir "ya descontado" vs "descontado pero
-- compensado por ajuste".
--
-- Solucion: facturar SIEMPRE descuenta. Las OVs legacy NO facturadas que
-- ya descontaron al pasar a OV requeriran que el operador haga un ajuste
-- compensatorio antes de facturar (sumando al inventario lo que la OV
-- "ya gasto") o asumir el doble descuento si ya hay stock real para
-- absorberlo (el trigger trg_inventario_no_negativa bloqueara salidas
-- que dejen el saldo profundizando un negativo).
-- =====================================================================

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

        -- Descontar inventario (sin idempotency: facturar SIEMPRE descuenta).
        -- Servicios no afectan inventario.
        IF NOT EXISTS (
            SELECT 1 FROM erp.productos
            WHERE id = v_item.producto_id AND es_servicio = true
        ) THEN
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
    END LOOP;

    UPDATE erp.cotizaciones SET status = 'facturada', factura_id = v_factura_id WHERE id = p_cotizacion_id;
    UPDATE erp.clientes SET saldo_pendiente = saldo_pendiente + v_cotizacion.total WHERE id = v_cotizacion.cliente_id;

    IF v_cotizacion.direccion_envio_id IS NOT NULL THEN
        UPDATE erp.direcciones_envio
        SET saldo_pendiente = saldo_pendiente + v_cotizacion.total
        WHERE id = v_cotizacion.direccion_envio_id;
    END IF;

    RETURN v_factura_id;
END;
$function$;
