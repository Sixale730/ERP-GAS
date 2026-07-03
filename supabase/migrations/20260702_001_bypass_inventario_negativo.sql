-- =====================================================================
-- Bypass reversible del trigger inventario_no_negativa
-- =====================================================================
-- Introduce la clave 'inventario.bypass_inventario_negativo' (boolean).
-- Cuando esta activa (true) para una organizacion, el trigger
-- fn_inventario_no_negativa deja pasar cualquier UPDATE/INSERT sin
-- validar. Cuando esta apagada (false, default), el trigger opera
-- normal: rechaza salidas que dejarian el saldo profundizando un
-- negativo o crearian un INSERT negativo.
--
-- Uso: bypass temporal cuando el operador necesita facturar OVs
-- historicas sin stock (mercancia ya salio fisicamente pero no se
-- descontaron en el sistema). Se enciende, factura, apaga.
--
-- Reversible: apagar el flag restaura el comportamiento estricto.
-- Los negativos dejados no se auto-corrigen; recepciones y ajustes
-- positivos los ira normalizando.
-- =====================================================================


-- 1) Sembrar la clave para TODAS las organizaciones existentes
INSERT INTO erp.configuracion_sistema (
  organizacion_id, categoria, clave, valor, tipo, descripcion,
  valor_default, is_global, permite_override_usuario, etiqueta, subgrupo,
  requiere_confirmacion
)
SELECT o.id,
       'inventario',
       'bypass_inventario_negativo',
       'false'::jsonb,
       'boolean',
       'Cuando esta activo, permite facturar OVs y descontar inventario aunque quede en negativo. Usalo temporalmente para regularizar operacion historica y APAGALO cuando termines. Mientras esta activo, un banner amarillo aparece arriba en todo el ERP.',
       'false'::jsonb,
       false,
       false,
       'Modo bypass inventario negativo (temporal)',
       'permisos',
       true
FROM erp.organizaciones o
ON CONFLICT (organizacion_id, categoria, clave) DO NOTHING;


-- 2) Actualizar la funcion del trigger para consultar la clave
CREATE OR REPLACE FUNCTION erp.fn_inventario_no_negativa()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  v_bypass boolean := false;
BEGIN
  -- Consultar si la organizacion tiene bypass activo. Si algo falla,
  -- por seguridad se asume false (aplica proteccion normal).
  BEGIN
    SELECT COALESCE((valor)::text::boolean, false)
    INTO v_bypass
    FROM erp.configuracion_sistema
    WHERE organizacion_id = NEW.organizacion_id
      AND categoria = 'inventario'
      AND clave = 'bypass_inventario_negativo';
  EXCEPTION WHEN OTHERS THEN
    v_bypass := false;
  END;

  IF v_bypass THEN
    -- Bypass activo: no validar, dejar pasar.
    RETURN NEW;
  END IF;

  -- Comportamiento normal (proteccion estricta)
  IF TG_OP = 'INSERT' THEN
    IF NEW.cantidad < 0 THEN
      RAISE EXCEPTION 'No se puede crear inventario con cantidad negativa (% para producto_id=%, almacen_id=%)',
        NEW.cantidad, NEW.producto_id, NEW.almacen_id
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cantidad < 0 AND NEW.cantidad < OLD.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente: el inventario del producto % en almacen % quedaria en % (actual: %). No puede haber salidas que profundicen un saldo negativo o lo creen.',
        NEW.producto_id, NEW.almacen_id, NEW.cantidad, OLD.cantidad
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
