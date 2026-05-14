# 04 — Diagnóstico de Cartera (foto a mayo 2026)

> ⚠️ **Archivo perecedero**: refleja el estado de la cartera al 13-may-2026. Los nombres y montos cambian rápido. La estructura del análisis (cómo segmentar, qué medir) sí es reutilizable.
> Para datos vivos consultar el ERP: `/reportes/cartera-vencida`, `/reportes/abc-clientes`, `/reportes/punto-reorden`.

## Contexto

- Solo **77 días de historia transaccional** en el ERP al 13-may-2026 (primera factura: 26-feb-2026).
- 151 productos activos, 36 clientes, 62 facturas, 0 ventas POS — el negocio es **100% B2B vía facturación**.
- "Últimos 90 días" ≈ historia completa de la empresa en el ERP.
- "Cuenta dormida >45 días" ≈ "cliente que solo compró una vez y no regresó".

## Hallazgo principal

**El negocio NO tiene problema de venta — tiene problema de cobranza.**

- $1,391,766 MXN saldo total
- **$860,158 MXN saldo VENCIDO (>30 días)** = 62% del total
- $282,396 MXN crítico (>60 días desde factura)
- 9 de 10 top clientes traen saldo = 100% de su volumen facturado
- Solo 1 cliente top (GAS VULCANO) tiene saldo $0

## Top 10 productos vendidos 90d (por ingreso)

| # | SKU | Producto | Unid | Clientes | Ingreso |
|---|-----|----------|-----:|---------:|--------:|
| 1 | GP-MT-EG-QE | Módulo Transductor Encoder QE | 36 | **10** | $198,523 |
| 2 | GP-AC-3G-M | Comunicaciones 3G en Módulo | 22 | 7 | $177,934 |
| 3 | GP-MU-KN-PLUS | CPU Versión KN Plus | 23 | 5 | $124,705 |
| 4 | G4-ED-C1__-P1X | Equipo Dispensario Simple | 1 | 1 | $108,045 |
| 5 | GP-RN-TP | Teclado Panel Gas-PAR | 37 | 5 | $89,383 |
| 6 | GP-MX-CF-PLUS | Interconexión c/Fuente Plus | 16 | 6 | $74,738 |
| 7 | G4-EA-FPNP-2 | Equipo Autotanque NP | 2 | 1 | $70,236 |
| 8 | G4-EC-FPMGN1-2 | Equipo Carburación Brida NP 1" | 2 | 1 | $68,906 |
| 9 | GP-RD-C2 | Display Cuarzo 20×4 | 52 | 6 | $50,541 |
| 10 | GP-MI-TH | Impresora Térmica | 16 | 5 | $47,145 |

**Anchor del catálogo**: GP-MT-EG-QE (Encoder QE) le vende a 10 de 19 clientes activos del trimestre. Si se agota, se cae la conversación con todos.

## Top 10 clientes 90d (por volumen)

| # | Cliente | $ Volumen | # Fac | Últ. compra | Días | Saldo pendiente |
|---|---------|----------:|------:|-------------|-----:|----------------:|
| 1 | DISTRIBUIDORA DE GAS NOEL | $291,578 | 18 | hoy | 0 | $150,766 |
| 2 | GAS SILZA | $280,797 | 6 | 23-abr | 20 | **$280,797 (100%)** |
| 3 | HIDROGAS DE AGUA PRIETA | $252,108 | 5 | 29-abr | 14 | **$252,108 (100%)** |
| 4 | GASES RODRIGUEZ DEL NORESTE | $203,604 | 9 | 23-abr | 20 | **$203,604 (100%)** |
| 5 | GAS EL SOBRANTE | $173,556 | 2 | 24-mar | **50 (DORMIDO)** | $173,556 |
| 6 | GENERADORES DE ENERGIA NOROESTE | $87,269 | 2 | 21-abr | 22 | $87,269 |
| 7 | DAMIGAS | $66,773 | 3 | 8-abr | 35 | $66,773 |
| 8 | VENDOGAS | $62,391 | 1 | 9-mar | **65 (CRÍTICO)** | $62,391 |
| 9 | TABAGAS | $58,357 | 9 | 8-abr | 35 | $58,357 |
| 10 | GAS VULCANO | $13,910 | 1 | 7-may | 6 | **$0 ✅** |

## Cuentas dormidas (≥30 días sin comprar)

| Cliente | Días | Compras hist | Volumen | Contacto | Notas |
|---------|-----:|-------------:|--------:|----------|-------|
| TABAGAS | 35 | 9 | $58,357 | Lic. Ana María López | Era cuenta semanal (c/3.8 días) |
| DAMIGAS | 35 | 3 | $66,773 | Ana María López | c/7.5 días |
| VENDO GAS DEL PACIFICO | 50 | 1 | $8,672 | Lic. Ana María López | 1 sola compra |
| GAS EL SOBRANTE | 50 | 2 | $173,556 | Ing. Manuel Prieto | Ticket alto ($86K prom) |
| VENDOGAS | 65 | 1 | $62,391 | Lic. Ana María López | Crítico |

**Patrón clave**: 4 de 5 cuentas dormidas tienen contacto "Lic. Ana María López" — es **compradora de un grupo de empresas (mismo dueño)**. Es **cuenta de otro vendedor**, NO trabajable directamente desde Poncho. Coordinar con quien la lleve, no contactar en frío.

## Stock crítico (urgencia abasto)

🔴 **Agotados sin OC** (riesgo de perder venta):
- GP-RF-A1/2 — Fusible 1/2 A
- G4-EA-FPNP-2 — Equipo Autotanque (bajo pedido, 15d entrega)
- G4-EC-FPMGN1-2 — Equipo Carburación (bajo pedido, 15d entrega)
- GP-AC-3G-C, GP-RC-32, GP-RC-15, GP-R-FP-P22A

🟠 **Cobertura <30 días** (OC ya enviada):
- **GP-MT-EG-QE** — 7.5 días de cobertura ⚠️ anchor del catálogo
- GP-MD-VL — 18 días
- GP-MD-VTA2 — 20 días
- GP-AL-GS — 25 días

## Cross-sell: matriz top10 clientes × top10 productos

Patrón identificado: **HIDROGAS, DGN compran 7-8 de 10**. **GAS RODRIGUEZ, DAMIGAS, VENDOGAS, GAS EL SOBRANTE compran refacciones pero NO módulos principales** — están comprando módulos a la competencia (1-2 fabricantes confirmados en MX).

## Aging de cartera

| Bucket | $ Saldo | % | Comentario |
|--------|--------:|---:|-----------|
| Vigente (≤30d) | $531,608 | 38% | Bajo política, no presionar |
| Vencido 1–30d | $577,762 | 42% | Cobrar esta semana |
| Vencido 31–60d | $282,396 | 20% | Crítico — escalar a dirección |

## Aprendizaje estructural (no perecedero)

1. **No surtir pedido > $20K si cliente tiene vencido > 60 días** — política operativa sugerida.
2. **Coordinar con vendedor del grupo Ana María López** antes de contactar a TABAGAS, DAMIGAS, VENDOGAS, VENDO GAS DEL PACIFICO.
3. **Anchor del catálogo (Encoder QE)** debe tener siempre OC en tránsito; si se agota, todo el pipeline tropieza.
4. **Equipos G4 son bajo pedido** (15 días entrega) → cotización + anticipo, NO promesa de stock.
5. **Cliente con saldo $0** (Vulcano) es semilla de la próxima cohorte — proteger y cultivar.
