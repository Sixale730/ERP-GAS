-- Tabla central de parametros del sistema
CREATE TABLE IF NOT EXISTS erp.configuracion_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id UUID REFERENCES erp.organizaciones(id) ON DELETE CASCADE,
  categoria VARCHAR(50) NOT NULL,
  clave VARCHAR(100) NOT NULL,
  valor JSONB NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('boolean','number','string','enum','json')),
  descripcion TEXT,
  valor_default JSONB,
  opciones JSONB,
  min_valor NUMERIC,
  max_valor NUMERIC,
  is_global BOOLEAN DEFAULT false,
  permite_override_usuario BOOLEAN DEFAULT false,
  modificado_por UUID REFERENCES erp.usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organizacion_id, categoria, clave)
);

CREATE INDEX IF NOT EXISTS idx_configsis_org_cat ON erp.configuracion_sistema(organizacion_id, categoria);
CREATE INDEX IF NOT EXISTS idx_configsis_clave ON erp.configuracion_sistema(categoria, clave);

COMMENT ON TABLE erp.configuracion_sistema IS 'Parametros del sistema editables por admin, separados por categoria con audit y multi-tenant';

-- Audit log
CREATE TABLE IF NOT EXISTS erp.configuracion_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuracion_id UUID REFERENCES erp.configuracion_sistema(id) ON DELETE SET NULL,
  organizacion_id UUID,
  categoria VARCHAR(50),
  clave VARCHAR(100),
  valor_anterior JSONB,
  valor_nuevo JSONB,
  modificado_por UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_configaudit_config ON erp.configuracion_audit(configuracion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_configaudit_org_cat ON erp.configuracion_audit(organizacion_id, categoria, clave, created_at DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION erp.fn_configsis_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_configsis_updated_at ON erp.configuracion_sistema;
CREATE TRIGGER trg_configsis_updated_at
  BEFORE UPDATE ON erp.configuracion_sistema
  FOR EACH ROW EXECUTE FUNCTION erp.fn_configsis_updated_at();

-- Trigger audit
CREATE OR REPLACE FUNCTION erp.fn_configsis_audit() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.valor IS DISTINCT FROM OLD.valor THEN
    INSERT INTO erp.configuracion_audit (configuracion_id, organizacion_id, categoria, clave, valor_anterior, valor_nuevo, modificado_por)
    VALUES (NEW.id, NEW.organizacion_id, NEW.categoria, NEW.clave, OLD.valor, NEW.valor, NEW.modificado_por);
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO erp.configuracion_audit (configuracion_id, organizacion_id, categoria, clave, valor_anterior, valor_nuevo, modificado_por)
    VALUES (NEW.id, NEW.organizacion_id, NEW.categoria, NEW.clave, NULL, NEW.valor, NEW.modificado_por);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_configsis_audit ON erp.configuracion_sistema;
CREATE TRIGGER trg_configsis_audit
  AFTER INSERT OR UPDATE ON erp.configuracion_sistema
  FOR EACH ROW EXECUTE FUNCTION erp.fn_configsis_audit();

-- Permisos
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.configuracion_sistema TO anon, authenticated;
GRANT SELECT, INSERT ON erp.configuracion_audit TO anon, authenticated;
