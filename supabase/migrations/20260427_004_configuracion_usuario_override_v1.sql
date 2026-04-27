-- Tabla de overrides por usuario para claves marcadas con permite_override_usuario=true
CREATE TABLE IF NOT EXISTS erp.configuracion_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES erp.usuarios(id) ON DELETE CASCADE,
  organizacion_id UUID REFERENCES erp.organizaciones(id) ON DELETE CASCADE,
  categoria VARCHAR(50) NOT NULL,
  clave VARCHAR(100) NOT NULL,
  valor JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (usuario_id, categoria, clave)
);

CREATE INDEX IF NOT EXISTS idx_configusu_usuario_cat ON erp.configuracion_usuario(usuario_id, categoria);

GRANT SELECT, INSERT, UPDATE, DELETE ON erp.configuracion_usuario TO anon, authenticated;

DROP TRIGGER IF EXISTS trg_configusu_updated_at ON erp.configuracion_usuario;
CREATE TRIGGER trg_configusu_updated_at
  BEFORE UPDATE ON erp.configuracion_usuario
  FOR EACH ROW EXECUTE FUNCTION erp.fn_configsis_updated_at();

-- get_configuracion_sistema_v2: resuelve usuario > org > global
DROP FUNCTION IF EXISTS erp.get_configuracion_sistema_v2(VARCHAR, VARCHAR, UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION erp.get_configuracion_sistema_v2(
  p_categoria VARCHAR,
  p_clave VARCHAR,
  p_organizacion_id UUID,
  p_usuario_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_valor JSONB;
  v_permite_override BOOLEAN;
BEGIN
  IF p_usuario_id IS NOT NULL THEN
    SELECT permite_override_usuario INTO v_permite_override
    FROM erp.configuracion_sistema
    WHERE categoria = p_categoria AND clave = p_clave AND organizacion_id = p_organizacion_id
    LIMIT 1;

    IF v_permite_override THEN
      SELECT valor INTO v_valor
      FROM erp.configuracion_usuario
      WHERE usuario_id = p_usuario_id AND categoria = p_categoria AND clave = p_clave;
      IF v_valor IS NOT NULL THEN
        RETURN v_valor;
      END IF;
    END IF;
  END IF;

  SELECT valor INTO v_valor
  FROM erp.configuracion_sistema
  WHERE categoria = p_categoria AND clave = p_clave
    AND (organizacion_id = p_organizacion_id OR is_global = true)
  ORDER BY (organizacion_id = p_organizacion_id) DESC
  LIMIT 1;
  RETURN v_valor;
END;
$$ LANGUAGE plpgsql STABLE;

DROP FUNCTION IF EXISTS public.get_configuracion_sistema_v2(VARCHAR, VARCHAR, UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.get_configuracion_sistema_v2(
  p_categoria VARCHAR, p_clave VARCHAR, p_organizacion_id UUID, p_usuario_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
  SELECT erp.get_configuracion_sistema_v2(p_categoria, p_clave, p_organizacion_id, p_usuario_id);
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION erp.get_configuracion_sistema_v2(VARCHAR, VARCHAR, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_configuracion_sistema_v2(VARCHAR, VARCHAR, UUID, UUID) TO anon, authenticated;

-- set_configuracion_usuario: upsert para overrides personales
DROP FUNCTION IF EXISTS erp.set_configuracion_usuario(VARCHAR, VARCHAR, JSONB, UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION erp.set_configuracion_usuario(
  p_categoria VARCHAR,
  p_clave VARCHAR,
  p_valor JSONB,
  p_usuario_id UUID,
  p_organizacion_id UUID
) RETURNS UUID AS $$
DECLARE
  v_permite BOOLEAN;
  v_id UUID;
BEGIN
  SELECT permite_override_usuario INTO v_permite
  FROM erp.configuracion_sistema
  WHERE categoria = p_categoria AND clave = p_clave AND organizacion_id = p_organizacion_id
  LIMIT 1;

  IF NOT COALESCE(v_permite, false) THEN
    RAISE EXCEPTION 'La clave % / % no permite override por usuario', p_categoria, p_clave;
  END IF;

  INSERT INTO erp.configuracion_usuario (usuario_id, organizacion_id, categoria, clave, valor)
  VALUES (p_usuario_id, p_organizacion_id, p_categoria, p_clave, p_valor)
  ON CONFLICT (usuario_id, categoria, clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS public.set_configuracion_usuario(VARCHAR, VARCHAR, JSONB, UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.set_configuracion_usuario(
  p_categoria VARCHAR, p_clave VARCHAR, p_valor JSONB, p_usuario_id UUID, p_organizacion_id UUID
) RETURNS UUID AS $$
  SELECT erp.set_configuracion_usuario(p_categoria, p_clave, p_valor, p_usuario_id, p_organizacion_id);
$$ LANGUAGE sql;

GRANT EXECUTE ON FUNCTION erp.set_configuracion_usuario(VARCHAR, VARCHAR, JSONB, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_configuracion_usuario(VARCHAR, VARCHAR, JSONB, UUID, UUID) TO anon, authenticated;
