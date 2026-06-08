# Pendientes — Generador de OC Automáticas

Mejoras detectadas en investigación del 02-jun-2026. **El algoritmo actual
funciona bien** para la lógica básica de min/max + OV + OC. Estos pendientes
son mejoras opcionales para casos avanzados.

## Diagnóstico de lo que SÍ funciona hoy

| Componente | Estado |
|------------|--------|
| Considera físico real (`erp.inventario`) | ✅ |
| Considera en tránsito (OCs `enviada` o `parcialmente_recibida`) | ✅ |
| Considera reservado (OVs en `orden_venta`) | ✅ |
| Respeta `stock_minimo` y `stock_maximo` por producto | ✅ |
| Excluye servicios | ✅ |
| Excluye productos sin proveedor (sin avisar — ver pendiente B) | ⚠️ |
| Considera velocidad de consumo histórica | ❌ (ver pendiente A) |
| Considera cotizaciones en `propuesta` (no `orden_venta`) | ❌ |

## Pendiente A — Mejora del algoritmo con velocidad de consumo

**Problema**: si un producto tiene `stock_maximo` mal calibrado (muy bajo vs
velocidad real), no se sugiere reorden aunque la cobertura proyectada sea
corta.

**Caso real detectado** (al 02-jun-2026):

| SKU | Vendidos 90d | Proyectado | Cobertura | stock_max actual | stock_max recomendado |
|---|---:|---:|---:|---:|---:|
| GP-MT-EG-QE (Encoder QE, anchor) | 42 | 13 | ~28 días | 10 | 15-20 |
| GP-RD-C2 Display Cuarzo | 60 | 18 | ~27 días | 10 | 25-30 |
| GP-RN-TP Teclado Panel | 43 | 10 | ~21 días | 10 | 18-22 |
| GP-MI-TH Impresora Térmica | 17 | 5 | ~26 días | 5 | 8-10 |
| GP-MX-CF-PLUS Interconexión Plus | 19 | 5 | ~24 días | 5 | 8-10 |

**Solución propuesta**:
Agregar al generador un criterio adicional: si la cobertura proyectada (días)
es menor al `lead_time_proveedor + buffer_dias`, sugerir reorden hasta
alcanzar la cobertura objetivo.

- Lead time default: 15 días
- Buffer default: 15 días
- Toggle en `/configuracion/sistema` para activar/desactivar y ajustar parámetros

**Esfuerzo estimado**: 2-3 horas.

## Pendiente B — Aviso visual en `/compras/nueva`

**Problema**: los productos descartados silenciosamente (sin proveedor, sin
movimiento, o con proyectado > máximo pero velocidad alta) no se muestran.

**Solución propuesta**:
Alert amarillo arriba del listado:
*"Hay N productos con consumo alto que no aparecieron en sugerencias
automáticas. [Ver lista]"*

Click → muestra tabla con los descartados y razón.

**Esfuerzo estimado**: 30 min.

## Pendiente C — Considerar cotizaciones en `propuesta` con alta probabilidad

**Problema**: el algoritmo solo cuenta como reservado las cotizaciones
convertidas a OV (`status = 'orden_venta'`). Las propuestas con alta
probabilidad de cierre podrían generar demanda futura no contemplada.

**Solución propuesta**:
Sumar al reservado las cotizaciones en `propuesta` que tengan
`probabilidad >= X%` (configurable, default 70%), ponderadas por su
probabilidad.

**Esfuerzo estimado**: 1 hora.

## Acciones operativas (sin código)

### Asignar proveedor a 9 productos huérfanos

Productos sin `proveedor_principal_id` que quedan fuera del generador:

- GP-RC-13M — Refacción Cable BUS 13M
- GP-RB-CRI — Bisel con Cristal
- GP-RC-IC-13M — Cable Impresora Carburación 13m
- GP-RC-IC-6M — Cable Impresora Carburación 6m
- GP-RP-BX2-MM — Panel Doble Display
- TM-U295 — EPSON TMU-295
- TM-T88VII — EPSON TM-T88VII
- SRP-330IIISK — BIXOLON 3 pulgadas
- GP-GENERICO — Genérico GASPAR

### Calibrar stock_maximo de los 5 SKUs críticos

Ver tabla del Pendiente A para valores sugeridos.

---

## Tareas operativas pendientes — Conversiones y guía (snapshot 03-jun-2026)

### Conversión COT-06229 → OV → Factura

- **Cliente**: SUPER DE GDL
- **Total**: $5,693.59 (1 item)
- **Item**: 1× GP-MX-CF-PLUS (Interconexión Plus)
- **Stock check**: físico 3 → queda 2 ✓ se puede facturar sin problema
- **Acción**: ejecutar `cotizacion_a_orden_venta(uuid)` → luego `cotizacion_a_factura(uuid)`

### OV-00100 → Factura

- **Cliente**: DGN (Distribuidora de Gas Noel)
- **Total**: $1,856.07 (2 items: 1× GP-MVAAT + 1× SER-ENV)
- **Stock check**: físico 1 → queda 0 ✓ se puede facturar
- **Acción**: ejecutar `cotizacion_a_factura(uuid)`

### OV-00101 → Factura — ⚠️ BLOQUEADA POR STOCK

- **Cliente**: DGN
- **Total**: $13,339.86 (2 items: 2× GP-MT-EG-QE + 1× SER-ENV)
- **Stock check**: GP-MT-EG-QE pedido 2, físico 1 → al facturar quedaría -1
- **Bloqueo**: el trigger `trg_inventario_no_negativa` rechazará el descuento porque profundiza el negativo
- **Opciones para resolver antes de facturar**:
  1. Reducir cantidad de Encoder QE en la OV de 2 a 1 (facturar parcial)
  2. Esperar recepción de OC con Encoder QE (revisar OC-00111 / OC-00112 que están en tránsito)
  3. Cancelar OV-00101 y crear nueva con la cantidad real disponible

### Guía conjunta OV-00100 + OV-00101

- Crear una sola guía en `/envios` que asocie las 2 facturas resultantes
- El usuario va a armarla manualmente desde el ERP cuando facture
- No se hace por SQL — usar la UI

---

## Diagnóstico OCs al 03-jun-2026 (referencia, no acción)

**Sin inconsistencias detectadas**: ninguna OC con `pendiente=0` quedó con status incorrecto. Todas las recibidas físicamente están marcadas correctamente.

**En tránsito** (61 + 18 piezas SICOM por llegar):
- OC-00111 (15-may): 1 item, 18 piezas, $160K — totalmente pendiente
- OC-00112 (19-may): 12 items, 61 piezas, $196K — totalmente pendiente

**Parcialmente recibidas**:
- OC-00109 (06-may): falta 3 piezas (casi cierra)
- OC-00110 (14-may): falta 38 piezas
- OC-00113 (21-may): falta 1 pieza

Verificar manualmente si alguna de estas (especialmente OC-00112) trae Encoder QE para destrabar OV-00101.
