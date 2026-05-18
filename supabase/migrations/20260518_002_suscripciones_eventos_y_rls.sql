-- ============================================================================
-- SUSCRIPCIONES - eventos de tracking + RLS en tablas sensibles
-- Aplicado en BD el 18-may-2026
-- ============================================================================

-- 1) Tabla de eventos
CREATE TABLE erp.suscripcion_eventos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id   UUID NOT NULL REFERENCES erp.organizaciones(id) ON DELETE CASCADE,
  usuario_id        UUID REFERENCES erp.usuarios(id) ON DELETE SET NULL,
  usuario_email     TEXT,
  usuario_nombre    TEXT,
  usuario_rol       TEXT,
  evento            VARCHAR(60) NOT NULL,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip                TEXT,
  user_agent        TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_susc_eventos_org_fecha ON erp.suscripcion_eventos(organizacion_id, created_at DESC);
CREATE INDEX idx_susc_eventos_evento    ON erp.suscripcion_eventos(evento);
CREATE INDEX idx_susc_eventos_usuario   ON erp.suscripcion_eventos(usuario_id, created_at DESC);

-- 2) RPC registrar_evento_suscripcion (dedup banner_visto por dia)
CREATE OR REPLACE FUNCTION erp.registrar_evento_suscripcion(
  p_evento     VARCHAR,
  p_metadata   JSONB DEFAULT '{}'::jsonb,
  p_ip         TEXT  DEFAULT NULL,
  p_user_agent TEXT  DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  v_user_id   UUID;
  v_erp_user  RECORD;
  v_existing  UUID;
  v_evento_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT u.id, u.organizacion_id, u.rol, u.email, u.nombre INTO v_erp_user
  FROM erp.usuarios u WHERE u.auth_user_id = v_user_id LIMIT 1;

  IF v_erp_user.id IS NULL THEN RETURN NULL; END IF;

  IF p_evento = 'banner_visto' THEN
    SELECT id INTO v_existing
    FROM erp.suscripcion_eventos
    WHERE usuario_id = v_erp_user.id
      AND evento = 'banner_visto'
      AND created_at >= date_trunc('day', NOW())
    LIMIT 1;

    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;

  INSERT INTO erp.suscripcion_eventos (
    organizacion_id, usuario_id, usuario_email, usuario_nombre, usuario_rol,
    evento, metadata, ip, user_agent
  ) VALUES (
    v_erp_user.organizacion_id, v_erp_user.id, v_erp_user.email, v_erp_user.nombre, v_erp_user.rol,
    p_evento, COALESCE(p_metadata, '{}'::jsonb), p_ip, p_user_agent
  ) RETURNING id INTO v_evento_id;

  RETURN v_evento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_evento_suscripcion(
  p_evento VARCHAR, p_metadata JSONB DEFAULT '{}'::jsonb,
  p_ip TEXT DEFAULT NULL, p_user_agent TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = erp, public AS $$
  SELECT erp.registrar_evento_suscripcion(p_evento, p_metadata, p_ip, p_user_agent);
$$;

-- 3) RPC listar_eventos_suscripcion (solo super_admin)
CREATE OR REPLACE FUNCTION erp.listar_eventos_suscripcion(p_dias_atras INT DEFAULT 30)
RETURNS TABLE (
  id              UUID,
  usuario_nombre  TEXT,
  usuario_email   TEXT,
  usuario_rol     TEXT,
  evento          VARCHAR,
  metadata        JSONB,
  ip              TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  v_user_id  UUID;
  v_erp_user RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT u.id, u.organizacion_id, u.rol INTO v_erp_user
  FROM erp.usuarios u WHERE u.auth_user_id = v_user_id LIMIT 1;

  IF v_erp_user.rol != 'super_admin' THEN
    RAISE EXCEPTION 'Acceso denegado: solo super_admin';
  END IF;

  RETURN QUERY
  SELECT e.id, e.usuario_nombre, e.usuario_email, e.usuario_rol, e.evento, e.metadata, e.ip, e.user_agent, e.created_at
  FROM erp.suscripcion_eventos e
  WHERE e.organizacion_id = v_erp_user.organizacion_id
    AND e.created_at >= NOW() - (p_dias_atras || ' days')::interval
  ORDER BY e.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_eventos_suscripcion(p_dias_atras INT DEFAULT 30)
RETURNS TABLE (
  id UUID, usuario_nombre TEXT, usuario_email TEXT, usuario_rol TEXT,
  evento VARCHAR, metadata JSONB, ip TEXT, user_agent TEXT, created_at TIMESTAMP
) LANGUAGE sql SECURITY DEFINER SET search_path = erp, public AS $$
  SELECT * FROM erp.listar_eventos_suscripcion(p_dias_atras);
$$;

-- 4) RPC listar_pagos_suscripcion (solo super_admin)
CREATE OR REPLACE FUNCTION erp.listar_pagos_suscripcion()
RETURNS TABLE (
  id                       UUID,
  fecha_pago               DATE,
  monto                    NUMERIC,
  forma_pago               VARCHAR,
  referencia               VARCHAR,
  periodo_cubierto_desde   DATE,
  periodo_cubierto_hasta   DATE,
  comprobante_url          TEXT,
  notas                    TEXT,
  registrado_por_nombre    TEXT,
  registrado_por_email     TEXT,
  created_at               TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  v_user_id  UUID;
  v_erp_user RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT u.id, u.organizacion_id, u.rol INTO v_erp_user
  FROM erp.usuarios u WHERE u.auth_user_id = v_user_id LIMIT 1;

  IF v_erp_user.rol != 'super_admin' THEN
    RAISE EXCEPTION 'Acceso denegado: solo super_admin';
  END IF;

  RETURN QUERY
  SELECT p.id, p.fecha_pago, p.monto, p.forma_pago, p.referencia,
         p.periodo_cubierto_desde, p.periodo_cubierto_hasta,
         p.comprobante_url, p.notas, p.registrado_por_nombre, p.registrado_por_email,
         p.created_at
  FROM erp.suscripcion_pagos p
  WHERE p.organizacion_id = v_erp_user.organizacion_id
  ORDER BY p.fecha_pago DESC, p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_pagos_suscripcion()
RETURNS TABLE (
  id UUID, fecha_pago DATE, monto NUMERIC, forma_pago VARCHAR, referencia VARCHAR,
  periodo_cubierto_desde DATE, periodo_cubierto_hasta DATE, comprobante_url TEXT,
  notas TEXT, registrado_por_nombre TEXT, registrado_por_email TEXT, created_at TIMESTAMP
) LANGUAGE sql SECURITY DEFINER SET search_path = erp, public AS $$
  SELECT * FROM erp.listar_pagos_suscripcion();
$$;

-- 5) RLS
ALTER TABLE erp.suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.suscripcion_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.suscripcion_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY suscripciones_super_admin_read ON erp.suscripciones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM erp.usuarios u
      WHERE u.auth_user_id = auth.uid()
        AND u.organizacion_id = erp.suscripciones.organizacion_id
        AND u.rol = 'super_admin'
    )
  );

CREATE POLICY suscripcion_pagos_super_admin_read ON erp.suscripcion_pagos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM erp.usuarios u
      WHERE u.auth_user_id = auth.uid()
        AND u.organizacion_id = erp.suscripcion_pagos.organizacion_id
        AND u.rol = 'super_admin'
    )
  );

CREATE POLICY suscripcion_eventos_super_admin_read ON erp.suscripcion_eventos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM erp.usuarios u
      WHERE u.auth_user_id = auth.uid()
        AND u.organizacion_id = erp.suscripcion_eventos.organizacion_id
        AND u.rol = 'super_admin'
    )
  );

-- 6) Reemplazar la vista por funcion suscripcion_publica (SECURITY DEFINER)
--    Necesario porque RLS bloquea lectura directa para no-super_admin.
DROP VIEW IF EXISTS erp.v_suscripcion_publica;

CREATE OR REPLACE FUNCTION erp.suscripcion_publica()
RETURNS TABLE (
  organizacion_id          UUID,
  plan                     VARCHAR,
  fecha_corte              DATE,
  estado                   VARCHAR,
  banner_activo            BOOLEAN,
  banner_audiencia_modo    VARCHAR,
  banner_usuarios_visibles UUID[],
  banner_forzar            BOOLEAN,
  dias_alerta              INT,
  contacto_nombre          VARCHAR,
  contacto_whatsapp        VARCHAR,
  monto_mensual            NUMERIC,
  monto_anual              NUMERIC,
  iva_porcentaje           NUMERIC,
  modo_lectura_activo      BOOLEAN,
  modo_lectura_bloqueos    JSONB,
  dias_restantes           INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  v_user_id  UUID;
  v_org_id   UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT u.organizacion_id INTO v_org_id
  FROM erp.usuarios u WHERE u.auth_user_id = v_user_id LIMIT 1;

  IF v_org_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    s.organizacion_id, s.plan, s.fecha_corte, s.estado,
    s.banner_activo, s.banner_audiencia_modo, s.banner_usuarios_visibles, s.banner_forzar, s.dias_alerta,
    s.contacto_nombre, s.contacto_whatsapp,
    s.monto_mensual, s.monto_anual, s.iva_porcentaje,
    s.modo_lectura_activo, s.modo_lectura_bloqueos,
    (s.fecha_corte - CURRENT_DATE)::int
  FROM erp.suscripciones s
  WHERE s.organizacion_id = v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.suscripcion_publica()
RETURNS TABLE (
  organizacion_id UUID, plan VARCHAR, fecha_corte DATE, estado VARCHAR,
  banner_activo BOOLEAN, banner_audiencia_modo VARCHAR, banner_usuarios_visibles UUID[],
  banner_forzar BOOLEAN, dias_alerta INT, contacto_nombre VARCHAR, contacto_whatsapp VARCHAR,
  monto_mensual NUMERIC, monto_anual NUMERIC, iva_porcentaje NUMERIC,
  modo_lectura_activo BOOLEAN, modo_lectura_bloqueos JSONB, dias_restantes INT
) LANGUAGE sql SECURITY DEFINER SET search_path = erp, public AS $$
  SELECT * FROM erp.suscripcion_publica();
$$;

-- 7) GRANTs
GRANT EXECUTE ON FUNCTION erp.registrar_evento_suscripcion(VARCHAR,JSONB,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_evento_suscripcion(VARCHAR,JSONB,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION erp.listar_eventos_suscripcion(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_eventos_suscripcion(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION erp.listar_pagos_suscripcion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_pagos_suscripcion() TO authenticated;
GRANT EXECUTE ON FUNCTION erp.suscripcion_publica() TO authenticated;
GRANT EXECUTE ON FUNCTION public.suscripcion_publica() TO authenticated;
