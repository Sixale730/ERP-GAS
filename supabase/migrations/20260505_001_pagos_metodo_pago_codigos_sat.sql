-- =====================================================================
-- Fix: erp.pagos.metodo_pago_check ahora acepta los codigos SAT c_FormaPago
-- =====================================================================
-- Estado previo (modelo legacy): el constraint solo permitia los strings
--   'efectivo' / 'transferencia' / 'tarjeta' / 'cheque'.
--
-- Pero todo el frontend (facturas/[id]/page.tsx FORMAS_PAGO_OPTIONS) y la
-- API route (/api/pagos -> FORMAS_PAGO_VALIDAS) ya envian los CODIGOS SAT
-- de 2 digitos del catalogo c_FormaPago. Por eso cualquier intento de
-- registrar un pago disparaba:
--
--   new row for relation "pagos" violates check constraint
--   "pagos_metodo_pago_check"
--
-- Migration:
--   1) Drop del constraint viejo.
--   2) Add constraint con los 22 codigos SAT validos del catalogo c_FormaPago.
--   3) Comment de columna documentando el catalogo.
--
-- Nota: se ejecuto previamente en remoto (tabla vacia, 0 filas, no hay
-- datos legacy que migrar). Este archivo deja la migration versionada en
-- el repo para que branches/setups locales y futuros redeploys queden
-- alineados.
-- =====================================================================

ALTER TABLE erp.pagos DROP CONSTRAINT IF EXISTS pagos_metodo_pago_check;

ALTER TABLE erp.pagos
  ADD CONSTRAINT pagos_metodo_pago_check
  CHECK (metodo_pago IN (
    '01', -- Efectivo
    '02', -- Cheque nominativo
    '03', -- Transferencia electronica de fondos
    '04', -- Tarjeta de credito
    '05', -- Monedero electronico
    '06', -- Dinero electronico
    '08', -- Vales de despensa
    '12', -- Dacion en pago
    '13', -- Pago por subrogacion
    '14', -- Pago por consignacion
    '15', -- Condonacion
    '17', -- Compensacion
    '23', -- Novacion
    '24', -- Confusion
    '25', -- Remision de deuda
    '26', -- Prescripcion o caducidad
    '27', -- A satisfaccion del acreedor
    '28', -- Tarjeta de debito
    '29', -- Tarjeta de servicios
    '30', -- Aplicacion de anticipos existentes
    '31', -- Intermediario de pagos
    '99'  -- Por definir
  ));

COMMENT ON COLUMN erp.pagos.metodo_pago IS
  'Codigo SAT c_FormaPago (2 caracteres). Ej: 01 Efectivo, 03 Transferencia, 04 Credito, 28 Debito, 99 Por definir.';
