-- ============================================================================
-- Proteccion contra duplicados de RFC en erp.clientes
-- Aplicado en BD el 18-may-2026
--
-- UNIQUE PARCIAL: el RFC es unico SOLO entre clientes activos dentro de la
-- misma organizacion. Permite que los inactivos conserven su RFC para
-- historico fiscal, pero impide crear (o reactivar) dos clientes activos
-- con el mismo RFC.
--
-- Normalizacion: UPPER + TRIM para evitar duplicados por mayusculas/espacios.
-- Solo aplica cuando rfc es NOT NULL y no esta vacio.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_clientes_rfc_activo_org
ON erp.clientes (organizacion_id, UPPER(TRIM(rfc)))
WHERE is_active = true
  AND rfc IS NOT NULL
  AND TRIM(rfc) <> '';

COMMENT ON INDEX erp.uniq_clientes_rfc_activo_org IS
'Garantiza que dentro de una org no haya dos clientes activos con el mismo RFC (normalizado UPPER+TRIM). Los inactivos pueden repetir para conservar historico fiscal.';
