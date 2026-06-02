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
