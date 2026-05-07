-- =====================================================================
-- Banner de novedades en el dashboard ("What's New")
-- =====================================================================
-- Sistema de comunicacion al usuario final: cada vez que se libera una
-- feature, mejora o fix relevante, se publica un banner en el dashboard.
-- Cada usuario puede dismissar y no volver a verlo.
--
-- Multi-tenant: organizacion_id NULL = banner global (todas las orgs).
-- Targeting opcional por roles via dirigido_a_roles[].
-- =====================================================================

CREATE TABLE IF NOT EXISTS erp.dashboard_notificaciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          VARCHAR(120) NOT NULL,
  descripcion     TEXT,
  tipo            VARCHAR(20) NOT NULL DEFAULT 'nuevo'
                    CHECK (tipo IN ('nuevo', 'mejora', 'fix', 'aviso')),
  icono           VARCHAR(60),
  cta_label       VARCHAR(60),
  cta_ruta        VARCHAR(200),
  fecha_inicio    DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin       DATE,
  dirigido_a_roles TEXT[],
  organizacion_id UUID REFERENCES erp.organizaciones(id) ON DELETE CASCADE,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES erp.usuarios(id),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dashboard_notif_activo_fecha
  ON erp.dashboard_notificaciones (activo, fecha_inicio, fecha_fin);

CREATE INDEX IF NOT EXISTS idx_dashboard_notif_org
  ON erp.dashboard_notificaciones (organizacion_id);

DROP TRIGGER IF EXISTS trg_dashboard_notif_updated_at ON erp.dashboard_notificaciones;
CREATE TRIGGER trg_dashboard_notif_updated_at
  BEFORE UPDATE ON erp.dashboard_notificaciones
  FOR EACH ROW EXECUTE FUNCTION erp.update_updated_at();

CREATE TABLE IF NOT EXISTS erp.dashboard_notificaciones_dismissals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacion_id UUID NOT NULL REFERENCES erp.dashboard_notificaciones(id) ON DELETE CASCADE,
  usuario_id      UUID NOT NULL REFERENCES erp.usuarios(id) ON DELETE CASCADE,
  dismissed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (notificacion_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_notif_dismiss_user
  ON erp.dashboard_notificaciones_dismissals (usuario_id);

ALTER TABLE erp.dashboard_notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.dashboard_notificaciones_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dashboard_notif_select ON erp.dashboard_notificaciones;
CREATE POLICY dashboard_notif_select ON erp.dashboard_notificaciones
  FOR SELECT USING (
    organizacion_id IS NULL OR organizacion_id = erp.get_my_org_id() OR erp.is_super_admin()
  );

DROP POLICY IF EXISTS dashboard_notif_insert ON erp.dashboard_notificaciones;
CREATE POLICY dashboard_notif_insert ON erp.dashboard_notificaciones
  FOR INSERT WITH CHECK (
    erp.is_super_admin() OR (erp.is_admin() AND (organizacion_id IS NULL OR organizacion_id = erp.get_my_org_id()))
  );

DROP POLICY IF EXISTS dashboard_notif_update ON erp.dashboard_notificaciones;
CREATE POLICY dashboard_notif_update ON erp.dashboard_notificaciones
  FOR UPDATE USING (
    erp.is_super_admin() OR (erp.is_admin() AND (organizacion_id IS NULL OR organizacion_id = erp.get_my_org_id()))
  );

DROP POLICY IF EXISTS dashboard_notif_delete ON erp.dashboard_notificaciones;
CREATE POLICY dashboard_notif_delete ON erp.dashboard_notificaciones
  FOR DELETE USING (
    erp.is_super_admin() OR (erp.is_admin() AND (organizacion_id IS NULL OR organizacion_id = erp.get_my_org_id()))
  );

DROP POLICY IF EXISTS dashboard_notif_dismiss_select ON erp.dashboard_notificaciones_dismissals;
CREATE POLICY dashboard_notif_dismiss_select ON erp.dashboard_notificaciones_dismissals
  FOR SELECT USING (
    usuario_id IN (SELECT id FROM erp.usuarios WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS dashboard_notif_dismiss_insert ON erp.dashboard_notificaciones_dismissals;
CREATE POLICY dashboard_notif_dismiss_insert ON erp.dashboard_notificaciones_dismissals
  FOR INSERT WITH CHECK (
    usuario_id IN (SELECT id FROM erp.usuarios WHERE auth_user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON erp.dashboard_notificaciones TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON erp.dashboard_notificaciones_dismissals TO anon, authenticated;
