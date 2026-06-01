-- Agregar COT-06228 al final de la cola FIFO de folios recuperados.
-- COT-06228 quedo como hueco en erp.cotizaciones (secuencia salto al 6229)
-- y no se incluyo en la migracion previa.
-- Orden de consumo final: 06225 (1ro), 06227 (2do), 06228 (3ro).
INSERT INTO erp.folios_recuperados (tipo, folio, notas, created_at)
VALUES (
  'cotizacion',
  'COT-06228',
  'Recuperado manual: hueco detectado al revisar la secuencia',
  NOW()
)
ON CONFLICT (tipo, folio) DO NOTHING;
