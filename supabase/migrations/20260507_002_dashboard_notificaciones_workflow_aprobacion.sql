-- =====================================================================
-- Workflow de aprobacion para dashboard_notificaciones
-- =====================================================================
-- Cambios:
-- 1) Agregar columna `status` (borrador|publicada|archivada). Las nuevas
--    nacen como 'borrador' (no se muestran en el dashboard hasta que el
--    super_admin las publique).
-- 2) Endurecer RLS: solo super_admin puede INSERT/UPDATE/DELETE. Los
--    admin_cliente ya no pueden gestionar (antes podian).
-- 3) Tracking de aprobacion: published_at + published_by para auditoria.
-- 4) Backfill: las filas sembradas previamente quedan como 'publicada'.
-- =====================================================================

ALTER TABLE erp.dashboard_notificaciones
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'borrador'
    CHECK (status IN ('borrador', 'publicada', 'archivada')),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES erp.usuarios(id);

CREATE INDEX IF NOT EXISTS idx_dashboard_notif_status
  ON erp.dashboard_notificaciones (status, activo, fecha_inicio);

UPDATE erp.dashboard_notificaciones
SET status = 'publicada',
    published_at = COALESCE(updated_at, created_at)
WHERE status = 'borrador'
  AND created_at < NOW() - INTERVAL '1 minute';

DROP POLICY IF EXISTS dashboard_notif_insert ON erp.dashboard_notificaciones;
CREATE POLICY dashboard_notif_insert ON erp.dashboard_notificaciones
  FOR INSERT WITH CHECK (erp.is_super_admin());

DROP POLICY IF EXISTS dashboard_notif_update ON erp.dashboard_notificaciones;
CREATE POLICY dashboard_notif_update ON erp.dashboard_notificaciones
  FOR UPDATE USING (erp.is_super_admin());

DROP POLICY IF EXISTS dashboard_notif_delete ON erp.dashboard_notificaciones;
CREATE POLICY dashboard_notif_delete ON erp.dashboard_notificaciones
  FOR DELETE USING (erp.is_super_admin());

DROP POLICY IF EXISTS dashboard_notif_select ON erp.dashboard_notificaciones;
CREATE POLICY dashboard_notif_select ON erp.dashboard_notificaciones
  FOR SELECT USING (
    erp.is_super_admin()
    OR (
      status = 'publicada'
      AND (organizacion_id IS NULL OR organizacion_id = erp.get_my_org_id())
    )
  );

COMMENT ON COLUMN erp.dashboard_notificaciones.status IS
  'borrador = creado por Claude o super_admin pero aun no aprobado; publicada = visible en dashboard; archivada = retirado del listado activo (historico)';
