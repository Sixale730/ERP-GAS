-- =====================================================================
-- Inventario: reemplazar CHECK estatico por trigger matizado
-- =====================================================================
-- El CHECK "cantidad >= 0" introducido en 20260511_001 bloquea cualquier
-- UPDATE cuyo resultado quede < 0, sin distinguir si la operacion va en
-- direccion correcta (entrada que reduce el negativo) o incorrecta
-- (salida que profundiza el negativo).
--
-- Caso real que rompe el flujo: GP-RD-C2 estaba en -23 (legacy negativo).
-- Recibir 10 unidades quiere hacer UPDATE cantidad = -13. El CHECK
-- rechaza porque -13 < 0, aunque conceptualmente la operacion va de
-- -23 hacia 0 (mejora). Resultado: imposible recibir mercancia en SKUs
-- con saldo legacy negativo, hasta cuadrarlos manualmente.
--
-- Regla correcta:
--   INSERT: cantidad >= 0 obligatorio (registros nuevos siempre limpios)
--   UPDATE: bloquear solo si NEW.cantidad < 0 AND NEW.cantidad < OLD.cantidad
--           (el delta es negativo Y deja el saldo negativo)
--   - Permite: entradas a inventario negativo (mejora el saldo)
--   - Permite: salidas mientras NEW.cantidad >= 0
--   - Bloquea: ventas/ajustes que profundizan el negativo o lo crean
-- =====================================================================


-- 1) DROP del CHECK estatico
ALTER TABLE erp.inventario
  DROP CONSTRAINT IF EXISTS inventario_cantidad_no_negativa;


-- 2) Funcion del trigger
CREATE OR REPLACE FUNCTION erp.fn_inventario_no_negativa()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cantidad < 0 THEN
      RAISE EXCEPTION 'No se puede crear inventario con cantidad negativa (% para producto_id=%, almacen_id=%)',
        NEW.cantidad, NEW.producto_id, NEW.almacen_id
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Solo bloquear cuando el saldo final es negativo Y la operacion lo empeora.
    -- Permite: entradas (delta >= 0) sin importar el saldo final.
    -- Permite: salidas mientras el saldo final no quede negativo.
    -- Bloquea: cualquier UPDATE que deje el saldo en negativo Y baje desde el OLD.
    IF NEW.cantidad < 0 AND NEW.cantidad < OLD.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente: el inventario del producto % en almacen % quedaria en % (actual: %). No puede haber salidas que profundicen un saldo negativo o lo creen.',
        NEW.producto_id, NEW.almacen_id, NEW.cantidad, OLD.cantidad
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;


-- 3) Trigger BEFORE INSERT/UPDATE
DROP TRIGGER IF EXISTS trg_inventario_no_negativa ON erp.inventario;
CREATE TRIGGER trg_inventario_no_negativa
  BEFORE INSERT OR UPDATE OF cantidad ON erp.inventario
  FOR EACH ROW
  EXECUTE FUNCTION erp.fn_inventario_no_negativa();
