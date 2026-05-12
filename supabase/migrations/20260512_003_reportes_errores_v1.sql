-- =====================================================================
-- Sistema de Reportes de Error de usuario al admin
-- =====================================================================
-- Permite a cualquier usuario autenticado reportar un error (manual o
-- captura automatica de crash). El reporte cae en una bandeja que ven
-- super_admin (todas las orgs) y admin_cliente (solo su org). Estos
-- pueden cambiar el status, agregar nota interna y resolver. El usuario
-- reportante (si es admin_cliente o super_admin) puede ver sus propios
-- reportes en /mis-reportes y se le marca cuando algo se resuelve.
--
-- Flujo de status: nuevo -> en_revision -> resuelto (+ descartado)
-- =====================================================================

CREATE TABLE IF NOT EXISTS erp.reportes_errores (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Quien y donde
  organizacion_id          UUID REFERENCES erp.organizaciones(id) ON DELETE CASCADE,
  usuario_id               UUID REFERENCES erp.usuarios(id) ON DELETE SET NULL,
  usuario_email            VARCHAR(200),
  usuario_nombre           VARCHAR(200),
  usuario_rol              VARCHAR(30),

  -- Contexto tecnico capturado en navegador
  ruta                     VARCHAR(500),
  user_agent               TEXT,
  viewport                 VARCHAR(40),

  -- Lo que el usuario escribio
  descripcion_usuario      TEXT NOT NULL CHECK (length(descripcion_usuario) >= 5),
  pasos_reproduccion       TEXT,

  -- Lo que el codigo capturo
  mensaje_tecnico          TEXT,
  stack                    TEXT,
  contexto                 JSONB,
  origen                   VARCHAR(30) NOT NULL DEFAULT 'manual'
                             CHECK (origen IN ('manual','boundary','window_error','unhandled_rejection','api')),

  -- Estado / triage
  status                   VARCHAR(20) NOT NULL DEFAULT 'nuevo'
                             CHECK (status IN ('nuevo','en_revision','resuelto','descartado')),
  prioridad                VARCHAR(10) NOT NULL DEFAULT 'normal'
                             CHECK (prioridad IN ('baja','normal','alta','critica')),
  nota_admin               TEXT,
  resolved_by              UUID REFERENCES erp.usuarios(id) ON DELETE SET NULL,
  resolved_at              TIMESTAMP,

  -- Feedback al reportante
  visto_por_reportante     BOOLEAN NOT NULL DEFAULT FALSE,
  visto_por_reportante_at  TIMESTAMP,

  created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reportes_errores_org_status
  ON erp.reportes_errores (organizacion_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reportes_errores_usuario
  ON erp.reportes_errores (usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reportes_errores_status
  ON erp.reportes_errores (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_reportes_errores_updated_at ON erp.reportes_errores;
CREATE TRIGGER trg_reportes_errores_updated_at
  BEFORE UPDATE ON erp.reportes_errores
  FOR EACH ROW EXECUTE FUNCTION erp.update_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE erp.reportes_errores ENABLE ROW LEVEL SECURITY;

-- SELECT: el reportante ve los suyos, super_admin ve todos, admin_cliente
-- ve los de su org
DROP POLICY IF EXISTS reportes_errores_select ON erp.reportes_errores;
CREATE POLICY reportes_errores_select ON erp.reportes_errores
  FOR SELECT USING (
    erp.is_super_admin()
    OR usuario_id IN (SELECT id FROM erp.usuarios WHERE auth_user_id = auth.uid())
    OR (erp.is_admin() AND organizacion_id = erp.get_my_org_id())
  );

-- INSERT: cualquier autenticado puede reportar (su usuario_id se setea
-- desde la RPC)
DROP POLICY IF EXISTS reportes_errores_insert ON erp.reportes_errores;
CREATE POLICY reportes_errores_insert ON erp.reportes_errores
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: solo admin (super_admin global, admin_cliente de su org) o el
-- propio reportante (para marcar como visto)
DROP POLICY IF EXISTS reportes_errores_update ON erp.reportes_errores;
CREATE POLICY reportes_errores_update ON erp.reportes_errores
  FOR UPDATE USING (
    erp.is_super_admin()
    OR (erp.is_admin() AND organizacion_id = erp.get_my_org_id())
    OR usuario_id IN (SELECT id FROM erp.usuarios WHERE auth_user_id = auth.uid())
  );

-- DELETE: solo super_admin
DROP POLICY IF EXISTS reportes_errores_delete ON erp.reportes_errores;
CREATE POLICY reportes_errores_delete ON erp.reportes_errores
  FOR DELETE USING (erp.is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON erp.reportes_errores TO anon, authenticated;

-- =====================================================================
-- RPC erp.reportar_error: crea un reporte capturando el usuario actual
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.reportar_error(
  p_descripcion_usuario  TEXT,
  p_pasos_reproduccion   TEXT DEFAULT NULL,
  p_ruta                 TEXT DEFAULT NULL,
  p_mensaje_tecnico      TEXT DEFAULT NULL,
  p_stack                TEXT DEFAULT NULL,
  p_contexto             JSONB DEFAULT NULL,
  p_origen               VARCHAR DEFAULT 'manual',
  p_user_agent           TEXT DEFAULT NULL,
  p_viewport             VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario   RECORD;
  v_reporte_id UUID;
BEGIN
  IF p_descripcion_usuario IS NULL OR length(trim(p_descripcion_usuario)) < 5 THEN
    RAISE EXCEPTION 'La descripcion debe tener al menos 5 caracteres';
  END IF;

  SELECT id, email, nombre, rol, organizacion_id
    INTO v_usuario
    FROM erp.usuarios
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

  INSERT INTO erp.reportes_errores (
    organizacion_id,
    usuario_id,
    usuario_email,
    usuario_nombre,
    usuario_rol,
    ruta,
    user_agent,
    viewport,
    descripcion_usuario,
    pasos_reproduccion,
    mensaje_tecnico,
    stack,
    contexto,
    origen
  ) VALUES (
    v_usuario.organizacion_id,
    v_usuario.id,
    v_usuario.email,
    v_usuario.nombre,
    v_usuario.rol,
    p_ruta,
    p_user_agent,
    p_viewport,
    p_descripcion_usuario,
    p_pasos_reproduccion,
    p_mensaje_tecnico,
    p_stack,
    p_contexto,
    COALESCE(p_origen, 'manual')
  )
  RETURNING id INTO v_reporte_id;

  RETURN v_reporte_id;
END;
$$;

GRANT EXECUTE ON FUNCTION erp.reportar_error(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, VARCHAR, TEXT, VARCHAR) TO anon, authenticated;

-- Wrapper publico
DROP FUNCTION IF EXISTS public.reportar_error(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, VARCHAR, TEXT, VARCHAR) CASCADE;
CREATE OR REPLACE FUNCTION public.reportar_error(
  p_descripcion_usuario  TEXT,
  p_pasos_reproduccion   TEXT DEFAULT NULL,
  p_ruta                 TEXT DEFAULT NULL,
  p_mensaje_tecnico      TEXT DEFAULT NULL,
  p_stack                TEXT DEFAULT NULL,
  p_contexto             JSONB DEFAULT NULL,
  p_origen               VARCHAR DEFAULT 'manual',
  p_user_agent           TEXT DEFAULT NULL,
  p_viewport             VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN erp.reportar_error(
    p_descripcion_usuario,
    p_pasos_reproduccion,
    p_ruta,
    p_mensaje_tecnico,
    p_stack,
    p_contexto,
    p_origen,
    p_user_agent,
    p_viewport
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reportar_error(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, VARCHAR, TEXT, VARCHAR) TO anon, authenticated;

-- =====================================================================
-- RPC erp.actualizar_status_reporte_error
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.actualizar_status_reporte_error(
  p_reporte_id  UUID,
  p_status      VARCHAR,
  p_nota_admin  TEXT DEFAULT NULL,
  p_prioridad   VARCHAR DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reporte RECORD;
  v_admin   RECORD;
BEGIN
  IF p_status NOT IN ('nuevo','en_revision','resuelto','descartado') THEN
    RAISE EXCEPTION 'Status invalido';
  END IF;

  SELECT * INTO v_reporte FROM erp.reportes_errores WHERE id = p_reporte_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reporte no encontrado';
  END IF;

  SELECT id, rol, organizacion_id
    INTO v_admin
    FROM erp.usuarios
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Solo super_admin (cualquier org) o admin_cliente (su org)
  IF v_admin.rol = 'super_admin' THEN
    NULL; -- ok
  ELSIF v_admin.rol = 'admin_cliente' AND v_reporte.organizacion_id = v_admin.organizacion_id THEN
    NULL; -- ok
  ELSE
    RAISE EXCEPTION 'Sin permisos para actualizar este reporte';
  END IF;

  UPDATE erp.reportes_errores
  SET status = p_status,
      nota_admin = COALESCE(p_nota_admin, nota_admin),
      prioridad = COALESCE(p_prioridad, prioridad),
      resolved_by = CASE WHEN p_status IN ('resuelto','descartado') THEN v_admin.id ELSE resolved_by END,
      resolved_at = CASE WHEN p_status IN ('resuelto','descartado') THEN NOW() ELSE resolved_at END,
      -- Si pasa a resuelto/descartado, dejar al reportante con badge sin leer
      visto_por_reportante = CASE
        WHEN p_status IN ('resuelto','descartado') AND v_reporte.status NOT IN ('resuelto','descartado') THEN FALSE
        ELSE visto_por_reportante
      END,
      visto_por_reportante_at = CASE
        WHEN p_status IN ('resuelto','descartado') AND v_reporte.status NOT IN ('resuelto','descartado') THEN NULL
        ELSE visto_por_reportante_at
      END
  WHERE id = p_reporte_id;

  RETURN json_build_object('success', TRUE, 'reporte_id', p_reporte_id, 'status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION erp.actualizar_status_reporte_error(UUID, VARCHAR, TEXT, VARCHAR) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.actualizar_status_reporte_error(UUID, VARCHAR, TEXT, VARCHAR) CASCADE;
CREATE OR REPLACE FUNCTION public.actualizar_status_reporte_error(
  p_reporte_id  UUID,
  p_status      VARCHAR,
  p_nota_admin  TEXT DEFAULT NULL,
  p_prioridad   VARCHAR DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN erp.actualizar_status_reporte_error(p_reporte_id, p_status, p_nota_admin, p_prioridad);
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_status_reporte_error(UUID, VARCHAR, TEXT, VARCHAR) TO anon, authenticated;

-- =====================================================================
-- RPC erp.marcar_reporte_visto: el reportante marca como leida la
-- resolucion (limpia el badge en su sidebar)
-- =====================================================================
CREATE OR REPLACE FUNCTION erp.marcar_reporte_visto(p_reporte_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reporte RECORD;
  v_usuario_id UUID;
BEGIN
  SELECT id INTO v_usuario_id FROM erp.usuarios WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  SELECT * INTO v_reporte FROM erp.reportes_errores WHERE id = p_reporte_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reporte no encontrado';
  END IF;

  IF v_reporte.usuario_id <> v_usuario_id THEN
    RAISE EXCEPTION 'Solo el reportante puede marcar como visto';
  END IF;

  UPDATE erp.reportes_errores
  SET visto_por_reportante = TRUE,
      visto_por_reportante_at = NOW()
  WHERE id = p_reporte_id;

  RETURN json_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION erp.marcar_reporte_visto(UUID) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.marcar_reporte_visto(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.marcar_reporte_visto(p_reporte_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN erp.marcar_reporte_visto(p_reporte_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_reporte_visto(UUID) TO anon, authenticated;
