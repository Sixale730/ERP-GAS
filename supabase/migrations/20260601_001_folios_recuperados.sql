-- ============================================================================
-- erp.folios_recuperados + modificacion a erp.generar_folio
-- Aplicado en BD el 01-jun-2026
--
-- Cuando se elimina una cotizacion (u otro documento con folio), el folio
-- queda "hueco" en la secuencia y se perderia. Esta tabla permite agregar
-- folios sueltos para que la proxima vez que se llame generar_folio('cotizacion')
-- los devuelva PRIMERO (FIFO por created_at, folio) antes de hacer nextval.
--
-- Por ahora solo se aplica al caso 'cotizacion' del CASE. Comportamiento de
-- los demas tipos (orden_venta, factura, pago, orden_compra, pos) queda
-- IDENTICO al original.
--
-- Caso real que origino este cambio: cotizaciones COT-06225 y COT-06227
-- fueron creadas y eliminadas en SOLAC; la secuencia ya iba en 6228 y las
-- proximas cotizaciones se hubieran saltado esos folios para siempre.
-- ============================================================================

CREATE TABLE IF NOT EXISTS erp.folios_recuperados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        VARCHAR(20) NOT NULL,
  folio       VARCHAR(20) NOT NULL,
  notas       TEXT,
  creado_por  UUID REFERENCES erp.usuarios(id),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tipo, folio)
);

CREATE INDEX IF NOT EXISTS idx_folios_recuperados_tipo_fecha
  ON erp.folios_recuperados(tipo, created_at, folio);

COMMENT ON TABLE erp.folios_recuperados IS
'Folios que quedaron huecos al eliminarse documentos. generar_folio() los reutiliza FIFO antes de hacer nextval para evitar saltos permanentes.';

CREATE OR REPLACE FUNCTION erp.generar_folio(tipo character varying)
RETURNS character varying
LANGUAGE plpgsql
AS $$
DECLARE
  nuevo_folio       VARCHAR;
  prefijo           VARCHAR;
  numero            INTEGER;
  recuperado_id     UUID;
  recuperado_folio  VARCHAR;
BEGIN
  -- Para cotizaciones: intentar reciclar primero (FIFO por created_at, folio)
  IF tipo = 'cotizacion' THEN
    SELECT fr.id, fr.folio
      INTO recuperado_id, recuperado_folio
    FROM erp.folios_recuperados fr
    WHERE fr.tipo = 'cotizacion'
    ORDER BY fr.created_at, fr.folio
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF recuperado_id IS NOT NULL THEN
      DELETE FROM erp.folios_recuperados WHERE id = recuperado_id;
      RETURN recuperado_folio;
    END IF;
  END IF;

  -- Comportamiento original (sin cambios)
  CASE tipo
    WHEN 'cotizacion' THEN
      prefijo := 'COT-';
      numero  := nextval('erp.seq_cotizacion');
    WHEN 'orden_venta' THEN
      prefijo := 'OV-';
      numero  := nextval('erp.seq_orden_venta');
    WHEN 'factura' THEN
      prefijo := 'FAC-';
      numero  := nextval('erp.seq_factura');
    WHEN 'pago' THEN
      prefijo := 'PAG-';
      numero  := nextval('erp.seq_pago');
    WHEN 'orden_compra' THEN
      prefijo := 'OC-';
      numero  := nextval('erp.seq_orden_compra');
    WHEN 'pos' THEN
      prefijo := 'POS-';
      numero  := nextval('erp.seq_pos');
    ELSE
      RAISE EXCEPTION 'Tipo de folio no valido: %', tipo;
  END CASE;

  nuevo_folio := prefijo || LPAD(numero::TEXT, 5, '0');
  RETURN nuevo_folio;
END;
$$;

GRANT EXECUTE ON FUNCTION erp.generar_folio(VARCHAR) TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON erp.folios_recuperados TO authenticated;

-- Folios huecos confirmados por el usuario (orden FIFO: primero 06225, luego 06227)
INSERT INTO erp.folios_recuperados (tipo, folio, notas, created_at) VALUES
  ('cotizacion', 'COT-06225', 'Recuperado manual: cotizacion creada y eliminada', NOW()),
  ('cotizacion', 'COT-06227', 'Recuperado manual: cotizacion creada y eliminada', NOW() + INTERVAL '1 microsecond')
ON CONFLICT (tipo, folio) DO NOTHING;
