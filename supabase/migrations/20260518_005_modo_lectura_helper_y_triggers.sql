-- ============================================================================
-- MODO LECTURA - Helper RPC + triggers en tablas core
-- Aplicado en BD el 18-may-2026
--
-- Cuando erp.suscripciones.modo_lectura_activo = true para una organizacion,
-- los usuarios no super_admin tienen bloqueadas las acciones configuradas en
-- modo_lectura_bloqueos (crear, editar, timbrar, pagos, ajustes, etc.).
--
-- Defensa en profundidad:
-- - BD: triggers en tablas core + RPC helper.
-- - API: endpoints CFDI (timbrar, reintentar, cancelar, complemento-pago)
--   llaman a verificar_modo_lectura('timbrar') antes de procesar.
-- - UI: <BannerModoLectura /> en AppLayout muestra aviso rojo en todas las
--   paginas a usuarios no super_admin.
-- ============================================================================

-- 1) Helper: verifica si una accion esta bloqueada
CREATE OR REPLACE FUNCTION erp.verificar_modo_lectura(p_accion TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = erp, public
AS $$
DECLARE
  v_user_id   UUID;
  v_rol       TEXT;
  v_org       UUID;
  v_activo    BOOLEAN;
  v_bloqueos  JSONB;
  v_bloq      BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT u.rol, u.organizacion_id INTO v_rol, v_org
  FROM erp.usuarios u WHERE u.auth_user_id = v_user_id LIMIT 1;

  IF v_org IS NULL THEN RETURN; END IF;
  IF v_rol = 'super_admin' THEN RETURN; END IF;

  SELECT s.modo_lectura_activo, s.modo_lectura_bloqueos INTO v_activo, v_bloqueos
  FROM erp.suscripciones s WHERE s.organizacion_id = v_org LIMIT 1;

  IF v_activo IS NULL OR NOT v_activo THEN RETURN; END IF;

  v_bloq := COALESCE((v_bloqueos->p_accion)::BOOLEAN, false);
  IF NOT v_bloq THEN RETURN; END IF;

  RAISE EXCEPTION 'SUSCRIPCION_MODO_LECTURA: La accion "%" esta bloqueada porque la suscripcion del ERP esta en modo solo lectura. Contacta al administrador para confirmar el pago.', p_accion
    USING ERRCODE = 'P0001';
END;
$$;

GRANT EXECUTE ON FUNCTION erp.verificar_modo_lectura(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.verificar_modo_lectura(p_accion TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = erp, public
AS $$ SELECT erp.verificar_modo_lectura(p_accion); $$;

GRANT EXECUTE ON FUNCTION public.verificar_modo_lectura(TEXT) TO authenticated;

-- 2) Trigger generico: INSERT = 'crear', UPDATE/DELETE = 'editar'
CREATE OR REPLACE FUNCTION erp.trg_modo_lectura_generico()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM erp.verificar_modo_lectura('crear');
  ELSE
    PERFORM erp.verificar_modo_lectura('editar');
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Trigger especifico para erp.pagos -> accion 'pagos'
CREATE OR REPLACE FUNCTION erp.trg_modo_lectura_pagos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
BEGIN
  PERFORM erp.verificar_modo_lectura('pagos');
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Trigger especifico para ajustes / movimientos / inventario -> accion 'ajustes'
CREATE OR REPLACE FUNCTION erp.trg_modo_lectura_ajustes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = erp, public
AS $$
BEGIN
  PERFORM erp.verificar_modo_lectura('ajustes');
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- 3) Aplicar triggers en las tablas que la UI escribe directo
DO $$
DECLARE
  v_tabla TEXT;
  v_tablas TEXT[] := ARRAY[
    'clientes', 'productos',
    'cotizaciones', 'cotizacion_items',
    'facturas', 'factura_items',
    'ordenes_compra', 'orden_compra_items', 'recepciones_orden',
    'precios_productos', 'direcciones_envio'
  ];
BEGIN
  FOREACH v_tabla IN ARRAY v_tablas LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_modo_lectura ON erp.%I;
       CREATE TRIGGER trg_modo_lectura
       BEFORE INSERT OR UPDATE OR DELETE ON erp.%I
       FOR EACH ROW EXECUTE FUNCTION erp.trg_modo_lectura_generico();',
      v_tabla, v_tabla
    );
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_modo_lectura ON erp.pagos;
CREATE TRIGGER trg_modo_lectura
BEFORE INSERT OR UPDATE OR DELETE ON erp.pagos
FOR EACH ROW EXECUTE FUNCTION erp.trg_modo_lectura_pagos();

DROP TRIGGER IF EXISTS trg_modo_lectura ON erp.movimientos_inventario;
CREATE TRIGGER trg_modo_lectura
BEFORE INSERT OR UPDATE OR DELETE ON erp.movimientos_inventario
FOR EACH ROW EXECUTE FUNCTION erp.trg_modo_lectura_ajustes();

DROP TRIGGER IF EXISTS trg_modo_lectura ON erp.ajustes_inventario;
CREATE TRIGGER trg_modo_lectura
BEFORE INSERT OR UPDATE OR DELETE ON erp.ajustes_inventario
FOR EACH ROW EXECUTE FUNCTION erp.trg_modo_lectura_ajustes();

DROP TRIGGER IF EXISTS trg_modo_lectura ON erp.ajuste_inventario_items;
CREATE TRIGGER trg_modo_lectura
BEFORE INSERT OR UPDATE OR DELETE ON erp.ajuste_inventario_items
FOR EACH ROW EXECUTE FUNCTION erp.trg_modo_lectura_ajustes();

-- erp.inventario: solo UPDATE/DELETE (los INSERT los hace seeding inicial)
DROP TRIGGER IF EXISTS trg_modo_lectura ON erp.inventario;
CREATE TRIGGER trg_modo_lectura
BEFORE UPDATE OR DELETE ON erp.inventario
FOR EACH ROW EXECUTE FUNCTION erp.trg_modo_lectura_ajustes();
