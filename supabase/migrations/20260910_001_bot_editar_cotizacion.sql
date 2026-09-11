-- Edicion de cotizaciones desde el asistente de Telegram (API /api/bot/cotizaciones/[id]).
--
-- La API calcula todo con las mismas reglas que al crear (src/lib/cotizaciones/editar.ts)
-- y esta funcion guarda cabecera + partidas en UNA transaccion: o queda todo o nada.
-- La web edita en tres pasos sueltos (update, delete, insert); si falla a la mitad,
-- la cotizacion puede quedar sin partidas (asi se perdieron las de OV-00099).
--
-- SECURITY INVOKER: aplican RLS y los permisos del usuario que llama.
-- Las partidas reemplazadas quedan en erp.items_eliminados_papelera (trigger trg_papelera).
-- Solo cotizaciones en 'propuesta': las ordenes de venta reservan inventario.

CREATE OR REPLACE FUNCTION erp.bot_guardar_edicion_cotizacion(
  p_cotizacion_id UUID,
  p_cabecera JSONB,
  p_items JSONB
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = erp, public
AS $$
DECLARE
  v_cot RECORD;
  v_item JSONB;
BEGIN
  SELECT id, folio, status, organizacion_id INTO v_cot
  FROM erp.cotizaciones
  WHERE id = p_cotizacion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotizacion no encontrada';
  END IF;
  IF v_cot.status <> 'propuesta' THEN
    RAISE EXCEPTION 'La % esta en "%": solo se editan cotizaciones en propuesta', v_cot.folio, v_cot.status;
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La cotizacion no puede quedar sin partidas';
  END IF;

  UPDATE erp.cotizaciones SET
    cliente_id           = (p_cabecera->>'cliente_id')::uuid,
    direccion_envio_id   = NULLIF(p_cabecera->>'direccion_envio_id', '')::uuid,
    lista_precio_id      = (p_cabecera->>'lista_precio_id')::uuid,
    fecha                = COALESCE((p_cabecera->>'fecha')::date, fecha),
    subtotal             = (p_cabecera->>'subtotal')::numeric,
    descuento_porcentaje = COALESCE((p_cabecera->>'descuento_porcentaje')::numeric, 0),
    descuento_monto      = COALESCE((p_cabecera->>'descuento_monto')::numeric, 0),
    iva                  = (p_cabecera->>'iva')::numeric,
    total                = (p_cabecera->>'total')::numeric,
    moneda               = COALESCE(p_cabecera->>'moneda', moneda),
    tipo_cambio          = (p_cabecera->>'tipo_cambio')::numeric,
    notas                = p_cabecera->>'notas',
    vigencia_dias        = COALESCE((p_cabecera->>'vigencia_dias')::int, vigencia_dias)
  WHERE id = p_cotizacion_id;

  DELETE FROM erp.cotizacion_items WHERE cotizacion_id = p_cotizacion_id;

  -- Una por una, con clock_timestamp(): el PDF ordena las partidas por created_at
  -- y con un solo INSERT todas tendrian la misma hora.
  FOR v_item IN
    SELECT e.value FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(value, n) ORDER BY e.n
  LOOP
    INSERT INTO erp.cotizacion_items (
      cotizacion_id, producto_id, descripcion, cantidad, precio_unitario,
      descuento_porcentaje, subtotal, organizacion_id, created_at
    ) VALUES (
      p_cotizacion_id,
      (v_item->>'producto_id')::uuid,
      v_item->>'descripcion',
      (v_item->>'cantidad')::numeric,
      (v_item->>'precio_unitario')::numeric,
      0,
      (v_item->>'subtotal')::numeric,
      v_cot.organizacion_id,
      clock_timestamp()
    );
  END LOOP;

  RETURN v_cot.folio;
END;
$$;

GRANT EXECUTE ON FUNCTION erp.bot_guardar_edicion_cotizacion(UUID, JSONB, JSONB) TO authenticated;
