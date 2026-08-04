-- =====================================================================
-- Merge cuentas duplicadas Jose Martinez
-- =====================================================================
-- SOURCE (mergear + desactivar):
--   id           35ddf190-690b-4a39-b1eb-231531a3c91b
--   email        joseanmtz75@gmail.com
--   auth_user_id d5cd6a21-8bcd-4dcf-a3c3-0accc24a9920
--   rol          admin_cliente
--
-- TARGET (preservar):
--   id           db9b4dfd-48f4-4bc0-88fe-f68f510272f0
--   email        joseanmtz0209@gmail.com
--   auth_user_id 6b6329b4-6728-4bd0-94fd-4a34406196c2
--   rol          super_admin
--
-- Ambas cuentas son de la misma persona (confirmado por el usuario).
-- Se re-apuntan 164 filas de source a target y se desactiva source.
--
-- REVERSIBILIDAD: erp._merge_usuarios_backup guarda registro_id por fila
-- afectada. Para deshacer: UPDATE con SET id_col = usuario_source_id
-- FROM _merge_usuarios_backup WHERE registro_id = tabla.id.
-- =====================================================================


-- 1) Tabla de backup para reversibilidad
CREATE TABLE IF NOT EXISTS erp._merge_usuarios_backup (
  id                     bigserial PRIMARY KEY,
  fecha_merge            timestamptz DEFAULT NOW(),
  usuario_source_id      uuid NOT NULL,
  usuario_source_email   varchar,
  usuario_source_auth_id uuid,
  usuario_target_id      uuid NOT NULL,
  usuario_target_email   varchar,
  tabla                  varchar NOT NULL,
  columna                varchar NOT NULL,
  registro_id            uuid,
  notas                  text
);


DO $$
DECLARE
  v_src  uuid := '35ddf190-690b-4a39-b1eb-231531a3c91b'; -- joseanmtz75
  v_tgt  uuid := 'db9b4dfd-48f4-4bc0-88fe-f68f510272f0'; -- joseanmtz0209
  v_src_email  varchar := 'joseanmtz75@gmail.com';
  v_tgt_email  varchar := 'joseanmtz0209@gmail.com';
  v_src_auth   uuid    := 'd5cd6a21-8bcd-4dcf-a3c3-0accc24a9920';
BEGIN
  -- ------------------------------------------------------------------
  -- 2) Snapshot de backup por tabla afectada (guarda registro_id)
  -- ------------------------------------------------------------------

  INSERT INTO erp._merge_usuarios_backup (usuario_source_id, usuario_source_email, usuario_source_auth_id, usuario_target_id, usuario_target_email, tabla, columna, registro_id)
  SELECT v_src, v_src_email, v_src_auth, v_tgt, v_tgt_email, 'cotizaciones', 'vendedor_id', id
  FROM erp.cotizaciones WHERE vendedor_id = v_src;

  INSERT INTO erp._merge_usuarios_backup (usuario_source_id, usuario_source_email, usuario_source_auth_id, usuario_target_id, usuario_target_email, tabla, columna, registro_id)
  SELECT v_src, v_src_email, v_src_auth, v_tgt, v_tgt_email, 'historial_documentos', 'usuario_id', id
  FROM erp.historial_documentos WHERE usuario_id = v_src;

  INSERT INTO erp._merge_usuarios_backup (usuario_source_id, usuario_source_email, usuario_source_auth_id, usuario_target_id, usuario_target_email, tabla, columna, registro_id)
  SELECT v_src, v_src_email, v_src_auth, v_tgt, v_tgt_email, 'suscripcion_eventos', 'usuario_id', id
  FROM erp.suscripcion_eventos WHERE usuario_id = v_src;

  INSERT INTO erp._merge_usuarios_backup (usuario_source_id, usuario_source_email, usuario_source_auth_id, usuario_target_id, usuario_target_email, tabla, columna, registro_id)
  SELECT v_src, v_src_email, v_src_auth, v_tgt, v_tgt_email, 'dashboard_notificaciones_dismissals', 'usuario_id', id
  FROM erp.dashboard_notificaciones_dismissals WHERE usuario_id = v_src;

  INSERT INTO erp._merge_usuarios_backup (usuario_source_id, usuario_source_email, usuario_source_auth_id, usuario_target_id, usuario_target_email, tabla, columna, registro_id)
  SELECT v_src, v_src_email, v_src_auth, v_tgt, v_tgt_email, 'guias_envio', 'created_by', id
  FROM erp.guias_envio WHERE created_by = v_src;

  INSERT INTO erp._merge_usuarios_backup (usuario_source_id, usuario_source_email, usuario_source_auth_id, usuario_target_id, usuario_target_email, tabla, columna, registro_id)
  SELECT v_src, v_src_email, v_src_auth, v_tgt, v_tgt_email, 'configuracion_sistema', 'modificado_por', id
  FROM erp.configuracion_sistema WHERE modificado_por = v_src;

  INSERT INTO erp._merge_usuarios_backup (usuario_source_id, usuario_source_email, usuario_source_auth_id, usuario_target_id, usuario_target_email, tabla, columna, registro_id)
  SELECT v_src, v_src_email, v_src_auth, v_tgt, v_tgt_email, 'ordenes_compra', 'creado_por', id
  FROM erp.ordenes_compra WHERE creado_por = v_src;

  INSERT INTO erp._merge_usuarios_backup (usuario_source_id, usuario_source_email, usuario_source_auth_id, usuario_target_id, usuario_target_email, tabla, columna, registro_id)
  SELECT v_src, v_src_email, v_src_auth, v_tgt, v_tgt_email, 'solicitudes_acceso', 'revisado_por', id
  FROM erp.solicitudes_acceso WHERE revisado_por = v_src;

  -- ------------------------------------------------------------------
  -- 3) Resolver colisiones en dashboard_notificaciones_dismissals
  --    Eliminar filas del source que ya tienen su equivalente en target
  --    (deja notas en backup para trazabilidad).
  -- ------------------------------------------------------------------

  INSERT INTO erp._merge_usuarios_backup (usuario_source_id, usuario_source_email, usuario_source_auth_id, usuario_target_id, usuario_target_email, tabla, columna, registro_id, notas)
  SELECT v_src, v_src_email, v_src_auth, v_tgt, v_tgt_email, 'dashboard_notificaciones_dismissals', 'usuario_id', id, 'ELIMINADO por colision UNIQUE(notificacion_id, usuario_id)'
  FROM erp.dashboard_notificaciones_dismissals s
  WHERE s.usuario_id = v_src
    AND EXISTS (
      SELECT 1 FROM erp.dashboard_notificaciones_dismissals t
      WHERE t.usuario_id = v_tgt AND t.notificacion_id = s.notificacion_id
    );

  DELETE FROM erp.dashboard_notificaciones_dismissals s
  WHERE s.usuario_id = v_src
    AND EXISTS (
      SELECT 1 FROM erp.dashboard_notificaciones_dismissals t
      WHERE t.usuario_id = v_tgt AND t.notificacion_id = s.notificacion_id
    );

  -- ------------------------------------------------------------------
  -- 4) UPDATE en cascada de todas las FK y soft-refs
  -- ------------------------------------------------------------------

  UPDATE erp.cotizaciones                       SET vendedor_id      = v_tgt WHERE vendedor_id      = v_src;
  UPDATE erp.historial_documentos               SET usuario_id       = v_tgt WHERE usuario_id       = v_src;
  UPDATE erp.suscripcion_eventos                SET usuario_id       = v_tgt WHERE usuario_id       = v_src;
  UPDATE erp.dashboard_notificaciones_dismissals SET usuario_id      = v_tgt WHERE usuario_id       = v_src;
  UPDATE erp.guias_envio                        SET created_by       = v_tgt WHERE created_by       = v_src;
  UPDATE erp.configuracion_sistema              SET modificado_por   = v_tgt WHERE modificado_por   = v_src;
  UPDATE erp.ordenes_compra                     SET creado_por       = v_tgt WHERE creado_por       = v_src;
  UPDATE erp.solicitudes_acceso                 SET revisado_por     = v_tgt WHERE revisado_por     = v_src;

  -- Tablas con 0 filas hoy pero pueden crecer: se dejan tambien por robustez
  UPDATE erp.movimientos_inventario             SET usuario_id       = v_tgt WHERE usuario_id       = v_src;
  UPDATE erp.ajustes_inventario                 SET creado_por       = v_tgt WHERE creado_por       = v_src;
  UPDATE erp.configuracion_usuario              SET usuario_id       = v_tgt WHERE usuario_id       = v_src;
  UPDATE erp.dashboard_notificaciones           SET published_by     = v_tgt WHERE published_by     = v_src;
  UPDATE erp.dashboard_notificaciones           SET created_by       = v_tgt WHERE created_by       = v_src;
  UPDATE erp.folios_recuperados                 SET creado_por       = v_tgt WHERE creado_por       = v_src;
  UPDATE erp.invitaciones                       SET invitado_por     = v_tgt WHERE invitado_por     = v_src;
  UPDATE erp.reportes_errores                   SET usuario_id       = v_tgt WHERE usuario_id       = v_src;
  UPDATE erp.reportes_errores                   SET resolved_by      = v_tgt WHERE resolved_by      = v_src;
  UPDATE erp.suscripcion_pagos                  SET registrado_por   = v_tgt WHERE registrado_por   = v_src;
  UPDATE erp.usuarios_autorizados               SET autorizado_por   = v_tgt WHERE autorizado_por   = v_src;

  -- ------------------------------------------------------------------
  -- 5) Desactivar cuenta source y liberar su email del whitelist
  -- ------------------------------------------------------------------

  UPDATE erp.usuarios
  SET is_active = false,
      email     = 'MERGED_' || v_src::text || '_' || email,
      updated_at = NOW()
  WHERE id = v_src;

  -- Quitar del whitelist para evitar auto-registro futuro si se intenta loguear
  DELETE FROM erp.usuarios_autorizados WHERE email = v_src_email;

END $$;
