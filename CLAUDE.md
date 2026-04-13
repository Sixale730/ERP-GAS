# CUANTY ERP - Sistema de Inventario, Ventas, POS y Finanzas

## Descripcion del Proyecto

ERP full-stack para PyMEs mexicanas. Cubre inventario multi-almacen, pipeline de ventas (cotizacion → orden → factura), POS con gestion de turnos, timbrado CFDI 4.0, compras, ~45 reportes, motor de insights con alertas accionables y control de acceso por roles. Pensado como alternativa mas simple e intuitiva que NetSuite.

## Stack Tecnologico

### Backend
- **Base de datos**: Supabase (PostgreSQL)
- **Schema principal**: `erp` (separado de `public`)
- **Autenticacion**: Supabase Auth con Google OAuth + flujo de invitaciones
- **RLS / multi-tenant**: Control por `org_id` en tablas sensibles; super_admin puede cambiar de org

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: Ant Design 5 (con `@ant-design/nextjs-registry`)
- **Language**: TypeScript
- **State Management**:
  - **React Query** (TanStack Query v5): cache de datos del servidor (staleTime 5 min, gcTime 30 min)
  - **Zustand v5** con middleware `persist`: estado global de UI y POS
- **UX**:
  - **NProgress**: barra de progreso durante navegacion
  - **Skeleton Loaders**: placeholders durante carga
  - **Optimistic Updates**: actualizaciones instantaneas en UI
- **PWA**: soporta instalacion como app (manifest.json + icons)

### Librerias clave
- **PDFs / Excel**: `jspdf`, `jspdf-autotable`, `exceljs` — todos con **dynamic import** (no en bundle inicial)
- **CFDI / SAT**: `xmlbuilder2`, `xml2js`, `soap` (SOAP WSDL de Finkok), `node-forge` (firma RSA), `xslt-processor`, `qrcode` — marcados como `serverExternalPackages` en next.config
- **Utilidades**: `dayjs`, `nprogress`

## Configuracion de Supabase (IMPORTANTE)

### 1. Exponer Schema en API
En Supabase Dashboard → Settings → API → Exposed schemas:
- Agregar `erp` a la lista de schemas expuestos

### 2. Permisos del Schema (REQUERIDO)

Ejecutar en SQL Editor:

```sql
-- Permisos de uso del schema
GRANT USAGE ON SCHEMA erp TO anon, authenticated;

-- Permisos en tablas existentes
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA erp TO anon, authenticated;

-- Permisos en secuencias
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA erp TO anon, authenticated;

-- Permisos en funciones
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA erp TO anon, authenticated;

-- Permisos por defecto para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA erp
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA erp
GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA erp
GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
```

> **Nota**: Sin estos permisos, el frontend mostrara error `42501: permission denied for schema erp`.

### 3. Wrappers publicos de RPCs

Muchas funciones de `erp.*` tienen un wrapper en `public.*` que llama al original. Si se modifica una RPC, **actualizar ambos**. Al cambiar tipos de retorno, usar `DROP FUNCTION ... CASCADE` + `CREATE` (no `CREATE OR REPLACE`).

### 4. Variables de Entorno

Crear `.env.local` en la raiz:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xuvxtwdlbqomjyeyeugy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
# Finkok (CFDI)
FINKOK_USERNAME=...
FINKOK_PASSWORD=...
FINKOK_AMBIENTE=dev|prod
```

---

## Comandos de Desarrollo

```bash
npm install
npm run dev          # desarrollo
npm run build        # build de produccion
npm start            # iniciar produccion
npm run lint         # eslint
npm run analyze      # bundle analyzer (@next/bundle-analyzer)
```

## Estructura del Frontend

```
src/
├── app/
│   ├── (dashboard)/           # Rutas con layout de sidebar
│   │   ├── dashboard/         # KPIs, alertas, insights resumen
│   │   ├── productos/         # CRUD productos
│   │   ├── inventario/        # Stock por almacen
│   │   ├── clientes/          # CRUD clientes
│   │   ├── cotizaciones/      # Cotizaciones (list, nueva, [id], editar)
│   │   ├── ordenes-venta/     # Ordenes de venta
│   │   ├── facturas/          # Facturas + factura global
│   │   ├── compras/           # Ordenes de compra y recepciones
│   │   ├── pos/               # Admin POS: cajas, cortes, ventas
│   │   ├── reportes/          # ~45 reportes
│   │   ├── insights/          # Motor de alertas (UI)
│   │   ├── catalogos/         # Categorias, almacenes, proveedores, listas precios, precios
│   │   ├── configuracion/     # Usuarios, CFDI, admin
│   │   ├── admin/leads/       # Panel de leads (solo super_admin)
│   │   ├── buscar/            # Busqueda global
│   │   └── layout.tsx
│   ├── (pos)/                 # Route group del terminal POS
│   │   ├── pos/               # Terminal POS (pantalla de caja)
│   │   └── layout.tsx
│   ├── api/                   # Route handlers (ver tabla abajo)
│   ├── auth/callback/         # Handler OAuth
│   ├── login/                 # Login con Google OAuth
│   ├── invitacion/[token]/    # Aceptar invitacion
│   ├── solicitar-acceso/      # Solicitud publica de acceso
│   ├── solicitud-pendiente/   # Estado espera aprobacion
│   ├── registro-pendiente/    # Estado espera completar registro
│   ├── setup/                 # Wizard inicial (crear super_admin)
│   ├── modulos/               # Selector de modulos (super_admin post-login)
│   ├── page.tsx               # Landing publica
│   ├── layout.tsx             # Layout raiz con providers
│   └── globals.css
├── components/
│   ├── layout/                # AppLayout, Sidebar, GlobalSearch, NavigationProgress
│   ├── common/                # Skeletons y helpers
│   ├── landing/               # Componentes de la landing + demos
│   ├── productos/
│   ├── precios/
│   ├── movimientos/
│   ├── facturacion/           # Facturas, CFDI UI
│   ├── cfdi/                  # Componentes especificos de CFDI (CSD, timbrado)
│   ├── insights/              # Cards, drawers, banners del motor de insights
│   ├── pos/                   # POSTerminal, carrito, pagos, recibo
│   └── dashboard/
├── lib/
│   ├── supabase/              # Cliente browser + server
│   ├── react-query/provider.tsx
│   ├── hooks/                 # ver seccion "Hooks"
│   ├── insights/              # engine.ts + rules/ (15 reglas)
│   ├── cfdi/                  # xml-builder, finkok/, pdf-generator, cadena, sello
│   ├── config/                # modules/ (registry), banxico, finkok, sat, mexico, empresa
│   ├── permisos.ts            # Helpers de permisos
│   ├── providers/
│   └── utils/
├── store/
│   ├── uiStore.ts             # Zustand: sidebar, filtros, favoritos, selectedOrgId
│   └── posStore.ts            # Zustand: carrito POS, turno, caja, peso bascula
├── types/
│   ├── database.ts            # Tipos del schema erp
│   └── pos.ts                 # Tipos POS (Caja, Turno, ProductoPOS, ...)
└── middleware.ts              # Proteccion de rutas + auto-registro
```

## Autenticacion y Control de Acceso

### Flujos de acceso
- **Setup inicial** (`/setup`): crea el primer `super_admin` via RPC `crear_super_admin_inicial`. Solo corre una vez.
- **Login** (`/login`): Google OAuth por Supabase. Post-login redirige a `/modulos` si es `super_admin`, a `/dashboard` en otro caso.
- **Invitacion** (`/invitacion/[token]`): valida token contra `erp.usuarios_autorizados` y lanza OAuth.
- **Solicitud publica** (`/solicitar-acceso`): crea registro en `usuarios_autorizados` con estado `pendiente_registro`.
- **Auto-registro**: si un usuario autenticado no esta en `erp.usuarios` pero si en `usuarios_autorizados`, el middleware llama a `registrar_usuario_autorizado` (RPC) como fallback.

### Roles
`super_admin`, `admin_cliente`, `vendedor`, `compras`, `contador` — guardados como VARCHAR con CHECK en `erp.usuarios` y `erp.invitaciones`.

### Permisos
- `PERMISOS_DEFAULT` vive en `src/lib/config/modules/registry.ts`: matriz `rol → modulo → {ver, crear, editar, eliminar}`.
- Override por usuario en `erp.usuarios.permisos` (JSONB, `NULL` = usa defaults del rol).
- `useAuth()` provee `role`, `erpUser` (con `permisos`) y helpers.
- `usePermisos()` provee `tienePermiso(modulo, accion)` mezclando defaults + overrides.
- `erp.usuarios_autorizados.permisos` (JSONB) se propaga al registrar via RPC.

### Sidebar
- Items declaran `modulo` y se filtran por `permisos[modulo].ver`.
- Items sin `modulo` (CFDI, Admin) caen al check por `roles`.
- `AppLayout.tsx` pasa `userPermisos={erpUser?.permisos}` al `Sidebar`.

### Middleware (`src/middleware.ts`)
- Usa `getSession()` (lectura local de cookie, sin network call) en vez de `getUser()`.
- Rutas `/api/*` excluidas del matcher — las API routes no pasan por middleware.
- Rutas publicas: `/`, `/login`, `/auth/callback`, `/invitacion`, `/registro-pendiente`, `/setup`, `/solicitar-acceso`, `/solicitud-pendiente`.
- Rol extraido del JWT (`app_role`) sin query a BD.
- Si no hay rol en el JWT, consulta `erp.usuarios` una sola vez e intenta `tryAutoRegister`.
- Gates de super_admin: `/configuracion/admin` y `/admin/leads` redirigen a `/dashboard` si no lo eres.

## Arquitectura de Estado

### React Query (server state)
Toda la data del servidor pasa por React Query:

```typescript
const { data, isLoading, isError } = useProductos()
const deleteProducto = useDeleteProducto()
await deleteProducto.mutateAsync(id) // optimistic update
```

**Config default** (ver `src/lib/react-query/provider.tsx`):
- `staleTime`: 5 min
- `gcTime`: 30 min
- `refetchOnWindowFocus`: false
- `refetchOnReconnect`: always (refresca datos tras perdida de conexion)
- Reintentos: 1 con delay 1s

### Zustand (client state)
Dos stores persistidos en localStorage:

- **`uiStore`**: `sidebarCollapsed`, `recentSearches`, `tablePageSize`, `pageFilters`, `selectedOrgId` (switcher de super_admin), `reporteFavoritos`.
- **`posStore`**: carrito, `descuentoGlobal`, `cajaId`, `turnoId`, `almacenId`, `listaPrecioId`, `clienteDefaultId`, `pesoBascula`, `lastSaleData`.

**Convención de selectores**: usar selectores atómicos (`useUIStore(s => s.field)`) en vez de destructuring del store completo para evitar re-renders innecesarios. Aplicado en AppLayout, POSTerminal, POSCart, PaymentModal, OpenShiftModal, CloseShiftModal, ScaleDisplay y reportes.

## Hooks (`src/lib/hooks/`)

### No-queries
`useAuth`, `useConfiguracion`, `useDireccionesEnvio`, `useEmpresa`, `useInactivityLogout`, `useMargenesCategoria`, `useModulos`, `useOrgContext`, `usePermisos`, `usePreciosProductos`, `useScale`.

### Queries (`src/lib/hooks/queries/`)
Data: `useClientes`, `useProductos`, `useOrdenesCompra`, `useOrdenesVenta`, `useCotizaciones`, `useFacturas`, `useFacturaGlobal`, `useInventario`, `useServicios`, `useCatalogos`, `useHistorialProducto`.

POS/Dashboard/Otros: `usePOS`, `useDashboard`, `useLeads`, `useTipoCambioBanxico`, `useInsights`.

Reportes: `useReportesVentas`, `useReportesInventario`, `useReportesFinanzas`, `useReportesCompras`, `useReportesFiscal`, `useReportesPOS`, `useReportesCobranza`, `useReportesNuevos`, `useReporteOrdenes`, `useReportesHelpers`.

## Paginas Implementadas

### Operacion
| Ruta | Descripcion |
|------|-------------|
| `/dashboard` | KPIs, alertas de stock, insights resumen, POS del dia |
| `/productos` | CRUD productos (list, nuevo, [id], [id]/editar) |
| `/inventario` | Stock por almacen, niveles y movimientos |
| `/clientes` | CRUD clientes (con datos fiscales) |
| `/cotizaciones` | Lista, nueva, detalle, editar |
| `/ordenes-venta` | Lista, nueva |
| `/facturas` | Lista, detalle, editar, global (factura global) |
| `/compras` | Ordenes de compra (list, nueva, [id], [id]/recibir, [id]/editar) |
| `/insights` | Motor de alertas accionables agrupado por severidad |
| `/buscar` | Busqueda global |

### POS
| Ruta | Descripcion |
|------|-------------|
| `/pos` (route group `(pos)`) | **Terminal POS** — seleccion de caja → apertura de turno → POSTerminal |
| `/pos/cajas` | Admin de cajas registradoras |
| `/pos/cortes` | Cortes de turno / reconciliacion |
| `/pos/ventas` | Historial de ventas POS |

### Catalogos y Configuracion
| Ruta | Descripcion |
|------|-------------|
| `/catalogos/categorias` | CRUD categorias |
| `/catalogos/almacenes` | CRUD almacenes |
| `/catalogos/proveedores` | CRUD proveedores |
| `/catalogos/listas-precios` | CRUD listas de precios |
| `/catalogos/precios-productos` | Matriz precios por producto y lista |
| `/configuracion` | Ajustes generales |
| `/configuracion/usuarios` | Usuarios, roles y permisos |
| `/configuracion/cfdi` | Config Finkok, CSD, certificados |
| `/configuracion/admin` | Admin global (solo super_admin) |
| `/admin/leads` | Panel de leads de landing (solo super_admin) |
| `/modulos` | Selector de modulos post-login (super_admin) |

### Reportes (`/reportes/*`)
~45 reportes organizados por area:
- **Ventas**: `ventas-pos`, `ventas-forma-pago`, `ventas-cliente`, `ventas-vendedor`, `ventas-categoria`, `comparativo-ventas`, `conversion-cotizaciones`, `ordenes-venta`, `productos-vendidos`, `abc-clientes`, `abc-productos`.
- **Inventario**: `inventario`, `movimientos`, `rotacion-inventario`, `productos-sin-movimiento`, `valuacion-inventario`, `punto-reorden`, `conciliacion-inventario`, `margen-utilidad`, `historial-precios-compra`.
- **Finanzas**: `flujo-efectivo`, `estado-resultados`, `cartera-vencida`, `estado-cuenta-cliente`, `facturas-saldos`, `pagos-recibidos`.
- **Fiscal**: `cfdi-emitidos`, `complementos-pago`, `diot`, `reporte-iva`.
- **Compras**: `ordenes-compra`, `compras-proveedor`.
- **POS**: `cortes-caja`, `productividad-cajero`, `analisis-horarios`.
- **Otros**: `servicios`, `devoluciones-cancelaciones`.
- `/reportes/_config` contiene la configuracion compartida de reportes.

### Publicas / Auth
`/`, `/login`, `/setup`, `/invitacion/[token]`, `/solicitar-acceso`, `/solicitud-pendiente`, `/registro-pendiente`, `/auth/callback`.

## API Routes (`src/app/api/`)

| Endpoint | Proposito |
|----------|-----------|
| `auth/setup` | Verifica y crea el primer super_admin |
| `invitaciones` | Verifica y procesa tokens de invitacion |
| `solicitudes-acceso` | Recibe solicitudes publicas |
| `cfdi/timbrar` | Timbra CFDI via Finkok `sign_stamp` |
| `cfdi/status` | Consulta estado de timbrado |
| `cfdi/cancelar` | Cancela CFDI timbrado |
| `cfdi/complemento-pago` | Agrega complemento de pago |
| `cfdi/preview` | Genera XML sin firma (preview) |
| `cfdi/reintentar` | Reintento de timbrado fallido |
| `cfdi/clientes-finkok` | Lista RFCs registrados en Finkok |
| `cfdi/clientes-prueba` | Emisores demo |
| `cfdi/csd` | Carga/actualiza CSD (cer + key) |
| `tipo-cambio/hoy` | Tipo de cambio USD→MXN (Banxico) |
| `leads/demo` | Captura de leads (publico) |
| `pagos` | Registro/conciliacion de pagos |
| `admin/reiniciar-sistema` | Reset del sistema (solo super_admin) |

## CFDI 4.0 via Finkok

**Metodo**: `sign_stamp` — Finkok firma y timbra en una sola llamada. No hay manejo de llaves en local mas alla de cargar el CSD al PAC.

**Archivos clave** (`src/lib/cfdi/`):
- `xml-builder.ts` — genera XML CFDI sin firma (`generarPreCFDI`)
- `finkok/stamp.ts` — llamada `signStamp` via SOAP
- `finkok/cancel.ts` — cancelacion
- `finkok/registration.ts` — registro de RFC y carga de CSD
- `finkok/csd-utils.ts` — parseo de .cer y .key
- `cadena-original.ts`, `sello.ts` — fallback (Finkok normalmente se encarga)
- `pago-builder.ts` — complemento de pago 2.0
- `pdf-generator.ts` — PDF con jsPDF + autotable
- `error-catalog.ts` — traduccion de errores SAT/Finkok
- `types.ts` — `DatosFacturaCFDI`, `ItemFacturaCFDI`, etc.

Guia de integracion: `docs/CFDI-FINKOK-GUIA.md`, `docs/finkok-registration.md`.

## Motor de Insights

Motor configurable de alertas que corre sobre datos del ERP.

**Estructura** (`src/lib/insights/`):
- `types.ts` — `InsightItem`, `InsightRule`, `InsightEstadoDB`, `InsightSharedCache`
- `engine.ts` — pre-carga cache compartido (~4 queries), evalua reglas en paralelo, ordena por severidad
- `rules/` — 15 reglas (4 ya migradas a usar cache compartido):

**Cache compartido** (`InsightSharedCache`): El engine pre-carga datos de facturas (90d), ventas POS (90d), productos stock y movimientos (90d) en ~4 queries paralelas. Las reglas reciben estos datos en `ctx.cache` y los filtran en memoria en vez de hacer queries propias. Reglas migradas: `cartera-vencida`, `cliente-perdiendo-volumen`, `vendedor-bajo-rendimiento`, `abc-cliente-degradandose`. Las restantes tienen fallback a query directa.

**Reglas**:
  1. `punto-reorden` — stock bajo punto de reorden
  2. `capital-retenido` — exceso de capital en inventario
  3. `cotizaciones-estancadas` — cotizaciones sin convertir
  4. `cartera-vencida` — cuentas por cobrar vencidas
  5. `cliente-perdiendo-volumen` — caida de compras de cliente
  6. `sobre-stock` — sobre-stock por categoria
  7. `categoria-declive` — caida en ventas por categoria
  8. `vendedor-bajo-rendimiento` — vendedor bajo meta
  9. `margen-negativo` — productos con margen negativo
  10. `ticket-promedio-pos` — caida de ticket promedio POS
  11. `rotacion-anormal` — anomalia en rotacion
  12. `producto-estrella-cayendo` — top product con caida
  13. `flujo-efectivo-riesgo` — riesgo de flujo de efectivo
  14. `abc-cliente-degradandose` — cliente degradando su rango ABC
  15. `horarios-oportunidad-pos` — oportunidades en horas valle

Severidades: `critico` (rojo), `alerta` (naranja), `info` (azul), `oportunidad` (verde).
Tipos: `inventario`, `ventas`, `cobranza`, `finanzas`, `pos`.

## Flujo Principal: Cotizacion → Factura → CFDI

1. **Nueva cotizacion** (`/cotizaciones/nueva`)
   - Seleccionar cliente (carga su lista de precios y datos fiscales)
   - Seleccionar almacen
   - Buscar/agregar productos, descuentos
   - Guardar como borrador o enviar

2. **Convertir a factura** — RPC `erp.cotizacion_a_factura(uuid)`
   - Crea la factura con datos fiscales del cliente
   - Copia items
   - Descuenta inventario y registra movimientos
   - Actualiza saldo del cliente

3. **Timbrar CFDI** — `POST /api/cfdi/timbrar`
   - Genera XML con `xml-builder.ts`
   - Envia a Finkok `sign_stamp`
   - Guarda UUID, XML timbrado y PDF

## Estructura del Schema ERP

### Catalogos
| Tabla | Descripcion |
|-------|-------------|
| `erp.categorias` | Categorias de productos |
| `erp.almacenes` | Almacenes / ubicaciones |
| `erp.listas_precios` | Listas de precios |
| `erp.proveedores` | Proveedores |

### Productos e Inventario
| Tabla | Descripcion |
|-------|-------------|
| `erp.productos` | Productos (SKU, precio, categoria) |
| `erp.precios_productos` | Precios por producto y lista |
| `erp.historial_precios` | Historial de cambios de precio |
| `erp.inventario` | Stock por producto y almacen |
| `erp.movimientos_inventario` | Entradas / salidas |

### Clientes y usuarios
| Tabla | Descripcion |
|-------|-------------|
| `erp.clientes` | Clientes con datos fiscales MX |
| `erp.usuarios` | Usuarios del ERP con `rol` y `permisos` JSONB |
| `erp.usuarios_autorizados` | Whitelist de invitados / solicitudes |
| `erp.invitaciones` | Invitaciones emitidas |

### Ventas
| Tabla | Descripcion |
|-------|-------------|
| `erp.cotizaciones` / `cotizacion_items` | Cotizaciones |
| `erp.ordenes_venta` | Ordenes de venta |
| `erp.facturas` / `factura_items` | Facturas |
| `erp.pagos` | Pagos a facturas |
| `erp.cfdi_*` | Datos de timbrado CFDI |

### Compras
| Tabla | Descripcion |
|-------|-------------|
| `erp.ordenes_compra` / `items` | Ordenes de compra y recepciones |

### POS
| Tabla | Descripcion |
|-------|-------------|
| `erp.cajas` | Cajas registradoras |
| `erp.turnos` | Turnos de caja (apertura/corte) |
| `erp.pos_ventas` | Ventas POS |
| `erp.pos_venta_items` | Items de venta POS |

### Insights
| Tabla | Descripcion |
|-------|-------------|
| `erp.insights_estado` | Persistencia de dismissals por usuario |

## Funciones Principales (RPCs)

- `erp.generar_folio(tipo VARCHAR)` → folios automaticos (`COT-`, `FAC-`, `PAG-`, etc.)
- `erp.cotizacion_a_factura(cotizacion_id UUID)` → convierte cotizacion a factura (items, inventario, saldo)
- `erp.recalcular_totales_cotizacion(uuid)` / `erp.recalcular_totales_factura(uuid)`
- `erp.crear_super_admin_inicial(...)` → setup inicial
- `erp.registrar_usuario_autorizado(p_auth_user_id, p_email, p_nombre, p_avatar_url)` → registra usuario desde whitelist

> **Importante**: las RPCs tienen wrappers en `public.*`. Al modificar una hay que actualizar ambos. Al cambiar tipos de retorno, hacer `DROP` + `CREATE` (no `CREATE OR REPLACE`).

## Triggers Automaticos

| Trigger | Descripcion |
|---------|-------------|
| `trg_*_updated_at` | Actualiza `updated_at` en cada UPDATE |
| `trg_historial_precios` | Registra cambios de precios automaticamente |
| `trg_cotizacion_item_subtotal` | Calcula subtotal de items de cotizacion |
| `trg_factura_item_subtotal` | Calcula subtotal de items de factura |
| `trg_registrar_pago` | Actualiza factura y saldo del cliente |

## Datos Fiscales Mexico

### Regimenes Fiscales (SAT)
- `601` — General de Ley Personas Morales
- `603` — Personas Morales con Fines no Lucrativos
- `612` — Personas Fisicas con Actividades Empresariales
- `616` — Sin obligaciones fiscales

### Usos CFDI
- `G01` — Adquisicion de mercancias
- `G03` — Gastos en general
- `P01` — Por definir
- `S01` — Sin efectos fiscales

### Complemento de pago
Se genera con `src/lib/cfdi/pago-builder.ts` y se timbra en `/api/cfdi/complemento-pago`.

## Convenciones de Codigo

### Backend (SQL)
- Tablas y columnas: `snake_case` en espanol
- PKs: `UUID` con `gen_random_uuid()`
- Timestamps: `created_at` y `updated_at` en todas las tablas
- Soft delete: `is_active` en lugar de borrar
- Moneda por defecto: MXN
- Roles: VARCHAR con CHECK constraints

### Frontend (TypeScript)
- Componentes: `PascalCase` (`ProductoTable.tsx`)
- Hooks: `camelCase` con prefijo `use` (`useProductos.ts`)
- Tipos: `PascalCase` (`Producto`, `Cliente`)
- Paginas: `page.tsx` (App Router)

### Performance (convenciones establecidas)
- **Supabase queries**: usar `.select('col1, col2')` con columnas explicitas, nunca `.select('*')`. Siempre incluir `.limit()` en queries de listado.
- **Queries en API routes**: paralelizar con `Promise.all()` cuando las queries son independientes.
- **Zustand**: usar selectores atomicos (`useStore(s => s.field)`) en vez de destructuring completo.
- **Dynamic imports**: librerias pesadas (jsPDF, exceljs) se importan con `await import()` dentro de la funcion que las usa.
- **console.log**: envolver en `if (process.env.NODE_ENV === 'development')` o eliminar. No dejar logs en codigo de produccion.
- **React Query invalidation**: invalidar query keys especificos, no usar `posKeys.all` u otros keys demasiado amplios.
- **Theme AntD**: definido como constante `ANTD_THEME` fuera del componente en `layout.tsx`, no inline.

## Scripts de Importacion (`scripts/`)

Pipeline de importacion de datos "mascotienda" (tienda de mascotas) para demo:
- `mascotienda_productos.csv` — catalogo (~650 productos)
- `import_mascotienda_productos.py` — batch POST a Supabase REST
- `gen_plpgsql_import.py` / `gen_csv.py` — generadores
- `block_01.sql` .. `block_20.sql` / `mini_*.sql` / `group_*.sql` — SQL troceado para ejecutar por partes
- `all_blocks.sql` — consolidado

## Uso de herramientas Supabase (notas operativas)

- `mcp__supabase__apply_migration` → DDL
- `mcp__supabase__execute_sql` → queries y RPCs
- `Divider` de Ant Design v5: el prop `orientation` puede no aceptar `"left"` como tipo — usar sin `orientation` o castear

## Estado del Proyecto

### Implementado
- [x] Frontend Next.js 14 + AntD 5 + React Query + Zustand
- [x] Auth completo con Google OAuth, invitaciones, setup inicial y auto-registro
- [x] Middleware con proteccion de rutas y extraccion de rol desde JWT
- [x] Control de acceso por rol + permisos JSONB por usuario
- [x] Dashboard con KPIs, alertas e insights resumen
- [x] CRUD de productos, clientes, cotizaciones, ordenes de venta, facturas, compras
- [x] Catalogos completos (categorias, almacenes, proveedores, listas de precios, precios-productos)
- [x] POS con terminal (`(pos)/pos`), cajas, turnos, cortes y ventas
- [x] ~45 reportes (ventas, inventario, finanzas, fiscal, compras, POS)
- [x] Motor de insights con 15 reglas y persistencia de dismissals
- [x] Timbrado CFDI 4.0 via Finkok (`sign_stamp`) incluyendo cancelacion y complemento de pago
- [x] Generacion de PDF (jsPDF) y Excel (exceljs) en reportes y documentos
- [x] Landing publica con formulario de leads
- [x] Multi-org con switcher para super_admin (`selectedOrgId` en `uiStore`)
- [x] PWA (manifest + icons)

### Pendiente / mejoras
- [ ] RLS endurecido end-to-end para multi-tenant
- [ ] Tests automatizados (unit / e2e)
- [ ] Migrar paginas criticas a Server Components con HydrationBoundary (dashboard, productos, clientes)
- [ ] Migrar las 11 reglas de insights restantes al cache compartido
- [ ] Reemplazar `select('*')` restantes (~60 instancias) por columnas explicitas
- [ ] Crear RPCs para reportes pesados (ABC, estado de resultados) que hagan agregacion en PostgreSQL
- [ ] Virtualización de tablas grandes con `<Table virtual />`
- [ ] Busqueda global: consolidar 6 queries en una RPC `erp.busqueda_global()`
