# CUANTY ERP - Sistema de Inventario, Ventas y Finanzas

## Descripcion del Proyecto

ERP simplificado que reemplaza NetSuite, enfocado en ser mas intuitivo y funcional.
Desarrollado para gestionar inventario, cotizaciones, facturas y finanzas con soporte para datos fiscales mexicanos.

## Stack Tecnologico

### Backend
- **Base de datos**: Supabase (PostgreSQL)
- **Schema**: `erp` (separado del schema `public`)
- **Autenticacion**: Supabase Auth (pendiente de implementar)

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: Ant Design 5
- **Language**: TypeScript
- **State**: React Query + Zustand
- **PWA**: Soporte para instalacion como app

## Configuracion de Supabase (IMPORTANTE)

### 1. Exponer Schema en API

En Supabase Dashboard → Settings → API → Exposed schemas:
- Agregar `erp` a la lista de schemas expuestos

### 2. Permisos del Schema (REQUERIDO)

Ejecutar en SQL Editor para que el frontend pueda acceder a los datos:

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

> **Nota**: Sin estos permisos, el frontend mostrara error `42501: permission denied for schema erp`

### 3. Variables de Entorno

Crear archivo `.env.local` en la raiz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xuvxtwdlbqomjyeyeugy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Build de produccion
npm run build

# Iniciar produccion
npm start
```

## Estructura del Frontend

```
src/
├── app/
│   ├── (dashboard)/           # Paginas con layout de sidebar
│   │   ├── page.tsx           # Dashboard principal
│   │   ├── productos/         # CRUD productos
│   │   ├── inventario/        # Control de stock
│   │   ├── clientes/          # CRUD clientes
│   │   ├── cotizaciones/      # Gestion cotizaciones
│   │   ├── facturas/          # Gestion facturas
│   │   └── catalogos/         # Almacenes, categorias, etc.
│   ├── layout.tsx             # Layout raiz con Ant Design
│   └── globals.css
├── components/
│   ├── layout/                # AppLayout, Sidebar
│   ├── productos/
│   ├── clientes/
│   ├── cotizaciones/
│   └── common/
├── lib/
│   ├── supabase/              # Cliente Supabase
│   ├── hooks/                 # Custom hooks
│   └── utils/                 # Utilidades (formateo, etc.)
├── store/                     # Estado global (Zustand)
└── types/
    └── database.ts            # Tipos TypeScript del schema
```

## Paginas Implementadas

| Ruta | Descripcion |
|------|-------------|
| `/` | Dashboard con estadisticas y alertas |
| `/productos` | Lista de productos con stock |
| `/inventario` | Stock por almacen con filtros |
| `/clientes` | Lista de clientes con saldos |
| `/cotizaciones` | Lista de cotizaciones |
| `/cotizaciones/nueva` | Crear nueva cotizacion |
| `/facturas` | Lista de facturas con saldos |
| `/catalogos/almacenes` | CRUD de almacenes |

## Flujo Principal: Cotizacion a Factura

1. **Nueva Cotizacion** (`/cotizaciones/nueva`)
   - Seleccionar cliente (carga su lista de precios)
   - Seleccionar almacen
   - Buscar y agregar productos
   - Aplicar descuentos
   - Guardar como borrador o enviar

2. **Convertir a Factura** (desde detalle de cotizacion)
   - Llama a `erp.cotizacion_a_factura()`
   - Automaticamente descuenta inventario
   - Actualiza saldo del cliente

---

## Estructura del Schema ERP

### Catalogos
| Tabla | Descripcion |
|-------|-------------|
| `erp.categorias` | Categorias de productos (con subcategorias) |
| `erp.almacenes` | Almacenes/ubicaciones de inventario |
| `erp.listas_precios` | Listas de precios (Publico, Mayoreo, Distribuidor) |
| `erp.proveedores` | Proveedores con datos fiscales |

### Productos e Inventario
| Tabla | Descripcion |
|-------|-------------|
| `erp.productos` | Catalogo de productos con SKU |
| `erp.precios_productos` | Precios por producto y lista |
| `erp.historial_precios` | Historial de cambios de precios |
| `erp.inventario` | Stock por producto y almacen |
| `erp.movimientos_inventario` | Historial de entradas/salidas |

### Clientes
| Tabla | Descripcion |
|-------|-------------|
| `erp.clientes` | Clientes con datos fiscales MX (RFC, regimen, uso CFDI) |

### Ventas
| Tabla | Descripcion |
|-------|-------------|
| `erp.cotizaciones` | Cotizaciones |
| `erp.cotizacion_items` | Lineas de cotizacion |
| `erp.facturas` | Facturas |
| `erp.factura_items` | Lineas de factura |
| `erp.pagos` | Pagos a facturas |

## Vistas Disponibles

| Vista | Descripcion |
|-------|-------------|
| `erp.v_productos_stock` | Productos con stock total por almacen |
| `erp.v_productos_precios` | Productos con precios por lista |
| `erp.v_inventario_detalle` | Inventario detallado con nivel de stock |
| `erp.v_cotizaciones` | Cotizaciones con datos de cliente |
| `erp.v_facturas` | Facturas con saldos y dias vencidas |
| `erp.v_clientes` | Clientes con estado de credito |
| `erp.v_movimientos` | Movimientos de inventario |
| `erp.v_resumen_ventas` | Resumen de ventas por periodo |

## Funciones Principales

### `erp.generar_folio(tipo VARCHAR)`
Genera folios automaticos para cotizaciones, facturas y pagos.
```sql
SELECT erp.generar_folio('cotizacion'); -- COT-00001
SELECT erp.generar_folio('factura');    -- FAC-00001
SELECT erp.generar_folio('pago');       -- PAG-00001
```

### `erp.cotizacion_a_factura(cotizacion_id UUID)`
Convierte una cotizacion a factura. **Automaticamente**:
1. Crea la factura con datos fiscales del cliente
2. Copia todos los items
3. Descuenta el inventario del almacen
4. Registra los movimientos de inventario
5. Actualiza el saldo pendiente del cliente

```sql
SELECT erp.cotizacion_a_factura('uuid-de-cotizacion');
```

### `erp.recalcular_totales_cotizacion(cotizacion_id UUID)`
Recalcula subtotal, IVA y total de una cotizacion.

### `erp.recalcular_totales_factura(factura_id UUID)`
Recalcula subtotal, IVA, total y saldo de una factura.

## Triggers Automaticos

| Trigger | Descripcion |
|---------|-------------|
| `trg_*_updated_at` | Actualiza `updated_at` en cada UPDATE |
| `trg_historial_precios` | Registra cambios de precios automaticamente |
| `trg_cotizacion_item_subtotal` | Calcula subtotal de items de cotizacion |
| `trg_factura_item_subtotal` | Calcula subtotal de items de factura |
| `trg_registrar_pago` | Actualiza factura y saldo del cliente al registrar pago |

## Datos Fiscales Mexico

### Regimenes Fiscales (SAT)
- `601` - General de Ley Personas Morales
- `603` - Personas Morales con Fines no Lucrativos
- `612` - Personas Fisicas con Actividades Empresariales
- `616` - Sin obligaciones fiscales

### Usos CFDI
- `G01` - Adquisicion de mercancias
- `G03` - Gastos en general
- `P01` - Por definir
- `S01` - Sin efectos fiscales

## Convenciones de Codigo

### Backend (SQL)
- **Nombres de tablas**: snake_case en espanol (`cotizacion_items`)
- **Nombres de columnas**: snake_case (`fecha_vencimiento`)
- **UUIDs**: Para todas las PKs (`gen_random_uuid()`)
- **Timestamps**: `created_at` y `updated_at` en todas las tablas
- **Soft delete**: Usar `is_active` en lugar de eliminar registros
- **Moneda**: Todos los montos en MXN por defecto

### Frontend (TypeScript)
- **Componentes**: PascalCase (`ProductoTable.tsx`)
- **Hooks**: camelCase con prefijo `use` (`useProductos.ts`)
- **Tipos**: PascalCase (`Producto`, `Cliente`)
- **Archivos de pagina**: `page.tsx` (Next.js App Router)

## Datos de Prueba Incluidos

- **5 Almacenes**: Central (CDMX), Norte (Monterrey), Sur (Guadalajara), Tijuana, Merida
- **5 Categorias**: Electronicos, Perifericos, Cables, Almacenamiento, Accesorios
- **3 Listas de Precios**: Publico, Mayoreo (-15%), Distribuidor (-25%)
- **3 Proveedores**: TechDist, ImportDigital, MayoreoElec
- **10 Productos**: Laptops, monitores, perifericos, cables, accesorios
- **3 Clientes**: Comercial ABC, Distribuidora XYZ, Publico en General
- **Inventario inicial**: 50 unidades en Central, distribuido en otros almacenes

## Proximos Pasos

### Completados
- [x] Crear frontend con Next.js/React
- [x] Dashboard con estadisticas
- [x] Pagina de productos con tabla y filtros
- [x] Pagina de inventario por almacen
- [x] Pagina de clientes con saldos
- [x] Pagina de cotizaciones con status
- [x] Formulario de nueva cotizacion (flujo completo)
- [x] Pagina de facturas con vencimientos
- [x] CRUD de almacenes

### Pendientes
- [ ] Paginas de detalle y edicion de productos
- [ ] Paginas de detalle y edicion de clientes
- [ ] Pagina de detalle de cotizacion con boton "Convertir a Factura"
- [ ] Pagina de detalle de factura con registro de pagos
- [ ] CRUD de categorias, proveedores, listas de precios
- [ ] Generacion de PDF para cotizaciones y facturas
- [ ] Implementar autenticacion con Supabase Auth
- [ ] Implementar RLS (Row Level Security) para multi-tenant
- [ ] Integracion con SAT para timbrado CFDI (opcional)
