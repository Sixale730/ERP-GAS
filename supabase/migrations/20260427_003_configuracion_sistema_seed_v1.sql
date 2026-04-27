-- Seeds iniciales para todas las organizaciones existentes
-- Idempotente via ON CONFLICT
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM erp.organizaciones LOOP
    -- INVENTARIO
    INSERT INTO erp.configuracion_sistema (organizacion_id, categoria, clave, valor, tipo, descripcion, valor_default, min_valor, max_valor)
    VALUES
      (org.id, 'inventario', 'objetivo_stock_default', '20'::jsonb, 'number',
       'Cantidad objetivo cuando un producto no tiene stock_maximo definido. Usado por el generador de OC.',
       '20'::jsonb, 1, 10000),
      (org.id, 'inventario', 'dias_sin_movimiento_alerta', '60'::jsonb, 'number',
       'Dias sin movimiento para considerar un producto sin rotacion en alertas y reportes.',
       '60'::jsonb, 7, 365),
      (org.id, 'inventario', 'permitir_sobre_venta', 'false'::jsonb, 'boolean',
       'Si se permite crear cotizaciones u OVs cuando el disponible es menor al solicitado.',
       'false'::jsonb, NULL, NULL)
    ON CONFLICT (organizacion_id, categoria, clave) DO NOTHING;

    -- COTIZACIONES
    INSERT INTO erp.configuracion_sistema (organizacion_id, categoria, clave, valor, tipo, descripcion, valor_default, min_valor, max_valor)
    VALUES
      (org.id, 'cotizaciones', 'vigencia_dias_default', '15'::jsonb, 'number',
       'Dias de vigencia por defecto al crear una cotizacion nueva.',
       '15'::jsonb, 1, 365),
      (org.id, 'cotizaciones', 'permitir_editar_aprobadas', 'false'::jsonb, 'boolean',
       'Si se permite editar cotizaciones ya convertidas a orden de venta.',
       'false'::jsonb, NULL, NULL)
    ON CONFLICT (organizacion_id, categoria, clave) DO NOTHING;

    -- POS
    INSERT INTO erp.configuracion_sistema (organizacion_id, categoria, clave, valor, tipo, descripcion, valor_default, min_valor, max_valor)
    VALUES
      (org.id, 'pos', 'requiere_corte_ciego', 'false'::jsonb, 'boolean',
       'Si el cajero debe contar la caja sin ver el monto esperado durante el corte.',
       'false'::jsonb, NULL, NULL),
      (org.id, 'pos', 'tolerancia_diferencia_caja', '50'::jsonb, 'number',
       'Tolerancia en MXN para considerar una diferencia de caja como normal.',
       '50'::jsonb, 0, 10000)
    ON CONFLICT (organizacion_id, categoria, clave) DO NOTHING;

    -- CFDI
    INSERT INTO erp.configuracion_sistema (organizacion_id, categoria, clave, valor, tipo, descripcion, valor_default, min_valor, max_valor)
    VALUES
      (org.id, 'cfdi', 'auto_timbrar_al_crear', 'false'::jsonb, 'boolean',
       'Si las facturas se timbran automaticamente al crearse (sin paso manual).',
       'false'::jsonb, NULL, NULL),
      (org.id, 'cfdi', 'dias_alerta_csd_vencimiento', '30'::jsonb, 'number',
       'Dias antes del vencimiento del CSD para mostrar alerta.',
       '30'::jsonb, 1, 365)
    ON CONFLICT (organizacion_id, categoria, clave) DO NOTHING;

    -- INSIGHTS
    INSERT INTO erp.configuracion_sistema (organizacion_id, categoria, clave, valor, tipo, descripcion, valor_default, min_valor, max_valor)
    VALUES
      (org.id, 'insights', 'cartera_vencida_dias', '30'::jsonb, 'number',
       'Dias para considerar una factura como cartera vencida.',
       '30'::jsonb, 1, 365),
      (org.id, 'insights', 'cliente_caida_volumen_pct', '30'::jsonb, 'number',
       'Porcentaje de caida vs 90d previos para alertar cliente perdiendo volumen.',
       '30'::jsonb, 5, 100),
      (org.id, 'insights', 'ticket_promedio_caida_pct', '15'::jsonb, 'number',
       'Porcentaje de caida del ticket promedio POS para generar alerta.',
       '15'::jsonb, 5, 100)
    ON CONFLICT (organizacion_id, categoria, clave) DO NOTHING;

    -- PERFORMANCE
    INSERT INTO erp.configuracion_sistema (organizacion_id, categoria, clave, valor, tipo, descripcion, valor_default, min_valor, max_valor)
    VALUES
      (org.id, 'performance', 'react_query_gc_minutes', '30'::jsonb, 'number',
       'Minutos antes de que React Query libere cache de queries inactivas. Reduce uso de memoria si es bajo.',
       '30'::jsonb, 5, 120),
      (org.id, 'performance', 'auto_clear_cache_minutes', '0'::jsonb, 'number',
       'Minutos para limpiar cache de React Query automaticamente. 0 = deshabilitado.',
       '0'::jsonb, 0, 240)
    ON CONFLICT (organizacion_id, categoria, clave) DO NOTHING;

    -- UI
    INSERT INTO erp.configuracion_sistema (organizacion_id, categoria, clave, valor, tipo, descripcion, valor_default, opciones, permite_override_usuario)
    VALUES
      (org.id, 'ui', 'densidad_tablas', '"middle"'::jsonb, 'enum',
       'Tamano de filas en tablas de listados.',
       '"middle"'::jsonb, '["small","middle","large"]'::jsonb, true),
      (org.id, 'ui', 'mostrar_ayudas_contextuales', 'true'::jsonb, 'boolean',
       'Mostrar tooltips e iconos de ayuda en formularios.',
       'true'::jsonb, NULL, true)
    ON CONFLICT (organizacion_id, categoria, clave) DO NOTHING;
  END LOOP;
END $$;
