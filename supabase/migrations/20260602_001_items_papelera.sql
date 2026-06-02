-- ============================================================================
-- PAPELERA DE ITEMS ELIMINADOS - capa de auditoria y recuperacion
-- Aplicado en BD el 02-jun-2026
--
-- Cualquier DELETE en cotizacion_items / factura_items / orden_compra_items
-- guarda un snapshot del item eliminado en erp.items_eliminados_papelera.
-- Si se vuelve a presentar un caso como el de OV-00099 (items perdidos por
-- bug del editor), la recuperacion se hace con 1 query en lugar de tener
-- que rastrear desde la cotizacion origen.
-- ============================================================================

CREATE TABLE IF NOT EXISTS erp.items_eliminados_papelera (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_origen      VARCHAR(30) NOT NULL,
  item_id_original  UUID NOT NULL,
  documento_id      UUID NOT NULL,
  organizacion_id   UUID,
  snapshot          JSONB NOT NULL,
  deleted_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_by_auth   UUID,
  deleted_by_email  TEXT,
  deleted_by_rol    TEXT
);

CREATE INDEX IF NOT EXISTS idx_papelera_documento ON erp.items_eliminados_papelera(tabla_origen, documento_id, deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_papelera_org_fecha ON erp.items_eliminados_papelera(organizacion_id, deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_papelera_item_original ON erp.items_eliminados_papelera(item_id_original);

COMMENT ON TABLE erp.items_eliminados_papelera IS
'Snapshot de items eliminados en cotizacion_items, factura_items, orden_compra_items. Habilita recuperacion rapida si un editor borra items por error.';

-- Trigger functions
CREATE OR REPLACE FUNCTION erp.trg_papelera_cotizacion_items()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE v_email TEXT; v_rol TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT u.email, u.rol INTO v_email, v_rol
    FROM erp.usuarios u WHERE u.auth_user_id = auth.uid() LIMIT 1;
  END IF;
  INSERT INTO erp.items_eliminados_papelera (
    tabla_origen, item_id_original, documento_id, organizacion_id, snapshot,
    deleted_by_auth, deleted_by_email, deleted_by_rol
  ) VALUES (
    'cotizacion_items', OLD.id, OLD.cotizacion_id, OLD.organizacion_id,
    to_jsonb(OLD), auth.uid(), v_email, v_rol
  );
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION erp.trg_papelera_factura_items()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE v_email TEXT; v_rol TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT u.email, u.rol INTO v_email, v_rol
    FROM erp.usuarios u WHERE u.auth_user_id = auth.uid() LIMIT 1;
  END IF;
  INSERT INTO erp.items_eliminados_papelera (
    tabla_origen, item_id_original, documento_id, organizacion_id, snapshot,
    deleted_by_auth, deleted_by_email, deleted_by_rol
  ) VALUES (
    'factura_items', OLD.id, OLD.factura_id, OLD.organizacion_id,
    to_jsonb(OLD), auth.uid(), v_email, v_rol
  );
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION erp.trg_papelera_orden_compra_items()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
DECLARE v_email TEXT; v_rol TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT u.email, u.rol INTO v_email, v_rol
    FROM erp.usuarios u WHERE u.auth_user_id = auth.uid() LIMIT 1;
  END IF;
  INSERT INTO erp.items_eliminados_papelera (
    tabla_origen, item_id_original, documento_id, organizacion_id, snapshot,
    deleted_by_auth, deleted_by_email, deleted_by_rol
  ) VALUES (
    'orden_compra_items', OLD.id, OLD.orden_compra_id, OLD.organizacion_id,
    to_jsonb(OLD), auth.uid(), v_email, v_rol
  );
  RETURN OLD;
END;
$$;

-- Triggers AFTER DELETE
DROP TRIGGER IF EXISTS trg_papelera ON erp.cotizacion_items;
CREATE TRIGGER trg_papelera
AFTER DELETE ON erp.cotizacion_items
FOR EACH ROW EXECUTE FUNCTION erp.trg_papelera_cotizacion_items();

DROP TRIGGER IF EXISTS trg_papelera ON erp.factura_items;
CREATE TRIGGER trg_papelera
AFTER DELETE ON erp.factura_items
FOR EACH ROW EXECUTE FUNCTION erp.trg_papelera_factura_items();

DROP TRIGGER IF EXISTS trg_papelera ON erp.orden_compra_items;
CREATE TRIGGER trg_papelera
AFTER DELETE ON erp.orden_compra_items
FOR EACH ROW EXECUTE FUNCTION erp.trg_papelera_orden_compra_items();

-- RPC de ayuda
CREATE OR REPLACE FUNCTION erp.listar_items_papelera(p_documento_id UUID)
RETURNS TABLE (
  id UUID, tabla_origen VARCHAR, item_id_original UUID, snapshot JSONB,
  deleted_at TIMESTAMP, deleted_by_email TEXT, deleted_by_rol TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = erp, public AS $$
  SELECT id, tabla_origen, item_id_original, snapshot, deleted_at, deleted_by_email, deleted_by_rol
  FROM erp.items_eliminados_papelera
  WHERE documento_id = p_documento_id
  ORDER BY deleted_at DESC;
$$;

GRANT EXECUTE ON FUNCTION erp.listar_items_papelera(UUID) TO authenticated;
GRANT SELECT ON erp.items_eliminados_papelera TO authenticated;
