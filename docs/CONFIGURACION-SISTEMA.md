# Panel de Parámetros del Sistema

Diseño y plan de implementación del panel de configuración avanzada en `/configuracion/sistema`.

## Objetivo

Exponer al usuario admin los parámetros que hoy están hardcoded en el código, con:

- Edición desde una UI agrupada por categoría.
- Auditoría de cambios (quién, cuándo, valor anterior).
- Trazabilidad: poder responder "¿por qué pasó esto?" mostrando qué parámetro influyó.
- Multi-tenant: cada `org_id` tiene su propia configuración, con override por usuario en claves marcadas.

Inspirado en patrones de SAP / Odoo / NetSuite ("Settings as Data").

## Ubicación

- Ruta: `/configuracion/sistema`
- Subpágina de `/configuracion` (igual que `usuarios`, `cfdi`, `admin`).
- Card visible para `admin_cliente` y `super_admin`.

## Arquitectura

### Backend (schema `erp`)

- **`erp.configuracion_sistema`**: tabla central key-value tipada por `org_id`.
  - Campos: `org_id`, `categoria`, `clave`, `valor JSONB`, `tipo`, `descripcion`, `valor_default`, `is_global`, `modificado_por`, timestamps.
  - UNIQUE `(org_id, categoria, clave)`.
- **`erp.configuracion_audit`**: log de cambios (trigger automático).
- **RPCs** con wrappers en `public.*`:
  - `set_configuracion(categoria, clave, valor)` — upsert + audit.
  - `get_configuracion(categoria, clave)` — con fallback a default.
  - `list_configuracion(categoria)` — listado para UI.

### Frontend

- **Hook `useConfiguracion(categoria)`**: lista para UI del panel (cache 10 min).
- **Hook `useConfigValue<T>(cat, clave, default)`**: lectura puntual desde código de negocio. Siempre con fallback al hardcode original.
- **Hook `useSetConfig()`**: mutation con optimistic update + invalidate.
- **Constantes `CONFIG_KEYS`** en `src/lib/config/keys.ts` para evitar strings mágicos.

### UI

- Página única con `<Tabs>` por categoría (no subrutas).
- `Input.Search` global cross-tabs.
- Cada parámetro: control según `tipo` (Switch / InputNumber / Input / Select / TextArea), botón "Restaurar default", Popover ⓘ con info de última modificación.

## Categorías iniciales

| Categoría | Ejemplos de claves |
|---|---|
| `inventario` | `objetivo_stock_default`, `dias_sin_movimiento_alerta`, `permitir_sobre_venta` |
| `cotizaciones` | `vigencia_dias_default`, `auto_marcar_vencidas`, `permitir_editar_aprobadas` |
| `pos` | `requiere_corte_ciego`, `tolerancia_diferencia_caja`, `forzar_cliente_publico_general` |
| `cfdi` | `auto_timbrar_al_crear`, `dias_alerta_csd_vencimiento`, `forma_pago_default` |
| `insights` | toggle por regla (15 reglas), umbrales (`cartera_vencida_dias`, `ticket_promedio_caida_pct`) |
| `performance` | `react_query_gc_minutes`, `auto_clear_cache_minutes` |
| `ui` | `tema`, `densidad_tablas`, `mostrar_ayudas_contextuales` |

## Fases de implementación

| Fase | Alcance | Riesgo |
|---|---|---|
| 0 | Branch + docs (este archivo). | Nulo |
| 1 | Tablas + RPCs + wrappers + seed. Backend listo, frontend no consume. | Bajo |
| 2 | Hook `useConfig` + tipos + catálogo de claves. Sin consumidores. | Bajo |
| 3 | UI `/configuracion/sistema` en modo lectura. | Bajo |
| 4 | Edición + restaurar default + audit visible. | Bajo (aún sin consumidores) |
| 5 | Primer consumidor real: `objetivo_stock_default` en `/compras/nueva`. | Bajo |
| 6 | Migración progresiva de hardcodes (1 commit por hardcode). | Medio (POS/CFDI sensibles) |
| 7 | Búsqueda fuzzy + badges de "modificado" + restaurar masivo. | Bajo |
| 8 | Trazabilidad de insights: cada insight explica con qué parámetros se generó + dry-run. | Medio (refactor del engine) |
| 9 | Override por usuario para claves de UI. | Bajo |
| 10 | Documentación final + actualizar `CLAUDE.md` + PR a `master`. | Nulo |

Cada fase termina con: `npm run build` + smoke test + commit + push.

## Reglas transversales

1. **Toda lectura de config tiene fallback** al hardcode original. Si la tabla está vacía o la query falla, el sistema sigue funcionando.
2. **Wrappers `public.*` se actualizan en el mismo commit** que la RPC en `erp.*`.
3. **Cambios de tipo de retorno**: `DROP FUNCTION ... CASCADE` + `CREATE`, nunca `CREATE OR REPLACE`.
4. **Antes de cada `push`**: build verde + smoke test del módulo tocado.
5. **Si un commit rompe algo**: `git revert <sha>`, no force-push.
6. **Multi-tenant**: cada query de config filtra por `org_id` desde `selectedOrgId` (uiStore) o `erpUser.org_id`. Probar con switcher de super_admin.
7. **Ningún cambio de fase 6+ sin pasar antes por las fases 1-5**: el panel debe estar audit-trackeado antes de que módulos críticos consuman valores.

## Ganancias colaterales

- Permite atacar el leak de memoria (`react_query_gc_minutes` configurable) sin cambios de código adicionales.
- Reemplaza el card "Recargar sistema" como única solución por una mitigación configurable.
- Da base para futura página "Salud del sistema" mostrando overrides activos vs defaults.
