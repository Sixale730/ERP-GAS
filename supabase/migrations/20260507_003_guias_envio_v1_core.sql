-- =====================================================================
-- Modulo de Logistica / Guias de envio (Fase 1 - Core)
-- =====================================================================
-- Caso de uso SOLAC: cliente paga -> OV -> almacen separa material ->
-- entrega en paqueteria -> ticket trae numero_guia y costo_real ->
-- comparte al cliente -> persona de logistica registra en este modulo.
--
-- Schema:
-- 1) erp.guias_envio: 1 fila por paquete entregado en paqueteria.
-- 2) erp.guia_envio_cotizaciones: tabla pivot N:M (una guia consolida
--    varias OVs del mismo cliente). Las OVs viven en cotizaciones con
--    status='orden_venta'.
-- 3) Rol nuevo 'logistica' agregado al CHECK de erp.usuarios.rol.
-- 4) RPC erp.generar_folio_guia + wrapper public.
-- 5) RLS multi-tenant + permisos por rol (logistica = CRUD de guias).
-- =====================================================================

ALTER TABLE erp.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE erp.usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('super_admin','admin_cliente','vendedor','compras','contador','logistica'));

ALTER TABLE erp.invitaciones DROP CONSTRAINT IF EXISTS invitaciones_rol_check;
ALTER TABLE erp.invitaciones
  ADD CONSTRAINT invitaciones_rol_check
  CHECK (rol IN ('super_admin','admin_cliente','vendedor','compras','contador','logistica'));

ALTER TABLE erp.usuarios_autorizados DROP CONSTRAINT IF EXISTS usuarios_autorizados_rol_check;
ALTER TABLE erp.usuarios_autorizados
  ADD CONSTRAINT usuarios_autorizados_rol_check
  CHECK (rol IN ('super_admin','admin_cliente','vendedor','compras','contador','logistica'));

CREATE TABLE IF NOT EXISTS erp.guias_envio (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio           VARCHAR(40) UNIQUE NOT NULL,
  organizacion_id UUID NOT NULL REFERENCES erp.organizaciones(id) ON DELETE CASCADE,
  cliente_id          UUID REFERENCES erp.clientes(id) ON DELETE SET NULL,
  cliente_nombre_libre VARCHAR(200),
  direccion_envio_id  UUID REFERENCES erp.direcciones_envio(id) ON DELETE SET NULL,
  paqueteria      VARCHAR(30) NOT NULL
                    CHECK (paqueteria IN (
                      'paquetexpress','estafeta','tres_guerras','dhl','fedex',
                      'castores','propio','otro'
                    )),
  numero_guia     VARCHAR(60),
  referencia_externa VARCHAR(60),
  tipo_entrega    VARCHAR(15) NOT NULL DEFAULT 'domicilio'
                    CHECK (tipo_entrega IN ('ocurre','domicilio')),
  forma_pago_envio VARCHAR(15) NOT NULL DEFAULT 'pagado'
                    CHECK (forma_pago_envio IN ('pagado','por_cobrar')),
  atencion_a      VARCHAR(120),
  destino_ciudad  VARCHAR(120),
  destino_estado  VARCHAR(80),
  destino_cp      VARCHAR(10),
  peso_kg         NUMERIC(10,3),
  medidas_cm      JSONB,
  bultos          INTEGER DEFAULT 1 CHECK (bultos > 0),
  valor_declarado NUMERIC(12,2),
  costo_real      NUMERIC(12,2),
  monto_cobrado   NUMERIC(12,2),
  status          VARCHAR(20) NOT NULL DEFAULT 'en_paqueteria'
                    CHECK (status IN ('en_paqueteria','en_transito','entregado','incidencia','devuelto')),
  fecha_despacho  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_estimada  DATE,
  fecha_entrega   TIMESTAMP,
  enviado_a_cliente_por VARCHAR(15)
                    CHECK (enviado_a_cliente_por IN ('whatsapp','email','manual','no_enviado')),
  fecha_enviado_cliente TIMESTAMP,
  ticket_url      TEXT,
  acuse_url       TEXT,
  notas           TEXT,
  factura_id      UUID REFERENCES erp.facturas(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES erp.usuarios(id),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guias_envio_org ON erp.guias_envio (organizacion_id);
CREATE INDEX IF NOT EXISTS idx_guias_envio_status ON erp.guias_envio (status);
CREATE INDEX IF NOT EXISTS idx_guias_envio_fecha_despacho ON erp.guias_envio (fecha_despacho DESC);
CREATE INDEX IF NOT EXISTS idx_guias_envio_paqueteria ON erp.guias_envio (paqueteria);
CREATE INDEX IF NOT EXISTS idx_guias_envio_cliente ON erp.guias_envio (cliente_id);
CREATE INDEX IF NOT EXISTS idx_guias_envio_factura ON erp.guias_envio (factura_id);

DROP TRIGGER IF EXISTS trg_guias_envio_updated_at ON erp.guias_envio;
CREATE TRIGGER trg_guias_envio_updated_at
  BEFORE UPDATE ON erp.guias_envio
  FOR EACH ROW EXECUTE FUNCTION erp.update_updated_at();

CREATE TABLE IF NOT EXISTS erp.guia_envio_cotizaciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guia_id         UUID NOT NULL REFERENCES erp.guias_envio(id) ON DELETE CASCADE,
  cotizacion_id   UUID NOT NULL REFERENCES erp.cotizaciones(id) ON DELETE CASCADE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (guia_id, cotizacion_id)
);

CREATE INDEX IF NOT EXISTS idx_guia_cot_guia ON erp.guia_envio_cotizaciones (guia_id);
CREATE INDEX IF NOT EXISTS idx_guia_cot_cot ON erp.guia_envio_cotizaciones (cotizacion_id);

CREATE OR REPLACE FUNCTION erp.generar_folio_guia()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $func$
DECLARE
  v_count INTEGER;
  v_year  INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  SELECT COUNT(*) INTO v_count FROM erp.guias_envio
    WHERE EXTRACT(YEAR FROM created_at) = v_year;
  RETURN 'GUIA-' || v_year || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
END;
$func$;

CREATE OR REPLACE FUNCTION public.generar_folio_guia()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $func$
BEGIN
  RETURN erp.generar_folio_guia();
END;
$func$;

GRANT EXECUTE ON FUNCTION erp.generar_folio_guia() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generar_folio_guia() TO anon, authenticated;

ALTER TABLE erp.guias_envio ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.guia_envio_cotizaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guias_envio_select ON erp.guias_envio;
CREATE POLICY guias_envio_select ON erp.guias_envio
  FOR SELECT USING (
    organizacion_id = erp.get_my_org_id() OR erp.is_super_admin()
  );

DROP POLICY IF EXISTS guias_envio_insert ON erp.guias_envio;
CREATE POLICY guias_envio_insert ON erp.guias_envio
  FOR INSERT WITH CHECK (
    organizacion_id = erp.get_my_org_id() AND (
      erp.is_super_admin() OR erp.is_admin()
      OR EXISTS (
        SELECT 1 FROM erp.usuarios u
        WHERE u.auth_user_id = auth.uid()
          AND u.rol IN ('logistica', 'vendedor')
      )
    )
  );

DROP POLICY IF EXISTS guias_envio_update ON erp.guias_envio;
CREATE POLICY guias_envio_update ON erp.guias_envio
  FOR UPDATE USING (
    organizacion_id = erp.get_my_org_id() AND (
      erp.is_super_admin() OR erp.is_admin()
      OR EXISTS (
        SELECT 1 FROM erp.usuarios u
        WHERE u.auth_user_id = auth.uid() AND u.rol = 'logistica'
      )
    )
  );

DROP POLICY IF EXISTS guias_envio_delete ON erp.guias_envio;
CREATE POLICY guias_envio_delete ON erp.guias_envio
  FOR DELETE USING (
    organizacion_id = erp.get_my_org_id() AND (
      erp.is_super_admin() OR erp.is_admin()
    )
  );

DROP POLICY IF EXISTS guia_cot_select ON erp.guia_envio_cotizaciones;
CREATE POLICY guia_cot_select ON erp.guia_envio_cotizaciones
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM erp.guias_envio g WHERE g.id = guia_id
            AND (g.organizacion_id = erp.get_my_org_id() OR erp.is_super_admin()))
  );

DROP POLICY IF EXISTS guia_cot_modify ON erp.guia_envio_cotizaciones;
CREATE POLICY guia_cot_modify ON erp.guia_envio_cotizaciones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM erp.guias_envio g WHERE g.id = guia_id
            AND g.organizacion_id = erp.get_my_org_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM erp.guias_envio g WHERE g.id = guia_id
            AND g.organizacion_id = erp.get_my_org_id())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON erp.guias_envio TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.guia_envio_cotizaciones TO anon, authenticated;
