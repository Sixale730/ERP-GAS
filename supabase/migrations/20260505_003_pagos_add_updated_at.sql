-- =====================================================================
-- Agrega columna updated_at a erp.pagos + trigger generico
-- =====================================================================
-- Era la unica tabla del schema erp que carecia de updated_at, lo que
-- rompia la convencion del repo y bloqueaba la RPC erp.editar_pago de la
-- migration 20260505_002_pagos_editar_rpc.sql:
--
--   "column updated_at of relation pagos does not exist"
--
-- Mantengo la convencion del resto del schema:
--   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
--   trigger trg_pagos_updated_at BEFORE UPDATE -> erp.update_updated_at()
-- Para las filas ya existentes, copia created_at como valor inicial.
-- =====================================================================

ALTER TABLE erp.pagos
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Backfill de filas existentes (si las hay) para que no queden NULL.
UPDATE erp.pagos
SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS trg_pagos_updated_at ON erp.pagos;
CREATE TRIGGER trg_pagos_updated_at
  BEFORE UPDATE ON erp.pagos
  FOR EACH ROW
  EXECUTE FUNCTION erp.update_updated_at();
