-- ============================================================================
-- SUSCRIPCIONES — Tablas, RPCs y vista publica
-- Aplicado en BD el 18-may-2026
-- ============================================================================

-- 1) Tabla principal: una suscripcion por organizacion
CREATE TABLE erp.suscripciones (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id             UUID NOT NULL REFERENCES erp.organizaciones(id) ON DELETE CASCADE,

  -- Plan y montos
  plan                        VARCHAR(20) NOT NULL DEFAULT 'mensual' CHECK (plan IN ('mensual','anual')),
  monto_mensual               NUMERIC(12,2) NOT NULL DEFAULT 2500,
  monto_anual                 NUMERIC(12,2) NOT NULL DEFAULT 25000,
  iva_porcentaje              NUMERIC(5,2)  NOT NULL DEFAULT 16,

  -- Vigencia
  fecha_corte                 DATE NOT NULL,
  estado                      VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','vencida','suspendida')),

  -- Configuracion banner
  banner_activo               BOOLEAN NOT NULL DEFAULT false,  -- OFF por default (preview interno)
  banner_audiencia_modo       VARCHAR(20) NOT NULL DEFAULT 'todos' CHECK (banner_audiencia_modo IN ('todos','seleccionados')),
  banner_usuarios_visibles    UUID[] NOT NULL DEFAULT '{}',
  banner_forzar               BOOLEAN NOT NULL DEFAULT true,
  dias_alerta                 INT NOT NULL DEFAULT 5 CHECK (dias_alerta BETWEEN 1 AND 30),

  -- Contacto admin
  contacto_nombre             VARCHAR(120) NOT NULL,
  contacto_whatsapp           VARCHAR(20)  NOT NULL,

  -- Modo solo lectura (apagado por default, sub-flags individuales)
  modo_lectura_activo         BOOLEAN NOT NULL DEFAULT false,
  modo_lectura_bloqueos       JSONB NOT NULL DEFAULT '{
    "crear": true,
    "editar": true,
    "timbrar": true,
    "pagos": true,
    "ajustes": true,
    "descargar_pdf": false,
    "exportar_excel": false,
    "config": false
  }'::jsonb,

  created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE (organizacion_id)
);

CREATE INDEX idx_suscripciones_org ON erp.suscripciones(organizacion_id);

CREATE TRIGGER trg_suscripciones_updated_at
  BEFORE UPDATE ON erp.suscripciones
  FOR EACH ROW EXECUTE FUNCTION erp.update_updated_at();

-- 2) Historial de pagos
CREATE TABLE erp.suscripcion_pagos (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suscripcion_id           UUID NOT NULL REFERENCES erp.suscripciones(id) ON DELETE CASCADE,
  organizacion_id          UUID NOT NULL REFERENCES erp.organizaciones(id) ON DELETE CASCADE,

  fecha_pago               DATE NOT NULL,
  monto                    NUMERIC(12,2) NOT NULL,
  forma_pago               VARCHAR(40) NOT NULL DEFAULT 'transferencia',
  referencia               VARCHAR(120),
  periodo_cubierto_desde   DATE NOT NULL,
  periodo_cubierto_hasta   DATE NOT NULL,
  comprobante_url          TEXT,
  notas                    TEXT,

  registrado_por           UUID REFERENCES erp.usuarios(id),
  registrado_por_email     TEXT,
  registrado_por_nombre    TEXT,

  created_at               TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_susc_pagos_susc ON erp.suscripcion_pagos(suscripcion_id, fecha_pago DESC);
CREATE INDEX idx_susc_pagos_org  ON erp.suscripcion_pagos(organizacion_id, fecha_pago DESC);

-- 3) Vista publica del estado
CREATE OR REPLACE VIEW erp.v_suscripcion_publica AS
SELECT
  s.organizacion_id,
  s.plan,
  s.fecha_corte,
  s.estado,
  s.banner_activo,
  s.banner_audiencia_modo,
  s.banner_usuarios_visibles,
  s.banner_forzar,
  s.dias_alerta,
  s.contacto_nombre,
  s.contacto_whatsapp,
  s.monto_mensual,
  s.monto_anual,
  s.iva_porcentaje,
  s.modo_lectura_activo,
  s.modo_lectura_bloqueos,
  (s.fecha_corte - CURRENT_DATE)::int AS dias_restantes
FROM erp.suscripciones s;

-- 4) RPC: estado_suscripcion
CREATE OR REPLACE FUNCTION erp.estado_suscripcion()
RETURNS TABLE (
  organizacion_id          UUID,
  plan                     VARCHAR,
  fecha_corte              DATE,
  estado                   VARCHAR,
  dias_restantes           INT,
  color_semaforo           VARCHAR,
  mostrar_banner           BOOLEAN,
  modo_lectura_activo      BOOLEAN,
  modo_lectura_bloqueos    JSONB,
  contacto_nombre          VARCHAR,
  contacto_whatsapp        VARCHAR,
  monto_mensual            NUMERIC,
  monto_anual              NUMERIC,
  iva_porcentaje           NUMERIC,
  dias_alerta              INT,
  banner_activo            BOOLEAN,
  banner_audiencia_modo    VARCHAR,
  banner_forzar            BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id        UUID;
  v_user_erp_id    UUID;
  v_org_id         UUID;
  v_susc           RECORD;
  v_dias           INT;
  v_color          VARCHAR;
  v_mostrar        BOOLEAN;
  v_en_audiencia   BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.id, u.organizacion_id
    INTO v_user_erp_id, v_org_id
  FROM erp.usuarios u
  WHERE u.auth_user_id = v_user_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_susc FROM erp.suscripciones s WHERE s.organizacion_id = v_org_id LIMIT 1;
  IF v_susc.id IS NULL THEN
    RETURN;
  END IF;

  v_dias := (v_susc.fecha_corte - CURRENT_DATE)::int;

  IF v_dias <= 1 THEN
    v_color := 'rojo';
  ELSIF v_dias <= 2 THEN
    v_color := 'naranja';
  ELSIF v_dias <= v_susc.dias_alerta THEN
    v_color := 'amarillo';
  ELSE
    v_color := 'verde';
  END IF;

  v_mostrar := v_susc.banner_activo;

  IF v_mostrar AND v_susc.banner_audiencia_modo = 'seleccionados' THEN
    v_en_audiencia := v_user_erp_id = ANY(v_susc.banner_usuarios_visibles);
    v_mostrar := v_en_audiencia;
  END IF;

  IF v_mostrar AND NOT v_susc.banner_forzar THEN
    v_mostrar := (v_dias <= v_susc.dias_alerta);
  END IF;

  RETURN QUERY SELECT
    v_susc.organizacion_id,
    v_susc.plan,
    v_susc.fecha_corte,
    v_susc.estado,
    v_dias,
    v_color,
    v_mostrar,
    v_susc.modo_lectura_activo,
    v_susc.modo_lectura_bloqueos,
    v_susc.contacto_nombre,
    v_susc.contacto_whatsapp,
    v_susc.monto_mensual,
    v_susc.monto_anual,
    v_susc.iva_porcentaje,
    v_susc.dias_alerta,
    v_susc.banner_activo,
    v_susc.banner_audiencia_modo,
    v_susc.banner_forzar;
END;
$$;

-- 5) RPC: registrar_pago_suscripcion (solo super_admin)
CREATE OR REPLACE FUNCTION erp.registrar_pago_suscripcion(
  p_monto                NUMERIC,
  p_fecha_pago           DATE,
  p_forma_pago           VARCHAR,
  p_referencia           VARCHAR DEFAULT NULL,
  p_periodo_meses        INT DEFAULT 1,
  p_comprobante_url      TEXT DEFAULT NULL,
  p_notas                TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  v_user_id        UUID;
  v_erp_user       RECORD;
  v_susc           RECORD;
  v_periodo_desde  DATE;
  v_periodo_hasta  DATE;
  v_pago_id        UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT u.id, u.organizacion_id, u.rol, u.email, u.nombre
    INTO v_erp_user
  FROM erp.usuarios u
  WHERE u.auth_user_id = v_user_id
  LIMIT 1;

  IF v_erp_user.id IS NULL THEN
    RAISE EXCEPTION 'Usuario no registrado en ERP';
  END IF;

  IF v_erp_user.rol != 'super_admin' THEN
    RAISE EXCEPTION 'Acceso denegado: solo super_admin puede registrar pagos';
  END IF;

  SELECT * INTO v_susc FROM erp.suscripciones s WHERE s.organizacion_id = v_erp_user.organizacion_id LIMIT 1;
  IF v_susc.id IS NULL THEN
    RAISE EXCEPTION 'No existe suscripcion para esta organizacion';
  END IF;

  v_periodo_desde := v_susc.fecha_corte;
  v_periodo_hasta := v_susc.fecha_corte + (p_periodo_meses || ' months')::interval;

  INSERT INTO erp.suscripcion_pagos (
    suscripcion_id, organizacion_id, fecha_pago, monto, forma_pago, referencia,
    periodo_cubierto_desde, periodo_cubierto_hasta, comprobante_url, notas,
    registrado_por, registrado_por_email, registrado_por_nombre
  ) VALUES (
    v_susc.id, v_susc.organizacion_id, p_fecha_pago, p_monto, p_forma_pago, p_referencia,
    v_periodo_desde, v_periodo_hasta, p_comprobante_url, p_notas,
    v_erp_user.id, v_erp_user.email, v_erp_user.nombre
  ) RETURNING id INTO v_pago_id;

  UPDATE erp.suscripciones
     SET fecha_corte    = v_periodo_hasta,
         estado         = 'activa',
         banner_forzar  = false,
         updated_at     = NOW()
   WHERE id = v_susc.id;

  RETURN v_pago_id;
END;
$$;

-- 6) RPC: actualizar_config_suscripcion (solo super_admin)
CREATE OR REPLACE FUNCTION erp.actualizar_config_suscripcion(p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  v_user_id  UUID;
  v_erp_user RECORD;
  v_susc_id  UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT u.id, u.organizacion_id, u.rol INTO v_erp_user
  FROM erp.usuarios u WHERE u.auth_user_id = v_user_id LIMIT 1;

  IF v_erp_user.rol != 'super_admin' THEN
    RAISE EXCEPTION 'Acceso denegado: solo super_admin';
  END IF;

  SELECT s.id INTO v_susc_id FROM erp.suscripciones s WHERE s.organizacion_id = v_erp_user.organizacion_id LIMIT 1;
  IF v_susc_id IS NULL THEN
    RAISE EXCEPTION 'No existe suscripcion para esta organizacion';
  END IF;

  UPDATE erp.suscripciones SET
    plan                     = COALESCE((p_payload->>'plan')::VARCHAR, plan),
    monto_mensual            = COALESCE((p_payload->>'monto_mensual')::NUMERIC, monto_mensual),
    monto_anual              = COALESCE((p_payload->>'monto_anual')::NUMERIC, monto_anual),
    iva_porcentaje           = COALESCE((p_payload->>'iva_porcentaje')::NUMERIC, iva_porcentaje),
    banner_activo            = COALESCE((p_payload->>'banner_activo')::BOOLEAN, banner_activo),
    banner_audiencia_modo    = COALESCE((p_payload->>'banner_audiencia_modo')::VARCHAR, banner_audiencia_modo),
    banner_usuarios_visibles = CASE
      WHEN p_payload ? 'banner_usuarios_visibles'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'banner_usuarios_visibles'))::UUID[]
      ELSE banner_usuarios_visibles END,
    banner_forzar            = COALESCE((p_payload->>'banner_forzar')::BOOLEAN, banner_forzar),
    dias_alerta              = COALESCE((p_payload->>'dias_alerta')::INT, dias_alerta),
    contacto_nombre          = COALESCE(p_payload->>'contacto_nombre', contacto_nombre),
    contacto_whatsapp        = COALESCE(p_payload->>'contacto_whatsapp', contacto_whatsapp),
    modo_lectura_activo      = COALESCE((p_payload->>'modo_lectura_activo')::BOOLEAN, modo_lectura_activo),
    modo_lectura_bloqueos    = COALESCE(p_payload->'modo_lectura_bloqueos', modo_lectura_bloqueos),
    fecha_corte              = COALESCE((p_payload->>'fecha_corte')::DATE, fecha_corte),
    estado                   = COALESCE((p_payload->>'estado')::VARCHAR, estado),
    updated_at               = NOW()
  WHERE id = v_susc_id;
END;
$$;

-- 7) Wrappers public.*
CREATE OR REPLACE FUNCTION public.estado_suscripcion()
RETURNS TABLE (
  organizacion_id          UUID,
  plan                     VARCHAR,
  fecha_corte              DATE,
  estado                   VARCHAR,
  dias_restantes           INT,
  color_semaforo           VARCHAR,
  mostrar_banner           BOOLEAN,
  modo_lectura_activo      BOOLEAN,
  modo_lectura_bloqueos    JSONB,
  contacto_nombre          VARCHAR,
  contacto_whatsapp        VARCHAR,
  monto_mensual            NUMERIC,
  monto_anual              NUMERIC,
  iva_porcentaje           NUMERIC,
  dias_alerta              INT,
  banner_activo            BOOLEAN,
  banner_audiencia_modo    VARCHAR,
  banner_forzar            BOOLEAN
)
LANGUAGE sql SECURITY INVOKER AS $$
  SELECT * FROM erp.estado_suscripcion();
$$;

CREATE OR REPLACE FUNCTION public.registrar_pago_suscripcion(
  p_monto NUMERIC, p_fecha_pago DATE, p_forma_pago VARCHAR,
  p_referencia VARCHAR DEFAULT NULL, p_periodo_meses INT DEFAULT 1,
  p_comprobante_url TEXT DEFAULT NULL, p_notas TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = erp, public AS $$
  SELECT erp.registrar_pago_suscripcion(p_monto, p_fecha_pago, p_forma_pago, p_referencia, p_periodo_meses, p_comprobante_url, p_notas);
$$;

CREATE OR REPLACE FUNCTION public.actualizar_config_suscripcion(p_payload JSONB)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = erp, public AS $$
  SELECT erp.actualizar_config_suscripcion(p_payload);
$$;

-- 8) GRANTs
GRANT SELECT ON erp.v_suscripcion_publica TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON erp.suscripciones TO authenticated;
GRANT SELECT, INSERT ON erp.suscripcion_pagos TO authenticated;
GRANT EXECUTE ON FUNCTION erp.estado_suscripcion()                                   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION erp.registrar_pago_suscripcion(NUMERIC,DATE,VARCHAR,VARCHAR,INT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION erp.actualizar_config_suscripcion(JSONB)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.estado_suscripcion()                                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pago_suscripcion(NUMERIC,DATE,VARCHAR,VARCHAR,INT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_config_suscripcion(JSONB)                TO authenticated;

-- 9) Insert inicial para SOLAC
INSERT INTO erp.suscripciones (
  organizacion_id, plan, monto_mensual, monto_anual, iva_porcentaje,
  fecha_corte, estado,
  banner_activo, banner_audiencia_modo, banner_usuarios_visibles, banner_forzar, dias_alerta,
  contacto_nombre, contacto_whatsapp,
  modo_lectura_activo
) VALUES (
  '89fd901a-bb39-46f3-9a3e-08d18212fdd5'::uuid,
  'mensual', 2500, 25000, 16,
  DATE '2026-05-30', 'activa',
  false, 'todos', '{}'::uuid[], true, 5,
  'Ing. Julio Gonzales', '+5213331179605',
  false
);
