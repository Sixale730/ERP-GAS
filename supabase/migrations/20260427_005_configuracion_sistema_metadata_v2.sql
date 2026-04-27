-- Anadir columnas de metadata para mejorar UX del panel
ALTER TABLE erp.configuracion_sistema
  ADD COLUMN IF NOT EXISTS etiqueta VARCHAR(120),
  ADD COLUMN IF NOT EXISTS subgrupo VARCHAR(50),
  ADD COLUMN IF NOT EXISTS aplicado_en JSONB,
  ADD COLUMN IF NOT EXISTS requiere_confirmacion BOOLEAN DEFAULT false;

-- Backfill de etiquetas, subgrupos, aplicado_en y confirmacion para las 16 claves
UPDATE erp.configuracion_sistema SET
  etiqueta = 'Stock objetivo por defecto',
  subgrupo = 'Stock',
  aplicado_en = '[{"ruta":"/compras/nueva","descripcion":"Generador automatico de OC"}]'::jsonb
WHERE categoria='inventario' AND clave='objetivo_stock_default';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'Dias sin movimiento para alerta',
  subgrupo = 'Alertas',
  aplicado_en = '[{"ruta":"/reportes/productos-sin-movimiento","descripcion":"Umbral inicial del reporte"}]'::jsonb
WHERE categoria='inventario' AND clave='dias_sin_movimiento_alerta';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'Permitir sobre-venta',
  subgrupo = 'Validaciones',
  requiere_confirmacion = true,
  aplicado_en = '[{"ruta":"/cotizaciones/nueva","descripcion":"Validacion al agregar items"},{"ruta":"/ordenes-venta/nueva","descripcion":"Validacion al agregar items"}]'::jsonb
WHERE categoria='inventario' AND clave='permitir_sobre_venta';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'Vigencia por defecto (dias)',
  aplicado_en = '[{"ruta":"/cotizaciones/nueva","descripcion":"Vigencia inicial al crear cotizacion"}]'::jsonb
WHERE categoria='cotizaciones' AND clave='vigencia_dias_default';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'Permitir editar cotizaciones aprobadas',
  requiere_confirmacion = true
WHERE categoria='cotizaciones' AND clave='permitir_editar_aprobadas';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'Requiere corte ciego',
  subgrupo = 'Operacion',
  requiere_confirmacion = true
WHERE categoria='pos' AND clave='requiere_corte_ciego';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'Tolerancia diferencia de caja (MXN)',
  subgrupo = 'Validaciones',
  requiere_confirmacion = true
WHERE categoria='pos' AND clave='tolerancia_diferencia_caja';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'Auto-timbrar al crear factura',
  subgrupo = 'Timbrado',
  requiere_confirmacion = true
WHERE categoria='cfdi' AND clave='auto_timbrar_al_crear';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'Dias antes de vencer CSD para alertar',
  subgrupo = 'Alertas',
  requiere_confirmacion = true
WHERE categoria='cfdi' AND clave='dias_alerta_csd_vencimiento';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'Cartera vencida (dias)',
  subgrupo = 'Cobranza'
WHERE categoria='insights' AND clave='cartera_vencida_dias';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'Caida de volumen del cliente (%)',
  subgrupo = 'Ventas',
  aplicado_en = '[{"ruta":"/insights","descripcion":"Regla cliente-perdiendo-volumen"}]'::jsonb
WHERE categoria='insights' AND clave='cliente_caida_volumen_pct';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'Caida ticket promedio POS (%)',
  subgrupo = 'POS',
  aplicado_en = '[{"ruta":"/insights","descripcion":"Regla ticket-promedio-pos"}]'::jsonb
WHERE categoria='insights' AND clave='ticket_promedio_caida_pct';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'GC time React Query (minutos)'
WHERE categoria='performance' AND clave='react_query_gc_minutes';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'Auto-limpiar cache cada (minutos)',
  aplicado_en = '[{"ruta":"*","descripcion":"AppLayout - aplica globalmente al montar la app"}]'::jsonb
WHERE categoria='performance' AND clave='auto_clear_cache_minutes';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'Densidad de tablas'
WHERE categoria='ui' AND clave='densidad_tablas';

UPDATE erp.configuracion_sistema SET
  etiqueta = 'Mostrar ayudas contextuales'
WHERE categoria='ui' AND clave='mostrar_ayudas_contextuales';

-- list_configuracion_sistema con los nuevos campos
DROP FUNCTION IF EXISTS erp.list_configuracion_sistema(UUID, VARCHAR) CASCADE;
CREATE OR REPLACE FUNCTION erp.list_configuracion_sistema(
  p_organizacion_id UUID,
  p_categoria VARCHAR DEFAULT NULL
) RETURNS TABLE (
  id UUID, organizacion_id UUID, categoria VARCHAR, clave VARCHAR, valor JSONB,
  tipo VARCHAR, descripcion TEXT, valor_default JSONB, opciones JSONB,
  min_valor NUMERIC, max_valor NUMERIC, is_global BOOLEAN,
  permite_override_usuario BOOLEAN,
  etiqueta VARCHAR, subgrupo VARCHAR, aplicado_en JSONB, requiere_confirmacion BOOLEAN,
  modificado_por UUID, modificado_por_nombre VARCHAR,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT cs.id, cs.organizacion_id, cs.categoria, cs.clave, cs.valor, cs.tipo,
         cs.descripcion, cs.valor_default, cs.opciones, cs.min_valor, cs.max_valor,
         cs.is_global, cs.permite_override_usuario,
         cs.etiqueta, cs.subgrupo, cs.aplicado_en, cs.requiere_confirmacion,
         cs.modificado_por, u.nombre AS modificado_por_nombre,
         cs.created_at, cs.updated_at
  FROM erp.configuracion_sistema cs
  LEFT JOIN erp.usuarios u ON u.id = cs.modificado_por
  WHERE (cs.organizacion_id = p_organizacion_id OR cs.is_global = true)
    AND (p_categoria IS NULL OR cs.categoria = p_categoria)
  ORDER BY cs.categoria, COALESCE(cs.subgrupo, ''), cs.clave;
END;
$$ LANGUAGE plpgsql STABLE;

DROP FUNCTION IF EXISTS public.list_configuracion_sistema(UUID, VARCHAR) CASCADE;
CREATE OR REPLACE FUNCTION public.list_configuracion_sistema(
  p_organizacion_id UUID, p_categoria VARCHAR DEFAULT NULL
) RETURNS TABLE (
  id UUID, organizacion_id UUID, categoria VARCHAR, clave VARCHAR, valor JSONB,
  tipo VARCHAR, descripcion TEXT, valor_default JSONB, opciones JSONB,
  min_valor NUMERIC, max_valor NUMERIC, is_global BOOLEAN,
  permite_override_usuario BOOLEAN,
  etiqueta VARCHAR, subgrupo VARCHAR, aplicado_en JSONB, requiere_confirmacion BOOLEAN,
  modificado_por UUID, modificado_por_nombre VARCHAR,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
) AS $$
  SELECT * FROM erp.list_configuracion_sistema(p_organizacion_id, p_categoria);
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION erp.list_configuracion_sistema(UUID, VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_configuracion_sistema(UUID, VARCHAR) TO anon, authenticated;
