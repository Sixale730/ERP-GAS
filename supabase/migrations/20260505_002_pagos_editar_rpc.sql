-- =====================================================================
-- RPC erp.editar_pago: editar un pago existente ajustando saldos en cascada
-- =====================================================================
-- El trigger trg_registrar_pago solo cubre INSERT. Para EDITAR un pago
-- necesitamos calcular el delta entre el monto viejo y el nuevo, y aplicar
-- ese delta a:
--   - erp.facturas: monto_pagado (+/- delta), saldo, status
--   - erp.clientes: saldo_pendiente (-/+ delta)
--   - erp.direcciones_envio: saldo_pendiente (si la factura tiene sucursal)
--
-- Si el monto no cambia, solo se actualizan los demas campos sin tocar
-- saldos. Validacion adicional: el nuevo monto no puede dejar la factura
-- sobrepagada ni con monto pagado negativo.
--
-- Nota: la migration ya se aplico en remoto via MCP; este archivo la deja
-- versionada para que branches/setups locales y futuros redeploys queden
-- alineados.
-- =====================================================================

CREATE OR REPLACE FUNCTION erp.editar_pago(
  p_pago_id      UUID,
  p_monto        NUMERIC,
  p_fecha        DATE,
  p_metodo_pago  VARCHAR,
  p_referencia   TEXT,
  p_notas        TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pago    RECORD;
  v_factura RECORD;
  v_delta   NUMERIC;
  v_nuevo_pagado NUMERIC;
BEGIN
  SELECT * INTO v_pago FROM erp.pagos WHERE id = p_pago_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pago no encontrado';
  END IF;

  SELECT * INTO v_factura FROM erp.facturas WHERE id = v_pago.factura_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura asociada al pago no encontrada';
  END IF;

  IF v_factura.status = 'cancelada' THEN
    RAISE EXCEPTION 'No se puede editar pagos de una factura cancelada';
  END IF;

  v_delta := p_monto - v_pago.monto;
  v_nuevo_pagado := v_factura.monto_pagado + v_delta;

  -- Validar: el nuevo monto pagado no puede exceder el total de la factura
  IF v_nuevo_pagado > v_factura.total + 0.0001 THEN
    RAISE EXCEPTION 'El nuevo monto excede el saldo disponible de la factura (total %, pagado tras edicion %)',
      v_factura.total, v_nuevo_pagado;
  END IF;

  IF v_nuevo_pagado < -0.0001 THEN
    RAISE EXCEPTION 'El nuevo monto deja la factura con monto pagado negativo';
  END IF;

  -- Update del pago
  UPDATE erp.pagos
  SET monto       = p_monto,
      fecha       = p_fecha,
      metodo_pago = p_metodo_pago,
      referencia  = p_referencia,
      notas       = p_notas,
      updated_at  = NOW()
  WHERE id = p_pago_id;

  -- Si cambia el monto, propagar el delta
  IF v_delta <> 0 THEN
    UPDATE erp.facturas
    SET monto_pagado = v_nuevo_pagado,
        saldo        = total - v_nuevo_pagado,
        status       = CASE
          WHEN v_nuevo_pagado >= total THEN 'pagada'
          WHEN v_nuevo_pagado > 0      THEN 'parcial'
          ELSE 'pendiente'
        END
    WHERE id = v_pago.factura_id;

    UPDATE erp.clientes
    SET saldo_pendiente = COALESCE(saldo_pendiente, 0) - v_delta
    WHERE id = v_factura.cliente_id;

    IF v_factura.direccion_envio_id IS NOT NULL THEN
      UPDATE erp.direcciones_envio
      SET saldo_pendiente = COALESCE(saldo_pendiente, 0) - v_delta
      WHERE id = v_factura.direccion_envio_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success',     TRUE,
    'pago_id',     p_pago_id,
    'factura_id',  v_pago.factura_id,
    'delta_monto', v_delta
  );
END;
$$;

GRANT EXECUTE ON FUNCTION erp.editar_pago(UUID, NUMERIC, DATE, VARCHAR, TEXT, TEXT) TO anon, authenticated;

-- Wrapper publico (convencion del repo: las RPCs criticas viven duplicadas
-- en public.* para que el cliente JS las pueda llamar via supabase.rpc()).
DROP FUNCTION IF EXISTS public.editar_pago(UUID, NUMERIC, DATE, VARCHAR, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.editar_pago(
  p_pago_id      UUID,
  p_monto        NUMERIC,
  p_fecha        DATE,
  p_metodo_pago  VARCHAR,
  p_referencia   TEXT,
  p_notas        TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN erp.editar_pago(p_pago_id, p_monto, p_fecha, p_metodo_pago, p_referencia, p_notas);
END;
$$;

GRANT EXECUTE ON FUNCTION public.editar_pago(UUID, NUMERIC, DATE, VARCHAR, TEXT, TEXT) TO anon, authenticated;
