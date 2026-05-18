-- ============================================================================
-- FIX BUG: erp.estado_suscripcion() necesita SECURITY DEFINER
--
-- Problema detectado en produccion: usuarios no super_admin no veian el banner
-- aunque banner_activo=true. Causa: la funcion estado_suscripcion era
-- SECURITY INVOKER (default) y RLS de erp.suscripciones solo permite SELECT a
-- super_admin. La funcion devolvia vacio para admin_cliente/vendedor/etc.
--
-- Aplicado en BD el 18-may-2026 despues de detectar el bug.
-- ============================================================================

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
SECURITY DEFINER
SET search_path = erp, public
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
  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT u.id, u.organizacion_id INTO v_user_erp_id, v_org_id
  FROM erp.usuarios u WHERE u.auth_user_id = v_user_id LIMIT 1;

  IF v_org_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_susc FROM erp.suscripciones s WHERE s.organizacion_id = v_org_id LIMIT 1;
  IF v_susc.id IS NULL THEN RETURN; END IF;

  v_dias := (v_susc.fecha_corte - CURRENT_DATE)::int;

  IF v_dias <= 1 THEN v_color := 'rojo';
  ELSIF v_dias <= 2 THEN v_color := 'naranja';
  ELSIF v_dias <= v_susc.dias_alerta THEN v_color := 'amarillo';
  ELSE v_color := 'verde';
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
    v_susc.organizacion_id, v_susc.plan, v_susc.fecha_corte, v_susc.estado,
    v_dias, v_color, v_mostrar,
    v_susc.modo_lectura_activo, v_susc.modo_lectura_bloqueos,
    v_susc.contacto_nombre, v_susc.contacto_whatsapp,
    v_susc.monto_mensual, v_susc.monto_anual, v_susc.iva_porcentaje,
    v_susc.dias_alerta, v_susc.banner_activo, v_susc.banner_audiencia_modo,
    v_susc.banner_forzar;
END;
$$;

CREATE OR REPLACE FUNCTION public.estado_suscripcion()
RETURNS TABLE (
  organizacion_id UUID, plan VARCHAR, fecha_corte DATE, estado VARCHAR,
  dias_restantes INT, color_semaforo VARCHAR, mostrar_banner BOOLEAN,
  modo_lectura_activo BOOLEAN, modo_lectura_bloqueos JSONB,
  contacto_nombre VARCHAR, contacto_whatsapp VARCHAR,
  monto_mensual NUMERIC, monto_anual NUMERIC, iva_porcentaje NUMERIC,
  dias_alerta INT, banner_activo BOOLEAN, banner_audiencia_modo VARCHAR,
  banner_forzar BOOLEAN
) LANGUAGE sql SECURITY DEFINER SET search_path = erp, public AS $$
  SELECT * FROM erp.estado_suscripcion();
$$;

GRANT EXECUTE ON FUNCTION erp.estado_suscripcion()    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estado_suscripcion() TO anon, authenticated;
