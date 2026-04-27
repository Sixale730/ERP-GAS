-- get_configuracion_sistema: lectura de un valor con fallback
DROP FUNCTION IF EXISTS erp.get_configuracion_sistema(VARCHAR, VARCHAR, UUID) CASCADE;
CREATE OR REPLACE FUNCTION erp.get_configuracion_sistema(
  p_categoria VARCHAR,
  p_clave VARCHAR,
  p_organizacion_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_valor JSONB;
BEGIN
  SELECT valor INTO v_valor
  FROM erp.configuracion_sistema
  WHERE categoria = p_categoria AND clave = p_clave
    AND (organizacion_id = p_organizacion_id OR is_global = true)
  ORDER BY (organizacion_id = p_organizacion_id) DESC
  LIMIT 1;
  RETURN v_valor;
END;
$$ LANGUAGE plpgsql STABLE;

-- list_configuracion_sistema: listado por org (todas las categorias o filtrada)
DROP FUNCTION IF EXISTS erp.list_configuracion_sistema(UUID, VARCHAR) CASCADE;
CREATE OR REPLACE FUNCTION erp.list_configuracion_sistema(
  p_organizacion_id UUID,
  p_categoria VARCHAR DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  organizacion_id UUID,
  categoria VARCHAR,
  clave VARCHAR,
  valor JSONB,
  tipo VARCHAR,
  descripcion TEXT,
  valor_default JSONB,
  opciones JSONB,
  min_valor NUMERIC,
  max_valor NUMERIC,
  is_global BOOLEAN,
  permite_override_usuario BOOLEAN,
  modificado_por UUID,
  modificado_por_nombre VARCHAR,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT cs.id, cs.organizacion_id, cs.categoria, cs.clave, cs.valor, cs.tipo,
         cs.descripcion, cs.valor_default, cs.opciones, cs.min_valor, cs.max_valor,
         cs.is_global, cs.permite_override_usuario, cs.modificado_por,
         u.nombre AS modificado_por_nombre,
         cs.created_at, cs.updated_at
  FROM erp.configuracion_sistema cs
  LEFT JOIN erp.usuarios u ON u.id = cs.modificado_por
  WHERE (cs.organizacion_id = p_organizacion_id OR cs.is_global = true)
    AND (p_categoria IS NULL OR cs.categoria = p_categoria)
  ORDER BY cs.categoria, cs.clave;
END;
$$ LANGUAGE plpgsql STABLE;

-- set_configuracion_sistema: upsert + audit (audit lo dispara el trigger)
DROP FUNCTION IF EXISTS erp.set_configuracion_sistema(VARCHAR, VARCHAR, JSONB, UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION erp.set_configuracion_sistema(
  p_categoria VARCHAR,
  p_clave VARCHAR,
  p_valor JSONB,
  p_organizacion_id UUID,
  p_modificado_por UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  UPDATE erp.configuracion_sistema
  SET valor = p_valor, modificado_por = p_modificado_por
  WHERE organizacion_id = p_organizacion_id AND categoria = p_categoria AND clave = p_clave
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Configuracion no encontrada: % / % (registrar primero el seed)', p_categoria, p_clave;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- reset_configuracion_sistema: restaurar a valor_default
DROP FUNCTION IF EXISTS erp.reset_configuracion_sistema(VARCHAR, VARCHAR, UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION erp.reset_configuracion_sistema(
  p_categoria VARCHAR,
  p_clave VARCHAR,
  p_organizacion_id UUID,
  p_modificado_por UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_default JSONB;
BEGIN
  SELECT id, valor_default INTO v_id, v_default
  FROM erp.configuracion_sistema
  WHERE organizacion_id = p_organizacion_id AND categoria = p_categoria AND clave = p_clave;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Configuracion no encontrada: % / %', p_categoria, p_clave;
  END IF;

  UPDATE erp.configuracion_sistema
  SET valor = v_default, modificado_por = p_modificado_por
  WHERE id = v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- get_audit_configuracion_sistema: ultimas modificaciones de una clave
DROP FUNCTION IF EXISTS erp.get_audit_configuracion_sistema(VARCHAR, VARCHAR, UUID, INT) CASCADE;
CREATE OR REPLACE FUNCTION erp.get_audit_configuracion_sistema(
  p_categoria VARCHAR,
  p_clave VARCHAR,
  p_organizacion_id UUID,
  p_limit INT DEFAULT 10
) RETURNS TABLE (
  id UUID,
  valor_anterior JSONB,
  valor_nuevo JSONB,
  modificado_por UUID,
  modificado_por_nombre VARCHAR,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.valor_anterior, a.valor_nuevo, a.modificado_por,
         u.nombre AS modificado_por_nombre, a.created_at
  FROM erp.configuracion_audit a
  LEFT JOIN erp.usuarios u ON u.id = a.modificado_por
  WHERE a.categoria = p_categoria AND a.clave = p_clave
    AND a.organizacion_id = p_organizacion_id
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Wrappers public.*
DROP FUNCTION IF EXISTS public.get_configuracion_sistema(VARCHAR, VARCHAR, UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.get_configuracion_sistema(
  p_categoria VARCHAR, p_clave VARCHAR, p_organizacion_id UUID
) RETURNS JSONB AS $$
  SELECT erp.get_configuracion_sistema(p_categoria, p_clave, p_organizacion_id);
$$ LANGUAGE sql STABLE;

DROP FUNCTION IF EXISTS public.list_configuracion_sistema(UUID, VARCHAR) CASCADE;
CREATE OR REPLACE FUNCTION public.list_configuracion_sistema(
  p_organizacion_id UUID, p_categoria VARCHAR DEFAULT NULL
) RETURNS TABLE (
  id UUID, organizacion_id UUID, categoria VARCHAR, clave VARCHAR, valor JSONB,
  tipo VARCHAR, descripcion TEXT, valor_default JSONB, opciones JSONB,
  min_valor NUMERIC, max_valor NUMERIC, is_global BOOLEAN,
  permite_override_usuario BOOLEAN, modificado_por UUID, modificado_por_nombre VARCHAR,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
) AS $$
  SELECT * FROM erp.list_configuracion_sistema(p_organizacion_id, p_categoria);
$$ LANGUAGE sql STABLE;

DROP FUNCTION IF EXISTS public.set_configuracion_sistema(VARCHAR, VARCHAR, JSONB, UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.set_configuracion_sistema(
  p_categoria VARCHAR, p_clave VARCHAR, p_valor JSONB,
  p_organizacion_id UUID, p_modificado_por UUID DEFAULT NULL
) RETURNS UUID AS $$
  SELECT erp.set_configuracion_sistema(p_categoria, p_clave, p_valor, p_organizacion_id, p_modificado_por);
$$ LANGUAGE sql;

DROP FUNCTION IF EXISTS public.reset_configuracion_sistema(VARCHAR, VARCHAR, UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.reset_configuracion_sistema(
  p_categoria VARCHAR, p_clave VARCHAR, p_organizacion_id UUID, p_modificado_por UUID DEFAULT NULL
) RETURNS UUID AS $$
  SELECT erp.reset_configuracion_sistema(p_categoria, p_clave, p_organizacion_id, p_modificado_por);
$$ LANGUAGE sql;

DROP FUNCTION IF EXISTS public.get_audit_configuracion_sistema(VARCHAR, VARCHAR, UUID, INT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_audit_configuracion_sistema(
  p_categoria VARCHAR, p_clave VARCHAR, p_organizacion_id UUID, p_limit INT DEFAULT 10
) RETURNS TABLE (
  id UUID, valor_anterior JSONB, valor_nuevo JSONB, modificado_por UUID,
  modificado_por_nombre VARCHAR, created_at TIMESTAMPTZ
) AS $$
  SELECT * FROM erp.get_audit_configuracion_sistema(p_categoria, p_clave, p_organizacion_id, p_limit);
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION erp.get_configuracion_sistema(VARCHAR, VARCHAR, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION erp.list_configuracion_sistema(UUID, VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION erp.set_configuracion_sistema(VARCHAR, VARCHAR, JSONB, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION erp.reset_configuracion_sistema(VARCHAR, VARCHAR, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION erp.get_audit_configuracion_sistema(VARCHAR, VARCHAR, UUID, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_configuracion_sistema(VARCHAR, VARCHAR, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_configuracion_sistema(UUID, VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_configuracion_sistema(VARCHAR, VARCHAR, JSONB, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_configuracion_sistema(VARCHAR, VARCHAR, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_configuracion_sistema(VARCHAR, VARCHAR, UUID, INT) TO anon, authenticated;
